import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Download, Printer } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { jsPDF } from 'jspdf';

export default function Payroll() {
  const [trips, setTrips] = useState([]);
  const [subcontractors, setSubcontractors] = useState([]);
  const [billingCycles, setBillingCycles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCycle, setSelectedCycle] = useState('all');
  const [selectedSub, setSelectedSub] = useState('all');

  const load = async () => {
    setLoading(true);
    const [t, s, b] = await Promise.all([
      base44.entities.TripRecord.list('-delivery_date', 500),
      base44.entities.Subcontractor.list('owner_name', 200),
      base44.entities.BillingCycle.list('-created_date', 100),
    ]);
    setTrips(t);
    setSubcontractors(s);
    setBillingCycles(b);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filteredTrips = trips.filter(t => {
    const cycleMatch = selectedCycle === 'all' || t.billing_cycle_id === selectedCycle;
    const subMatch = selectedSub === 'all' || t.subcontractor_id === selectedSub;
    return cycleMatch && subMatch;
  });

  // Group by subcontractor
  const grouped = {};
  filteredTrips.forEach(trip => {
    const key = trip.subcontractor_id || trip.plate_number;
    if (!grouped[key]) {
      grouped[key] = {
        sub_id: subcontractors.find(s => s.id === trip.subcontractor_id)?.sub_id || '—',
        owner_name: trip.owner_name,
        plate_number: trip.plate_number,
        truck_type: trip.truck_type,
        trips: [],
        total_gross: 0,
        total_tax: 0,
        total_hidden: 0,
        total_admin: 0,
        total_net: 0,
      };
    }
    grouped[key].trips.push(trip);
    grouped[key].total_gross += trip.gross_rate || 0;
    grouped[key].total_tax += trip.tax_deduction || 0;
    grouped[key].total_hidden += trip.hidden_fee || 0;
    grouped[key].total_admin += trip.admin_fee || 0;
    grouped[key].total_net += trip.net_payroll || 0;
  });

  const payrollData = Object.values(grouped);
  const grandNet = payrollData.reduce((s, r) => s + r.total_net, 0);
  const grandGross = payrollData.reduce((s, r) => s + r.total_gross, 0);

  const exportPDF = () => {
    const doc = new jsPDF();
    const cycleLabel = selectedCycle === 'all' ? 'All Cycles' : billingCycles.find(b => b.id === selectedCycle)?.cycle_name || selectedCycle;

    doc.setFontSize(16);
    doc.text('PT Tracking - Payroll Summary', 14, 18);
    doc.setFontSize(10);
    doc.text(`Billing Cycle: ${cycleLabel}`, 14, 26);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 32);

    let y = 42;
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.text('Sub ID', 14, y);
    doc.text('Plate #', 38, y);
    doc.text('Owner', 65, y);
    doc.text('Truck', 110, y);
    doc.text('Trips', 130, y);
    doc.text('Gross', 145, y);
    doc.text('Net Payroll', 170, y);
    doc.setFont(undefined, 'normal');
    y += 2;
    doc.line(14, y, 196, y);
    y += 5;

    payrollData.forEach(row => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(row.sub_id, 14, y);
      doc.text(row.plate_number, 38, y);
      doc.text(row.owner_name?.substring(0, 22) || '', 65, y);
      doc.text(row.truck_type || '', 110, y);
      doc.text(String(row.trips.length), 132, y);
      doc.text(`P${row.total_gross.toFixed(2)}`, 145, y);
      doc.text(`P${row.total_net.toFixed(2)}`, 170, y);
      y += 7;
    });

    y += 3;
    doc.line(14, y, 196, y);
    y += 5;
    doc.setFont(undefined, 'bold');
    doc.text(`TOTAL NET PAYROLL: P${grandNet.toFixed(2)}`, 14, y);

    doc.save(`Payroll_${cycleLabel.replace(/\s/g, '_')}.pdf`);
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Payroll Summary"
        subtitle="View and export payroll per subcontractor"
        actions={
          <Button onClick={exportPDF} size="sm" variant="outline">
            <Download className="w-4 h-4 mr-1.5" /> Export PDF
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="w-60">
          <Select value={selectedCycle} onValueChange={setSelectedCycle}>
            <SelectTrigger><SelectValue placeholder="Filter by billing cycle" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Billing Cycles</SelectItem>
              {billingCycles.map(b => <SelectItem key={b.id} value={b.id}>{b.cycle_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="w-60">
          <Select value={selectedSub} onValueChange={setSelectedSub}>
            <SelectTrigger><SelectValue placeholder="Filter by subcontractor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subcontractors</SelectItem>
              {subcontractors.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.owner_name} — {s.plate_number}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Subcontractors', value: payrollData.length },
          { label: 'Total Trips', value: filteredTrips.length },
          { label: 'Gross Amount', value: `₱${grandGross.toFixed(2)}`, color: 'text-blue-700' },
          { label: 'Net Payroll', value: `₱${grandNet.toFixed(2)}`, color: 'text-emerald-700' },
        ].map(card => (
          <div key={card.label} className="bg-card border rounded-lg p-4">
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className={`text-xl font-bold mt-1 ${card.color || 'text-foreground'}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Loading payroll data...</div>
      ) : payrollData.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">No payroll data for the selected filters</p>
        </div>
      ) : (
        <div className="bg-card border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  {['Sub ID', 'Plate #', 'Owner / Driver', 'Truck Type', 'Trips', 'Gross Rate', 'Tax (2%)', 'Hidden Fee (4%)', 'Admin Fee (6%)', 'Net Payroll'].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payrollData.map((row, idx) => (
                  <tr key={idx} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-primary">{row.sub_id}</td>
                    <td className="px-4 py-3 font-semibold">{row.plate_number}</td>
                    <td className="px-4 py-3">{row.owner_name}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">{row.truck_type}</span>
                    </td>
                    <td className="px-4 py-3 text-center font-semibold">{row.trips.length}</td>
                    <td className="px-4 py-3 text-right">₱{row.total_gross.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-red-600">-₱{row.total_tax.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-orange-600">-₱{row.total_hidden.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-amber-600">-₱{row.total_admin.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-700">₱{row.total_net.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/50">
                  <td colSpan={9} className="px-4 py-3 text-sm font-semibold text-right">Grand Total Net Payroll</td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-700 text-base">₱{grandNet.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}