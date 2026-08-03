import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Download, Loader2, Plus, Trash2, FileText, ArrowLeft, Save } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { formatDateDisplay, formatAmount } from '@/lib/dateUtils';
import { generateQuotationPDF, LOGO_URL } from '@/lib/quotationPdf';

const COMPANY = {
  name: 'Phaeton Trucking Services',
  address: 'Block 3 Lot 1, Pacita 2-B, Cyan St., Brgy. San Lazaro, City of San Pedro, Laguna, Philippines',
  phone: '0931-974-6058',
  email: 'operations@phaetontrucking.com',
  birReg: 'NON-VAT',
  tin: '274-546-612-00000',
};

const TRUCK_TYPES = ['AUV', 'Sub-4W', '6-Wheel', '10-Wheel'];
const TRIP_TYPES = ['One Way', 'Round Trip'];

const blankRow = () => ({
  description: '',
  truck_type: 'AUV',
  trip_type: 'One Way',
  num_trips: 1,
  rate: 0,
  row_total: 0,
});

const todayISO = () => new Date().toISOString().split('T')[0];

export default function Quotation() {
  const { user } = useAuth();
  const [view, setView] = useState('list');
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [form, setForm] = useState(null);

  const loadList = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.Quotation.list('-created_date', 100);
      setQuotations(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadList(); }, []);

  const startNew = () => {
    setForm({
      id: null,
      quote_number: '',
      quote_date: todayISO(),
      validity: '30 days',
      quoted_for_name: '',
      quoted_for_address: '',
      line_items: [blankRow()],
      terms_and_conditions: '',
      prepared_by: user?.full_name || '',
      status: 'draft',
    });
    setView('edit');
  };

  const startEdit = (q) => {
    setForm({
      ...q,
      line_items: (q.line_items && q.line_items.length) ? q.line_items.map((it) => ({ ...it })) : [blankRow()],
    });
    setView('edit');
  };

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const updateRow = (idx, field, value) => {
    setForm((prev) => {
      const items = prev.line_items.map((it, i) => (i === idx ? { ...it, [field]: value } : it));
      const r = items[idx];
      r.row_total = (Number(r.num_trips) || 0) * (Number(r.rate) || 0);
      return { ...prev, line_items: items };
    });
  };

  const addRow = () => setForm((prev) => ({ ...prev, line_items: [...prev.line_items, blankRow()] }));
  const removeRow = (idx) => setForm((prev) => ({ ...prev, line_items: prev.line_items.filter((_, i) => i !== idx) || [blankRow()] }));

  const grandTotal = useMemo(
    () => (form?.line_items || []).reduce((s, it) => s + (Number(it.row_total) || 0), 0),
    [form]
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        quote_number: form.quote_number,
        quote_date: form.quote_date,
        validity: form.validity,
        quoted_for_name: form.quoted_for_name,
        quoted_for_address: form.quoted_for_address,
        line_items: form.line_items,
        terms_and_conditions: form.terms_and_conditions,
        prepared_by: form.prepared_by,
        status: form.status,
      };
      if (form.id) {
        await base44.entities.Quotation.update(form.id, payload);
      } else {
        const created = await base44.entities.Quotation.create(payload);
        setForm((prev) => ({ ...prev, id: created.id }));
      }
      await loadList();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await generateQuotationPDF(form);
    } finally {
      setExporting(false);
    }
  };

  // ===== LIST VIEW =====
  if (view === 'list') {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">Quotation Drafts</h3>
            <p className="text-xs text-muted-foreground">Create, edit, and export price quotations as PDF.</p>
          </div>
          <Button onClick={startNew}>
            <Plus className="w-4 h-4 mr-1" /> New Quotation
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-10">
            <Loader2 className="w-6 h-6 text-primary animate-spin mx-auto mb-2" />
          </div>
        ) : quotations.length === 0 ? (
          <div className="text-center py-12 border rounded-lg bg-muted/20">
            <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No quotation drafts yet. Click "New Quotation" to start.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {quotations.map((q) => (
              <button
                key={q.id}
                onClick={() => startEdit(q)}
                className="text-left bg-card border rounded-lg p-4 hover:border-primary hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="text-sm font-bold text-primary">{q.quote_number || '—'}</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      q.status === 'finalized' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {q.status || 'draft'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-1">{q.quoted_for_name || '—'}</p>
                <p className="text-xs text-muted-foreground">
                  {q.quote_date ? formatDateDisplay(q.quote_date) : '—'}  •  {q.line_items?.length || 0} item(s)
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (!form) return null;

  // ===== EDIT VIEW =====
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={() => { setView('list'); loadList(); }}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to list
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSave} disabled={saving || !form.quote_number}>
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />} Save Draft
          </Button>
          <Button onClick={handleExport} disabled={exporting}>
            {exporting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />} Export PDF
          </Button>
        </div>
      </div>

      {/* PART 1 — Company Header */}
      <section className="bg-card border rounded-lg p-6 text-center">
        <img
          src={LOGO_URL}
          alt="Phaeton Trucking"
          className="w-20 h-20 rounded-full mx-auto mb-3 object-cover ring-1 ring-border bg-white"
        />
        <h2 className="text-lg font-bold text-foreground tracking-tight">{COMPANY.name}</h2>
        <p className="text-xs text-muted-foreground mt-1">{COMPANY.address}</p>
        <p className="text-xs text-muted-foreground">{COMPANY.phone} | {COMPANY.email}</p>
        <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t">
          <span className="text-muted-foreground">BIR Registration: <span className="font-semibold text-foreground">{COMPANY.birReg}</span></span>
          <span className="text-muted-foreground">TIN: <span className="font-semibold text-foreground">{COMPANY.tin}</span></span>
        </div>
      </section>

      {/* PART 2 — Quote Details */}
      <section className="bg-card border rounded-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">2</span>
          <h3 className="text-sm font-semibold">Quote Details</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quote No. *</Label>
            <Input
              value={form.quote_number}
              onChange={(e) => update('quote_number', e.target.value)}
              placeholder="Enter quote number"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quote Date</Label>
            <Input
              type="date"
              value={form.quote_date}
              onChange={(e) => update('quote_date', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Validity</Label>
            <Input
              value={form.validity}
              onChange={(e) => update('validity', e.target.value)}
              placeholder="e.g., 30 days"
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quoted For — Name</Label>
            <Input
              value={form.quoted_for_name}
              onChange={(e) => update('quoted_for_name', e.target.value)}
              placeholder="Client name"
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quoted For — Address</Label>
            <Textarea
              value={form.quoted_for_address}
              onChange={(e) => update('quoted_for_address', e.target.value)}
              rows={2}
              placeholder="Client address"
            />
          </div>
        </div>
      </section>

      {/* PART 3 — Service Items */}
      <section className="bg-card border rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b bg-muted/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">3</span>
            <h3 className="text-sm font-semibold">Service Items</h3>
          </div>
          <Button size="sm" variant="outline" onClick={addRow}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Row
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                {['Service / Route', 'Truck Type', 'Trip Type', 'Trips', 'Rate', 'Total', ''].map((h, i) => (
                  <th
                    key={i}
                    className={
                      i >= 3 && i <= 5
                        ? 'text-right px-3 py-2.5 font-semibold text-xs text-muted-foreground uppercase whitespace-nowrap'
                        : 'text-left px-3 py-2.5 font-semibold text-xs text-muted-foreground uppercase whitespace-nowrap'
                    }
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {form.line_items.map((row, idx) => (
                <tr key={idx} className="border-b last:border-0">
                  <td className="px-3 py-2">
                    <Input
                      value={row.description || ''}
                      onChange={(e) => updateRow(idx, 'description', e.target.value)}
                      placeholder="Description / route"
                      className="h-8 text-sm"
                    />
                  </td>
                  <td className="px-3 py-2 min-w-[112px]">
                    <Select value={row.truck_type} onValueChange={(v) => updateRow(idx, 'truck_type', v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TRUCK_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2 min-w-[112px]">
                    <Select value={row.trip_type} onValueChange={(v) => updateRow(idx, 'trip_type', v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TRIP_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2 w-20">
                    <Input
                      type="number"
                      min="0"
                      value={row.num_trips}
                      onChange={(e) => updateRow(idx, 'num_trips', Number(e.target.value))}
                      className="h-8 text-sm text-right"
                    />
                  </td>
                  <td className="px-3 py-2 w-28">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.rate}
                      onChange={(e) => updateRow(idx, 'rate', Number(e.target.value))}
                      className="h-8 text-sm text-right"
                    />
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-primary whitespace-nowrap">
                    ₱{formatAmount(row.row_total || 0)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => removeRow(idx)}
                      className="text-muted-foreground hover:text-destructive p-1 disabled:opacity-30"
                      disabled={form.line_items.length <= 1}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-4 border-t bg-muted/20 flex justify-end">
          <div className="w-64 flex items-center justify-between bg-primary text-white px-4 py-2.5 rounded font-bold">
            <span className="text-sm">GRAND TOTAL</span>
            <span>₱{formatAmount(grandTotal)}</span>
          </div>
        </div>
      </section>

      {/* PART 4 — Terms & Conditions */}
      <section className="bg-card border rounded-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">4</span>
          <h3 className="text-sm font-semibold">Terms & Conditions</h3>
        </div>
        <Textarea
          value={form.terms_and_conditions}
          onChange={(e) => update('terms_and_conditions', e.target.value)}
          rows={6}
          placeholder="Enter terms & conditions..."
        />
      </section>

      {/* PART 5 — Signature Block */}
      <section className="bg-card border rounded-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">5</span>
          <h3 className="text-sm font-semibold">Signature Block</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Prepared & Certified By</p>
            <div className="border-b pb-1 text-sm font-medium text-foreground">{form.prepared_by || '—'}</div>
          </div>
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Confirmed By</p>
            <div className="border-b pb-1">&nbsp;</div>
            <div className="text-xs text-muted-foreground">Date: ____________________</div>
          </div>
        </div>
      </section>
    </div>
  );
}