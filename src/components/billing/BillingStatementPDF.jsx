import { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Download, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useAppData } from '@/lib/AppDataContext';
import { formatDateDisplay, formatAmount } from '@/lib/dateUtils';
import { generateBillingStatementPDF } from '@/lib/billingStatementPdf';

export default function BillingStatementPDF() {
  const { user } = useAuth();
  const { billingCycles: cycles, clients } = useAppData();

  const [selectedId, setSelectedId] = useState('');
  const [soaDate, setSoaDate] = useState(new Date().toISOString().split('T')[0]);
  const [trips, setTrips] = useState([]);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [generating, setGenerating] = useState(false);

  const selectedCycle = useMemo(() => cycles.find(c => c.id === selectedId) || null, [cycles, selectedId]);
  const selectedClient = useMemo(() => clients.find(c => c.id === selectedCycle?.client_account_id) || null, [clients, selectedCycle]);

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

  const handleDownload = () => {
    if (!selectedCycle) return;
    setGenerating(true);
    try {
      generateBillingStatementPDF({
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

  return (
    <div className="space-y-5">
      {/* Statement selector */}
      <div className="bg-card border rounded-lg p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Statement No.</Label>
            <Select value={selectedId} onValueChange={handleSelect}>
              <SelectTrigger><SelectValue placeholder="Select a billing statement" /></SelectTrigger>
              <SelectContent>
                {cycles
                  .slice()
                  .sort((a, b) => (b.cycle_name || '').localeCompare(a.cycle_name || ''))
                  .map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.cycle_name}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">SOA / Billing Date</Label>
            <Input type="date" value={soaDate} onChange={e => setSoaDate(e.target.value)} />
          </div>
        </div>
      </div>

      {!selectedId ? (
        <div className="text-center py-16 bg-card border rounded-lg">
          <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">Select a billing statement to generate the PDF</p>
        </div>
      ) : loadingTrips ? (
        <div className="text-center py-16 bg-card border rounded-lg">
          <Loader2 className="w-7 h-7 text-primary animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">Loading trip records...</p>
        </div>
      ) : (
        <>
          {/* Read-only preview */}
          <div className="bg-card border rounded-lg overflow-hidden">
            <div className="px-5 py-3 border-b bg-muted/40">
              <h3 className="text-sm font-semibold">Statement Preview</h3>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
              <PreviewRow label="Statement No." value={selectedCycle?.cycle_name} />
              <PreviewRow label="SOA / Billing Date" value={formatDateDisplay(soaDate)} />
              <PreviewRow label="Period Covered" value={periodCovered} />
              <PreviewRow label="Credit Terms" value="30 Days" />
            </div>
            <div className="px-5 pb-5">
              <div className="border rounded-lg p-4 bg-muted/20">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Bill To</p>
                <p className="text-base font-bold text-foreground">{selectedClient?.client_name || '—'}</p>
                {selectedClient?.address && <p className="text-sm text-muted-foreground mt-1">{selectedClient.address}</p>}
                {selectedClient?.tin && <p className="text-sm text-muted-foreground">TIN: {selectedClient.tin}</p>}
                <p className="text-sm text-muted-foreground">Warehouse: {warehouse}</p>
                {selectedClient?.sub_accounts?.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Sub-Account(s): {selectedClient.sub_accounts.map(s => s.sub_account_name).join(', ')}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Trip rows preview */}
          <div className="bg-card border rounded-lg overflow-hidden">
            <div className="px-5 py-3 border-b bg-muted/40 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Trip Records ({trips.length})</h3>
            </div>
            {trips.length === 0 ? (
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
                        <td className="px-4 py-2.5"><span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">{trip.truck_type}</span></td>
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
          </div>

          {/* Download button */}
          <div className="flex justify-end">
            <Button onClick={handleDownload} disabled={generating || !selectedCycle} size="lg">
              {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              {generating ? 'Generating...' : 'Download PDF'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function PreviewRow({ label, value }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide w-36 shrink-0">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
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