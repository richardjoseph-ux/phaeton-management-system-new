import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    // Support both direct call and entity automation payload
    const billing_received_date = body.billing_received_date || body.data?.billing_received_date;
    if (!billing_received_date) {
      return Response.json({ error: 'billing_received_date is required' }, { status: 400 });
    }

    // Find all deductions for this billing date that have an insurance_charge linked
    const deductions = await base44.asServiceRole.entities.BillingDeduction.filter({
      billing_received_date,
    });

    const insuranceDeductions = deductions.filter(d => (d.insurance_charge || 0) > 0);
    if (insuranceDeductions.length === 0) {
      return Response.json({ updated: 0, message: 'No insurance deductions found for this date' });
    }

    // For each, find the matching subcontractor and advance insurance_start_date by 3 months
    let updated = 0;
    for (const ded of insuranceDeductions) {
      const subs = await base44.asServiceRole.entities.Subcontractor.filter({
        plate_number: ded.plate_number,
      });

      const sub = subs[0];
      if (!sub || !sub.insurance_start_date) continue;

      // Advance start date by 3 months (one quarter)
      const current = new Date(sub.insurance_start_date);
      current.setMonth(current.getMonth() + 3);
      const newStartDate = current.toISOString().split('T')[0];

      // Also advance end date if it exists
      let newEndDate = sub.insurance_end_date;
      if (sub.insurance_end_date) {
        const end = new Date(sub.insurance_end_date);
        end.setMonth(end.getMonth() + 3);
        newEndDate = end.toISOString().split('T')[0];
      }

      await base44.asServiceRole.entities.Subcontractor.update(sub.id, {
        insurance_start_date: newStartDate,
        insurance_end_date: newEndDate,
      });

      updated++;
    }

    return Response.json({ updated, message: `Advanced insurance quarter for ${updated} subcontractor(s)` });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});