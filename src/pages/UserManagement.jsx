import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import { Users, ShieldCheck, UserCircle } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const { currentUser } = useAuth();

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.User.list();
    setUsers(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const updateUser = async (userId, field, value) => {
    setSaving(userId + field);
    await base44.entities.User.update(userId, { [field]: value });
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, [field]: value } : u));
    setSaving(null);
  };

  const admins = users.filter(u => u.role === 'admin').length;
  const activeUsers = users.filter(u => u.status !== 'Inactive').length;

  return (
    <div className="p-6">
      <PageHeader
        title="User Management"
        subtitle="Manage roles and access for all registered users"
      />

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Total Users</p>
          <p className="text-2xl font-bold mt-1">{users.length}</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Admins</p>
          <p className="text-2xl font-bold mt-1 text-primary">{admins}</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Active Users</p>
          <p className="text-2xl font-bold mt-1 text-emerald-700">{activeUsers}</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Loading users...</div>
      ) : (
        <div className="bg-card border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {['User', 'Email', 'Role', 'Status', 'Joined'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                        {user.full_name?.charAt(0) || '?'}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{user.full_name}</p>
                        {user.id === currentUser?.id && (
                          <span className="text-xs text-primary">(You)</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{user.email}</td>
                  <td className="px-4 py-3">
                    <Select
                      value={user.role || 'user'}
                      onValueChange={v => updateUser(user.id, 'role', v)}
                      disabled={saving === user.id + 'role'}
                    >
                      <SelectTrigger className="w-32 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">
                          <span className="flex items-center gap-1.5"><ShieldCheck className="w-3 h-3 text-primary" /> Admin</span>
                        </SelectItem>
                        <SelectItem value="user">
                          <span className="flex items-center gap-1.5"><UserCircle className="w-3 h-3 text-muted-foreground" /> User</span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    <Select
                      value={user.status || 'Active'}
                      onValueChange={v => updateUser(user.id, 'status', v)}
                      disabled={saving === user.id + 'status'}
                    >
                      <SelectTrigger className="w-32 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {user.created_date ? new Date(user.created_date).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}