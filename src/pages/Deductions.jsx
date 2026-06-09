import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus, Pencil, Receipt, DollarSign } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
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
  const [activeTab, setActiveTab] = useState('deductions'); // 'deductions' | 'reimbursements'
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

  const load = async () => {
    setLoading(true);
    const [b, d, summaries, r] = await Promise.all([
      base44.entities.BillingCycle.list('-billing_received_date', 200),
      base44.entities.BillingDeduction.list('-billing_received_date', 500),
      base44.entities.BillingReceivedSummary.list('-billing_received_date', 200),
      base44.entities.Reimbursement.list('-billing_received_date', 500),
    ]);
    setBillingCycles(b);
    setDeductions(d);
    setBillingReceivedSummaries(summaries);
    setReimbursements(r);
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
              <TabsTrigger value="deductions">Deductions</TabsTrigger>
              <TabsTrigger value="reimbursements">Reimbursements</TabsTrigger>
              <TabsTrigger value="all">All Records</TabsTrigger>
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
                    // Load owners for this date
                    const cycles = billingCycles.filter(c => c.billing_received_date === v);
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
                        // Also get all ACTIVE subcontractors for cases with no trip data
                        base44.entities.Subcontractor.filter({ status: 'Active' }, 'plate_number', 500).then(subs => {
                          subs.forEach(s => {
                            if (!seen[s.plate_number]) {
                              seen[s.plate_number] = { plate_number: s.plate_number, owner_name: s.owner_name };
                            }
                          });
                          setDateOwners(Object.values(seen).sort((a, b) => a.plate_number.localeCompare(b.plate_number)));
                        });
                      });
                    }
                  }}
                >
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
                            } else {
                              await base44.entities.Reimbursement.create(data);
                            }
                            await load();
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

            {/* All Records Tab */}
            <TabsContent value="all" className="space-y-6">
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
                <div className="bg-card border rounded-lg overflow-hidden">
                  {/* Combined Summary */}
                  <div className="grid grid-cols-4 divide-x border-b">
                    <div className="p-4">
                      <p className="text-xs text-muted-foreground">Deductions</p>
                      <p className="text-xl font-bold mt-1">{filteredDeductions.length}</p>
                    </div>
                    <div className="p-4">
                      <p className="text-xs text-muted-foreground">Total Deductions</p>
                      <p className="text-xl font-bold mt-1 text-red-700">₱{(totalInsurance + totalOther).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                    <div className="p-4">
                      <p className="text-xs text-muted-foreground">Reimbursements</p>
                      <p className="text-xl font-bold mt-1">{reimbursements.filter(r => r.billing_received_date === selectedDate).length}</p>
                    </div>
                    <div className="p-4">
                      <p className="text-xs text-muted-foreground">Total Reimbursements</p>
                      <p className="text-xl font-bold mt-1 text-green-700">₱{reimbursements.filter(r => r.billing_received_date === selectedDate).reduce((s, r) => s + (r.reimbursement_amount || 0), 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                  </div>

                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">Type</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">Plate #</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">Owner / Driver</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">Details</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">Amount (₱)</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Deductions */}
                      {filteredDeductions.map(d => (
                        <tr key={d.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3">
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded font-medium">Deduction</span>
                          </td>
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
                      {reimbursements.filter(r => r.billing_received_date === selectedDate).map(r => (
                        <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3">
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">Reimbursement</span>
                          </td>
                          <td className="px-4 py-3 font-mono font-semibold text-primary">{r.plate_number}</td>
                          <td className="px-4 py-3">{r.owner_name}</td>
                          <td className="px-4 py-3 text-xs">
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium capitalize">{r.reimbursement_type}</span>
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-green-700">+₱{(r.reimbursement_amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{r.notes || '—'}</td>
                        </tr>
                      ))}
                      {filteredDeductions.length === 0 && reimbursements.filter(r => r.billing_received_date === selectedDate).length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-16 text-center text-muted-foreground text-sm">
                            No records found for {selectedDate}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}