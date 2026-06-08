import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Pencil, Trash2, ClipboardList } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import TripForm from '@/components/trips/TripForm';

export default function TripEncoding() {
  const [trips, setTrips] = useState([]);
  const [clients, setClients] = useState([]);
  const [subcontractors, setSubcontractors] = useState([]);
  const [billingCycles, setBillingCycles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editData, setEditData] = useState(null);

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

  const filtered = trips.filter(t =>
    !search ||
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
    t.billing_cycle_name?.toLowerCase().includes(search.toLowerCase())
  );

  const handleEdit = (trip) => { setEditData(trip); setFormOpen(true); };
  const handleAdd = () => { setEditData(null); setFormOpen(true); };
  const handleDelete = async (id) => {
    if (!confirm('Delete this trip record?')) return;
    await base44.entities.TripRecord.delete(id);
    load();
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Trip Encoding"
        subtitle="Encode and manage trip records"
        actions={
          <Button onClick={handleAdd} size="sm">
            <Plus className="w-4 h-4 mr-1.5" /> New Trip
          </Button>
        }
      />

      {/* Search */}
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by plate, name, DR#..." value={search} onChange={e => setSearch(e.target.value)} />
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
                  <td className="px-4 py-3 text-xs text-muted-foreground">{trip.billing_cycle_name || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleEdit(trip)} className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(trip.id)} className="p-1.5 hover:bg-red-50 rounded text-muted-foreground hover:text-red-600">
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
        clients={clients}
        subcontractors={subcontractors}
        billingCycles={billingCycles}
      />
    </div>
  );
}