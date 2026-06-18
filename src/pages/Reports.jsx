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
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  // Helper for comma formatting (e.g., 1,000,000.00)
  const formatCurrency = (val) => new Intl.NumberFormat('en-PH', { 
    style: 'currency', currency: 'PHP', minimumFractionDigits: 2 
  }).format(val || 0);

  const [filters, setFilters] = useState({
    client_id: 'all', sub_id: 'all', cycle_id: 'all',
    year: 'all', date_from: '', date_to: ''
  });

  // Extract unique years from trips
  const availableYears = useMemo(() => {
    const years = new Set(trips.map(t => t.delivery_date?.substring(0, 4)).filter(Boolean));
    return Array.from(years).sort((a, b) => b - a);
  }, [trips]);

  const load = async () => {
    setLoading(true);
    try {
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
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { setCurrentPage(1); }, [filters]);

  const setF = (k, v) => setFilters(p => ({ ...p, [k]: v }));

  const filtered = useMemo(() => trips.filter(t => {
    if (filters.client_id !== 'all' && t.client_account_id !== filters.client_id) return false;
    if (filters.sub_id !== 'all' && t.subcontractor_id !== filters.sub_id) return false;
    if (filters.cycle_id !== 'all' && t.billing_cycle_id !== filters.cycle_id) return false;
    if (filters.year !== 'all' && t.delivery_date?.substring(0, 4) !== filters.year) return false;
    if (filters.date_from && t.delivery_date < filters.date_from) return false;
    if (filters.date_to && t.delivery_date > filters.date_to) return false;
    return true;
  }), [trips, filters]);

  const { totalGross, totalNet } = useMemo(() => filtered.reduce((acc, t) => ({
    totalGross: acc.totalGross + (t.gross_rate || 0),
    totalNet: acc.totalNet + (t.net_payroll || 0)
  }), { totalGross: 0, totalNet: 0 }), [filtered]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filtered.slice(start, start + rowsPerPage);
  }, [filtered, currentPage]);

  const totalPages = Math.ceil(filtered.length / rowsPerPage);

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.text('PT Tracking - Trip Records Report', 14, 16);
    // ... (rest of your existing PDF logic)
    doc.save(`TripRecords_Report.pdf`);
  };

  const exportCSV = () => {
    // ... (rest of your existing CSV logic)
  };

  return (
    <div className="p-6">
      <PageHeader title="Reports" subtitle="Filter and export trip records" />

      <div className="bg-card border rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filters</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
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
              {subcontractors.map(s => <SelectItem key={s.id} value={s.id}>{s.owner_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.cycle_id} onValueChange={v => setF('cycle_id', v)}>
            <SelectTrigger><SelectValue placeholder="All Billing Cycles" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Billing Cycles</SelectItem>
              {billingCycles.map(b => <SelectItem key={b.id} value={b.id}>{b.cycle_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={filters.date_from} onChange={e => setF('date_from', e.target.value)} />
          <Input type="date" value={filters.date_to} onChange={e => setF('date_to', e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
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
      </div>

      {/* Table ... */}
      <td className="px-3 py-2.5 text-right text-xs">{formatCurrency(trip.gross_rate)}</td>
      <td className="px-3 py-2.5 text-right font-semibold text-xs text-emerald-700">{formatCurrency(trip.net_payroll)}</td>
      {/* ... */}
    </div>
  );
}