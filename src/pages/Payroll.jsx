import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Download, Pencil } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { jsPDF } from 'jspdf';
import TripEditDialog from '@/components/payroll/TripEditDialog';

export default function Payroll() {
  const [trips, setTrips] = useState([]);
  const [billingCycles, setBillingCycles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCycle, setSelectedCycle] = useState('all');
  const [editTrip, setEditTrip] = useState(null);

  const load = async () => {
    setLoading(true);
    const [t, b] = await Promise.all([
      base44.entities.TripRecord.list('-delivery_date', 500),
      base44.entities.BillingCycle.list('-created_date', 100),
    ]);
    setTrips(t);
    setBillingCycles(b);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filteredTrips = trips.filter(t => {
    return selectedCycle === 'all' || t.billing_cycle_id === selectedCycle;
  });

  const calculateTotals = (trip) => {
    const gross = trip.gross_rate || 0;
    const tax = gross * 0.02;
    const hidden = gross * 0.04;
    const admin = gross * 0.06;
    const insurance = trip.insurance_charge || 0;
    const other = trip.other_charges || 0;
    const net = gross - tax - hidden - admin - insurance - other;
    return { gross, tax, hidden, admin, insurance, other, net };
  };

  const grandTotal = filteredTrips.reduce((sum, trip) => {
    return sum + calculateTotals(trip).net;
  }, 0);

  const grandGross = filteredTrips.reduce((sum, trip) => {
    return sum + trip.gross_rate || 0;
  }, 0);

  const exportPDF = () => {
    const doc = new jsPDF();
    const cycleLabel = selectedCycle === 'all' ? 'All Cycles' : billingCycles.find(b => b.id === selectedCycle)?.cycle_name || selectedCycle;

    doc.setFontSize(16);
    doc.text('PT Tracking - Payroll Report', 14, 18);
    doc.setFontSize(10);
    doc.text(`Billing Cycle: ${cycleLabel}`, 14, 26);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 32);

    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    let y = 42;
    doc.text('Plate #', 14, y);
    doc.text('Owner', 35, y);
    doc.text('Truck', 75, y);
    doc.text('Route', 95, y);
    doc.text('Gross', 140, y);
    doc.text('Net', 165, y);
    doc.setFont(undefined, 'normal');
    y += 2;
    doc.line(14, y, 196, y);
    y += 5;

    filteredTrips.forEach(trip => {
      if (y > 270) { doc.addPage(); y = 20; }
      const totals = calculateTotals(trip);
      doc.text(trip.plate_number, 14, y);
      doc.text(trip.owner_name?.substring(0, 18) || '', 35, y);
      doc.text(trip.truck_type || '', 75, y);
      doc.text(`${trip.delivery_code}`, 95, y);
      doc.text(`₱${totals.gross.toFixed(2)}`, 140, y);
      doc.text(`₱${totals.net.toFixed(2)}`, 165, y);
      y += 6;
    });

    y += 3;
    doc.line(14, y, 196, y);
    y += 5;
    doc.setFont(undefined, 'bold');
    doc.text(`TOTAL NET PAYROLL: ₱${grandTotal.toFixed(2)}`, 14, y);

    doc.save(`Payroll_${cycleLabel.replace(/\s/g, '_')}.pdf`);
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Payroll Report"
        subtitle="View and manage trip payroll by billing cycle"
        actions={
          <Button onClick={exportPDF} size="sm" variant="outline">
            <Download className="w-4 h-4 mr-1.5" /> Export PDF
          </Button>
        }
      />

      {/* Filter */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="w-80">
          <Select value={selectedCycle} onValueChange={setSelectedCycle}>
            <SelectTrigger><SelectValue placeholder="Select billing cycle" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Billing Cycles</SelectItem>
              {billingCycles.map(b => <SelectItem key={b.id} value={b.id}>{b.cycle_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Total Trips</p>
          <p className="text-xl font-bold mt-1">{filteredTrips.length}</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Gross Amount</p>
          <p className="text-xl font-bold mt-1 text-blue-700">₱{grandGross.toFixed(2)}</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Net Payroll</p>
          <p className="text-xl font-bold mt-1 text-emerald-700">₱{grandTotal.toFixed(2)}</p>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Loading payroll data...</div>
      ) : filteredTrips.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">No trips found for the selected billing cycle</p>
        </div>
      ) : (
        <div className="bg-card border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  {['Plate #', 'Owner / Driver', 'Truck', 'Client', 'Route', 'Delivery Code', 'Gross Rate', 'Tax (2%)', 'Hidden (4%)', 'Admin (6%)', 'Insurance', 'Other', 'Net Payroll', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredTrips.map(trip => {
                  const totals = calculateTotals(trip);
                  return (
                    <tr key={trip.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono font-semibold text-primary">{trip.plate_number}</td>
                      <td className="px-4 py-3">{trip.owner_name}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">{trip.truck_type}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{trip.client_name}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        <div>{trip.pickup_location}</div>
                        <div className="text-muted-foreground/60">→ {trip.delivery_location}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{trip.delivery_code}</td>
                      <td className="px-4 py-3 text-right font-semibold">₱{totals.gross.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-red-600">-₱{totals.tax.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-orange-600">-₱{totals.hidden.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-amber-600">-₱{totals.admin.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-blue-600">-₱{totals.insurance.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-purple-600">-₱{totals.other.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-700">₱{totals.net.toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <button 
                          onClick={() => setEditTrip(trip)} 
                          className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/50">
                  <td colSpan={12} className="px-4 py-3 text-sm font-semibold text-right">Grand Total Net Payroll</td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-700 text-base">₱{grandTotal.toFixed(2)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <TripEditDialog
        open={!!editTrip}
        onClose={() => setEditTrip(null)}
        onSaved={load}
        trip={editTrip}
      />
    </div>
  );
}