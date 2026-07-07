import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2 } from 'lucide-react';

const TRUCK_TYPES = ['AUV', 'Sub-4W', '6-Wheel', '10-Wheel'];

const emptyRow = () => ({
  delivery_location: '',
  delivery_code: '',
  trip_route_code: '',
  rates: { AUV: '', 'Sub-4W': '', '6-Wheel': '', '10-Wheel': '' }
});

export default function AddPickupLocationDialog({ open, onClose, onAdd }) {
  const [pickupName, setPickupName] = useState('');
  const [activeTruck, setActiveTruck] = useState('AUV');
  const [rows, setRows] = useState([emptyRow()]);

  const reset = () => {
    setPickupName('');
    setActiveTruck('AUV');
    setRows([emptyRow()]);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const addRow = () => setRows(p => [...p, emptyRow()]);
  const removeRow = (i) => setRows(p => p.filter((_, idx) => idx !== i));

  const setRowField = (i, field, value) => setRows(p => {
    const next = [...p];
    next[i] = { ...next[i], [field]: value };
    return next;
  });

  const setRowRate = (i, truck, value) => setRows(p => {
    const next = [...p];
    next[i] = { ...next[i], rates: { ...next[i].rates, [truck]: value } };
    return next;
  });

  const handleAdd = () => {
    const loc = pickupName.trim().toUpperCase();
    if (!loc) { alert('Please enter a pickup location name.'); return; }

    // Build routes: one per row, all stamped with pickup_location
    const newRoutes = rows
      .filter(r => r.delivery_location.trim() || r.delivery_code.trim())
      .map(r => ({
        pickup_location: loc,
        delivery_location: r.delivery_location.trim(),
        delivery_code: r.delivery_code.trim(),
        trip_route_code: r.trip_route_code.trim(),
        rates: Object.fromEntries(
          Object.entries(r.rates).map(([k, v]) => [k, v === '' ? null : parseFloat(v)])
        )
      }));

    // If no rows filled, still add one blank route with just the pickup location
    if (newRoutes.length === 0) {
      newRoutes.push({
        pickup_location: loc,
        delivery_location: '',
        delivery_code: '',
        trip_route_code: '',
        rates: { AUV: null, 'Sub-4W': null, '6-Wheel': null, '10-Wheel': null }
      });
    }

    onAdd(loc, newRoutes);
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Pickup Location</DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 space-y-5 py-2 pr-1">

          {/* Pickup location name */}
          <div className="space-y-1.5">
            <Label>Pickup Location Name *</Label>
            <Input
              value={pickupName}
              onChange={e => setPickupName(e.target.value.toUpperCase())}
              placeholder="e.g. DSV_MAKATI"
            />
          </div>

          {/* Truck type tabs */}
          <div>
            <Label className="mb-2 block">Truck Type (select to enter rates)</Label>
            <div className="flex gap-1 flex-wrap border-b border-border mb-3">
              {TRUCK_TYPES.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setActiveTruck(t)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-t border-b-2 transition-colors ${
                    activeTruck === t
                      ? 'border-primary text-primary bg-primary/5'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Rate matrix table */}
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-muted/60 border-b">
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground border-r">Destination</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground border-r">Route Code</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground border-r">Trip Route</th>
                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-white bg-primary border-r">{activeTruck}</th>
                    <th className="px-2 py-2.5 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className="border-b last:border-b-0 hover:bg-muted/20">
                      <td className="px-2 py-1.5 border-r">
                        <Input
                          className="h-7 text-xs min-w-[120px]"
                          value={row.delivery_location}
                          onChange={e => setRowField(i, 'delivery_location', e.target.value)}
                          placeholder="e.g. Baguio City"
                        />
                      </td>
                      <td className="px-2 py-1.5 border-r">
                        <Input
                          className="h-7 text-xs min-w-[90px]"
                          value={row.delivery_code}
                          onChange={e => setRowField(i, 'delivery_code', e.target.value)}
                          placeholder="e.g. BGO"
                        />
                      </td>
                      <td className="px-2 py-1.5 border-r">
                        <Input
                          className="h-7 text-xs min-w-[90px]"
                          value={row.trip_route_code}
                          onChange={e => setRowField(i, 'trip_route_code', e.target.value)}
                          placeholder="Optional"
                        />
                      </td>
                      <td className="px-2 py-1.5 border-r bg-primary/5">
                        <Input
                          className="h-7 text-xs text-right min-w-[80px]"
                          type="number"
                          min="0"
                          step="1"
                          placeholder="—"
                          value={row.rates[activeTruck]}
                          onChange={e => setRowRate(i, activeTruck, e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <button onClick={() => removeRow(i)} className="text-red-400 hover:text-red-600 p-0.5" disabled={rows.length === 1}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Button type="button" variant="outline" size="sm" onClick={addRow} className="mt-2">
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Row
            </Button>
            <p className="text-xs text-muted-foreground mt-1">Switch truck type tabs to enter rates for other vehicle types.</p>
          </div>
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleAdd} disabled={!pickupName.trim()}>Add Pickup Location</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}