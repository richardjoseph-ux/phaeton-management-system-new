import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Trash2 } from 'lucide-react';

const TRUCK_TYPES = ['AUV', 'Sub-4W', '6-Wheel', '10-Wheel'];

const emptyRoute = () => ({ pickup_location: '', delivery_location: '', delivery_code: '', trip_route_code: '' });

export default function ClientForm({ open, onClose, onSaved, editData }) {
  const [form, setForm] = useState({
    client_name: '', client_code: '', address: '', contact_person: '',
    contact_number: '', status: 'Active',
    routes: [emptyRoute()],
    rates: { AUV: '', 'Sub-4W': '', '6-Wheel': '', '10-Wheel': '' }
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editData) {
      setForm({
        client_name: editData.client_name || '',
        client_code: editData.client_code || '',
        address: editData.address || '',
        contact_person: editData.contact_person || '',
        contact_number: editData.contact_number || '',
        status: editData.status || 'Active',
        routes: editData.routes?.length ? editData.routes : [emptyRoute()],
        rates: {
          AUV: editData.rates?.AUV ?? '',
          'Sub-4W': editData.rates?.['Sub-4W'] ?? '',
          '6-Wheel': editData.rates?.['6-Wheel'] ?? '',
          '10-Wheel': editData.rates?.['10-Wheel'] ?? '',
        }
      });
    } else {
      setForm({
        client_name: '', client_code: '', address: '', contact_person: '',
        contact_number: '', status: 'Active',
        routes: [emptyRoute()],
        rates: { AUV: '', 'Sub-4W': '', '6-Wheel': '', '10-Wheel': '' }
      });
    }
  }, [editData, open]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const setRoute = (idx, k, v) => setForm(p => {
    const routes = [...p.routes];
    routes[idx] = { ...routes[idx], [k]: v };
    return { ...p, routes };
  });

  const addRoute = () => setForm(p => ({ ...p, routes: [...p.routes, emptyRoute()] }));
  const removeRoute = (idx) => setForm(p => ({ ...p, routes: p.routes.filter((_, i) => i !== idx) }));

  const setRate = (k, v) => setForm(p => ({ ...p, rates: { ...p.rates, [k]: v } }));

  const handleSave = async () => {
    setSaving(true);
    const data = {
      ...form,
      rates: Object.fromEntries(
        Object.entries(form.rates).map(([k, v]) => [k, v === '' ? null : parseFloat(v)])
      )
    };
    if (editData) {
      await base44.entities.ClientAccount.update(editData.id, data);
    } else {
      await base44.entities.ClientAccount.create(data);
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editData ? 'Edit Client Account' : 'Create Client Account'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Client Name *</Label>
              <Input value={form.client_name} onChange={e => set('client_name', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Client Code</Label>
              <Input value={form.client_code} onChange={e => set('client_code', e.target.value.toUpperCase())} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Address</Label>
              <Input value={form.address} onChange={e => set('address', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Contact Person</Label>
              <Input value={form.contact_person} onChange={e => set('contact_person', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Contact Number</Label>
              <Input value={form.contact_number} onChange={e => set('contact_number', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Rates */}
          <div>
            <h3 className="text-sm font-semibold mb-3 text-foreground">Rates per Truck Type (₱)</h3>
            <div className="grid grid-cols-2 gap-3">
              {TRUCK_TYPES.map(t => (
                <div key={t} className="space-y-1.5">
                  <Label>{t}</Label>
                  <Input
                    type="number" min="0" step="0.01"
                    placeholder="0.00"
                    value={form.rates[t]}
                    onChange={e => setRate(t, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Routes */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">Route Configurations</h3>
              <Button type="button" variant="outline" size="sm" onClick={addRoute}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Route
              </Button>
            </div>
            <div className="space-y-3">
              {form.routes.map((route, idx) => (
                <div key={idx} className="border rounded-lg p-3 bg-muted/30 relative">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground">Route {idx + 1}</span>
                    {form.routes.length > 1 && (
                      <button onClick={() => removeRoute(idx)} className="text-red-400 hover:text-red-600">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Pickup Location *</Label>
                      <Input className="h-8 text-sm" value={route.pickup_location} onChange={e => setRoute(idx, 'pickup_location', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Delivery Location *</Label>
                      <Input className="h-8 text-sm" value={route.delivery_location} onChange={e => setRoute(idx, 'delivery_location', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Delivery Code *</Label>
                      <Input className="h-8 text-sm" value={route.delivery_code} onChange={e => setRoute(idx, 'delivery_code', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Trip Route Code</Label>
                      <Input className="h-8 text-sm" value={route.trip_route_code} onChange={e => setRoute(idx, 'trip_route_code', e.target.value)} placeholder="Optional" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.client_name}>
            {saving ? 'Saving...' : editData ? 'Update' : 'Create Account'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}