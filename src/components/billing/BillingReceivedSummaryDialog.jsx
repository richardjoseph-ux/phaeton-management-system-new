import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ClipboardList } from 'lucide-react';

export default function BillingReceivedSummaryDialog({ open, onClose, billingDate, cycleIds, fuelSubsidies }) {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && cycleIds?.length > 0) {
      loadTrips();
    }
  }, [open, cycleIds]);

  const loadTrips = async () => {
    setLoading(true);
    const allTrips = await Promise.all(
      cycleIds.map(id => base44.entities.TripRecord.filter({ billing_cycle_id: id }, '-delivery_date', 500))
    );
    setTrips(allTrips.flat());
    setLoading(false);
  };

  const getFuelSubsidy = (trip) => {
    if (!fuelSubsidies) return null;
    const tripDate = new Date(trip.delivery_date);
    return fuelSubsidies.find(subsidy => {
      const startDate = new Date(subsidy.start_date);
      const endDate = new Date(subsidy.end_date);
      return subsidy.client_account_id === trip.client_account_id &&
             tripDate >= startDate && tripDate <= endDate;
    });
  };

  const calculateTotals = (trip) => {
    const gross = trip.gross_rate || 0;
    const tax = gross * 0.02;
    const afterTax = gross - tax;
    const hidden = afterTax * 0.04;
    const admin = afterTax * 0.06;
    const insurance = trip.insurance_charge || 0;
    const other = trip.other_charges || 0;
    const fuelSubsidy = getFuelSubsidy(trip);
    const fuelSubsidyAmount = fuelSubsidy ? gross * (fuelSubsidy.subsidy_percentage / 100) : 0;
    const net = gross - tax - hidden - admin - insurance - other + fuelSubsidyAmount;
    return { gross, tax, afterTax, hidden, admin, insurance, other, fuelSubsidy: fuelSubsidyAmount, net };
  };

  const grandTotals = trips.reduce((acc, trip) => {
    const t = calculateTotals(trip);
    acc.afterTax += t.afterTax;
    acc.fuelSubsidy += t.fuelSubsidy;
    acc.net += t.net;
    return acc;
  }, { afterTax: 0, fuelSubsidy: 0, net: 0 });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[98vw] max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Billing Received Summary — {billingDate}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading trips...</div>
        ) : trips.length === 0 ? (
          <div className="text-center py-12">
            <ClipboardList className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-muted-foreground text-sm">No trips found for this billing date</p>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-card border rounded-lg p-4">
                <p className="text-xs text-muted-foreground">Total Trips</p>
                <p className="text-xl font-bold mt-1">{trips.length}</p>
              </div>
              <div className="bg-card border rounded-lg p-4">
                <p className="text-xs text-muted-foreground">Gross Amount - 2% Tax</p>
                <p className="text-xl font-bold mt-1 text-blue-700">₱{grandTotals.afterTax.toFixed(2)}</p>
              </div>
              <div className="bg-card border rounded-lg p-4">
                <p className="text-xs text-muted-foreground">Total Fuel Subsidy</p>
                <p className="text-xl font-bold mt-1 text-green-700">₱{grandTotals.fuelSubsidy.toFixed(2)}</p>
              </div>
              <div className="bg-card border rounded-lg p-4">
                <p className="text-xs text-muted-foreground">Net Payroll</p>
                <p className="text-xl font-bold mt-1 text-emerald-700">₱{grandTotals.net.toFixed(2)}</p>
              </div>
            </div>

            {/* Detailed Table */}
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="border-b">
                    {['Plate #', 'Owner / Driver', 'Truck', 'Client', 'Route', 'Delivery Code', 'Delivery Date', 'Gross Rate', 'Tax (2%)', 'Hidden (4%)', 'Admin (6%)', 'Insurance', 'Other', 'Fuel Subsidy', 'Net Payroll'].map(h => (
                      <th key={h} className="text-left px-3 py-3 font-semibold text-xs text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {trips.map(trip => {
                    const t = calculateTotals(trip);
                    return (
                      <tr key={trip.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-3 py-3 font-mono font-semibold text-primary whitespace-nowrap">{trip.plate_number}</td>
                        <td className="px-3 py-3 whitespace-nowrap">{trip.owner_name}</td>
                        <td className="px-3 py-3">
                          <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">{trip.truck_type}</span>
                        </td>
                        <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">{trip.client_name}</td>
                        <td className="px-3 py-3 text-xs text-muted-foreground">
                          <div>{trip.pickup_location}</div>
                          <div className="text-muted-foreground/60">→ {trip.delivery_location}</div>
                        </td>
                        <td className="px-3 py-3 font-mono text-xs whitespace-nowrap">{trip.delivery_code || '—'}</td>
                        <td className="px-3 py-3 text-sm whitespace-nowrap">{trip.delivery_date}</td>
                        <td className="px-3 py-3 text-right font-semibold whitespace-nowrap">₱{t.gross.toFixed(2)}</td>
                        <td className="px-3 py-3 text-right text-red-600 whitespace-nowrap">-₱{t.tax.toFixed(2)}</td>
                        <td className="px-3 py-3 text-right text-orange-600 whitespace-nowrap">-₱{t.hidden.toFixed(2)}</td>
                        <td className="px-3 py-3 text-right text-amber-600 whitespace-nowrap">-₱{t.admin.toFixed(2)}</td>
                        <td className="px-3 py-3 text-right text-blue-600 whitespace-nowrap">-₱{t.insurance.toFixed(2)}</td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">-₱{t.other.toFixed(2)}</td>
                        <td className="px-3 py-3 text-right text-green-600 whitespace-nowrap">+₱{t.fuelSubsidy.toFixed(2)}</td>
                        <td className="px-3 py-3 text-right font-bold text-emerald-700 whitespace-nowrap">₱{t.net.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-muted/50">
                    <td colSpan={14} className="px-3 py-3 text-sm font-semibold text-right">Grand Total Net Payroll</td>
                    <td className="px-3 py-3 text-right font-bold text-emerald-700 whitespace-nowrap">₱{grandTotals.net.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}

        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}