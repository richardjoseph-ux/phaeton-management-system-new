import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus, Pencil } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';

export default function Deductions() {
  const [billingCycles, setBillingCycles] = useState([]);
  const [deductions, setDeductions] = useState([]);
  const [dateOwners, setDateOwners] = useState([]); // owners with trips for selected date
  const [loadingOwners, setLoadingOwners] = useState(false);
  const [loading, setLoading] = useState(true);

  const [selectedDate, setSelectedDate] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    plate_number: '',
    owner_name: '',
    insurance_charge: '',
    other_charges: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [b, d] = await Promise.all([
      base44.entities.BillingCycle.list('-billing_received_date', 200),
      base44.entities.BillingDeduction.list('-billing_received_date', 500),
    ]);
    setBillingCycles(b);
    setDeductions(d);
    setLoading(false);
  };

  const loadOwnersForDate = async (date) => {
    setLoadingOwners(true);
    setDateOwners([]);
    // Find billing cycles for this date
    const cycles = billingCycles.filter(c => c.billing_received_date === date);
    if (cycles.length === 0) { setLoadingOwners(false); return; }
    // Fetch all trips for those cycles
    const allTrips = await Promise.all(
      cycles.map(c => base44.entities.TripRecord.filter({ billing_cycle_id: c.id }, 'plate_number', 500))
    );
    // Deduplicate owners
    const seen = {};
    allTrips.flat().forEach(t => {
      if (t.plate_number && !seen[t.plate_number]) {
        seen[t.plate_number] = { plate_number: t.plate_number, owner_name: t.owner_name };
      }
    });
    setDateOwners(Object.values(seen).sort((a, b) => a.plate_number.localeCompare(b.plate_number)));
    setLoadingOwners(false);
  };

  useEffect(() => { load(); }, []);

  // Unique billing received dates from billing cycles
  const dateOptions = (() => {
    const seen = new Set();
    const result = [];
    billingCycles.forEach(c => {
      if (c.billing_received_date && !seen.has(c.billing_received_date)) {
        seen.add(c.billing_received_date);
        result.push(c.billing_received_date);
      }
    });
    return result.sort((a, b) => b.localeCompare(a));
  })();

  // Deductions for the selected date
  const filteredDeductions = deductions.filter(d => d.billing_received_date === selectedDate);

  // Plate numbers already assigned for this date (for validation)
  const assignedPlates = filteredDeductions
    .filter(d => d.id !== editingId)
    .map(d => d.plate_number);

  const handleOwnerSelect = (plateNumber) => {
    const owner = dateOwners.find(o => o.plate_number === plateNumber);
    setForm(f => ({ ...f, plate_number: plateNumber, owner_name: owner?.owner_name || '' }));
  };

  const handleEdit = (deduction) => {
    setEditingId(deduction.id);
    setForm({
      plate_number: deduction.plate_number,
      owner_name: deduction.owner_name,
      insurance_charge: deduction.insurance_charge?.toString() || '',
      other_charges: deduction.other_charges?.toString() || '',
      notes: deduction.notes || '',
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setForm({ plate_number: '', owner_name: '', insurance_charge: '', other_charges: '', notes: '' });
  };

  const handleSave = async () => {
    if (!selectedDate || !form.plate_number) return;
    setSaving(true);
    const data = {
      billing_received_date: selectedDate,
      plate_number: form.plate_number,
      owner_name: form.owner_name,
      insurance_charge: parseFloat(form.insurance_charge) || 0,
      other_charges: parseFloat(form.other_charges) || 0,
      notes: form.notes,
    };
    if (editingId) {
      await base44.entities.BillingDeduction.update(editingId, data);
    } else {
      await base44.entities.BillingDeduction.create(data);
    }
    await load();
    handleCancel();
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this deduction record?')) return;
    await base44.entities.BillingDeduction.delete(id);
    setDeductions(d => d.filter(x => x.id !== id));
  };

  const totalInsurance = filteredDeductions.reduce((s, d) => s + (d.insurance_charge || 0), 0);
  const totalOther = filteredDeductions.reduce((s, d) => s + (d.other_charges || 0), 0);

  return (
    <div className="p-6">
      <PageHeader
        title="Billing Deductions"
        subtitle="Declare flat insurance and other charges per billing received date and owner/driver"
      />

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Loading...</div>
      ) : (
        <div className="space-y-6">
          {/* Date Selector */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Billing Received Date</p>
            <Select value={selectedDate} onValueChange={v => { setSelectedDate(v); handleCancel(); loadOwnersForDate(v); }}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Select date..." />
              </SelectTrigger>
              <SelectContent>
                {dateOptions.map(d => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedDate && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Form Panel */}
              <div className="lg:col-span-1">
                <div className="bg-card border rounded-lg p-5 space-y-4">
                  <h3 className="font-semibold text-sm">
                    {editingId ? 'Edit Deduction' : 'Add Deduction'}
                  </h3>

                  <div className="space-y-1.5">
                    <Label>Owner / Driver</Label>
                    <Select
                      value={form.plate_number}
                      onValueChange={handleOwnerSelect}
                      disabled={!!editingId || loadingOwners}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={loadingOwners ? 'Loading...' : 'Select owner...'} />
                      </SelectTrigger>
                      <SelectContent>
                        {dateOwners
                          .filter(o => editingId || !assignedPlates.includes(o.plate_number))
                          .map(o => (
                            <SelectItem key={o.plate_number} value={o.plate_number}>
                              {o.plate_number} — {o.owner_name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="insurance">Insurance Charge (₱)</Label>
                    <Input
                      id="insurance"
                      type="number"
                      placeholder="0.00"
                      value={form.insurance_charge}
                      onChange={e => setForm(f => ({ ...f, insurance_charge: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="other">Other Charges (₱)</Label>
                    <Input
                      id="other"
                      type="number"
                      placeholder="0.00"
                      value={form.other_charges}
                      onChange={e => setForm(f => ({ ...f, other_charges: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="notes">Notes (optional)</Label>
                    <Input
                      id="notes"
                      placeholder="e.g. Monthly insurance premium"
                      value={form.notes}
                      onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    />
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button
                      onClick={handleSave}
                      disabled={saving || !form.plate_number}
                      className="flex-1"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      {saving ? 'Saving...' : editingId ? 'Update' : 'Add'}
                    </Button>
                    {editingId && (
                      <Button variant="outline" onClick={handleCancel}>Cancel</Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Deductions Table */}
              <div className="lg:col-span-2">
                {filteredDeductions.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground border rounded-lg bg-card">
                    <p className="text-sm">No deductions declared for {selectedDate} yet.</p>
                  </div>
                ) : (
                  <div className="bg-card border rounded-lg overflow-hidden">
                    {/* Summary */}
                    <div className="grid grid-cols-3 divide-x border-b">
                      <div className="p-4">
                        <p className="text-xs text-muted-foreground">Drivers</p>
                        <p className="text-xl font-bold mt-1">{filteredDeductions.length}</p>
                      </div>
                      <div className="p-4">
                        <p className="text-xs text-muted-foreground">Total Insurance</p>
                        <p className="text-xl font-bold mt-1 text-blue-700">₱{totalInsurance.toFixed(2)}</p>
                      </div>
                      <div className="p-4">
                        <p className="text-xs text-muted-foreground">Total Other Charges</p>
                        <p className="text-xl font-bold mt-1 text-orange-700">₱{totalOther.toFixed(2)}</p>
                      </div>
                    </div>

                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          {['Plate #', 'Owner / Driver', 'Insurance (₱)', 'Other Charges (₱)', 'Notes', ''].map(h => (
                            <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDeductions.map(d => (
                          <tr key={d.id} className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${editingId === d.id ? 'bg-primary/5' : ''}`}>
                            <td className="px-4 py-3 font-mono font-semibold text-primary">{d.plate_number}</td>
                            <td className="px-4 py-3">{d.owner_name}</td>
                            <td className="px-4 py-3 text-right font-semibold text-blue-700">₱{(d.insurance_charge || 0).toFixed(2)}</td>
                            <td className="px-4 py-3 text-right font-semibold text-orange-700">₱{(d.other_charges || 0).toFixed(2)}</td>
                            <td className="px-4 py-3 text-muted-foreground text-xs">{d.notes || '—'}</td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1">
                                <button onClick={() => handleEdit(d)} className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground">
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => handleDelete(d.id)} className="p-1.5 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}