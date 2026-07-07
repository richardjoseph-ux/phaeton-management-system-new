import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const isAuthenticated = await base44.auth.isAuthenticated();
    if (!isAuthenticated) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const base44Admin = base44.asServiceRole;
    const subcontractors = await base44Admin.entities.Subcontractor.list('-created_date', 500);
    const existingAlerts = await base44Admin.entities.Alert.filter({ type: 'InsuranceRenewal', status: 'unread' });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const NOTIFY_DAYS_BEFORE = 30;

    let created = 0;

    for (const sub of subcontractors) {
      if (!sub.is_insured || !sub.insurance_start_date || sub.status === 'Inactive') continue;

      const startDate = new Date(sub.insurance_start_date);

      // Calculate Q1-Q4 due dates (every 3 months from start date)
      for (let q = 1; q <= 4; q++) {
        const dueDate = new Date(startDate);
        dueDate.setMonth(dueDate.getMonth() + (q * 3));

        const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        // Only notify if due within 30 days and not already expired
        if (daysUntilDue < 0 || daysUntilDue > NOTIFY_DAYS_BEFORE) continue;

        const dueDateStr = dueDate.toISOString().split('T')[0];
        const quarterLabel = `Q${q}`;

        // Check if alert already exists for this subcontractor + due date
        const alreadyExists = existingAlerts.some(
          a => a.subcontractor_id === sub.id && a.due_date === dueDateStr
        );
        if (alreadyExists) continue;

        const daysText = daysUntilDue === 0 ? 'today' : `in ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'}`;
        await base44Admin.entities.Alert.create({
          type: 'InsuranceRenewal',
          status: 'unread',
          subcontractor_id: sub.id,
          plate_number: sub.plate_number,
          owner_name: sub.owner_name,
          due_date: dueDateStr,
          quarter_label: quarterLabel,
          message: `${quarterLabel} insurance renewal for ${sub.plate_number} (${sub.owner_name}) is due ${daysText} — ${dueDateStr}`,
        });
        created++;
      }
    }

    return Response.json({ success: true, alerts_created: created });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});