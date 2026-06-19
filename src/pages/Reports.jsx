import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, BarChart3, Filter } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { formatDateDisplay } from '@/lib/dateUtils';
import { jsPDF } from 'jspdf';

export default function Reports() {
  const [trips, setTrips] = useState([]);
  const [clients, setClients] = useState([]);
  const [subcontractors, setSubcontractors] = useState([]);
  const [billingCycles, setBillingCycles] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Pagination & Filter States
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;
  const [filters, setFilters] = useState({
    client_id: 'all', sub_id: 'all', cycle_id: 'all',
    year: 'all', date_from: '', date_to: ''
  });

  // Currency Formatter
  const formatCurrency = (val) => new Intl.NumberFormat('en-PH', { 
    style: 'currency', currency: 'PHP', minimumFractionDigits: 2 
  }).format(val || 0);

  const load = async () => {
    setLoading(true);
    const [t, c, s, b] = await Promise.all([
      base44.entities.TripRecord.list('-delivery_date', 1000),
      base44.entities.ClientAccount.list('client_name', 100),
      base44.entities.Subcontractor.list('owner_name', 200),
      base44.entities.BillingCycle.list('-created_date', 100),
    ]);
    setTrips(t);
    setClients(c);
    setSubcontractors(s);
    setBillingCycles(b);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Reset to page 1 on filter change
  useEffect(() => { setCurrentPage(1); }, [filters]);

  const setF = (k, v) => setFilters(p => ({ ...p, [k]: v }));

  const availableYears = useMemo(() => {
    const years = new Set(trips.map(t => t.delivery_date?.substring(0, 4)).filter(Boolean));
    return Array.from(years).sort((a, b) => b - a);
  }, [trips]);

const filtered = trips.filter(t => {
    if (filters.client_id !== 'all' && t.client_account_id !== filters.client_id) return false;
    if (filters.sub_id !== 'all' && t.subcontractor_id !== filters.sub_id) return false;
    if (filters.cycle_id !== 'all' && t.billing_cycle_id !== filters.cycle_id) return false;
    if (filters.year !== 'all' && t.delivery_date?.substring(0, 4) !== filters.year) return false;
    if (filters.date_from && (!t.first_cheque_date || t.first_cheque_date < filters.date_from)) return false;
    if (filters.date_to && (!t.first_cheque_date || t.first_cheque_date > filters.date_to)) return false;
    
    return true;
  });

  const totalGross = filtered.reduce((s, t) => s + (t.gross_rate || 0), 0);
  const totalNet = filtered.reduce((s, t) => s + (t.net_payroll || 0), 0);
  const companyIncome = totalGross - totalNet;

  // Pagination Logic
  const totalPages = Math.ceil(filtered.length / rowsPerPage);
  const paginatedData = filtered.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text('PT Tracking - Trip Records Report', 14, 16);
    doc.setFontSize(8);
    doc.text(`Generated: ${new Date().toLocaleDateString()} | Total Records: ${filtered.length}`, 14, 23);

    let y = 33;
    doc.setFont(undefined, 'bold');
    doc.setFontSize(7);
    const headers = ['Plate#', 'Owner', 'Truck', 'Client', 'Pickup', 'Delivery', 'Del.Code', 'Del.Date', 'DR#', 'Waybill', 'Particular', 'Billing', 'Gross', 'Net'];
    const xPos = [14, 33, 60, 74, 104, 131, 158, 174, 189, 205, 220, 240, 258, 272];
    headers.forEach((h, i) => doc.text(h, xPos[i] || 14, y));
    doc.setFont(undefined, 'normal');
    y += 2;
    doc.line(14, y, 286, y);
    y += 4;

    filtered.forEach(trip => {
      if (y > 190) { doc.addPage(); y = 20; }
      const row = [
        trip.plate_number || '',
        (trip.owner_name || '').substring(0, 12),
        trip.truck_type || '',
        (trip.client_name || '').substring(0, 14),
        (trip.pickup_location || '').substring(0, 14),
        (trip.delivery_location || '').substring(0, 14),
        trip.delivery_code || '',
        trip.delivery_date || '',
        trip.dr_number || '',
        trip.waybill_number || '',
        (trip.particular || '').substring(0, 12),
        (trip.billing_cycle_name || '').substring(0, 14),
        trip.gross_rate ? `P${trip.gross_rate.toFixed(0)}` : '',
        trip.net_payroll ? `P${trip.net_payroll.toFixed(0)}` : '',
      ];
      row.forEach((cell, i) => doc.text(String(cell), xPos[i] || 14, y));
      y += 6;
    });

    doc.save(`TripRecords_Report.pdf`);
  };

  const exportCSV = () => {
    const headers = ['Plate No', 'Owner/Driver', 'Truck Type', 'Client', 'Pickup', 'Delivery', 'Delivery Code', 'Trip Route Code', 'Delivery Date', 'First Cheque Date', 'Billing Date', 'Particular', 'DR Number', 'Waybill', 'Billing Cycle', 'Gross Rate', 'Tax (2%)', 'Hidden Fee (4%)', 'Admin Fee (6%)', 'Net Payroll'];
    const rows = filtered.map(t => [
      t.plate_number, t.owner_name, t.truck_type, t.client_name,
      t.pickup_location, t.delivery_location, t.delivery_code, t.trip_route_code,
      t.delivery_date, t.first_cheque_date, t.billing_date, t.particular,
      t.dr_number, t.waybill_number, t.billing_cycle_name,
      t.gross_rate, t.tax_deduction, t.hidden_fee, t.admin_fee, t.net_payroll
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v ?? ''}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'TripRecords_Export.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Reports"
        subtitle="Filter and export trip records"
        actions={
          <div className="flex gap-2">
            <Button onClick={exportCSV} size="sm" variant="outline"><Download className="w-4 h-4 mr-1.5" /> Export CSV</Button>
            <Button onClick={exportPDF} size="sm" variant="outline"><Download className="w-4 h-4 mr-1.5" /> Export PDF</Button>
          </div>
        }
      />

      <div className="bg-card border rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filters</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Select value={filters.year} onValueChange={v => setF('year', v)}>
            <SelectTrigger><SelectValue placeholder="All Years" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              {availableYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.client_id} onValueChange={v => setF('client_id', v)}>
            <SelectTrigger><SelectValue placeholder="All Clients" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.client_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.sub_id} onValueChange={v => setF('sub_id', v)}>
            <SelectTrigger><SelectValue placeholder="All Subcontractors" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subcontractors</SelectItem>
              {subcontractors.map(s => <SelectItem key={s.id} value={s.id}>{s.owner_name} – {s.plate_number}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.cycle_id} onValueChange={v => setF('cycle_id', v)}>
            <SelectTrigger><SelectValue placeholder="All Billing Cycles" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Billing Cycles</SelectItem>
              {billingCycles.map(b => <SelectItem key={b.id} value={b.id}>{b.cycle_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" placeholder="Date from" value={filters.date_from} onChange={e => setF('date_from', e.target.value)} />
          <Input type="date" placeholder="Date to" value={filters.date_to} onChange={e => setF('date_to', e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Records Found</p>
          <p className="text-2xl font-bold mt-1">{filtered.length}</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Total Gross</p>
          <p className="text-2xl font-bold mt-1 text-blue-700">{formatCurrency(totalGross)}</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Total Net Payroll</p>
          <p className="text-2xl font-bold mt-1 text-emerald-700">{formatCurrency(totalNet)}</p>
        </div>
        <div className="bg-card border rounded-lg p-4 border-l-4 border-l-amber-500">
          <p className="text-xs text-muted-foreground">Company Income</p>
          <p className="text-2xl font-bold mt-1 text-amber-700">{formatCurrency(companyIncome)}</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Loading...</div>
      ) : (
        <div className="bg-card border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  {['Plate #', 'Owner', 'Truck', 'Client', 'Pickup → Delivery', 'Del. Date', 'DR #', 'Waybill', 'Particular', 'Billing Cycle', 'Gross', 'Net'].map(h => (
                    <th key={h} className="text-left px-3 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="text-center py-16">
                      <BarChart3 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-muted-foreground text-sm">No records match the selected filters</p>
                    </td>
                  </tr>
                ) : paginatedData.map(trip => (
                  <tr key={trip.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2.5 font-mono font-semibold text-xs text-primary">{trip.plate_number}</td>
                    <td className="px-3 py-2.5 text-xs">{trip.owner_name}</td>
                    <td className="px-3 py-2.5"><span className="text-xs bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">{trip.truck_type}</span></td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{trip.client_name}</td>
                    <td className="px-3 py-2.5 text-xs">
                      <div>{trip.pickup_location}</div>
                      <div className="text-muted-foreground">→ {trip.delivery_location} <span className="font-mono">({trip.delivery_code})</span></div>
                    </td>
                    <td className="px-3 py-2.5 text-xs">{formatDateDisplay(trip.delivery_date)}</td>
                    <td className="px-3 py-2.5 font-mono text-xs">{trip.dr_number}</td>
                    <td className="px-3 py-2.5 font-mono text-xs">{trip.waybill_number}</td>
                    <td className="px-3 py-2.5 text-xs">{trip.particular}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{trip.billing_cycle_name}</td>
                    <td className="px-3 py-2.5 text-right text-xs">{formatCurrency(trip.gross_rate)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-xs text-emerald-700">{formatCurrency(trip.net_payroll)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between p-4 border-t">
            <span className="text-xs text-muted-foreground">Page {currentPage} of {totalPages || 1}</span>
            <div className="flex gap-2">
              <Button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} size="sm" variant="outline">Previous</Button>
              <Button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} size="sm" variant="outline">Next</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}