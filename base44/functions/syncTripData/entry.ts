import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const normalize = (value) => String(value || '').trim().toLowerCase();

const loadAll = async (entity, sort) => {
  const records = [];
  let cursor;
  do {
    const page = await entity.list({ sort, limit: 1000, cursor });
    records.push(...page.items);
    cursor = page.has_more ? page.next_cursor : null;
  } while (cursor);
  return records;
};

const getFeeBreakdown = (trip, client, route) => {
  const grossRate = Number(route?.rates?.[trip.truck_type]) || Number(trip.gross_rate) || 0;
  const pickupFee = (client.pickup_location_fees || []).find((item) =>
    normalize(item.pickup_location) === normalize(trip.pickup_location)
  );
  const truckFee = (pickupFee?.truck_type_fees || []).find((item) => item.truck_type === trip.truck_type);
  if (!truckFee) return null;

  const versions = new Map();
  (truckFee.fee_history || []).forEach((version) => versions.set(version.effective_date || '', version));
  versions.set(truckFee.effective_date || '', truckFee);
  const applicable = [...versions.values()]
    .filter((version) => !version.effective_date || version.effective_date <= trip.delivery_date)
    .sort((a, b) => String(b.effective_date || '').localeCompare(String(a.effective_date || '')))[0];
  if (!applicable) return null;

  const tax = grossRate * 0.02;
  const afterTax = grossRate - tax;
  const hiddenFee = afterTax * ((Number(applicable.hidden_fee_percentage) || 4) / 100);
  const adminFee = afterTax * 0.06;
  return {
    gross_rate: grossRate,
    tax_deduction: tax,
    hidden_fee: hiddenFee,
    admin_fee: adminFee,
    net_payroll: grossRate - tax - hiddenFee - adminFee - (Number(trip.insurance_charge) || 0) - (Number(trip.other_charges) || 0),
  };
};

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const [trips, clients, subcontractors] = await Promise.all([
      loadAll(base44.asServiceRole.entities.TripRecord, '-created_date'),
      loadAll(base44.asServiceRole.entities.ClientAccount, 'client_name'),
      loadAll(base44.asServiceRole.entities.Subcontractor, 'plate_number'),
    ]);

    const updates = [];
    for (const trip of trips) {
      const client = clients.find((item) => item.id === trip.client_account_id || item.client_name === trip.client_name);
      if (!client) continue;
      const route = (client.routes || []).find((item) =>
        normalize(item.pickup_location) === normalize(trip.pickup_location) &&
        normalize(item.delivery_location) === normalize(trip.delivery_location) &&
        normalize(item.delivery_code) === normalize(trip.delivery_code)
      );
      const subcontractor = subcontractors.find((item) => normalize(item.plate_number) === normalize(trip.plate_number));
      const feeBreakdown = getFeeBreakdown(trip, client, route);
      const update = {
        client_account_id: client.id,
        client_name: client.client_name,
        subcontractor_id: subcontractor?.id || trip.subcontractor_id,
        trip_route_code: route?.trip_route_code || trip.trip_route_code,
        ...(feeBreakdown || {}),
      };
      const changed = Object.keys(update).some((key) => update[key] !== trip[key]);
      if (changed) updates.push({ id: trip.id, ...update });
    }

    for (let index = 0; index < updates.length; index += 500) {
      await base44.asServiceRole.entities.TripRecord.bulkUpdate(updates.slice(index, index + 500));
    }

    return Response.json({ success: true, updated: updates.length, message: `Synced ${updates.length} trip record${updates.length === 1 ? '' : 's'}.` });
  } catch (error) {
    return Response.json({ error: error.message || 'Trip sync failed.' }, { status: 500 });
  }
}