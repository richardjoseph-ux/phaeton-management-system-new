import { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Loader2, Truck } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useAppData } from '@/lib/AppDataContext';
import { formatDateDisplay, formatAmount } from '@/lib/dateUtils';
import { generateBillingStatementPDF, LOGO_URL } from '@/lib/billingStatementPdf';

const COMPANY = {
  name: 'Phaeton Trucking Services',
  address: 'Block 3 Lot 1, Pacita 2-B, Cyan St., Brgy. San Lazaro, City of San Pedro, Laguna, Philippines',
  phone: '0931-974-6058',
  email: 'operations@phaetontrucking.com',
  birReg: 'NON-VAT',
  tin: '274-546-612-00000',
};

export default function BillingStatementPDF() {
  const { user } = useAuth();
  const { billingCycles: cycles, clients } = useAppData();

  const [selectedId, setSelectedId] = useState('');
  const [soaDate, setSoaDate] = useState(new Date().toISOString().split('T')[0]);
  const [datePrepared, setDatePrepared] = useState(new Date().toISOString().split('T')[0]);
  const [trips, setTrips] = useState([]);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [generating, setGenerating] = useState(false);

  const selectedCycle = useMemo(() => cycles.find(c => c.id === selectedId) || null, [cycles, selectedId]);
  const selectedClient = useMemo(() => clients.find(c => c.id === selectedCycle?.client_account_id) || null, [clients, selectedCycle]);
  const hasSelection = !!selectedId && !loadingTrips;

  const handleSelect = async (id) => {
    setSelectedId(id);
    setTrips([]);
    if (!id) return;
    setLoadingTrips(true);
    try {
      const data = await base44.entities.TripRecord.filter({ billing_cycle_id: id }, 'delivery_date', 500);
      setTrips(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingTrips(false);
    }
  };

  const sortedDates = trips.map(t => t.delivery_date).filter(Boolean).sort();
  const periodCovered = sortedDates.length
    ? `${formatDateDisplay(sortedDates[0])} - ${formatDateDisplay(sortedDates[sortedDates.length - 1])}`
    : '—';
  const warehouse = [...new Set(trips.map(t => t.pickup_location).filter(Boolean))].join(', ') || '—';

  const totalGross = trips.reduce((s, t) => s + (t.gross_rate || 0), 0);
  const totalTax = totalGross * 0.02;
  const amountDue = totalGross - totalTax;

  const handleDownload = async () => {
    if (!selectedCycle) return;
    setGenerating(true);
    try {
      await generateBillingStatementPDF({
        cycle: selectedCycle,
        client: selectedClient,
        trips,
        soaDate,
        preparedBy: user?.full_name,
      });
    } finally {
      setGenerating(false);
    }
  };

  const dimClass = hasSelection ? '' : 'opacity-50 pointer-events-none';

  return (
    <div className="space-y-5">
      {/* PART 1 — Company Header */}
      <section className="bg-card border rounded-lg p-6 text-center">
        <img src={LOGO_URL} alt="Phaeton Trucking" className="w-14 h-14 rounded-full mx-auto mb-3 object-cover ring-1 ring-border" />
        <h2 className="text-lg font-bold text-foreground tracking-tight">{COMPANY.name}</h2>
        <p className="text-xs text-muted-foreground mt-1">{COMPANY.address}</p>
        <p className="text-xs text-muted-foreground">{COMPANY.phone} | {COMPANY.email}</p>
        <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t">
          <span className="text-muted-foreground">BIR Registration: <span className="font-semibold text-foreground">{COMPANY.birReg}</span></span>
          <span className="text-muted-foreground">TIN: <span className="font-semibold text-foreground">{COMPANY.tin}</span></span>
        </div>
      </section>

      {/* PART 2 — Statement Info & Bill To */}
      <section className={`bg-card border rounded-lg p-5 ${dimClass}`}>
        <div className="flex items-center gap-2 mb-4">
          <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">2</span>
          <h3 className="text-sm font-semibold">Statement Info & Bill To</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Statement No.</Label>
            <Select value={selectedId} onValueChange={handleSelect}>
              <SelectTrigger><SelectValue placeholder="Select a billing statement" /></SelectTrigger>
              <SelectContent>
                {cycles.slice().sort((a, b) => (b.cycle_name || '').localeCompare(a.cycle_name || '')).map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.cycle_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">SOA / Billing Date</Label>
            <Input type="date" value={soaDate} onChange={e => setSoaDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Period Covered</Label>
            <div className="text-sm font-medium text-foreground py-2">{periodCovered}</div>
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Credit Terms</Label>
            <div className="text-sm font-medium text-foreground py-2">30 Days</div>
          </div>
        </div>
        <div className="mt-4 border-t pt-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Bill To</p>
          <p className="text-base font-bold text-foreground">{selectedClient?.client_name || '—'}</p>
          {selectedClient?.address && <p className="text-sm text-muted-foreground mt-1">{selectedClient.address}</p>}
          {selectedClient?.tin && <p className="text-sm text-muted-foreground">TIN: {selectedClient.tin}</p>}
          <p className="text-sm text-muted-foreground">Warehouse: {warehouse}</p>
        </div>
      </section>

      {/* PART 3 — Trip Summary */}
      <section className={`bg-card border rounded-lg overflow-hidden ${dimClass}`}>
        <div className="px-5 py-3 border-b bg-muted/40 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">3</span>
          <h3 className="text-sm font-semibold">Description of Services Rendered ({trips.length})</h3>
        </div>
        {loadingTrips ? (
          <div className="text-center py-10">
            <Loader2 className="w-6 h-6 text-primary animate-spin mx-auto mb-2" />
            <p className="text-muted-foreground text-sm">Loading trip records...</p>
          </div>
        ) : trips.length === 0 ? (
          <p className="text-center py-10 text-muted-foreground text-sm">No trips assigned to this billing statement</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  {['Date', 'Route', 'Truck Type', 'Amount'].map(h => (
                    <th key={h} className={h === 'Amount' ? 'text-right px-4 py-2.5 font-semibold text-xs text-muted-foreground uppercase' : 'text-left px-4 py-2.5 font-semibold text-xs text-muted-foreground uppercase'}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trips.map(trip => (
                  <tr key={trip.id} className="border-b last:border-0">
                    <td className="px-4 py-2.5 text-sm whitespace-nowrap">{formatDateDisplay(trip.delivery_date)}</td>
                    <td className="px-4 py-2.5 text-sm text-muted-foreground">{trip.pickup_location} → {trip.delivery_location}</td>
                    <td className="px-4 py-2.5"><span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium inline-flex items-center gap-1"><Truck className="w-3 h-3" />{trip.truck_type}</span></td>
                    <td className="px-4 py-2.5 text-right font-semibold text-primary whitespace-nowrap">₱{formatAmount(trip.gross_rate || 0)}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50 italic">
                  <td colSpan={4} className="px-4 py-2.5 text-xs text-muted-foreground">NOTHING FOLLOWS</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        <div className="px-5 py-4 border-t bg-muted/20 flex justify-end">
          <div className="w-72 space-y-1.5 text-sm">
            <TotalLine label="Total Gross ex VAT" value={totalGross} />
            <TotalLine label="Total Due" value={totalGross} />
            <TotalLine label="2% Withholding Tax" value={totalTax} className="text-red-600" />
            <div className="border-t pt-1.5">
              <div className="flex items-center justify-between bg-primary text-white px-3 py-2 rounded font-bold">
                <span>AMOUNT DUE</span>
                <span>₱{formatAmount(amountDue)}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PART 4 — Signature Block */}
      <section className={`bg-card border rounded-lg p-5 ${dimClass}`}>
        <div className="flex items-center gap-2 mb-4">
          <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">4</span>
          <h3 className="text-sm font-semibold">Signature Block</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Prepared By</p>
            <div className="border-b pb-1 text-sm font-medium text-foreground">{user?.full_name || '—'}</div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Date Prepared</Label>
              <Input type="date" value={datePrepared} onChange={e => setDatePrepared(e.target.value)} className="h-8 text-xs" />
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Received By</p>
            <div className="border-b pb-1">&nbsp;</div>
            <div className="text-xs text-muted-foreground">Date Received: ____________________</div>
          </div>
        </div>
      </section>

      {/* Download */}
      <div className="flex justify-end">
        <Button onClick={handleDownload} disabled={generating || !hasSelection || !selectedCycle} size="lg">
          {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
          {generating ? 'Generating...' : 'Download PDF'}
        </Button>
      </div>
    </div>
  );
}

function TotalLine({ label, value, className = '' }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold ${className}`}>₱{formatAmount(value)}</span>
    </div>
  );
}