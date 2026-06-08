import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

export default function TripForm({ open, onClose, onSaved, editData, clients, subcontractors, billingCycles }) {
  const [form, setForm] = useState({
    plate_number: '', subcontractor_id: '', owner_name: '', truck_type: '',
    client_account_id: '', client_name: '', pickup_location: '',
    delivery_location: '', delivery_code: '', trip_route_code: '',
    first_cheque_date: '', delivery_date: '', billing_date: '',
    particular: '', dr_number: '', waybill_number: '',
    billing_cycle_id: '', billing_cycle_name: ''
  });
  const [saving, setSaving] = useState(false);

  // Derived options
  const selectedClient = clients.find(c => c.id === form.client_account_id);
  const pickupOptions = [...new Set((selectedClient?.routes || []).map(r => r.pickup_location).filter(Boolean))];
  const deliveryOptions = (selectedClient?.routes || []).filter(r => r.pickup_location === form.pickup_location);

  useEffect(() => {
    if (editData) {
      setForm({
        plate_number: editData.plate_number || '',
        subcontractor_id: editData.subcontractor_id || '',
        owner_name: editData.owner_name || '',
        truck_type: editData.truck_type || '',
        client_account_id: editData.client_account_id || '',
        client_name: editData.client_name || '',
        pickup_location: editData.pickup_location || '',
        delivery_location: editData.delivery_location || '',
        delivery_code: editData.delivery_code || '',
        trip_route_code: editData.trip_route_code || '',
        first_cheque_date: editData.first_cheque_date || '',
        delivery_date: editData.delivery_date || '',
        billing_date: editData.billing_date || '',
        particular: editData.particular || '',
        dr_number: editData.dr_number || '',
        waybill_number: editData.waybill_number || '',
        billing_cycle_id: editData.billing_cycle_id || '',
        billing_cycle_name: editData.billing_cycle_name || '',
      });
    } else {
      setForm({
        plate_number: '', subcontractor_id: '', owner_name: '', truck_type: '',
        client_account_id: '', client_name: '', pickup_location: '',
        delivery_location: '', delivery_code: '', trip_route_code: '',
        first_cheque_date: '', delivery_date: '', billing_date: '',
        particular: '', dr_number: '', waybill_number: '',
        billing_cycle_id: '', billing_cycle_name: ''
      });
    }
  }, [editData, open]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handlePlateChange = (value) => {
    const sub = subcontractors.find(s => s.plate_number?.toUpperCase() === value.toUpperCase());
    setForm(p => ({
      ...p,
      plate_number: value.toUpperCase(),
      subcontractor_id: sub?.id || '',
      owner_name: sub?.owner_name || '',
      truck_type: sub?.truck_type || '',
    }));
  };

  const handleClientChange = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    setForm(p => ({
      ...p,
      client_account_id: clientId,
      client_name: client?.client_name || '',
      pickup_location: '',
      delivery_location: '',
      delivery_code: '',
      trip_route_code: '',
    }));
  };

  const handlePickupChange = (pickup) => {
    setForm(p => ({
      ...p,
      pickup_location: pickup,
      delivery_location: '',
      delivery_code: '',
      trip_route_code: '',
    }));
  };

  const handleDeliverySelect = (routeIdx) => {
    const route = deliveryOptions[parseInt(routeIdx)];
    if (route) {
      setForm(p => ({
        ...p,
        delivery_location: route.delivery_location,
        delivery_code: route.delivery_code,
        trip_route_code: route.trip_route_code || '',
      }));
    }
  };

  const handleBillingCycleChange = (cycleId) => {
    const cycle = billingCycles.find(c => c.id === cycleId);
    setForm(p => ({
      ...p,
      billing_cycle_id: cycleId,
      billing_cycle_name: cycle?.cycle_name || '',
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    const client = clients.find(c => c.id === form.client_account_id);
    const matchedRoute = (client?.routes || []).find(r =>
      r.pickup_location === form.pickup_location &&
      r.delivery_location === form.delivery_location &&
      r.delivery_code === form.delivery_code
    );
    const grossRate = matchedRoute?.rates?.[form.truck_type] || client?.rates?.[form.truck_type] || 0;
    const taxDeduction = grossRate * 0.02;
    const hiddenFee = grossRate * 0.04;
    const adminFee = grossRate * 0.06;
    const netPayroll = grossRate * 0.88;
    const data = { ...form, gross_rate: grossRate, tax_deduction: taxDeduction, hidden_fee: hiddenFee, admin_fee: adminFee, net_payroll: netPayroll };
    if (editData) {
      await base44.entities.TripRecord.update(editData.id, data);
    } else {
      await base44.entities.TripRecord.create(data);
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editData ? 'Edit Trip Record' : 'Encode New Trip'}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-2">
          {/* Vehicle Info */}
          <div className="col-span-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Vehicle Information</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Plate Number *</Label>
                <Input
                  value={form.plate_number}
                  onChange={e => handlePlateChange(e.target.value)}
                  placeholder="ABC 1234"
                  list="plate-suggestions"
                />
                <datalist id="plate-suggestions">
                  {subcontractors.map(s => <option key={s.id} value={s.plate_number} />)}
                </datalist>
              </div>
              <div className="space-y-1.5">
                <Label>Owner / Driver</Label>
                <Input value={form.owner_name} readOnly className="bg-muted" placeholder="Auto-filled" />
              </div>
              <div className="space-y-1.5">
                <Label>Truck Type</Label>
                <Input value={form.truck_type} readOnly className="bg-muted" placeholder="Auto-filled" />
              </div>
            </div>
          </div>

          {/* Route */}
          <div className="col-span-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Route Information</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Client Account *</Label>
                <Select value={form.client_account_id} onValueChange={handleClientChange}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    {clients.filter(c => c.status === 'Active').map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.client_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Pickup Location *</Label>
                <Select value={form.pickup_location} onValueChange={handlePickupChange} disabled={!form.client_account_id}>
                  <SelectTrigger><SelectValue placeholder="Select pickup" /></SelectTrigger>
                  <SelectContent>
                    {pickupOptions.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Delivery Location & Code</Label>
                <Select
                  disabled={!form.pickup_location}
                  onValueChange={handleDeliverySelect}
                  value={deliveryOptions.findIndex(r => r.delivery_location === form.delivery_location && r.delivery_code === form.delivery_code).toString()}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select delivery">
                      {form.delivery_location ? `${form.delivery_location} (${form.delivery_code})` : 'Select delivery'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {deliveryOptions.map((r, i) => (
                      <SelectItem key={i} value={i.toString()}>
                        {r.delivery_location} — {r.delivery_code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Trip Route Code</Label>
                <Input value={form.trip_route_code} onChange={e => set('trip_route_code', e.target.value)} placeholder="Auto-filled or manual" />
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="col-span-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Dates</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>First Cheque Date</Label>
                <Input type="date" value={form.first_cheque_date} onChange={e => set('first_cheque_date', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Delivery Date *</Label>
                <Input type="date" value={form.delivery_date} onChange={e => set('delivery_date', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Billing Date</Label>
                <Input type="date" value={form.billing_date} onChange={e => set('billing_date', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="col-span-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Trip Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Particular (Drop-off name)</Label>
                <Input value={form.particular} onChange={e => set('particular', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>DR Number</Label>
                <Input value={form.dr_number} onChange={e => set('dr_number', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Waybill Number</Label>
                <Input value={form.waybill_number} onChange={e => set('waybill_number', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Billing Statement</Label>
                <Select value={form.billing_cycle_id} onValueChange={handleBillingCycleChange}>
                  <SelectTrigger><SelectValue placeholder="Select billing cycle" /></SelectTrigger>
                  <SelectContent>
                    {billingCycles.map(bc => (
                      <SelectItem key={bc.id} value={bc.id}>{bc.cycle_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Rate Preview */}
          {form.truck_type && form.client_account_id && (() => {
            const client = clients.find(c => c.id === form.client_account_id);
            const matchedRoute = (client?.routes || []).find(r =>
              r.pickup_location === form.pickup_location &&
              r.delivery_location === form.delivery_location &&
              r.delivery_code === form.delivery_code
            );
            const gross = matchedRoute?.rates?.[form.truck_type] || client?.rates?.[form.truck_type] || 0;
            if (!gross) return null;
            return (
              <div className="col-span-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs font-semibold text-blue-800 mb-2">Rate Breakdown</p>
                <div className="grid grid-cols-4 gap-2 text-xs text-blue-700">
                  <div><span className="text-blue-500">Gross Rate</span><br />₱{gross.toFixed(2)}</div>
                  <div><span className="text-blue-500">Tax (2%)</span><br />-₱{(gross * 0.02).toFixed(2)}</div>
                  <div><span className="text-blue-500">Hidden Fee (4%)</span><br />-₱{(gross * 0.04).toFixed(2)}</div>
                  <div><span className="text-blue-800 font-semibold">Net Payroll (88%)</span><br /><span className="font-bold">₱{(gross * 0.88).toFixed(2)}</span></div>
                </div>
              </div>
            );
          })()}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.plate_number || !form.client_account_id || !form.delivery_date}>
            {saving ? 'Saving...' : editData ? 'Update Trip' : 'Save Trip'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}