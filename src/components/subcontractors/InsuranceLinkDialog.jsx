import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDateDisplay } from '@/lib/dateUtils';
import { Check, Link2, CheckCircle2 } from 'lucide-react';
import moment from 'moment';

// Compute all 4 quarter due dates from insurance_start_date
const getQuarterDates = (startDate) => {
  if (!startDate) return [];
  return [1, 2, 3, 4].map(q => ({
    label: `Q${q}`,
    dueDate: moment(startDate).add(q * 3, 'months').format('YYYY-MM-DD'),
  }));
};

export default function InsuranceLinkDialog({ open, onClose, subcontractor }) {
  const [billingDates, setBillingDates] = useState([]);
  const [deductions, setDeductions] = useState([]);
  const [selectedQuarter, setSelectedQuarter] = useState(null);
  const [form, setForm] = useState({ billing_received_date: '', insurance_charge: '' });
  const [saving, setSaving] = useState(false);
  const [savedQ, setSavedQ] = useState(null);

  useEffect(() => {
    if (!open || !subcontractor) return;
    setSelectedQuarter(null);
    setSavedQ(null);
    setForm({ billing_received_date: '', insurance_charge: '' });

    Promise.all([
      base44.entities.BillingCycle.list('-billing_received_date', 200),
      base44.entities.BillingDeduction.filter({ plate_number: subcontractor.plate_number }),
    ]).then(([cycles, deds]) => {
      const seen = new Set();
      const dates = [];
      cycles.forEach(c => {
        if (c.billing_received_date && !seen.has(c.billing_received_date)) {
          seen.add(c.billing_received_date);
          dates.push(c.billing_received_date);
        }
      });
      setBillingDates(dates.sort((a, b) => b.localeCompare(a)));
      setDeductions(deds);
    });
  }, [open, subcontractor]);

  if (!subcontractor) return null;

  const quarters = getQuarterDates(subcontractor.insurance_start_date);

  // Check which quarters already have a deduction with insurance_charge > 0
  // We match by looking at deductions whose billing_received_date falls within the quarter window
  const isPaid = (quarterDueDate) => {
    return deductions.some(d => d.insurance_charge > 0 && d.billing_received_date <= quarterDueDate);
  };

  const handleSelectQuarter = (q) => {
    setSelectedQuarter(q);
    setForm({ billing_received_date: '', insurance_charge: '' });
    setSavedQ(null);
  };

  const handleSave = async () => {
    if (!form.billing_received_date || !selectedQuarter) return;
    setSaving(true);

    const existing = await base44.entities.BillingDeduction.filter({
      billing_received_date: form.billing_received_date,
      plate_number: subcontractor.plate_number,
    });

    const data = {
      billing_received_date: form.billing_received_date,
      plate_number: subcontractor.plate_number,
      owner_name: subcontractor.owner_name,
      insurance_charge: parseFloat(form.insurance_charge) || 0,
      other_charges: existing[0]?.other_charges || 0,
      notes: `${selectedQuarter.label} insurance renewal linked`,
    };

    if (existing.length > 0) {
      await base44.entities.BillingDeduction.update(existing[0].id, {
        insurance_charge: data.insurance_charge,
        notes: data.notes,
        owner_name: data.owner_name,
      });
    } else {
      await base44.entities.BillingDeduction.create(data);
    }

    // Refresh deductions
    const updated = await base44.entities.BillingDeduction.filter({ plate_number: subcontractor.plate_number });
    setDeductions(updated);
    setSavedQ(selectedQuarter.label);
    setSelectedQuarter(null);
    setForm({ billing_received_date: '', insurance_charge: '' });
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-primary" />
            Insurance Renewals — {subcontractor.plate_number}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">{subcontractor.owner_name}</p>
        </DialogHeader>

        {/* Q1–Q4 tracker */}
        <div className="grid grid-cols-4 gap-2 mt-2">
          {quarters.map(q => {
            const paid = isPaid(q.dueDate);
            const isSelected = selectedQuarter?.label === q.label;
            return (
              <button
                key={q.label}
                onClick={() => handleSelectQuarter(q)}
                className={`rounded-lg border p-3 text-center transition-all ${
                  paid
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                    : isSelected
                    ? 'border-primary bg-primary/5 text-primary ring-1 ring-primary'
                    : 'border-border hover:border-primary/50 hover:bg-muted/30'
                }`}
              >
                <p className="font-bold text-sm">{q.label}</p>
                {paid ? (
                  <CheckCircle2 className="w-4 h-4 mx-auto mt-1 text-emerald-600" />
                ) : (
                  <p className="text-[10px] text-muted-foreground mt-1">Pending</p>
                )}
                <p className="text-[9px] text-muted-foreground mt-0.5">
                  Due {formatDateDisplay(q.dueDate)}
                </p>
              </button>
            );
          })}
        </div>

        {savedQ && (
          <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            <CheckCircle2 className="w-4 h-4" />
            {savedQ} deduction linked successfully. Deductions page updated.
          </div>
        )}

        {/* Link form for selected quarter */}
        {selectedQuarter && (
          <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
            <p className="text-sm font-semibold">
              Link {selectedQuarter.label} to a Billing Deduction
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                Due: {formatDateDisplay(selectedQuarter.dueDate)}
              </span>
            </p>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Billing Received Date</p>
              <Select
                value={form.billing_received_date}
                onValueChange={v => setForm(f => ({ ...f, billing_received_date: v }))}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Select date..." />
                </SelectTrigger>
                <SelectContent>
                  {billingDates.map(d => (
                    <SelectItem key={d} value={d} className="text-sm">{formatDateDisplay(d)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Insurance Charge (₱)</p>
              <Input
                type="number"
                placeholder="0.00"
                className="h-8 text-sm"
                value={form.insurance_charge}
                onChange={e => setForm(f => ({ ...f, insurance_charge: e.target.value }))}
              />
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1"
                disabled={saving || !form.billing_received_date}
                onClick={handleSave}
              >
                <Check className="w-3.5 h-3.5 mr-1" />
                {saving ? 'Saving...' : 'Create Deduction'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setSelectedQuarter(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {!selectedQuarter && !savedQ && (
          <p className="text-xs text-muted-foreground text-center">
            Click a quarter above to link it to a billing deduction.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}