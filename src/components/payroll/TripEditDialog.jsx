import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function TripEditDialog({ open, onClose, onSaved, trip }) {
  const [insuranceCharge, setInsuranceCharge] = useState('');
  const [otherCharges, setOtherCharges] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (trip) {
      setInsuranceCharge(trip.insurance_charge?.toString() || '');
      setOtherCharges(trip.other_charges?.toString() || '');
    }
  }, [trip]);

  if (!trip) return null;

  const gross = trip.gross_rate || 0;
  const tax = gross * 0.02;
  const afterTax = gross - tax;
  const hidden = afterTax * 0.04;
  const admin = afterTax * 0.06;
  const insurance = parseFloat(insuranceCharge) || 0;
  const other = parseFloat(otherCharges) || 0;
  const net = gross - tax - hidden - admin - insurance - other;

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.entities.TripRecord.update(trip.id, {
        insurance_charge: insurance,
        other_charges: other,
        net_payroll: net
      });
      onSaved();
      onClose();
    } catch (error) {
      alert('Error saving: ' + error.message);
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Trip Charges - {trip.plate_number}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Owner / Driver</Label>
              <div className="text-sm text-muted-foreground mt-1">{trip.owner_name}</div>
            </div>
            <div>
              <Label>Truck Type</Label>
              <div className="text-sm text-muted-foreground mt-1">{trip.truck_type}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Route</Label>
              <div className="text-sm text-muted-foreground mt-1">
                {trip.pickup_location} → {trip.delivery_location}
              </div>
            </div>
            <div>
              <Label>Client</Label>
              <div className="text-sm text-muted-foreground mt-1">{trip.client_name}</div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-semibold mb-3">Deductions &amp; Charges</h4>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-sm">Gross Rate</Label>
                <span className="font-semibold">₱{gross.toFixed(2)}</span>
              </div>
              
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Tax (2%)</span>
                <span className="text-red-600">-₱{tax.toFixed(2)}</span>
              </div>
              
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Hidden Fee (4%)</span>
                <span className="text-orange-600">-₱{hidden.toFixed(2)}</span>
              </div>
              
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Admin Fee (6%)</span>
                <span className="text-amber-600">-₱{admin.toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-center pt-2 border-t">
                <Label htmlFor="insurance">Insurance Charge</Label>
                <Input
                  id="insurance"
                  type="number"
                  placeholder="0.00"
                  value={insuranceCharge}
                  onChange={(e) => setInsuranceCharge(e.target.value)}
                  className="w-32 text-right"
                />
              </div>

              <div className="flex justify-between items-center">
                <Label htmlFor="other">Other Charges</Label>
                <Input
                  id="other"
                  type="number"
                  placeholder="0.00"
                  value={otherCharges}
                  onChange={(e) => setOtherCharges(e.target.value)}
                  className="w-32 text-right"
                />
              </div>

              <div className="flex justify-between items-center pt-3 border-t bg-emerald-50 p-3 rounded">
                <Label className="font-bold text-emerald-800">Net Payroll</Label>
                <span className="font-bold text-emerald-700 text-lg">₱{net.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}