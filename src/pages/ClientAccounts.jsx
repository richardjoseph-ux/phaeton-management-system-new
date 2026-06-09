import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Pencil, Building2, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import ClientForm from '@/components/clients/ClientForm';

const TRUCK_TYPES = ['AUV', 'Sub-4W', '6-Wheel', '10-Wheel'];

export default function ClientAccounts() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [expanded, setExpanded] = useState({});

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.ClientAccount.list('client_name', 100);
    setList(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = list.filter(c =>
    !search ||
    c.client_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.client_code?.toLowerCase().includes(search.toLowerCase())
  );

  const handleEdit = (item) => { setEditData(item); setFormOpen(true); };
  const handleAdd = () => { setEditData(null); setFormOpen(true); };
  const toggleExpand = (id) => setExpanded(p => ({ ...p, [id]: !p[id] }));
  const handleDelete = async (item) => {
    if (!confirm(`Delete client "${item.client_name}"? This cannot be undone.`)) return;
    await base44.entities.ClientAccount.delete(item.id);
    load();
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Client Accounts"
        subtitle="Manage client accounts, routes, and rates"
        actions={
          <Button onClick={handleAdd} size="sm">
            <Plus className="w-4 h-4 mr-1.5" /> Create Account
          </Button>
        }
      />

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search client..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Building2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">No client accounts found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(client => (
            <div key={client.id} className="bg-card border rounded-lg overflow-hidden">
              <div className="flex items-center gap-4 px-5 py-4">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground">{client.client_name}</h3>
                    {client.client_code && (
                      <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{client.client_code}</span>
                    )}
                    <StatusBadge status={client.status} type="account" />
                  </div>
                  <div className="flex items-center gap-4 mt-0.5">
                    {client.contact_person && <span className="text-xs text-muted-foreground">{client.contact_person}</span>}
                    {client.contact_number && <span className="text-xs text-muted-foreground">{client.contact_number}</span>}
                    <span className="text-xs text-muted-foreground">{client.routes?.length || 0} route(s)</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                   <button onClick={() => handleEdit(client)} className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground">
                     <Pencil className="w-4 h-4" />
                   </button>
                   <button onClick={() => handleDelete(client)} className="p-1.5 hover:bg-red-50 rounded text-muted-foreground hover:text-red-600">
                     <Trash2 className="w-4 h-4" />
                   </button>
                   <button onClick={() => toggleExpand(client.id)} className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground">
                     {expanded[client.id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                   </button>
                 </div>
              </div>


            </div>
          ))}
        </div>
      )}

      <ClientForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={load}
        editData={editData}
      />
    </div>
  );
}