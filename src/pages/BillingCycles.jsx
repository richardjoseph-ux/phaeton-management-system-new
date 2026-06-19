import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, CreditCard, Pencil, Eye, ClipboardList, Calendar, Archive, ArchiveRestore, CheckCircle2, Circle, ListChecks, Trash2, Download, Upload } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import BillingReceivedSummaryDialog from '@/components/billing/BillingReceivedSummaryDialog';
import { useAuth } from '@/lib/AuthContext';
import { formatDateDisplay } from '@/lib/dateUtils';
import * as XLSX from 'xlsx';

export default function BillingCycles() {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const [cycles, setCycles] = useState([]);
  const [clients, setClients] = useState([]);
  const [summaryRecords, setSummaryRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [form, setForm] = useState({ cycle_name: '', client_account_id: '', notes: '', billing_received_date: '', cheque_date: '' });
  const [nextSeq, setNextSeq] = useState('0001');
  const [saving, setSaving] = useState(false);
  const [tripsOpen, setTripsOpen] = useState(false);
  const [selectedCycle, setSelectedCycle] = useState(null);
  const [trips, setTrips] = useState([]);
  const [loadingTrips, setLoadingTrips] = useState(false);

  // Tabs: statements section vs summary section
  const [mainTab, setMainTab] = useState('statements'); // 'statements' | 'summary'
  // Sub-tabs for statements
  const [stmtTab, setStmtTab] = useState('active'); // 'active' | 'archived'
  // Sub-tabs for summary
  const [summaryTab, setSummaryTab] = useState('active'); // 'active' | 'archived'

  const [fuelSubsidies, setFuelSubsidies] = useState([]);
  const [deductions, setDeductions] = useState([]);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryDate, setSummaryDate] = useState('');
  const [summaryCycles, setSummaryCycles] = useState([]);
  const [allTrips, setAllTrips] = useState([]);
  const fileInputRef = useRef(null);

  const load = async () => {
    setLoading(true);
    const [c, cl, s, sr, t, d] = await Promise.all([
      base44.entities.BillingCycle.list('-created_date', 200),
      base44.entities.ClientAccount.list('client_name', 100),
      base44.entities.FuelSubsidy.list('-created_date', 100),
      base44.entities.BillingReceivedSummary.list('-billing_received_date', 200),
      base44.entities.TripRecord.list('-created_date', 500),
      base44.entities.BillingDeduction.list('-billing_received_date', 500),
    ]);
    setCycles(c);
    setClients(cl);
    setFuelSubsidies(s);
    setSummaryRecords(sr);
    setAllTrips(t);
    setDeductions(d);
    setLoading(false);
  };

  const getFuelSubsidy = (trip) => {
    const tripDate = new Date(trip.delivery_date);
    return fuelSubsidies.find(subsidy => {
      const startDate = new Date(subsidy.start_date);
      const endDate = new Date(subsidy.end_date);
      return subsidy.client_account_id === trip.client_account_id &&
             tripDate >= startDate && tripDate <= endDate;
    });
  };

  const calculateTotals = (trip) => {
    const gross = trip.gross_rate || 0;
    // Use stored calculated values if available
    const tax = trip.tax_deduction || (gross * 0.02);
    const hidden = trip.hidden_fee || (gross * 0.02 > 0 ? (gross - gross * 0.02) * 0.04 : 0);
    const admin = trip.admin_fee || (gross * 0.02 > 0 ? (gross - gross * 0.02) * 0.06 : 0);
    const insurance = trip.insurance_charge || 0;
    const other = trip.other_charges || 0;
    const fuelSubsidy = getFuelSubsidy(trip);
    const fuelSubsidyAmount = fuelSubsidy ? gross * (fuelSubsidy.subsidy_percentage / 100) : 0;
    const net = gross - tax - hidden - admin - insurance - other + fuelSubsidyAmount;
    return { gross, tax, hidden, admin, insurance, other, fuelSubsidy: fuelSubsidyAmount, net };
  };

  const calculateNextSequence = async (clientId) => {
    if (!clientId) return '0001';
    const existingCycles = await base44.entities.BillingCycle.filter({ client_account_id: clientId }, '-created_date', 100);
    const client = clients.find(c => c.id === clientId);
    const clientCode = client?.client_code || 'XX';
    const yearSuffix = new Date().getFullYear().toString().slice(-2);
    let maxSeq = 0;
    existingCycles.forEach(c => {
      const match = c.cycle_name?.match(new RegExp(`${clientCode}${yearSuffix}-(\\d{4})`));
      if (match) maxSeq = Math.max(maxSeq, parseInt(match[1]));
    });
    const seq = String(maxSeq + 1).padStart(4, '0');
    setNextSeq(seq);
    return seq;
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditData(null);
    setForm({ cycle_name: '', client_account_id: '', notes: '', billing_received_date: '', cheque_date: '', paid_status: 'Unpaid' });
    setNextSeq('0001');
    setFormOpen(true);
  };

  const openEdit = (item) => {
    setEditData(item);
    setForm({
      cycle_name: item.cycle_name || '',
      client_account_id: item.client_account_id || '',
      notes: item.notes || '',
      billing_received_date: item.billing_received_date || '',
      cheque_date: item.cheque_date || '',
    });
    setFormOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    if (editData) {
      if (editData.cheque_date !== form.cheque_date && form.cheque_date) {
        const tripsToUpdate = await base44.entities.TripRecord.filter({ billing_cycle_id: editData.id });
        await Promise.all(tripsToUpdate.map(trip => base44.entities.TripRecord.update(trip.id, { first_cheque_date: form.cheque_date })));
      }
      if (editData.billing_received_date !== form.billing_received_date && form.billing_received_date) {
        const tripsToUpdate = await base44.entities.TripRecord.filter({ billing_cycle_id: editData.id });
        await Promise.all(tripsToUpdate.map(trip => base44.entities.TripRecord.update(trip.id, { billing_date: form.billing_received_date })));
      }
      await base44.entities.BillingCycle.update(editData.id, form);
    } else {
      await base44.entities.BillingCycle.create({ ...form, status: 'Open' });
    }
    setSaving(false);
    setFormOpen(false);
    load();
  };

  const toggleArchiveCycle = async (cycle) => {
    await base44.entities.BillingCycle.update(cycle.id, { is_archived: !cycle.is_archived });
    load();
  };

  const handleDeleteCycle = async (cycle) => {
    if (!confirm(`Delete billing statement "${cycle.cycle_name}"? This cannot be undone.`)) return;
    await base44.entities.BillingCycle.delete(cycle.id);
    load();
  };

  const getClientName = (id) => clients.find(c => c.id === id)?.client_name || '—';

  // Calculate payout date: 30 working days from billing received date, then find nearest Tuesday
  const calculatePayoutDate = (billingReceivedDate) => {
    if (!billingReceivedDate) return null;
    
    let currentDate = new Date(billingReceivedDate);
    let workingDaysCount = 0;
    
    // Count 30 working days (skip weekends)
    while (workingDaysCount < 30) {
      currentDate.setDate(currentDate.getDate() + 1);
      const dayOfWeek = currentDate.getDay();
      // 0 = Sunday, 6 = Saturday
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        workingDaysCount++;
      }
    }
    
    // Find nearest Tuesday
    const dayOfWeek = currentDate.getDay();
    const daysToTuesday = [
      2, // Sunday (0) -> Tuesday (+2)
      1, // Monday (1) -> Tuesday (+1)
      0, // Tuesday (2) -> Tuesday (0)
      -1, // Wednesday (3) -> Tuesday (-1)
      -2, // Thursday (4) -> Tuesday (-2)
      -3, // Friday (5) -> Tuesday (-3)
      3  // Saturday (6) -> Tuesday (+3)
    ];
    
    currentDate.setDate(currentDate.getDate() + daysToTuesday[dayOfWeek]);
    
    // Format as YYYY-MM-DD
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Group non-archived cycles by billing_received_date for summary tab
  const billingReceivedGroups = (() => {
    const groups = {};
    cycles.filter(c => !c.is_archived).forEach(cycle => {
      if (cycle.billing_received_date) {
        if (!groups[cycle.billing_received_date]) groups[cycle.billing_received_date] = [];
        groups[cycle.billing_received_date].push(cycle);
      }
    });
    return Object.entries(groups)
      .map(([date, items]) => ({ date, cycles: items }))
      .sort((a, b) => b.date.localeCompare(a.date));
  })();

  // Get or create summary record for a date
  const getSummaryRecord = (date) => summaryRecords.find(r => r.billing_received_date === date);

  const ensureSummaryRecord = async (date) => {
    let record = getSummaryRecord(date);
    if (!record) {
      record = await base44.entities.BillingReceivedSummary.create({ billing_received_date: date, is_paid: false, payroll_processed: false, is_archived: false });
      setSummaryRecords(prev => [...prev, record]);
    }
    return record;
  };

  const toggleSummaryField = async (date, field) => {
    const record = await ensureSummaryRecord(date);
    await base44.entities.BillingReceivedSummary.update(record.id, { [field]: !record[field] });
    load();
  };

  const toggleArchiveSummary = async (date) => {
    const record = await ensureSummaryRecord(date);
    await base44.entities.BillingReceivedSummary.update(record.id, { is_archived: !record.is_archived });
    load();
  };

  const openSummary = (group) => {
    setSummaryDate(group.date);
    const enriched = group.cycles.map(c => ({ ...c, client_name: getClientName(c.client_account_id) }));
    setSummaryCycles(enriched);
    setSummaryOpen(true);
  };

  const handleExport = async () => {
    try {
      const data = cycles.map(c => ({
        cycle_name: c.cycle_name,
        client_name: getClientName(c.client_account_id),
        status: c.status,
        billing_received_date: c.billing_received_date,
        cheque_date: c.cheque_date,
        paid_status: c.paid_status,
        is_archived: c.is_archived,
        notes: c.notes
      }));
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'BillingCycles');
      XLSX.writeFile(workbook, `BillingCycles_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
      alert('Export failed: ' + error.message);
    }
  };

const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formatDate = (val) => {
      if (!val) return "";
      const date = typeof val === 'number' ? new Date((val - 25569) * 86400 * 1000) : new Date(val);
      return isNaN(date.getTime()) ? "" : date.toISOString().split('T')[0];
    };

    try {
      const bytes = await file.arrayBuffer();
      const workbook = XLSX.read(bytes, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      const processedData = jsonData.map(item => {
        // 1. Normalize keys: map "cycle name" to "cycle_name"
        const normalizedItem = {
          cycle_name: item["cycle name"] || item.cycle_name,
          status: item.status,
          billing_received_date: formatDate(item.billing_received_date),
          cheque_date: formatDate(item.cheque_date),
          paid_status: item.paid_status,
          is_archived: item.is_archived === "TRUE" || item.is_archived === true,
          notes: item.notes
        };

        // 2. Map client_name to client_account_id
        const client = clients.find(c => c.client_name === item.client_name);
        
        return {
          ...normalizedItem,
          client_account_id: client ? client.id : null 
        };
      });

      const existing = await base44.entities.BillingCycle.list();
      const existingNames = new Set(existing.map(c => c.cycle_name?.toLowerCase()));
      
      const toImport = processedData.filter(item => 
        item.cycle_name && !existingNames.has(item.cycle_name.toLowerCase())
      );
      
      if (toImport.length === 0) {
        alert('No valid new records to import.');
        return;
      }

      await base44.entities.BillingCycle.bulkCreate(toImport);
      alert(`Successfully imported ${toImport.length} records.`);
      load();
    } catch (error) {
      alert('Import failed: ' + error.message);
    }
    event.target.value = '';
  };

  const openTripsView = async (cycle) => {
    setSelectedCycle(cycle);
    setLoadingTrips(true);
    const tripsData = await base44.entities.TripRecord.filter({ billing_cycle_id: cycle.id }, '-created_date', 200);
    setTrips(tripsData);
    setLoadingTrips(false);
    setTripsOpen(true);
  };

  const getChequeAmountForDate = (date) => {
    const cyclesForDate = cycles.filter(c => c.billing_received_date === date);
    const cycleIds = cyclesForDate.map(c => c.id);
    
    let totalGross = 0;
    let totalOtherCharges = 0;
    
    cycleIds.forEach(cycleId => {
      const cycleTrips = allTrips.filter(t => t.billing_cycle_id === cycleId);
      cycleTrips.forEach(trip => {
        totalGross += trip.gross_rate || 0;
      });
    });
    
    // Get other charges deductions for this date (not insurance)
    const deductionsForDate = deductions.filter(d => d.billing_received_date === date);
    deductionsForDate.forEach(d => {
      totalOtherCharges += d.other_charges || 0;
    });
    
    const tax = totalGross * 0.02;
    return totalGross - tax - totalOtherCharges;
  };

  // Filtered cycles for statements tabs - sorted by billing received date latest to oldest
  const filteredCycles = cycles
    .filter(cycle => {
      if (stmtTab === 'archived') return !!cycle.is_archived;
      return !cycle.is_archived;
    })
    .sort((a, b) => {
      const dateA = a.billing_received_date ? new Date(a.billing_received_date) : new Date(0);
      const dateB = b.billing_received_date ? new Date(b.billing_received_date) : new Date(0);
      return dateB - dateA;
    });

  // Update these definitions in your component
const activeSummaryGroups = billingReceivedGroups
  .filter(g => !getSummaryRecord(g.date)?.is_archived)
  .map(g => ({ ...g, cycles: [...g.cycles].sort((a, b) => a.cycle_name.localeCompare(b.cycle_name)) }))
  // Change the sort below:
  .sort((a, b) => b.date.localeCompare(a.date)); 

const archivedSummaryGroups = (() => {
  const archivedDates = summaryRecords.filter(r => r.is_archived).map(r => r.billing_received_date);
  const groups = {};
  cycles.filter(c => c.is_archived || archivedDates.includes(c.billing_received_date)).forEach(cycle => {
    if (cycle.billing_received_date && archivedDates.includes(cycle.billing_received_date)) {
      if (!groups[cycle.billing_received_date]) groups[cycle.billing_received_date] = [];
      groups[cycle.billing_received_date].push(cycle);
    }
  });
  return Object.entries(groups)
    .map(([date, items]) => ({ date, cycles: items.sort((a, b) => a.cycle_name.localeCompare(b.cycle_name)) }))
    // Change the sort below:
    .sort((a, b) => b.date.localeCompare(a.date));
})();

  const tabClass = (active) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`;

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Billing Cycles</h1>
          <p className="text-sm text-muted-foreground">Manage billing statements and received summaries</p>
        </div>
        {mainTab === 'statements' && (
          <div className="flex gap-2 items-center">
            <div className="flex gap-2 mr-4">
              <Button onClick={handleExport} size="sm" variant="outline">
                <Download className="w-4 h-4 mr-1.5" /> Export Excel
              </Button>
              {isAdmin && (
                <>
                  {/* NEW SYNC BUTTON */}
                  <Button onClick={syncClientIds} size="sm" variant="outline">
                    <RefreshCw className="w-4 h-4 mr-1.5" /> Sync Clients
                  </Button>

                  <Button onClick={() => fileInputRef.current?.click()} size="sm" variant="outline">
                    <Upload className="w-4 h-4 mr-1.5" /> Import Excel
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleImport}
                    className="hidden"
                  />
                </>
              )}
            </div>
            {isAdmin && (
              <Button onClick={openAdd} size="sm">
                <Plus className="w-4 h-4 mr-1.5" /> New Billing Statement
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Main tabs */}
      <div className="flex items-center gap-2 border-b mb-0">
        <button onClick={() => setMainTab('statements')} className={tabClass(mainTab === 'statements')}>
          Billing Statements
        </button>
        <button onClick={() => setMainTab('summary')} className={tabClass(mainTab === 'summary')}>
          Billing Received Summary
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Loading...</div>
      ) : mainTab === 'statements' ? (
        <>
          {/* Statement sub-tabs */}
          <div className="flex items-center gap-2 border-b mb-4 mt-0 bg-muted/30 px-2">
            {[
              { key: 'active', label: `Billing Statements (${cycles.filter(c => !c.is_archived).length})` },
              { key: 'archived', label: `Archived (${cycles.filter(c => !!c.is_archived).length})` },
            ].map(t => (
              <button key={t.key} onClick={() => setStmtTab(t.key)} className={tabClass(stmtTab === t.key)}>
                {t.label}
              </button>
            ))}
          </div>

          {filteredCycles.length === 0 ? (
            <div className="text-center py-16">
              <CreditCard className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">No billing statements in this category</p>
            </div>
          ) : (
            <div className="bg-card border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    {['Statement Name', 'Client', 'Billing Received', 'Cheque Date', 'Notes', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredCycles.map(cycle => (
                    <tr key={cycle.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <button onClick={() => openTripsView(cycle)} className="font-semibold text-primary hover:underline">
                          {cycle.cycle_name}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{getClientName(cycle.client_account_id)}</td>
                      <td className="px-4 py-3 text-sm">{formatDateDisplay(cycle.billing_received_date)}</td>
                      <td className="px-4 py-3 text-sm">{formatDateDisplay(cycle.cheque_date)}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{cycle.notes || '—'}</td>
                      <td className="px-4 py-3">
                        {isAdmin && (
                          <div className="flex items-center gap-1">
                            {!cycle.is_archived && (
                              <button onClick={() => openEdit(cycle)} className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground" title="Edit">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => toggleArchiveCycle(cycle)}
                              className={`p-1.5 rounded transition-colors ${cycle.is_archived ? 'hover:bg-blue-50 hover:text-blue-600 text-muted-foreground' : 'hover:bg-amber-50 hover:text-amber-600 text-muted-foreground'}`}
                              title={cycle.is_archived ? 'Unarchive' : 'Archive'}
                            >
                              {cycle.is_archived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                            </button>
                            <button onClick={() => handleDeleteCycle(cycle)} className="p-1.5 hover:bg-red-50 rounded text-muted-foreground hover:text-red-600 transition-colors" title="Delete">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Summary sub-tabs */}
          <div className="flex items-center gap-2 border-b mb-4 mt-0 bg-muted/30 px-2">
            {[
              { key: 'active', label: `Active (${activeSummaryGroups.length})` },
              { key: 'archived', label: `Archived (${archivedSummaryGroups.length})` },
            ].map(t => (
              <button key={t.key} onClick={() => setSummaryTab(t.key)} className={tabClass(summaryTab === t.key)}>
                {t.label}
              </button>
            ))}
          </div>

          {(() => {
            const groups = summaryTab === 'active' ? activeSummaryGroups : archivedSummaryGroups;
            if (groups.length === 0) {
              return (
                <div className="text-center py-16">
                  <Calendar className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-muted-foreground text-sm">
                    {summaryTab === 'active' ? 'No billing received dates recorded yet' : 'No archived summaries'}
                  </p>
                </div>
              );
            }
            return (
              <div className="bg-card border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      {['Billing Received Date', 'Payout Date', 'Statements', '# Stmts', 'Cheque Amount', 'Paid', 'Payroll Processed', ''].map(h => (
                        <th key={h} className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map(group => {
                      const rec = getSummaryRecord(group.date);
                      const isPaid = rec?.is_paid || false;
                      const isPayroll = rec?.payroll_processed || false;
                      const isArchived = rec?.is_archived || false;
                      return (
                        <tr key={group.date} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                           <td className="px-4 py-3 font-semibold">{formatDateDisplay(group.date)}</td>
                           <td className="px-4 py-3 text-sm font-medium text-primary">
                             {formatDateDisplay(calculatePayoutDate(group.date))}
                           </td>
                           <td className="px-4 py-3 text-sm text-muted-foreground max-w-xs truncate">
                             {group.cycles.map(c => c.cycle_name).join(', ')}
                           </td>
                           <td className="px-4 py-3 text-sm">{group.cycles.length}</td>
                           <td className="px-4 py-3 text-sm font-semibold text-amber-700">₱{getChequeAmountForDate(group.date).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                           <td className="px-4 py-3">
                            {isAdmin ? (
                              <button
                                onClick={() => !isArchived && toggleSummaryField(group.date, 'is_paid')}
                                disabled={isArchived}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${isPaid ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'} disabled:opacity-60 disabled:cursor-not-allowed`}
                                title={isPaid ? 'Mark as Unpaid' : 'Mark as Paid'}
                              >
                                {isPaid ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                                {isPaid ? 'Paid' : 'Unpaid'}
                              </button>
                            ) : (
                              <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                {isPaid ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                                {isPaid ? 'Paid' : 'Unpaid'}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {isAdmin ? (
                              <button
                                onClick={() => !isArchived && toggleSummaryField(group.date, 'payroll_processed')}
                                disabled={isArchived}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${isPayroll ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'} disabled:opacity-60 disabled:cursor-not-allowed`}
                                title={isPayroll ? 'Mark as Not Processed' : 'Mark as Processed'}
                              >
                                {isPayroll ? <ListChecks className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                                {isPayroll ? 'Processed' : 'Pending'}
                              </button>
                            ) : (
                              <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${isPayroll ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                                {isPayroll ? <ListChecks className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                                {isPayroll ? 'Processed' : 'Pending'}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              {/* Removed the {!isArchived && ( ... )} wrapper */}
                              <button
                                onClick={() => openSummary(group)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary/10 text-primary rounded-md hover:bg-primary/20 transition-colors"
                              >
                                <Eye className="w-3.5 h-3.5" /> View
                              </button>
                              
                              {isAdmin && (
                                <button
                                  onClick={() => toggleArchiveSummary(group.date)}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${isArchived ? 'bg-blue-50 text-blue-600 hover:bg-blue-100' : 'bg-amber-50 text-amber-600 hover:bg-amber-100'}`}
                                  title={isArchived ? 'Unarchive' : 'Archive'}
                                >
                                  {isArchived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                                  {isArchived ? 'Unarchive' : 'Archive'}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </>
      )}

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editData ? 'Edit Billing Statement' : 'New Billing Statement'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Client Account *</Label>
              <Select
                value={form.client_account_id}
                onValueChange={async (v) => {
                  const client = clients.find(c => c.id === v);
                  const clientCode = client?.client_code || 'XX';
                  const yearSuffix = new Date().getFullYear().toString().slice(-2);
                  const seq = await calculateNextSequence(v);
                  const generatedName = client ? `BS-${clientCode}${yearSuffix}-${seq}` : '';
                  setForm(p => ({ ...p, client_account_id: v, cycle_name: generatedName }));
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.client_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Cycle Name *</Label>
              <Input value={form.cycle_name} onChange={e => setForm(p => ({ ...p, cycle_name: e.target.value }))} placeholder="e.g., BS-FL26-0001" />
            </div>
            <div className="space-y-1.5">
              <Label>Billing Received Date</Label>
              <Input type="date" value={form.billing_received_date} onChange={e => setForm(p => ({ ...p, billing_received_date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Cheque Date</Label>
              <Input type="date" value={form.cheque_date} onChange={e => setForm(p => ({ ...p, cheque_date: e.target.value }))} />
              {form.cheque_date && !editData && (
                <p className="text-xs text-muted-foreground">This will be applied to all trips in this billing statement</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Optional notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.cycle_name || !form.client_account_id}>
              {saving ? 'Saving...' : editData ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BillingReceivedSummaryDialog
        open={summaryOpen}
        onClose={() => setSummaryOpen(false)}
        billingDate={summaryDate}
        cycles={summaryCycles}
        fuelSubsidies={fuelSubsidies}
      />

      {/* Trips Dialog */}
      <Dialog open={tripsOpen} onOpenChange={setTripsOpen}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Trips for {selectedCycle?.cycle_name} — {getClientName(selectedCycle?.client_account_id)}
            </DialogTitle>
          </DialogHeader>
          {loadingTrips ? (
            <div className="text-center py-12 text-muted-foreground">Loading trips...</div>
          ) : trips.length === 0 ? (
            <div className="text-center py-12">
              <ClipboardList className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">No trips assigned to this billing statement</p>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-card border rounded-lg p-4">
                  <p className="text-xs text-muted-foreground">Total Trips</p>
                  <p className="text-xl font-bold mt-1">{trips.length}</p>
                </div>
                <div className="bg-card border rounded-lg p-4">
                  <p className="text-xs text-muted-foreground">Total Gross Rate</p>
                  <p className="text-xl font-bold mt-1 text-blue-700">₱{trips.reduce((s, t) => s + (t.gross_rate || 0), 0).toFixed(2)}</p>
                </div>
                <div className="bg-card border rounded-lg p-4">
                  <p className="text-xs text-muted-foreground">Total Tax (2%)</p>
                  <p className="text-xl font-bold mt-1 text-red-600">-₱{trips.reduce((s, t) => s + (t.tax_deduction || (t.gross_rate || 0) * 0.02), 0).toFixed(2)}</p>
                </div>
              </div>

              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr className="border-b">
                      {['Plate #', 'Owner / Driver', 'Truck', 'Route', 'Delivery Date', 'DR #'].map(h => (
                        <th key={h} className="text-left px-3 py-3 font-semibold text-xs text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                      ))}
                      <th className="text-right px-3 py-3 font-semibold text-xs text-muted-foreground uppercase whitespace-nowrap">Gross Rate</th>
                      <th className="text-right px-3 py-3 font-semibold text-xs text-muted-foreground uppercase whitespace-nowrap">Tax (2%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trips.map(trip => {
                      const gross = trip.gross_rate || 0;
                      const tax = trip.tax_deduction || (gross * 0.02);
                      return (
                        <tr key={trip.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-3 py-3 font-mono font-semibold text-primary whitespace-nowrap">{trip.plate_number}</td>
                          <td className="px-3 py-3 whitespace-nowrap">{trip.owner_name}</td>
                          <td className="px-3 py-3">
                            <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">{trip.truck_type}</span>
                          </td>
                          <td className="px-3 py-3 text-xs text-muted-foreground">
                            <div>{trip.pickup_location}</div>
                            <div className="text-muted-foreground/60">→ {trip.delivery_location}</div>
                          </td>
                          <td className="px-3 py-3 text-sm whitespace-nowrap">{formatDateDisplay(trip.delivery_date)}</td>
                          <td className="px-3 py-3 font-mono text-xs whitespace-nowrap">{trip.dr_number || '—'}</td>
                          <td className="px-3 py-3 text-right font-semibold whitespace-nowrap">₱{gross.toFixed(2)}</td>
                          <td className="px-3 py-3 text-right text-red-600 whitespace-nowrap">-₱{tax.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t bg-muted/50">
                      <td colSpan={6} className="px-3 py-3 text-sm font-semibold text-right">Grand Total</td>
                      <td className="px-3 py-3 text-right font-bold whitespace-nowrap">₱{trips.reduce((s, t) => s + (t.gross_rate || 0), 0).toFixed(2)}</td>
                      <td className="px-3 py-3"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
          <DialogFooter>
            <Button onClick={() => setTripsOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}