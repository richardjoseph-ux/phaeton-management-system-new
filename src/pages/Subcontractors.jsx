import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Pencil, Truck, Trash2, Download, Upload } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import SubcontractorForm from '@/components/subcontractors/SubcontractorForm';
import { formatDateDisplay } from '@/lib/dateUtils';
import { useAuth } from '@/lib/AuthContext';
import * as XLSX from 'xlsx';
import moment from 'moment'; // Assuming you use Moment.js for date manipulation

const calculateBusinessDaysBetweenDates = (startDate, endDate) => {
  // Implement your business day calculation logic here.
  // Example using Moment.js:
  return moment(endDate).diff(moment(startDate), 'businessDays');
};

const calculateDaysRemaining = (dueDate) => {
  return moment().diff(moment(dueDate), 'days');
};

const getInsuranceStatus = (sub) => {
  if (!sub.is_insured || !sub.insurance_start_date) return { status: 'Uninsured', dueDate: null };

  const start = new Date(sub.insurance_start_date);
  const nextDueDate = new Date(start);
  nextDueDate.setMonth(nextDueDate.getMonth() + 3); // Quarterly = 3 months

  const today = new Date();
  const thirtyDaysBeforeDue = new Date(nextDueDate);
  thirtyDaysBeforeDue.setDate(thirtyDaysBeforeDue.getDate() - 30);

  if (today > nextDueDate) return { status: 'Expired', dueDate: nextDueDate };
  if (today >= thirtyDaysBeforeDue) return { status: 'Payment Due Soon', dueDate: nextDueDate };
  return { status: 'Insured', dueDate: nextDueDate };
};

