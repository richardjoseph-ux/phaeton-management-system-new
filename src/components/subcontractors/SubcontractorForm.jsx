import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { X } from 'lucide-react';

const TRUCK_TYPES = ['AUV', 'Sub-4W', '6-Wheel', '10-Wheel'];

const generateSubId = async () => {
  const list = await base44.entities.Subcontractor.list('-created_date', 200);
  const existing = list
    .map(s => s.sub_id)
    .filter(Boolean)
    .map(id => parseInt(id.replace('PT-SUB-', ''), 10))
    .filter(n => !isNaN(n));
  const max = existing.length > 0 ? Math.max(...existing) : 0;
  return `PT-SUB-${String(max + 1).padStart(3, '0')}`;
};

export default function SubcontractorForm({ open, onClose, onSaved, editData }) {
  const [form, setForm] = useState({
    plate_number: '', truck_type: '', owner_name: '', contact_number: '',
    garage_location: '', status: 'Active', is_insured: false,
    insurance_start_date: '', insurance_end_date: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editData) {
      setForm({
        plate_number: editData.plate_number || '',
        truck_type: editData.truck_type || '',
        owner_name: editData.owner_name || '',
        contact_number: editData.contact_number || '',
        garage_location: editData.garage_location || '',
        status: editData.status || 'Active',
        is_insured: editData.is_insured || false,
        insurance_start_date: editData.insurance_start_date || '',
        insurance_end_date: editData.insurance_end_date || '',
      });
    } else {
      setForm({
        plate_number: '', truck_type: '', owner_name: '', contact_number: '',
        garage_location: '', status: 'Active', is_insured: false,
        insurance_start_date: '', insurance_end_date: ''
      });
    }
  }, [editData, open]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    const data = { ...form };
    if (!editData) data.sub_id = await generateSubId();
    if (editData) {
      await base44.entities.Subcontractor.update(editData.id, data);
    } else {
      await base44.entities.Subcontractor.create(data);
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editData ? 'Edit Subcontractor' : 'Register New Subcontractor'}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-2">
          <div className="col-span-2 flex gap-2">
            <div className="flex-1 space-y-1.5">
              <Label>Plate Number *</Label>
              <Input value={form.plate_number} onChange={e => set('plate_number', e.target.value.toUpperCase())} placeholder="ABC 1234" />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label>Truck Type *</Label>
              <Select value={form.truck_type} onValueChange={v => set('truck_type', v)}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {TRUCK_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="col-span-2 space-y-1.5">
            <Label>Owner / Driver Name *</Label>
            <Input value={form.owner_name} onChange={e => set('owner_name', e.target.value)} placeholder="Full name" />
          </div>

          <div className="space-y-1.5">
            <Label>Contact Number</Label>
            <Input value={form.contact_number} onChange={e => set('contact_number', e.target.value)} placeholder="09XX XXX XXXX" />
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

          <div className="col-span-2 space-y-1.5">
            <Label>Garage Location</Label>
            <Input value={form.garage_location} onChange={e => set('garage_location', e.target.value)} placeholder="Address / area" />
          </div>

          <div className="col-span-2 flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div>
              <p className="text-sm font-medium">Insurance</p>
              <p className="text-xs text-muted-foreground">Vehicle is covered by insurance</p>
            </div>
            <Switch checked={form.is_insured} onCheckedChange={v => set('is_insured', v)} />
          </div>

          {form.is_insured && (
            <>
              <div className="space-y-1.5">
                <Label>Insurance Start Date</Label>
                <Input type="date" value={form.insurance_start_date} onChange={e => set('insurance_start_date', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Insurance End Date</Label>
                <Input type="date" value={form.insurance_end_date} onChange={e => set('insurance_end_date', e.target.value)} />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.plate_number || !form.truck_type || !form.owner_name}>
            {saving ? 'Saving...' : editData ? 'Update' : 'Register'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}