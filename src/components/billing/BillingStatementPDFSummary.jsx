import { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Download, Loader2, Check, ChevronDown, X } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useAppData } from '@/lib/AppDataContext';
import { formatDateDisplay, formatAmount } from '@/lib/dateUtils';
import { generateSummaryStatementPDF, LOGO_URL } from '@/lib/summaryStatementPdf';

const COMPANY = {
  name: 'Phaeton Trucking Services',
  address: 'Block 3 Lot 1, Pacita 2-B, Cyan St., Brgy. San Lazaro, City of San Pedro, Laguna, Philippines',
  phone: '0931-974-6058',
  email: 'operations@phaetontrucking.com',
  birReg: 'NON-VAT',
  tin: '274-546-612-00000',
};

export default function BillingStatementPDFSummary() {
  const { user } = useAuth();
  const { billingCycles: cycles, clients } = useAppData();

  const [selectedIds, setSelectedIds] = useState([]);
  const [datePrepared, setDatePrepared] = useState(new Date().toISOString().split('T')[0]);
  const [tripMap, setTripMap] = useState({}); // { [cycleId]: trips[] }
  const [loadingIds, setLoadingIds] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [openMenus, setOpenMenus] = useState({});

  const availableCycles = useMemo(
    () => cycles.filter(c => !c.is_archived).sort((a, b) => (b.cycle_name || '').localeCompare(a.cycle_name || '')),
    [cycles]
  );

  const selectedCycles = useMemo(
    () => selectedIds.map(id => cycles.find(c => c.id === id)).filter(Boolean),
    [selectedIds, cycles]
  );

  const firstCycle = selectedCycles[0] || null;
  const selectedClient = useMemo(
    () => clients.find(c => c.id === firstCycle?.client_account_id) || null,
    [clients, firstCycle]
  );

  const allTrips = useMemo(() => {
    const merged = selectedIds.flatMap(id => (tripMap[id] || []).map(t => ({ ...t, _cycle_name: cycles.find(c => c.id === id)?.cycle_name || '—' })));
    return merged.sort((a, b) => (a.delivery_date || '').localeCompare(b.delivery_date || ''));
  }, [selectedIds, tripMap, cycles]);

  const isLoading = loadingIds.length > 0;
  const hasSelection = selectedIds.length > 0 && !isLoading;
  const dimClass = hasSelection ? '' : 'opacity-50 pointer-events-none';

  const fetchTrips = async (id) => {
    if (tripMap[id]) return;
    setLoadingIds(prev => [...prev, id]);
    try {
      const data = await base44.entities.TripRecord.filter({ billing_cycle_id: id }, 'delivery_date', 500);
      setTripMap(prev => ({ ...prev, [id]: data }));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingIds(prev => prev.filter(x => x !== id));
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    fetchTrips(id);
  };

  const removeSelected = (id) => {
    setSelectedIds(prev => prev.filter(x => x !== id));
  };

  const selectedCycleName = (id) => cycles.find(c => c.id === id)?.cycle_name || id;

  const sortedDates = allTrips.map(t => t.delivery_date).filter(Boolean).sort();
  const periodCovered = sortedDates.length
    ? `${formatDateDisplay(sortedDates[0])} - ${formatDateDisplay(sortedDates[sortedDates.length - 1])}`
    : '—';
  const warehouse = [...new Set(allTrips.map(t => t.pickup_location).filter(Boolean))].join(', ') || '—';
  const soaDates = selectedCycles.map(c => c.billing_received_date).filter(Boolean);
  const soaDate = soaDates.length ? soaDates.join(', ') : '—';

  const handleDownload = async () => {
    if (!hasSelection) return;
    setGenerating(true);
    try {
      const groups = selectedCycles.map(c => ({ cycle: c, trips: tripMap[c.id] || [] }));
      await generateSummaryStatementPDF({
        groups,
        client: selectedClient,
        preparedBy: user?.full_name,
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* PART 1 — Company Header */}
      <section className="bg-card border rounded-lg p-6 text-center">
        <img src={LOGO_URL} alt="Phaeton Trucking" className="w-20 h-20 rounded-full mx-auto mb-3 object-cover ring-1 ring-border bg-white" />
        <h2 className="text-lg font-bold text-foreground tracking-tight">{COMPANY.name}</h2>
        <p className="text-xs text-muted-foreground mt-1">{COMPANY.address}</p>
        <p className="text-xs text-muted-foreground">{COMPANY.phone} | {COMPANY.email}</p>
        <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t">
          <span className="text-muted-foreground">BIR Registration: <span className="font-semibold text-foreground">{COMPANY.birReg}</span></span>
          <span className="text-muted-foreground">TIN: <span className="font-semibold text-foreground">{COMPANY.tin}</span></span>
        </div>
      </section>

      {/* PART 2 — Statement Info & Bill To */}
      <section className="bg-card border rounded-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">2</span>
          <h3 className="text-sm font-semibold">Statement Info & Bill To</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Statement No.</Label>
            <Popover open={openMenus.main} onOpenChange={(o) => setOpenMenus(p => ({ ...p, main: o }))}>
              <PopoverTrigger asChild>
                <button type="button" className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring">
                  <span className={selectedIds.length ? 'text-foreground' : 'text-muted-foreground'}>
                    {selectedIds.length ? `${selectedIds.length} statement(s) selected` : 'Select billing statements'}
                  </span>
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <div className="max-h-64 overflow-y-auto p-1">
                  {availableCycles.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-3 text-center">No billing statements available</p>
                  ) : availableCycles.map(c => {
                    const checked = selectedIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleSelect(c.id)}
                        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent text-left"
                      >
                        <span className={`flex h-4 w-4 items-center justify-center rounded border ${checked ? 'bg-primary border-primary' : 'border-input'}`}>
                          {checked && <Check className="h-3 w-3 text-primary-foreground" />}
                        </span>
                        <span className="flex-1 truncate">{c.cycle_name}</span>
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
            {selectedIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {selectedCycles.map(c => (
                  <span key={c.id} className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs font-medium px-2 py-1 rounded-full">
                    {c.cycle_name}
                    <button type="button" onClick={() => removeSelected(c.id)} className="hover:text-primary/70">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">SOA / Billing Date</Label>
            <div className="text-sm font-medium text-foreground py-2">{soaDate || '—'}</div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Period Covered</Label>
            <div className="text-sm font-medium text-foreground py-2">{periodCovered}</div>
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Credit Terms</Label>
            <div className="text-sm font-medium text-foreground py-2">{selectedClient?.credit_terms ? `${selectedClient.credit_terms} Days` : '—'}</div>
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

      {/* PART 3 — Consolidated Trip Table */}
      <section className={`bg-card border rounded-lg overflow-hidden ${dimClass}`}>
        <div className="px-5 py-3 border-b bg-muted/40 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">3</span>
          <h3 className="text-sm font-semibold">Description of Services Rendered ({allTrips.length})</h3>
        </div>
        {isLoading ? (
          <div className="text-center py-10">
            <Loader2 className="w-6 h-6 text-primary animate-spin mx-auto mb-2" />
            <p className="text-muted-foreground text-sm">Loading trip records...</p>
          </div>
        ) : allTrips.length === 0 ? (
          <p className="text-center py-10 text-muted-foreground text-sm">Select billing statements to load trips</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-2.5 font-semibold text-xs text-muted-foreground uppercase">Date</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-xs text-muted-foreground uppercase">Billing Statement</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-xs text-muted-foreground uppercase">DR No.</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-xs text-muted-foreground uppercase">Route</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-xs text-muted-foreground uppercase">Amount</th>
                </tr>
              </thead>
              <tbody>
                {allTrips.map(trip => (
                  <tr key={trip.id} className="border-b last:border-0">
                    <td className="px-4 py-2.5 text-sm whitespace-nowrap">{formatDateDisplay(trip.delivery_date)}</td>
                    <td className="px-4 py-2.5 text-sm text-muted-foreground">{trip._cycle_name}</td>
                    <td className="px-4 py-2.5 text-sm text-muted-foreground whitespace-nowrap">{trip.dr_number || '—'}</td>
                    <td className="px-4 py-2.5 text-sm text-muted-foreground">{trip.delivery_code || '—'}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-primary whitespace-nowrap">₱{formatAmount(trip.gross_rate || 0)}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50 italic">
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">—</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">—</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">—</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">NOTHING FOLLOWS</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">—</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        {/* Per-statement totals */}
        <div className="px-5 py-4 border-t bg-muted/20 flex flex-col items-end gap-3">
          {selectedCycles.map(c => {
            const trips = tripMap[c.id] || [];
            const totalGross = trips.reduce((s, t) => s + (t.gross_rate || 0), 0);
            const totalTax = totalGross * 0.02;
            const amountDue = totalGross - totalTax;
            return (
              <div key={c.id} className="w-80 space-y-1 text-sm">
                <TotalLine label={c.cycle_name.toUpperCase()} value={totalGross} bold />
                <TotalLine label="2% WITH HOLDING TAX (IF APPLICABLE)" value={totalTax} />
                <TotalLine label="TOTAL (VAT INC, IF APPLICABLE)" value={amountDue} bold />
                <div className="border-t my-1" />
              </div>
            );
          })}
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
        <Button onClick={handleDownload} disabled={generating || !hasSelection} size="lg">
          {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
          {generating ? 'Generating...' : 'Download PDF'}
        </Button>
      </div>
    </div>
  );
}

function TotalLine({ label, value, bold = false }) {
  return (
    <div className="flex items-center justify-between">
      <span className={bold ? 'font-semibold text-foreground' : 'text-muted-foreground'}>{label}</span>
      <span className={bold ? 'font-bold text-foreground' : 'font-medium'}>₱{formatAmount(value)}</span>
    </div>
  );
}