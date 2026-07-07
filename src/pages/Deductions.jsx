import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus, Pencil, Receipt, DollarSign } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { formatDateDisplay } from '@/lib/dateUtils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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

  const [billingReceivedSummaries, setBillingReceivedSummaries] = useState([]);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'deductions' | 'reimbursements'
  const [reimbursements, setReimbursements] = useState([]);
  const [reimbursementForm, setReimbursementForm] = useState({
    billing_received_date: '',
    plate_number: '',
    owner_name: '',
    reimbursement_amount: '',
    reimbursement_type: '',
    notes: '',
  });
  const [editingReimbursementId, setEditingReimbursementId] = useState(null);
  const [savingReimbursement, setSavingReimbursement] = useState(false);

  const [otherCharges, setOtherCharges] = useState([]);
  const [otherChargesForm, setOtherChargesForm] = useState({
    billing_received_date: '',
    charge_type: '',
    amount: '',
    description: '',
  });
  const [editingOtherChargeId, setEditingOtherChargeId] = useState(null);
  const [savingOtherCharge, setSavingOtherCharge] = useState(false);

  const load = async () => {
    setLoading(true);
    const [b, d, summaries, r, o] = await Promise.all([
      base44.entities.BillingCycle.list('-billing_received_date', 200),
      base44.entities.BillingDeduction.list('-billing_received_date', 500),
      base44.entities.BillingReceivedSummary.list('-billing_received_date', 200),
      base44.entities.Reimbursement.list('-billing_received_date', 500),
      base44.entities.OtherCharges.list('-billing_received_date', 500),
    ]);
    setBillingCycles(b);
    setDeductions(d);
    setBillingReceivedSummaries(summaries);
    setReimbursements(r);
    setOtherCharges(o);
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

  // Unique billing received dates — show if no summary record exists OR payroll_processed is false
  const dateOptions = (() => {
    const seen = new Set();
    const result = [];
    billingCycles.forEach(c => {
      if (c.billing_received_date && !seen.has(c.billing_received_date)) {
        const rec = billingReceivedSummaries.find(s => s.billing_received_date === c.billing_received_date);
        // Show if no summary yet (pending by default) OR explicitly not processed
        if (!rec || !rec.payroll_processed) {
          seen.add(c.billing_received_date);
          result.push(c.billing_received_date);
        }
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
      setDeductions(prev => prev.map(d => d.id === editingId ? { ...d, ...data } : d));
    } else {
      const created = await base44.entities.BillingDeduction.create(data);
      setDeductions(prev => [...prev, created]);
    }
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
        title="Deductions & Reimbursements"
        subtitle="Manage billing deductions and subcontractor reimbursements"
      />

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Loading...</div>
      ) : (
        <div className="space-y-6">
          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="all">All Records</TabsTrigger>
              <TabsTrigger value="deductions">Deductions</TabsTrigger>
              <TabsTrigger value="reimbursements">Reimbursements</TabsTrigger>
              <TabsTrigger value="others">Others</TabsTrigger>
            </TabsList>

            {/* Deductions Tab */}
            <TabsContent value="deductions" className="space-y-6">
              {/* Date Selector */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Billing Received Date</p>
                <Select value={selectedDate} onValueChange={v => { setSelectedDate(v); handleCancel(); loadOwnersForDate(v); }}>
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Select date..." />
                  </SelectTrigger>
                  <SelectContent>
  {dateOptions.map(d => (
    <SelectItem key={d} value={d}>{formatDateDisplay(d)}</SelectItem>
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
            </TabsContent>

            {/* Reimbursements Tab */}
            <TabsContent value="reimbursements" className="space-y-6">
              {/* Date Selector for Reimbursements */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Billing Received Date</p>
                <Select 
                  value={reimbursementForm.billing_received_date} 
                  onValueChange={v => { 
  setReimbursementForm(f => ({ ...f, billing_received_date: v }));
  
  // 1. Find billing cycles for this date
  const cycles = billingCycles.filter(c => c.billing_received_date === v);
  
  // 2. Fetch trips for these cycles to get relevant owners
  if (cycles.length > 0) {
    Promise.all(
      cycles.map(c => base44.entities.TripRecord.filter({ billing_cycle_id: c.id }, 'plate_number', 500))
    ).then(allTrips => {
      const seen = {};
      allTrips.flat().forEach(t => {
        if (t.plate_number && !seen[t.plate_number]) {
          seen[t.plate_number] = { plate_number: t.plate_number, owner_name: t.owner_name };
        }
      });
      // Set ONLY the owners found in the trips for this date
      setDateOwners(Object.values(seen).sort((a, b) => a.plate_number.localeCompare(b.plate_number)));
    });
  } else {
    // If no cycles found for this date, clear the list
    setDateOwners([]);
  }
}}
                >
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Select date..." />
                  </SelectTrigger>
                  <SelectContent>
  {dateOptions.map(d => (
    <SelectItem key={d} value={d}>{formatDateDisplay(d)}</SelectItem>
  ))}
</SelectContent>
                </Select>
              </div>

              {reimbursementForm.billing_received_date && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Reimbursement Form Panel */}
                  <div className="lg:col-span-1">
                    <div className="bg-card border rounded-lg p-5 space-y-4">
                      <h3 className="font-semibold text-sm">
                        {editingReimbursementId ? 'Edit Reimbursement' : 'Add Reimbursement'}
                      </h3>

                      <div className="space-y-1.5">
                        <Label>Subcontractor / Owner</Label>
                        <Select
                          value={reimbursementForm.plate_number}
                          onValueChange={(plateNumber) => {
                            const owner = dateOwners.find(o => o.plate_number === plateNumber);
                            setReimbursementForm(f => ({ ...f, plate_number: plateNumber, owner_name: owner?.owner_name || '' }));
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select subcontractor..." />
                          </SelectTrigger>
                          <SelectContent>
                            {dateOwners.map(o => (
                              <SelectItem key={o.plate_number} value={o.plate_number}>
                                {o.plate_number} — {o.owner_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label>Reimbursement Type</Label>
                        <Select
                          value={reimbursementForm.reimbursement_type}
                          onValueChange={v => setReimbursementForm(f => ({ ...f, reimbursement_type: v }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select type..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fuel">Fuel</SelectItem>
                            <SelectItem value="maintenance">Maintenance</SelectItem>
                            <SelectItem value="tolls">Tolls</SelectItem>
                            <SelectItem value="insurance">Insurance</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="amount">Reimbursement Amount (₱)</Label>
                        <Input
                          id="amount"
                          type="number"
                          placeholder="0.00"
                          value={reimbursementForm.reimbursement_amount}
                          onChange={e => setReimbursementForm(f => ({ ...f, reimbursement_amount: e.target.value }))}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="notes">Notes (optional)</Label>
                        <Input
                          id="notes"
                          placeholder="e.g. Emergency repair"
                          value={reimbursementForm.notes}
                          onChange={e => setReimbursementForm(f => ({ ...f, notes: e.target.value }))}
                        />
                      </div>

                      <div className="flex gap-2 pt-1">
                        <Button
                          onClick={async () => {
                            if (!reimbursementForm.billing_received_date || !reimbursementForm.plate_number) return;
                            setSavingReimbursement(true);
                            const data = {
                              billing_received_date: reimbursementForm.billing_received_date,
                              plate_number: reimbursementForm.plate_number,
                              owner_name: reimbursementForm.owner_name,
                              reimbursement_amount: parseFloat(reimbursementForm.reimbursement_amount) || 0,
                              reimbursement_type: reimbursementForm.reimbursement_type,
                              notes: reimbursementForm.notes,
                            };
                            if (editingReimbursementId) {
                              await base44.entities.Reimbursement.update(editingReimbursementId, data);
                              setReimbursements(prev => prev.map(r => r.id === editingReimbursementId ? { ...r, ...data } : r));
                            } else {
                              const created = await base44.entities.Reimbursement.create(data);
                              setReimbursements(prev => [...prev, created]);
                            }
                            setReimbursementForm({
                              billing_received_date: reimbursementForm.billing_received_date,
                              plate_number: '',
                              owner_name: '',
                              reimbursement_amount: '',
                              reimbursement_type: '',
                              notes: '',
                            });
                            setEditingReimbursementId(null);
                            setSavingReimbursement(false);
                          }}
                          disabled={savingReimbursement || !reimbursementForm.plate_number || !reimbursementForm.reimbursement_amount}
                          className="flex-1"
                        >
                          <DollarSign className="w-4 h-4 mr-1" />
                          {savingReimbursement ? 'Saving...' : editingReimbursementId ? 'Update' : 'Add'}
                        </Button>
                        {editingReimbursementId && (
                          <Button variant="outline" onClick={() => {
                            setEditingReimbursementId(null);
                            setReimbursementForm({
                              billing_received_date: reimbursementForm.billing_received_date,
                              plate_number: '',
                              owner_name: '',
                              reimbursement_amount: '',
                              reimbursement_type: '',
                              notes: '',
                            });
                          }}>Cancel</Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Reimbursements Table */}
                  <div className="lg:col-span-2">
                    {(() => {
                      const filteredReimbursements = reimbursements.filter(r => r.billing_received_date === reimbursementForm.billing_received_date);
                      const totalAmount = filteredReimbursements.reduce((s, r) => s + (r.reimbursement_amount || 0), 0);
                      
                      if (filteredReimbursements.length === 0) {
                        return (
                          <div className="text-center py-16 text-muted-foreground border rounded-lg bg-card">
                            <Receipt className="w-10 h-10 mx-auto mb-2 opacity-20" />
                            <p className="text-sm">No reimbursements filed for this date yet.</p>
                          </div>
                        );
                      }
                      return (
                        <div className="bg-card border rounded-lg overflow-hidden">
                          {/* Summary */}
                          <div className="grid grid-cols-3 divide-x border-b">
                            <div className="p-4">
                              <p className="text-xs text-muted-foreground">Reimbursements</p>
                              <p className="text-xl font-bold mt-1">{filteredReimbursements.length}</p>
                            </div>
                            <div className="p-4">
                              <p className="text-xs text-muted-foreground">Total Amount</p>
                              <p className="text-xl font-bold mt-1 text-green-700">₱{totalAmount.toFixed(2)}</p>
                            </div>
                            <div className="p-4">
                              <p className="text-xs text-muted-foreground">Avg per Owner</p>
                              <p className="text-xl font-bold mt-1 text-blue-700">₱{(totalAmount / filteredReimbursements.length).toFixed(2)}</p>
                            </div>
                          </div>

                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b bg-muted/50">
                                {['Plate #', 'Owner / Driver', 'Type', 'Amount (₱)', 'Notes', ''].map(h => (
                                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {filteredReimbursements.map(r => (
                                <tr key={r.id} className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${editingReimbursementId === r.id ? 'bg-primary/5' : ''}`}>
                                  <td className="px-4 py-3 font-mono font-semibold text-primary">{r.plate_number}</td>
                                  <td className="px-4 py-3">{r.owner_name}</td>
                                  <td className="px-4 py-3">
                                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium capitalize">{r.reimbursement_type}</span>
                                  </td>
                                  <td className="px-4 py-3 text-right font-semibold text-green-700">₱{(r.reimbursement_amount || 0).toFixed(2)}</td>
                                  <td className="px-4 py-3 text-muted-foreground text-xs">{r.notes || '—'}</td>
                                  <td className="px-4 py-3">
                                    <div className="flex gap-1">
                                      <button onClick={() => {
                                        setEditingReimbursementId(r.id);
                                        setReimbursementForm({
                                          billing_received_date: r.billing_received_date,
                                          plate_number: r.plate_number,
                                          owner_name: r.owner_name,
                                          reimbursement_amount: r.reimbursement_amount?.toString() || '',
                                          reimbursement_type: r.reimbursement_type || '',
                                          notes: r.notes || '',
                                        });
                                      }} className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground">
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                      <button onClick={async () => {
                                        if (!confirm('Delete this reimbursement record?')) return;
                                        await base44.entities.Reimbursement.delete(r.id);
                                        setReimbursements(prev => prev.filter(x => x.id !== r.id));
                                      }} className="p-1.5 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive">
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Others Tab - Gross Rate Adjustments */}
            <TabsContent value="others" className="space-y-6">
              {/* Date Selector for Others */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Billing Received Date</p>
                <Select 
                  value={otherChargesForm.billing_received_date} 
                  onValueChange={v => { 
                    setOtherChargesForm(f => ({ ...f, billing_received_date: v }));
                  }}
                >
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Select date..." />
                  </SelectTrigger>
                  <SelectContent>
  {dateOptions.map(d => (
    <SelectItem key={d} value={d}>{formatDateDisplay(d)}</SelectItem>
  ))}
</SelectContent>
                </Select>
              </div>

              {otherChargesForm.billing_received_date && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Other Charges Form Panel */}
                  <div className="lg:col-span-1">
                    <div className="bg-card border rounded-lg p-5 space-y-4">
                      <h3 className="font-semibold text-sm">
                        {editingOtherChargeId ? 'Edit Adjustment' : 'Add Adjustment'}
                      </h3>

                      <div className="space-y-1.5">
                        <Label>Charge Type</Label>
                        <Select
                          value={otherChargesForm.charge_type}
                          onValueChange={v => setOtherChargesForm(f => ({ ...f, charge_type: v }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select type..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Demurrage">Demurrage</SelectItem>
                            <SelectItem value="Fuel Subsidy">Fuel Subsidy</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="other-amount">Amount (₱)</Label>
                        <Input
                          id="other-amount"
                          type="number"
                          placeholder="0.00"
                          value={otherChargesForm.amount}
                          onChange={e => setOtherChargesForm(f => ({ ...f, amount: e.target.value }))}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="other-description">Description (optional)</Label>
                        <Input
                          id="other-description"
                          placeholder="e.g. Waiting charges at port"
                          value={otherChargesForm.description}
                          onChange={e => setOtherChargesForm(f => ({ ...f, description: e.target.value }))}
                        />
                      </div>

                      <div className="flex gap-2 pt-1">
                        <Button
                          onClick={async () => {
                            if (!otherChargesForm.billing_received_date || !otherChargesForm.charge_type || !otherChargesForm.amount) return;
                            setSavingOtherCharge(true);
                            const data = {
                              billing_received_date: otherChargesForm.billing_received_date,
                              charge_type: otherChargesForm.charge_type,
                              amount: parseFloat(otherChargesForm.amount) || 0,
                              description: otherChargesForm.description,
                            };
                            if (editingOtherChargeId) {
                              await base44.entities.OtherCharges.update(editingOtherChargeId, data);
                              setOtherCharges(prev => prev.map(o => o.id === editingOtherChargeId ? { ...o, ...data } : o));
                            } else {
                              const created = await base44.entities.OtherCharges.create(data);
                              setOtherCharges(prev => [...prev, created]);
                            }
                            setOtherChargesForm({
                              billing_received_date: otherChargesForm.billing_received_date,
                              charge_type: '',
                              amount: '',
                              description: '',
                            });
                            setEditingOtherChargeId(null);
                            setSavingOtherCharge(false);
                          }}
                          disabled={savingOtherCharge || !otherChargesForm.charge_type || !otherChargesForm.amount}
                          className="flex-1"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          {savingOtherCharge ? 'Saving...' : editingOtherChargeId ? 'Update' : 'Add'}
                        </Button>
                        {editingOtherChargeId && (
                          <Button variant="outline" onClick={() => {
                            setEditingOtherChargeId(null);
                            setOtherChargesForm({
                              billing_received_date: otherChargesForm.billing_received_date,
                              charge_type: '',
                              amount: '',
                              description: '',
                            });
                          }}>Cancel</Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Other Charges Table */}
                  <div className="lg:col-span-2">
                    {(() => {
                      const filteredOtherCharges = otherCharges.filter(o => o.billing_received_date === otherChargesForm.billing_received_date);
                      const totalOtherChargesAmount = filteredOtherCharges.reduce((s, o) => s + (o.amount || 0), 0);
                      
                      if (filteredOtherCharges.length === 0) {
                        return (
                          <div className="text-center py-16 text-muted-foreground border rounded-lg bg-card">
                            <DollarSign className="w-10 h-10 mx-auto mb-2 opacity-20" />
                            <p className="text-sm">No adjustments added for this date yet.</p>
                          </div>
                        );
                      }
                      return (
                        <div className="bg-card border rounded-lg overflow-hidden">
                          {/* Summary */}
                          <div className="grid grid-cols-2 divide-x border-b">
                            <div className="p-4">
                              <p className="text-xs text-muted-foreground">Adjustments</p>
                              <p className="text-xl font-bold mt-1">{filteredOtherCharges.length}</p>
                            </div>
                            <div className="p-4">
                              <p className="text-xs text-muted-foreground">Total Added to Gross Rate</p>
                              <p className="text-xl font-bold mt-1 text-green-700">+₱{totalOtherChargesAmount.toFixed(2)}</p>
                            </div>
                          </div>

                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b bg-muted/50">
                                {['Type', 'Amount (₱)', 'Description', ''].map(h => (
                                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {filteredOtherCharges.map(o => (
                                <tr key={o.id} className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${editingOtherChargeId === o.id ? 'bg-primary/5' : ''}`}>
                                  <td className="px-4 py-3">
                                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">{o.charge_type}</span>
                                  </td>
                                  <td className="px-4 py-3 text-right font-semibold text-green-700">+₱{(o.amount || 0).toFixed(2)}</td>
                                  <td className="px-4 py-3 text-muted-foreground text-xs">{o.description || '—'}</td>
                                  <td className="px-4 py-3">
                                    <div className="flex gap-1">
                                      <button onClick={() => {
                                        setEditingOtherChargeId(o.id);
                                        setOtherChargesForm({
                                          billing_received_date: o.billing_received_date,
                                          charge_type: o.charge_type,
                                          amount: o.amount?.toString() || '',
                                          description: o.description || '',
                                        });
                                      }} className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground">
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                      <button onClick={async () => {
                                        if (!confirm('Delete this adjustment record?')) return;
                                        await base44.entities.OtherCharges.delete(o.id);
                                        setOtherCharges(prev => prev.filter(x => x.id !== o.id));
                                      }} className="p-1.5 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive">
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* All Records Tab */}
            <TabsContent value="all" className="space-y-6">
              <div className="bg-card border rounded-lg overflow-hidden">
                {/* Combined Summary */}
                <div className="grid grid-cols-4 divide-x border-b">
                  <div className="p-4">
                    <p className="text-xs text-muted-foreground">Total Deductions</p>
                    <p className="text-xl font-bold mt-1">{deductions.length}</p>
                  </div>
                  <div className="p-4">
                    <p className="text-xs text-muted-foreground">Total Deduction Amount</p>
                    <p className="text-xl font-bold mt-1 text-red-700">₱{deductions.reduce((s, d) => s + (d.insurance_charge || 0) + (d.other_charges || 0), 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                  <div className="p-4">
                    <p className="text-xs text-muted-foreground">Total Reimbursements</p>
                    <p className="text-xl font-bold mt-1">{reimbursements.length}</p>
                  </div>
                  <div className="p-4">
                    <p className="text-xs text-muted-foreground">Total Reimbursement Amount</p>
                    <p className="text-xl font-bold mt-1 text-green-700">₱{reimbursements.reduce((s, r) => s + (r.reimbursement_amount || 0), 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                </div>

                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">Type</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">Billing Date</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">Plate #</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">Owner / Driver</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">Details</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">Amount (₱)</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Deductions */}
                    {deductions.map(d => (
                      <tr key={d.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded font-medium">Deduction</span>
                        </td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">{formatDateDisplay(d.billing_received_date)}</td>
                        <td className="px-4 py-3 font-mono font-semibold text-primary">{d.plate_number}</td>
                        <td className="px-4 py-3">{d.owner_name}</td>
                        <td className="px-4 py-3 text-xs">
                          <div className="text-blue-700">Insurance: ₱{(d.insurance_charge || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                          <div className="text-orange-700">Other: ₱{(d.other_charges || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-red-700">-₱{((d.insurance_charge || 0) + (d.other_charges || 0)).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{d.notes || '—'}</td>
                      </tr>
                    ))}
                    {/* Reimbursements */}
                    {reimbursements.map(r => (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">Reimbursement</span>
                        </td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">{formatDateDisplay(r.billing_received_date)}</td>
                        <td className="px-4 py-3 font-mono font-semibold text-primary">{r.plate_number}</td>
                        <td className="px-4 py-3">{r.owner_name}</td>
                        <td className="px-4 py-3 text-xs">
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium capitalize">{r.reimbursement_type}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-green-700">+₱{(r.reimbursement_amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{r.notes || '—'}</td>
                      </tr>
                    ))}
                    {deductions.length === 0 && reimbursements.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-16 text-center text-muted-foreground text-sm">
                          No records found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}