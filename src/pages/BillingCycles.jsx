import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, CreditCard, Pencil, Lock, Unlock } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';

export default function BillingCycles() {
  const [cycles, setCycles] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [form, setForm] = useState({ cycle_name: '', client_account_id: '', notes: '' });
  const [nextSeq, setNextSeq] = useState('0001');
  const [saving, setSaving] = useState(false);

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
    setForm({ cycle_name: '', client_account_id: '', notes: '' });
    setNextSeq('0001');
    setFormOpen(true);
  };
  const openEdit = (item) => {
    setEditData(item);
    setForm({
      cycle_name: item.cycle_name || '',
      client_account_id: item.client_account_id || '',
      notes: item.notes || '',
    });
    setFormOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    if (editData) {
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

  return (
    <div className="p-6">
      <PageHeader
        title="Billing Statements"
        subtitle="Manage billing statements per client account"
        actions={
          <Button onClick={openAdd} size="sm">
            <Plus className="w-4 h-4 mr-1.5" /> New Billing Statement
          </Button>
        }
      />

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
                {['Statement Name', 'Client', 'Status', 'Notes', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cycles.map(cycle => (
                <tr key={cycle.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-semibold">{cycle.cycle_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{getClientName(cycle.client_account_id)}</td>
                  <td className="px-4 py-3"><StatusBadge status={cycle.status || 'Open'} type="billing" /></td>
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
    </div>
  );
}