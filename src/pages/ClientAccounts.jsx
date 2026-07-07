import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Pencil, Building2, ChevronDown, ChevronUp, Trash2, Download } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import ClientForm from '@/components/clients/ClientForm';
import { useAuth } from '@/lib/AuthContext';
import { getTruckTypeFeePercentage } from '@/lib/feeCalculator';
import * as XLSX from 'xlsx'; // Import the Excel library

// ==========================================
// SUB-COMPONENT: CLIENT ROUTE TABLE
// ==========================================
function ClientRouteTable({ client }) {
  const pickupLocations = useMemo(() => {
    return [...new Set(client.routes?.map(r => r.pickup_location).filter(Boolean))];
  }, [client.routes]);

  const [activeTab, setActiveTab] = useState(pickupLocations[0] || '');
  const [activeTruck, setActiveTruck] = useState('AUV');
  const [routeSearch, setRouteSearch] = useState('');

  const processedRoutes = useMemo(() => {
    if (!activeTab) return [];
    const cleanSearch = routeSearch.toLowerCase();

    const groupedData = (client.routes || [])
      .filter(r => r.pickup_location === activeTab)
      .filter(r => r.rates?.[activeTruck] != null && r.rates?.[activeTruck] !== '')
      .filter(r => !cleanSearch || 
        r.delivery_location?.toLowerCase().includes(cleanSearch) || 
        r.delivery_code?.toLowerCase().includes(cleanSearch)
      )
      .reduce((acc, route) => {
        const key = `${route.delivery_location}|${route.delivery_code}`;
        if (!acc[key]) {
          acc[key] = { ...route, rates: { ...route.rates } };
        } else if (!acc[key].rates[activeTruck] && route.rates[activeTruck]) {
          acc[key].rates[activeTruck] = route.rates[activeTruck];
        }
        return acc;
      }, {});

    return Object.values(groupedData).sort((a, b) => 
      a.delivery_location.localeCompare(b.delivery_location)
    );
  }, [client.routes, activeTab, activeTruck, routeSearch]);

  const hiddenFeePercentage = getTruckTypeFeePercentage(client, activeTab, activeTruck);

  // ==========================================
  // EXCEL EXPORT ENGINE
  // Extracts only the currently mapped dataset
  // ==========================================
  const handleExportExcel = () => {
    if (processedRoutes.length === 0) return;

    // Map your visible table data into rows for the spreadsheet
    const excelRows = processedRoutes.map(route => {
      const gross = Number(route.rates?.[activeTruck] || 0);
      const tax = gross * 0.02;
      const afterTax = gross - tax;
      const hidden = afterTax * (hiddenFeePercentage / 100);
      const admin = afterTax * 0.06;
      const net = gross - tax - hidden - admin;

      return {
        'Destination': route.delivery_location,
        'Code': route.delivery_code,
        'Gross (₱)': gross,
        'Tax (2%) (₱)': -tax,
        [`Hidden (${hiddenFeePercentage}%) (₱)`]: -hidden,
        'Admin (6%) (₱)': -admin,
        'Net (₱)': net
      };
    });

    // Create worksheet and workbook structure
    const worksheet = XLSX.utils.json_to_sheet(excelRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `${activeTruck} Rates`);

    // Dynamic filename: e.g., "FILO_LOGISTICS_JYSCS_AUV_Rates.xlsx"
    const sanitizedClientName = client.client_name?.replace(/[^a-z0-9]/gi, '_');
    const sanitizedTabName = activeTab.replace(/[^a-z0-9]/gi, '_');
    const filename = `${sanitizedClientName}_${sanitizedTabName}_${activeTruck}_Rates.xlsx`;

    // Trigger local browser download
    XLSX.writeFile(workbook, filename);
  };

  return (
    <div className="border-t bg-muted/20">
      <div className="px-5 py-4 border-b">
        <h4 className="text-sm font-semibold">Routes & Rates</h4>
      </div>

      {/* Pickup Tabs */}
      <div className="flex gap-1 px-5 pt-3 border-b border-border overflow-x-auto">
        {pickupLocations.map(loc => (
          <button
            key={loc}
            onClick={() => setActiveTab(loc)}
            className={`px-3 py-1.5 text-xs font-medium rounded-t border-b-2 transition-colors ${
              activeTab === loc
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {loc}
          </button>
        ))}
      </div>

      {/* Truck Tabs */}
      <div className="flex gap-1 px-5 pt-2 border-b border-border bg-muted/30 overflow-x-auto">
        {['AUV', 'Sub-4W', '6-Wheel', '10-Wheel'].map(type => (
          <button
            key={type}
            onClick={() => setActiveTruck(type)}
            className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
              activeTruck === type
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      <div className="p-5">
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center mb-3">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              className="pl-8 h-8 text-xs"
              placeholder="Search destination or code..."
              value={routeSearch}
              onChange={e => setRouteSearch(e.target.value)}
            />
          </div>
          
          <Button 
            onClick={handleExportExcel} 
            variant="outline" 
            size="sm" 
            className="h-8 text-xs w-full sm:w-auto"
            disabled={processedRoutes.length === 0}
          >
            <Download className="w-3.5 h-3.5 mr-1.5" /> Export {activeTab} ({activeTruck})
          </Button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-2 py-2 font-semibold text-muted-foreground">Destination</th>
                <th className="text-left px-2 py-2 font-semibold text-muted-foreground">Code</th>
                <th className="text-right px-2 py-2 font-semibold text-muted-foreground">Gross</th>
                <th className="text-right px-2 py-2 font-semibold text-muted-foreground text-red-600">Tax(2%)</th>
                <th className="text-right px-2 py-2 font-semibold text-muted-foreground text-orange-600">Hidden({hiddenFeePercentage}%)</th>
                <th className="text-right px-2 py-2 font-semibold text-muted-foreground text-amber-600">Admin(6%)</th>
                <th className="text-right px-2 py-2 font-semibold text-muted-foreground text-emerald-600">Net</th>
              </tr>
            </thead>
            <tbody>
              {processedRoutes.map((route, idx) => {
                const gross = Number(route.rates?.[activeTruck] || 0);
                const tax = gross * 0.02;
                const afterTax = gross - tax;
                const hidden = afterTax * (hiddenFeePercentage / 100);
                const admin = afterTax * 0.06;
                const net = gross - tax - hidden - admin;

                return (
                  <tr key={idx} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-2 py-2">{route.delivery_location}</td>
                    <td className="px-2 py-2 font-mono">{route.delivery_code}</td>
                    <td className="px-2 py-2 text-right font-medium">₱{gross.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td className="px-2 py-2 text-right text-red-600">-₱{tax.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td className="px-2 py-2 text-right text-orange-600">-₱{hidden.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td className="px-2 py-2 text-right text-amber-600">-₱{admin.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td className="px-2 py-2 text-right font-bold text-emerald-700">₱{net.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// MAIN COMPONENT: CLIENT ACCOUNTS VIEW
// ==========================================
export default function ClientAccounts() {
  const { user: currentUser } = useAuth();
  
  const isAdmin = currentUser?.role === 'admin';
  const canEdit = isAdmin || currentUser?.role === 'user';
  
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [expandedClients, setExpandedClients] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.ClientAccount.list('client_name', 100);
      setList(data || []);
      return data || [];
    } catch (error) {
      console.error("Error loading client accounts:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filteredList = useMemo(() => {
    if (!search) return list;
    const cleanSearch = search.toLowerCase();
    return list.filter(c =>
      c.client_name?.toLowerCase().includes(cleanSearch) ||
      c.client_code?.toLowerCase().includes(cleanSearch)
    );
  }, [list, search]);

  const handleEdit = (item) => { setEditData(item); setFormOpen(true); };
  const handleAdd = () => { setEditData(null); setFormOpen(true); };
  const toggleExpand = (id) => setExpandedClients(p => ({ ...p, [id]: !p[id] }));
  
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
          canEdit && ( 
            <Button onClick={handleAdd} size="sm">
              <Plus className="w-4 h-4 mr-1.5" /> Create Account
            </Button>
          )
        }
      />

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search client..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Loading...</div>
      ) : filteredList.length === 0 ? (
        <div className="text-center py-16">
          <Building2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">No client accounts found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredList.map(client => (
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
                  {canEdit && (
                    <button onClick={() => handleEdit(client)} className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground">
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                  {isAdmin && (
                    <button onClick={() => handleDelete(client)} className="p-1.5 hover:bg-red-50 rounded text-muted-foreground hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => toggleExpand(client.id)} className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground">
                    {expandedClients[client.id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {expandedClients[client.id] && <ClientRouteTable client={client} />}
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