export default function Subcontractors() {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const fileInputRef = useRef(null);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.Subcontractor.list('-created_date', 200);
    setList(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

const processedList = list.map(sub => {
  const insStatus = getInsuranceStatus(sub);
  
  // Calculate how many months have passed since the start date
  let currentQuarter = null;
  if (sub.insurance_start_date) {
    const start = new Date(sub.insurance_start_date);
    const today = new Date();
    
    // Calculate total months difference
    const monthsDiff = (today.getFullYear() - start.getFullYear()) * 12 + (today.getMonth() - start.getMonth());
    
    // Calculate quarter (1, 2, 3, or 4) relative to the start date
    // Each quarter is 3 months long
    currentQuarter = (Math.floor(monthsDiff / 3) % 4) + 1;
  }

  if (statusTab === 'active') {
    return {
      ...sub,
      insStatus: {
        status: insStatus.status,
        dueDate: sub.insurance_start_date ? moment(sub.insurance_start_date).format('MMM YYYY') : null
      },
    };
  } else {
    return { ...sub, insStatus, quarter: currentQuarter };
  }
});

  const filtered = processedList.filter(s => {
    const matchesSearch = !search ||
      s.plate_number?.toLowerCase().includes(search.toLowerCase()) ||
      s.owner_name?.toLowerCase().includes(search.toLowerCase()) ||
      s.sub_id?.toLowerCase().includes(search.toLowerCase());
        const insStatus = s.insStatus;
    let matchesStatus = true;
    if (statusTab === 'active') matchesStatus = s.status === 'Active';
    else if (statusTab === 'inactive') matchesStatus = s.status === 'Inactive';
    else if (statusTab === 'insurance') matchesStatus = insStatus.status === 'Expired' || insStatus.status === 'Payment Due Soon';
    return matchesSearch && matchesStatus;
  });

  const activeCount = list.filter(s => s.status === 'Active').length;
  const inactiveCount = list.filter(s => s.status === 'Inactive').length;
  const insuranceCount = list.filter(s => {
    const status = getInsuranceStatus(s);
    return status.status === 'Expired' || status.status === 'Payment Due Soon';
  }).length;

  const handleEdit = (item) => { setEditData(item); setFormOpen(true); };
  const handleAdd = () => { setEditData(null); setFormOpen(true); };
  const handleDelete = async (item) => {
    if (!confirm(`Delete subcontractor "${item.plate_number} — ${item.owner_name}"? This cannot be undone.`)) return;
    await base44.entities.Subcontractor.delete(item.id);
    load();
  };

  const handleExport = async () => {
    try {
      const data = list.map(s => ({
        sub_id: s.sub_id,
        plate_number: s.plate_number,
        owner_name: s.owner_name,
        truck_type: s.truck_type,
        contact_number: s.contact_number,
        garage_location: s.garage_location,
        join_date: s.join_date,
        status: s.status,
        is_insured: s.is_insured,
        insurance_start_date: s.insurance_start_date,
        insurance_end_date: s.insurance_end_date
      }));
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Subcontractors');
      XLSX.writeFile(workbook, `Subcontractors_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
      alert('Export failed: ' + error.message);
    }
  };

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const bytes = await file.arrayBuffer();
      const workbook = XLSX.read(bytes, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      if (jsonData.length === 0) {
        alert('Excel file is empty');
        return;
      }
      const existing = await base44.entities.Subcontractor.list();
      const existingPlates = new Set(existing.map(s => s.plate_number?.toLowerCase()));
      const toImport = jsonData.filter(item => !existingPlates.has(item.plate_number?.toLowerCase()));
      const skipped = jsonData.length - toImport.length;
      if (toImport.length === 0) {
        alert('All records already exist (skipped ' + skipped + ' duplicates)');
        return;
      }
      await base44.entities.Subcontractor.bulkCreate(toImport);
      alert(`Successfully imported ${toImport.length} subcontractor records (${skipped} duplicates skipped)`);
      load();
    } catch (error) {
      alert('Import failed: ' + error.message);
    }
    event.target.value = '';
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Subcontractors"
        subtitle="Manage registered vehicles and subcontractors"
        actions={
          <div className="flex gap-2 items-center">
            <div className="flex gap-2 mr-4">
              <Button onClick={handleExport} size="sm" variant="outline">
                <Download className="w-4 h-4 mr-1.5" /> Export Excel
              </Button>
              {isAdmin && (
                <>
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
              <Button onClick={handleAdd} size="sm">
                <Plus className="w-4 h-4 mr-1.5" /> Register Subcontractor
              </Button>
            )}
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
                    { label: 'Total', value: list.length, color: 'text-foreground' },
          { label: 'Active', value: list.filter(s => s.status === 'Active').length, color: 'text-emerald-600' },
          { label: 'Insurance Due', value: insuranceCount, color: 'text-amber-600' },
          { label: 'Inactive', value: list.filter(s => s.status === 'Inactive').length, color: 'text-red-500' },
        ].map(stat => (
          <div key={stat.label} className="bg-card border rounded-lg p-4">
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-2 mb-4 border-b">
        <button
          onClick={() => setStatusTab('all')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            statusTab === 'all' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          All ({list.length})
        </button>
        <button
          onClick={() => setStatusTab('active')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            statusTab === 'active' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Active ({activeCount})
        </button>
                <button
          onClick={() => setStatusTab('inactive')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            statusTab === 'inactive' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Inactive ({inactiveCount})
        </button>
        <button
          onClick={() => setStatusTab('insurance')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            statusTab === 'insurance' ? 'border-amber-600 text-amber-600' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Insurance Due ({insuranceCount})
        </button>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search plate, name, ID..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {['ID', 'Plate #', 'Owner / Driver', 'Truck Type', 'Contact', 'Join Date', 'Garage', 'Insurance', 'Status', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
                            {loading ? (
                <tr><td colSpan={10} className="text-center py-12 text-muted-foreground">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-16">
                    <Truck className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-muted-foreground text-sm">No subcontractors found</p>
                  </td>
                </tr>
              ) : filtered.map(sub => {
                const insStatus = sub.insStatus;
                return (
                  <tr key={sub.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-primary font-semibold">{sub.sub_id}</td>
                    <td className="px-4 py-3 font-semibold">{sub.plate_number}</td>
                    <td className="px-4 py-3">{sub.owner_name}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">{sub.truck_type}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{sub.contact_number || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{formatDateDisplay(sub.join_date)}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{sub.garage_location || '—'}</td>
                                        <td className="px-4 py-3">
                                          <div>
                                            <StatusBadge status={typeof insStatus === 'string' ? insStatus : insStatus.status} type="insurance" />
                                            {insStatus.dueDate && (
                                              <p className={`text-xs text-muted-foreground mt-0.5 ${typeof insStatus.dueDate !== 'string' && calculateDaysRemaining(insStatus.dueDate) <= 5 ? 'text-red-600' : ''}`}>
                                                {typeof insStatus.dueDate === 'string' ? `Start: ${insStatus.dueDate}` : `Due: ${formatDateDisplay(insStatus.dueDate)}`}
                                              </p>
                                            )}
                                          </div>
                      {/* Display due dates per quarter */}
                      {sub.quarter && (
                        <p className="text-[10px] text-muted-foreground font-mono mt-1 uppercase">
                          Q{sub.quarter} Renewal
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={sub.status} type="account" /></td>
                    <td className="px-4 py-3">
                      {isAdmin && (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleEdit(sub)} className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(sub)} className="p-1.5 hover:bg-red-50 rounded text-muted-foreground hover:text-red-600">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
      </div>
    </div>

      <SubcontractorForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={load}
        editData={editData}
      />
    </div>
  );
}