import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Pencil, Truck, Phone, MapPin } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import SubcontractorForm from '@/components/subcontractors/SubcontractorForm';

const getInsuranceStatus = (sub) => {
  if (!sub.is_insured) return 'Uninsured';
  if (!sub.insurance_end_date) return 'Insured';
  const today = new Date();
  const end = new Date(sub.insurance_end_date);
  return end < today ? 'Expired' : 'Insured';
};

export default function Subcontractors() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editData, setEditData] = useState(null);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.Subcontractor.list('-created_date', 200);
    setList(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = list.filter(s =>
    !search ||
    s.plate_number?.toLowerCase().includes(search.toLowerCase()) ||
    s.owner_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.sub_id?.toLowerCase().includes(search.toLowerCase())
  );

  const handleEdit = (item) => { setEditData(item); setFormOpen(true); };
  const handleAdd = () => { setEditData(null); setFormOpen(true); };

  return (
    <div className="p-6">
      <PageHeader
        title="Subcontractors"
        subtitle="Manage registered vehicles and subcontractors"
        actions={
          <Button onClick={handleAdd} size="sm">
            <Plus className="w-4 h-4 mr-1.5" /> Register Subcontractor
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total', value: list.length, color: 'text-foreground' },
          { label: 'Active', value: list.filter(s => s.status === 'Active').length, color: 'text-emerald-600' },
          { label: 'Insured', value: list.filter(s => getInsuranceStatus(s) === 'Insured').length, color: 'text-blue-600' },
          { label: 'Inactive', value: list.filter(s => s.status === 'Inactive').length, color: 'text-red-500' },
        ].map(stat => (
          <div key={stat.label} className="bg-card border rounded-lg p-4">
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
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
                {['ID', 'Plate #', 'Owner / Driver', 'Truck Type', 'Contact', 'Garage', 'Insurance', 'Status', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-16">
                    <Truck className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-muted-foreground text-sm">No subcontractors found</p>
                  </td>
                </tr>
              ) : filtered.map(sub => {
                const insStatus = getInsuranceStatus(sub);
                return (
                  <tr key={sub.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-primary font-semibold">{sub.sub_id}</td>
                    <td className="px-4 py-3 font-semibold">{sub.plate_number}</td>
                    <td className="px-4 py-3">{sub.owner_name}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">{sub.truck_type}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{sub.contact_number || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{sub.garage_location || '—'}</td>
                    <td className="px-4 py-3">
                      <div>
                        <StatusBadge status={insStatus} type="insurance" />
                        {sub.insurance_end_date && (
                          <p className="text-xs text-muted-foreground mt-0.5">Until {sub.insurance_end_date}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={sub.status} type="account" /></td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleEdit(sub)} className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
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