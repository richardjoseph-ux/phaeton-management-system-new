import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Pencil, Trash2, ClipboardList, RefreshCw, Download, Upload, RefreshCcw, Copy } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import TripForm from '@/components/trips/TripForm';
import ExcelImportExport from '@/components/ui/ExcelImportExport';
import * as XLSX from 'xlsx';

export default function TripEncoding() {
  const [trips, setTrips] = useState([]);
  const [clients, setClients] = useState([]);
  const [subcontractors, setSubcontractors] = useState([]);
  const [billingCycles, setBillingCycles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState('latest');
  const [filterBilling, setFilterBilling] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncingData, setSyncingData] = useState(false);

  const load = async () => {
    setLoading(true);
    const [t, c, s, b] = await Promise.all([
      base44.entities.TripRecord.list('-created_date', 200),
      base44.entities.ClientAccount.list('client_name', 100),
      base44.entities.Subcontractor.list('plate_number', 200),
      base44.entities.BillingCycle.list('-created_date', 100),
    ]);
    setTrips(t);
    setClients(c);
    setSubcontractors(s);
    setBillingCycles(b);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = [...trips].filter(t => {
    const matchSearch = !search ||
      t.plate_number?.toLowerCase().includes(search.toLowerCase()) ||
      t.owner_name?.toLowerCase().includes(search.toLowerCase()) ||
      t.truck_type?.toLowerCase().includes(search.toLowerCase()) ||
      t.client_name?.toLowerCase().includes(search.toLowerCase()) ||
      t.pickup_location?.toLowerCase().includes(search.toLowerCase()) ||
      t.delivery_location?.toLowerCase().includes(search.toLowerCase()) ||
      t.delivery_code?.toLowerCase().includes(search.toLowerCase()) ||
      t.particular?.toLowerCase().includes(search.toLowerCase()) ||
      t.dr_number?.toLowerCase().includes(search.toLowerCase()) ||
      t.waybill_number?.toLowerCase().includes(search.toLowerCase()) ||
      t.trip_route_code?.toLowerCase().includes(search.toLowerCase()) ||
      t.billing_cycle_name?.toLowerCase().includes(search.toLowerCase());
    const matchBilling = !filterBilling || t.billing_cycle_name?.toLowerCase() === filterBilling.toLowerCase();
    return matchSearch && matchBilling;
  }).sort((a, b) => {
    if (sortOrder === 'latest') {
      return (b.delivery_date || '').localeCompare(a.delivery_date || '');
    } else {
      return (a.delivery_date || '').localeCompare(b.delivery_date || '');
    }
  });

  const handleEdit = (trip) => { setEditData(trip); setFormOpen(true); };
  const handleDuplicate = (trip) => { 
    const { id, created_date, updated_date, created_by_id, ...rest } = trip;
    setEditData(rest); 
    setFormOpen(true); 
  };
  const handleAdd = () => { setEditData(null); setFormOpen(true); };
  const handleDelete = async (id) => {
    if (!confirm('Delete this trip record?')) return;
    await base44.entities.TripRecord.delete(id);
    load();
  };

  const handleSyncBillingDates = async () => {
    setSyncing(true);
    try {
      const response = await base44.functions.invoke('syncBillingDates', {});
      if (response.data.success) {
        alert(response.data.message);
        await load();
      }
    } catch (error) {
      alert('Error syncing billing dates: ' + error.message);
    }
    setSyncing(false);
  };

  const handleSyncTripData = async () => {
    setSyncingData(true);
    try {
      const tripsToUpdate = await base44.entities.TripRecord.list();
      let updated = 0;
      for (const trip of tripsToUpdate) {
        if (!trip.client_account_id || !trip.gross_rate) {
          const client = clients.find(c => c.client_name === trip.client_name);
          if (client) {
            const route = client.routes?.find(r => 
              r.pickup_location === trip.pickup_location && 
              r.delivery_location === trip.delivery_location
            );
            const rate = route?.rates?.[trip.truck_type] || 0;
            const gross = rate || trip.gross_rate || 0;
            const tax = gross * 0.02;
            const afterTax = gross - tax;
            const hidden = afterTax * 0.04;
            const admin = afterTax * 0.06;
            await base44.entities.TripRecord.update(trip.id, {
              client_account_id: client.id,
              client_name: client.client_name,
              gross_rate: gross,
              tax_deduction: tax,
              hidden_fee: hidden,
              admin_fee: admin,
              net_payroll: gross - tax - hidden - admin - (trip.insurance_charge || 0) - (trip.other_charges || 0)
            });
            updated++;
          }
        }
      }
      alert(`Synced ${updated} trip records with client and rate data`);
      await load();
    } catch (error) {
      alert('Error syncing trip data: ' + error.message);
    }
    setSyncingData(false);
  };

  const handleExportTrips = async () => {
    try {
      const data = trips.map(t => ({
        plate_number: t.plate_number,
        owner_name: t.owner_name,
        client_name: t.client_name,
        pickup_location: t.pickup_location,
        delivery_location: t.delivery_location,
        delivery_code: t.delivery_code,
        particular: t.particular,
        dr_number: t.dr_number,
        waybill_number: t.waybill_number,
        delivery_date: t.delivery_date,
        billing_date: t.billing_date,
        billing_cycle_name: t.billing_cycle_name
      }));
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Trips');
      XLSX.writeFile(workbook, `TripEncoding_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
      alert('Export failed: ' + error.message);
    }
  };

  const handleImportTrips = async (event) => {
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
      const existing = await base44.entities.TripRecord.list();
      const existingKeys = new Set(existing.map(t => `${t.plate_number?.toLowerCase() || ''}-${t.dr_number?.toLowerCase() || ''}-${t.delivery_date || ''}`));
      const toImport = jsonData.filter(item => {
        const key = `${item.plate_number?.toLowerCase() || ''}-${item.dr_number?.toLowerCase() || ''}-${item.delivery_date || ''}`;
        return !existingKeys.has(key);
      });
      const skipped = jsonData.length - toImport.length;
      if (toImport.length === 0) {
        alert('All records already exist (skipped ' + skipped + ' duplicates)');
        return;
      }
      await base44.entities.TripRecord.bulkCreate(toImport);
      alert(`Successfully imported ${toImport.length} trip records (${skipped} duplicates skipped). Click "Sync Trip Data" to populate client, rates, and fees.`);
      load();
    } catch (error) {
      alert('Import failed: ' + error.message);
    }
    event.target.value = '';
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Trip Encoding"
        subtitle="Encode and manage trip records"
        actions={
          <div className="flex gap-2">
            <div className="flex gap-2 mr-4">
              <Button 
                onClick={handleExportTrips} 
                size="sm" 
                variant="outline"
              >
                <Download className="w-4 h-4 mr-1.5" /> Export Excel
              </Button>
              <label>
                <Button 
                  size="sm" 
                  variant="outline"
                  asChild
                >
                  <span>
                    <Upload className="w-4 h-4 mr-1.5" /> Import Excel
                  </span>
                </Button>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleImportTrips}
                  className="hidden"
                />
              </label>
            </div>
            <Button 
              onClick={handleSyncTripData} 
              size="sm" 
              variant="outline"
              disabled={syncingData}
            >
              <RefreshCcw className={`w-4 h-4 mr-1.5 ${syncingData ? 'animate-spin' : ''}`} /> 
              Sync Trip Data
            </Button>
            <Button 
              onClick={handleSyncBillingDates} 
              size="sm" 
              variant="outline"
              disabled={syncing}
            >
              <RefreshCw className={`w-4 h-4 mr-1.5 ${syncing ? 'animate-spin' : ''}`} /> 
              Sync Billing Dates
            </Button>
            <Button onClick={handleAdd} size="sm">
              <Plus className="w-4 h-4 mr-1.5" /> New Trip
            </Button>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9 w-64" placeholder="Search by plate, name, DR#..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select 
          className="flex h-9 w-40 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          value={sortOrder}
          onChange={e => setSortOrder(e.target.value)}
        >
          <option value="latest">Latest First</option>
          <option value="oldest">Oldest First</option>
        </select>
        <select 
          className="flex h-9 w-48 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          value={filterBilling}
          onChange={e => setFilterBilling(e.target.value)}
        >
          <option value="">All Billing Statements</option>
          {billingCycles.filter(bc => !bc.is_archived).map(bc => (
            <option key={bc.id} value={bc.cycle_name}>{bc.cycle_name}</option>
          ))}
        </select>
        {filterBilling && (
          <Button variant="outline" size="sm" onClick={() => setFilterBilling('')}>
            Clear Filters
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Plate #</th>
                <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Owner / Driver</th>
                <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Truck</th>
                <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Client</th>
                <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Route</th>
                <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Particular</th>
                <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">DR #</th>
                <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Waybill</th>
                <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Trip Route</th>
                <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Delivery Date</th>
                <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Billing Statement</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} className="text-center py-12 text-muted-foreground">Loading trips...</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-16">
                    <ClipboardList className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-muted-foreground text-sm">No trip records found</p>
                  </td>
                </tr>
              ) : filtered.map(trip => (
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
                    <div className="text-muted-foreground/60">Code: {trip.delivery_code}</div>
                  </td>
                  <td className="px-4 py-3 text-sm">{trip.particular || '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs">{trip.dr_number || '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs">{trip.waybill_number || '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs">{trip.trip_route_code || '—'}</td>
                  <td className="px-4 py-3 text-sm font-medium">{trip.delivery_date || '—'}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{trip.billing_cycle_name || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleDuplicate(trip)} className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground" title="Duplicate">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleEdit(trip)} className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground" title="Edit">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(trip.id)} className="p-1.5 hover:bg-red-50 rounded text-muted-foreground hover:text-red-600" title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <TripForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={load}
        editData={editData}
        isDuplicate={editData && !editData.id}
        clients={clients}
        subcontractors={subcontractors}
        billingCycles={billingCycles}
      />
    </div>
  );
}