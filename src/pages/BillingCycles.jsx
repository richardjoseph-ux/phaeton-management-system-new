import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, CreditCard, Pencil, Lock, Unlock, Eye, ClipboardList } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';

export default function BillingCycles() {
  const [cycles, setCycles] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [form, setForm] = useState({ cycle_name: '', client_account_id: '', notes: '', billing_received_date: '', cheque_date: '', paid_status: 'Unpaid' });
  const [nextSeq, setNextSeq] = useState('0001');
  const [saving, setSaving] = useState(false);
  const [tripsOpen, setTripsOpen] = useState(false);
  const [selectedCycle, setSelectedCycle] = useState(null);
  const [trips, setTrips] = useState([]);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [activeTab, setActiveTab] = useState('unpaid'); // 'paid', 'unpaid', 'closed'

  const load = async () => {
    setLoading(true);
    const [c, cl] = await Promise.all([
      base44.entities.BillingCycle.list('-created_date', 100),
      base44.entities.ClientAccount.list('client_name', 100),
    ]);
    setCycles(c);
    setClients(cl);
    setLoading(false);
  };

  const calculateNextSequence = async (clientId) => {
    if (!clientId) {
      return '0001';
    }
    const existingCycles = await base44.entities.BillingCycle.filter({ client_account_id: clientId }, '-created_date', 100);
    const client = clients.find(c => c.id === clientId);
    const clientCode = client?.client_code || 'XX';
    const yearSuffix = new Date().getFullYear().toString().slice(-2);
    
    // Find max sequence from existing cycles
    let maxSeq = 0;
    existingCycles.forEach(c => {
      const match = c.cycle_name?.match(new RegExp(`${clientCode}${yearSuffix}-(\\d{4})`));
      if (match) {
        maxSeq = Math.max(maxSeq, parseInt(match[1]));
      }
    });
    const nextSeq = String(maxSeq + 1).padStart(4, '0');
    setNextSeq(nextSeq);
    return nextSeq;
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
      paid_status: item.paid_status || 'Unpaid',
    });
    setFormOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    if (editData) {
      // If cheque date changed, update all trips with this billing cycle
      if (editData.cheque_date !== form.cheque_date && form.cheque_date) {
        const tripsToUpdate = await base44.entities.TripRecord.filter({ billing_cycle_id: editData.id });
        await Promise.all(
          tripsToUpdate.map(trip => 
            base44.entities.TripRecord.update(trip.id, { first_cheque_date: form.cheque_date })
          )
        );
      }
      // If billing received date changed, update all trips with this billing cycle
      if (editData.billing_received_date !== form.billing_received_date && form.billing_received_date) {
        const tripsToUpdate = await base44.entities.TripRecord.filter({ billing_cycle_id: editData.id });
        await Promise.all(
          tripsToUpdate.map(trip => 
            base44.entities.TripRecord.update(trip.id, { billing_date: form.billing_received_date })
          )
        );
      }
      await base44.entities.BillingCycle.update(editData.id, form);
    } else {
      await base44.entities.BillingCycle.create({ 
        ...form, 
        status: 'Open'
      });
    }
    setSaving(false);
    setFormOpen(false);
    load();
  };

  const toggleStatus = async (cycle) => {
    const newStatus = cycle.status === 'Open' ? 'Closed' : 'Open';
    await base44.entities.BillingCycle.update(cycle.id, { status: newStatus });
    load();
  };

  const getClientName = (id) => clients.find(c => c.id === id)?.client_name || '—';

  const filteredCycles = cycles.filter(cycle => {
    if (activeTab === 'closed') return cycle.status === 'Closed';
    if (activeTab === 'paid') return cycle.paid_status === 'Paid' && cycle.status === 'Open';
    if (activeTab === 'unpaid') return cycle.paid_status === 'Unpaid' && cycle.status === 'Open';
    return true;
  });

  const openTripsView = async (cycle) => {
    setSelectedCycle(cycle);
    setLoadingTrips(true);
    const tripsData = await base44.entities.TripRecord.filter({ billing_cycle_id: cycle.id }, '-created_date', 200);
    setTrips(tripsData);
    setLoadingTrips(false);
    setTripsOpen(true);
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Billing Statements</h1>
            <p className="text-sm text-muted-foreground">Manage billing statements per client account</p>
          </div>
          <Button onClick={openAdd} size="sm">
            <Plus className="w-4 h-4 mr-1.5" /> New Billing Statement
          </Button>
        </div>
        
        <div className="flex items-center gap-2 border-b">
          <button
            onClick={() => setActiveTab('unpaid')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'unpaid' 
                ? 'border-primary text-primary' 
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Unpaid ({cycles.filter(c => c.paid_status === 'Unpaid' && c.status === 'Open').length})
          </button>
          <button
            onClick={() => setActiveTab('paid')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'paid' 
                ? 'border-primary text-primary' 
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Paid ({cycles.filter(c => c.paid_status === 'Paid' && c.status === 'Open').length})
          </button>
          <button
            onClick={() => setActiveTab('closed')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'closed' 
                ? 'border-primary text-primary' 
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Closed Cycle ({cycles.filter(c => c.status === 'Closed').length})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Loading...</div>
      ) : cycles.length === 0 ? (
        <div className="text-center py-16">
          <CreditCard className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">No billing cycles yet</p>
        </div>
      ) : (
        <div className="bg-card border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {['Statement Name', 'Client', 'Billing Received', 'Cheque Date', 'Paid Status', 'Notes', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredCycles.map(cycle => (
                <tr key={cycle.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <button 
                      onClick={() => openTripsView(cycle)} 
                      className="font-semibold text-primary hover:underline"
                    >
                      {cycle.cycle_name}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{getClientName(cycle.client_account_id)}</td>
                  <td className="px-4 py-3 text-sm">{cycle.billing_received_date || '—'}</td>
                  <td className="px-4 py-3 text-sm">{cycle.cheque_date || '—'}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={cycle.paid_status || 'Unpaid'} type="billing" />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{cycle.notes || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(cycle)} className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => toggleStatus(cycle)}
                        className={`p-1.5 rounded text-muted-foreground transition-colors ${cycle.status === 'Open' ? 'hover:bg-red-50 hover:text-red-600' : 'hover:bg-emerald-50 hover:text-emerald-600'}`}
                        title={cycle.status === 'Open' ? 'Close cycle' : 'Reopen cycle'}
                      >
                        {cycle.status === 'Open' ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
                  setForm(p => ({ 
                    ...p, 
                    client_account_id: v,
                    cycle_name: generatedName
                  }));
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
              <Input 
                value={form.cycle_name} 
                onChange={e => setForm(p => ({ ...p, cycle_name: e.target.value }))} 
                placeholder="e.g., BS-FL26-0001" 
              />
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
              <Label>Payment Status</Label>
              <Select value={form.paid_status} onValueChange={v => setForm(p => ({ ...p, paid_status: v }))}>
                <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Unpaid">Unpaid</SelectItem>
                  <SelectItem value="Paid">Paid</SelectItem>
                </SelectContent>
              </Select>
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

      <Dialog open={tripsOpen} onOpenChange={setTripsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Trips for {selectedCycle?.cycle_name} - {getClientName(selectedCycle?.client_account_id)}
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
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="border-b">
                    <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase">Plate #</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase">Owner / Driver</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase">Truck</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase">Route</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase">Delivery Date</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase">DR #</th>
                    <th className="text-right px-4 py-3 font-semibold text-xs text-muted-foreground uppercase">Net Payroll</th>
                  </tr>
                </thead>
                <tbody>
                  {trips.map(trip => (
                    <tr key={trip.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 font-mono font-semibold text-primary">{trip.plate_number}</td>
                      <td className="px-4 py-3">{trip.owner_name}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">{trip.truck_type}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        <div>{trip.pickup_location}</div>
                        <div className="text-muted-foreground/60">→ {trip.delivery_location}</div>
                      </td>
                      <td className="px-4 py-3 text-sm">{trip.delivery_date}</td>
                      <td className="px-4 py-3 font-mono text-xs">{trip.dr_number || '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                        ₱{trip.net_payroll?.toFixed(2) || '0.00'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          <DialogFooter>
            <Button onClick={() => setTripsOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}