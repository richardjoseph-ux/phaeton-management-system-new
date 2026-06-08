import { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Trash2, Upload, Download } from 'lucide-react';

const TRUCK_TYPES = ['AUV', 'Sub-4W', '6-Wheel', '10-Wheel'];

const emptyRoute = () => ({
  pickup_location: '', delivery_location: '', delivery_code: '', trip_route_code: '',
  rates: { AUV: '', 'Sub-4W': '', '6-Wheel': '', '10-Wheel': '' }
});

function TabBar({ tabs, active, onSelect, label }) {
  return (
    <div className="flex gap-1 flex-wrap border-b border-border">
      {tabs.map(tab => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onSelect(tab.value)}
          title={tab.label}
          className={`px-3 py-1.5 text-xs font-medium rounded-t border-b-2 transition-colors max-w-[180px] truncate ${
            active === tab.value
              ? 'border-primary text-primary bg-primary/5'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export default function ClientForm({ open, onClose, onSaved, editData }) {
  const [form, setForm] = useState({
    client_name: '', client_code: '', address: '', contact_person: '',
    contact_number: '', status: 'Active',
    routes: [emptyRoute()]
  });
  const [saving, setSaving] = useState(false);
  const [activePickup, setActivePickup] = useState('__all__');
  const [activeTruck, setActiveTruck] = useState('__all__');
  const fileInputRef = useRef(null);

  // Unique pickup locations
  const pickupTabs = [...new Set(form.routes.map(r => r.pickup_location).filter(Boolean))];

  // Indices visible after both filters
  const visibleIndices = form.routes.reduce((acc, r, i) => {
    const pickupMatch = activePickup === '__all__' || r.pickup_location === activePickup;
    // truck filter: show row if that truck type has a value (or if showing all trucks)
    const truckMatch = activeTruck === '__all__' || (r.rates?.[activeTruck] !== '' && r.rates?.[activeTruck] != null);
    if (pickupMatch && truckMatch) acc.push(i);
    return acc;
  }, []);

  useEffect(() => {
    if (editData) {
      setForm({
        client_name: editData.client_name || '',
        client_code: editData.client_code || '',
        address: editData.address || '',
        contact_person: editData.contact_person || '',
        contact_number: editData.contact_number || '',
        status: editData.status || 'Active',
        routes: editData.routes?.length
          ? editData.routes.map(r => ({
              pickup_location: r.pickup_location || '',
              delivery_location: r.delivery_location || '',
              delivery_code: r.delivery_code || '',
              trip_route_code: r.trip_route_code || '',
              rates: {
                AUV: r.rates?.AUV ?? '',
                'Sub-4W': r.rates?.['Sub-4W'] ?? '',
                '6-Wheel': r.rates?.['6-Wheel'] ?? '',
                '10-Wheel': r.rates?.['10-Wheel'] ?? '',
              }
            }))
          : [emptyRoute()]
      });
    } else {
      setForm({
        client_name: '', client_code: '', address: '', contact_person: '',
        contact_number: '', status: 'Active',
        routes: [emptyRoute()]
      });
    }
    setActivePickup('__all__');
    setActiveTruck('__all__');
  }, [editData, open]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const setRoute = (idx, k, v) => setForm(p => {
    const routes = [...p.routes];
    routes[idx] = { ...routes[idx], [k]: v };
    return { ...p, routes };
  });

  const setRouteRate = (idx, truckType, v) => setForm(p => {
    const routes = [...p.routes];
    routes[idx] = { ...routes[idx], rates: { ...routes[idx].rates, [truckType]: v } };
    return { ...p, routes };
  });

  const addRoute = () => {
    const newRoute = emptyRoute();
    if (activePickup !== '__all__') newRoute.pickup_location = activePickup;
    setForm(p => ({ ...p, routes: [...p.routes, newRoute] }));
  };

  const removeRoute = (idx) => setForm(p => ({ ...p, routes: p.routes.filter((_, i) => i !== idx) }));

  // ── Excel Export ──────────────────────────────────────────────────────────
  const handleExport = () => {
    const rows = form.routes.map(r => ({
      'Pickup Location': r.pickup_location,
      'Delivery Location': r.delivery_location,
      'Delivery Code': r.delivery_code,
      'Trip Route Code': r.trip_route_code,
      'AUV Rate': r.rates?.AUV ?? '',
      'Sub-4W Rate': r.rates?.['Sub-4W'] ?? '',
      '6-Wheel Rate': r.rates?.['6-Wheel'] ?? '',
      '10-Wheel Rate': r.rates?.['10-Wheel'] ?? '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Routes');
    XLSX.writeFile(wb, `${form.client_name || 'client'}_routes.xlsx`);
  };

  // ── Excel Import ──────────────────────────────────────────────────────────
  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws);
      const imported = rows.map(row => ({
        pickup_location: String(row['Pickup Location'] || '').trim(),
        delivery_location: String(row['Delivery Location'] || '').trim(),
        delivery_code: String(row['Delivery Code'] || '').trim(),
        trip_route_code: String(row['Trip Route Code'] || '').trim(),
        rates: {
          AUV: row['AUV Rate'] ?? '',
          'Sub-4W': row['Sub-4W Rate'] ?? '',
          '6-Wheel': row['6-Wheel Rate'] ?? '',
          '10-Wheel': row['10-Wheel Rate'] ?? '',
        }
      }));
      setForm(p => ({ ...p, routes: imported.length ? imported : [emptyRoute()] }));
      setActivePickup('__all__');
      setActiveTruck('__all__');
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    const data = {
      ...form,
      routes: form.routes.map(r => ({
        ...r,
        rates: Object.fromEntries(
          Object.entries(r.rates).map(([k, v]) => [k, v === '' ? null : parseFloat(v)])
        )
      }))
    };
    if (editData) {
      await base44.entities.ClientAccount.update(editData.id, data);
    } else {
      await base44.entities.ClientAccount.create(data);
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  // ── Tab configs ───────────────────────────────────────────────────────────
  const pickupTabList = [
    { value: '__all__', label: `All Pickups (${form.routes.length})` },
    ...pickupTabs.map(p => ({
      value: p,
      label: `${p} (${form.routes.filter(r => r.pickup_location === p).length})`
    }))
  ];

  // For truck tabs, count routes that have a rate for that truck type (within current pickup filter)
  const routesInPickup = activePickup === '__all__'
    ? form.routes
    : form.routes.filter(r => r.pickup_location === activePickup);

  const truckTabList = [
    { value: '__all__', label: `All Trucks (${routesInPickup.length})` },
    ...TRUCK_TYPES.map(t => ({
      value: t,
      label: `${t} (${routesInPickup.filter(r => r.rates?.[t] !== '' && r.rates?.[t] != null).length})`
    }))
  ];

  // Columns to show: in "All Trucks" view show all 4 rate cols; in specific truck view show only that one
  const rateColumns = activeTruck === '__all__' ? TRUCK_TYPES : [activeTruck];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{editData ? 'Edit Client Account' : 'Create Client Account'}</DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 space-y-5 py-2 pr-1">

          {/* Account Info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Client Name *</Label>
              <Input value={form.client_name} onChange={e => set('client_name', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Client Code</Label>
              <Input value={form.client_code} onChange={e => set('client_code', e.target.value.toUpperCase())} />
            </div>
            <div className="space-y-1.5">
              <Label>Contact Person</Label>
              <Input value={form.contact_person} onChange={e => set('contact_person', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Contact Number</Label>
              <Input value={form.contact_number} onChange={e => set('contact_number', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input value={form.address} onChange={e => set('address', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Routes + Rates */}
          <div>
            {/* Toolbar */}
            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Routes &amp; Rates</p>
              <div className="flex items-center gap-2">
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current.click()}>
                  <Upload className="w-3.5 h-3.5 mr-1" /> Import Excel
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleExport}>
                  <Download className="w-3.5 h-3.5 mr-1" /> Export Excel
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={addRoute}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Route
                </Button>
              </div>
            </div>

            {/* Level 1: Pickup Tabs */}
            <TabBar tabs={pickupTabList} active={activePickup} onSelect={(v) => { setActivePickup(v); setActiveTruck('__all__'); }} />

            {/* Level 2: Truck Type Sub-Tabs */}
            <div className="bg-muted/30 px-2 pt-1 pb-0 border-x border-border">
              <TabBar tabs={truckTabList} active={activeTruck} onSelect={setActiveTruck} />
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-b-lg border border-t-0">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-muted/60 border-b">
                    {activePickup === '__all__' && (
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground border-r">Pick Up</th>
                    )}
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground border-r">Destination</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground border-r">Route Code</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground border-r">Trip Route</th>
                    {rateColumns.map(t => (
                      <th key={t} className={`text-center px-3 py-2.5 text-xs font-semibold border-r ${activeTruck === t ? 'text-white bg-primary' : 'text-primary'}`}>{t}</th>
                    ))}
                    <th className="px-2 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleIndices.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center py-6 text-xs text-muted-foreground">
                        No routes found for this filter. {activeTruck !== '__all__' && 'Routes without a rate for this truck type are hidden.'}
                      </td>
                    </tr>
                  ) : visibleIndices.map(idx => {
                    const route = form.routes[idx];
                    return (
                      <tr key={idx} className="border-b last:border-b-0 hover:bg-muted/20">
                        {activePickup === '__all__' && (
                          <td className="px-2 py-1.5 border-r">
                            <Input
                              className="h-7 text-xs min-w-[120px]"
                              value={route.pickup_location}
                              onChange={e => setRoute(idx, 'pickup_location', e.target.value)}
                              placeholder="e.g. DSV Parañaque"
                            />
                          </td>
                        )}
                        <td className="px-2 py-1.5 border-r">
                          <Input
                            className="h-7 text-xs min-w-[120px]"
                            value={route.delivery_location}
                            onChange={e => setRoute(idx, 'delivery_location', e.target.value)}
                            placeholder="e.g. Baguio City"
                          />
                        </td>
                        <td className="px-2 py-1.5 border-r">
                          <Input
                            className="h-7 text-xs min-w-[90px]"
                            value={route.delivery_code}
                            onChange={e => setRoute(idx, 'delivery_code', e.target.value)}
                            placeholder="e.g. BGO"
                          />
                        </td>
                        <td className="px-2 py-1.5 border-r">
                          <Input
                            className="h-7 text-xs min-w-[90px]"
                            value={route.trip_route_code}
                            onChange={e => setRoute(idx, 'trip_route_code', e.target.value)}
                            placeholder="Optional"
                          />
                        </td>
                        {rateColumns.map(t => (
                          <td key={t} className={`px-2 py-1.5 border-r ${activeTruck === t ? 'bg-primary/5' : ''}`}>
                            <Input
                              className="h-7 text-xs text-right min-w-[80px]"
                              type="number"
                              min="0"
                              step="1"
                              placeholder="—"
                              value={route.rates?.[t] ?? ''}
                              onChange={e => setRouteRate(idx, t, e.target.value)}
                            />
                          </td>
                        ))}
                        <td className="px-2 py-1.5 text-center">
                          <button onClick={() => removeRoute(idx)} className="text-red-400 hover:text-red-600 p-0.5">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-muted-foreground mt-1.5">
              {activeTruck !== '__all__'
                ? `Showing only routes with a rate for ${activeTruck}. Switch to "All Trucks" to see and edit all routes.`
                : 'Rates in ₱. Leave blank if a truck type does not serve a route.'}
            </p>
          </div>

        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.client_name}>
            {saving ? 'Saving...' : editData ? 'Update' : 'Create Account'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}