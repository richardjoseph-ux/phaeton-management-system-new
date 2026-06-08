import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all billing cycles that have cheque_date or billing_received_date set
    const billingCycles = await base44.asServiceRole.entities.BillingCycle.list();
    
    let updatedCount = 0;
    
    for (const cycle of billingCycles) {
      // Only process if cycle has dates to sync
      if (!cycle.cheque_date && !cycle.billing_received_date) {
        continue;
      }
      
      // Get all trips for this billing cycle
      const trips = await base44.asServiceRole.entities.TripRecord.filter({ 
        billing_cycle_id: cycle.id 
      });
      
      const updates = [];
      
      for (const trip of trips) {
        const updateData = {};
        
        // Sync cheque date to first_cheque_date
        if (cycle.cheque_date && trip.first_cheque_date !== cycle.cheque_date) {
          updateData.first_cheque_date = cycle.cheque_date;
        }
        
        // Sync billing_received_date to billing_date
        if (cycle.billing_received_date && trip.billing_date !== cycle.billing_received_date) {
          updateData.billing_date = cycle.billing_received_date;
        }
        
        // Only update if there are changes
        if (Object.keys(updateData).length > 0) {
          updates.push(
            base44.asServiceRole.entities.TripRecord.update(trip.id, updateData)
          );
          updatedCount++;
        }
      }
      
      if (updates.length > 0) {
        await Promise.all(updates);
      }
    }
    
    return Response.json({ 
      success: true, 
      message: `Synced ${updatedCount} trip records with billing statement dates` 
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});