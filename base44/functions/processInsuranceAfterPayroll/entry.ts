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

    // Find ALL insurance deductions (any billing date) with insurance_charge > 0
    // We do this because insurance may have been linked on a different billing date
    // than the payroll being processed (e.g. linked on May 25, payroll processed on May 29)
    const allDeductions = await base44.asServiceRole.entities.BillingDeduction.list('-billing_received_date', 500);
    const insuranceDeductions = allDeductions.filter(d => (d.insurance_charge || 0) > 0);

    if (insuranceDeductions.length === 0) {
      return Response.json({ updated: 0, message: 'No insurance deductions found' });
    }

    // Group deductions by plate_number to get latest per subcontractor
    const byPlate: Record<string, any[]> = {};
    for (const ded of insuranceDeductions) {
      if (!byPlate[ded.plate_number]) byPlate[ded.plate_number] = [];
      byPlate[ded.plate_number].push(ded);
    }

    let updated = 0;
    for (const [plate_number, deds] of Object.entries(byPlate)) {
      const subs = await base44.asServiceRole.entities.Subcontractor.filter({ plate_number });
      const sub = subs[0];
      if (!sub || !sub.insurance_start_date) continue;

      const startDate = new Date(sub.insurance_start_date);

      // Check all 4 quarters. For each quarter, if there's a deduction whose billing_received_date
      // falls within the quarter window AND before or on the processed billing_received_date,
      // that quarter has been paid — advance the start date by 3 months for each paid quarter.
      let advanceCount = 0;
      for (let q = 1; q <= 4; q++) {
        const qStart = new Date(startDate);
        qStart.setMonth(qStart.getMonth() + (q - 1) * 3);
        const qEnd = new Date(startDate);
        qEnd.setMonth(qEnd.getMonth() + q * 3);

        const qStartStr = qStart.toISOString().split('T')[0];
        const qEndStr = qEnd.toISOString().split('T')[0];

        // A deduction pays for this quarter if its billing date is within the quarter window
        // and that billing date is <= the payroll being processed now
        const paidInThisQuarter = deds.some(d =>
          d.billing_received_date >= qStartStr &&
          d.billing_received_date <= qEndStr &&
          d.billing_received_date <= billing_received_date
        );

        if (paidInThisQuarter) {
          advanceCount++;
        } else {
          // Stop at first unpaid quarter
          break;
        }
      }

      if (advanceCount === 0) continue;

      // Advance start date by advanceCount quarters (3 months each)
      const newStart = new Date(sub.insurance_start_date);
      newStart.setMonth(newStart.getMonth() + advanceCount * 3);
      const newStartDate = newStart.toISOString().split('T')[0];

      let newEndDate = sub.insurance_end_date;
      if (sub.insurance_end_date) {
        const end = new Date(sub.insurance_end_date);
        end.setMonth(end.getMonth() + advanceCount * 3);
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