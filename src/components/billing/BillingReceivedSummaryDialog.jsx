import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ClipboardList } from 'lucide-react';

export default function BillingReceivedSummaryDialog({ open, onClose, billingDate, cycles, fuelSubsidies }) {
  const [trips, setTrips] = useState([]);
  const [billingDeductions, setBillingDeductions] = useState([]);
  const [loading, setLoading] = useState(false);

  const cycleIds = cycles?.map(c => c.id) || [];

  useEffect(() => {
    if (open && cycleIds.length > 0) {
      loadData();
    }
  }, [open, cycleIds.join(',')]);

  const loadData = async () => {
    setLoading(true);
    const [allTrips, deductions] = await Promise.all([
      Promise.all(cycleIds.map(id => base44.entities.TripRecord.filter({ billing_cycle_id: id }, '-delivery_date', 500))).then(r => r.flat()),
      base44.entities.BillingDeduction.filter({ billing_received_date: billingDate }, 'plate_number', 200),
    ]);
    setTrips(allTrips);
    setBillingDeductions(deductions);
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
    const fuelSubsidyAmount = (() => {
      const s = getFuelSubsidy(trip);
      return s ? gross * (s.subsidy_percentage / 100) : 0;
    })();
    const net = gross - tax - hidden - admin + fuelSubsidyAmount;
    return { gross, tax, afterTax, hidden, admin, fuelSubsidy: fuelSubsidyAmount, net };
  };

  // Group trips by plate_number and aggregate totals
  const plateGroups = (() => {
    const groups = {};
    trips.forEach(trip => {
      const key = trip.plate_number;
      if (!groups[key]) {
        groups[key] = {
          plate_number: trip.plate_number,
          owner_name: trip.owner_name,
          truck_type: trip.truck_type,
          client_name: trip.client_name,
          gross: 0, tax: 0, hidden: 0, admin: 0, fuelSubsidy: 0, tripNet: 0,
          tripCount: 0,
        };
      }
      const t = calculateTotals(trip);
      groups[key].gross += t.gross;
      groups[key].tax += t.tax;
      groups[key].hidden += t.hidden;
      groups[key].admin += t.admin;
      groups[key].fuelSubsidy += t.fuelSubsidy;
      groups[key].tripNet += t.net;
      groups[key].tripCount += 1;
    });
    // Apply flat deductions per plate
    return Object.values(groups).map(row => {
      const ded = billingDeductions.find(d => d.plate_number === row.plate_number);
      const insurance = ded?.insurance_charge || 0;
      const other = ded?.other_charges || 0;
      return { ...row, insurance, other, net: row.tripNet - insurance - other };
    }).sort((a, b) => a.plate_number.localeCompare(b.plate_number));
  })();

  const grandTotals = plateGroups.reduce((acc, row) => {
    acc.afterTax += row.gross - row.tax;
    acc.fuelSubsidy += row.fuelSubsidy;
    acc.net += row.net;
    return acc;
  }, { afterTax: 0, fuelSubsidy: 0, net: 0 });

  const statementNames = cycles?.map(c => c.cycle_name).join(', ') || '';
  const clientNames = [...new Set(cycles?.map(c => c.client_name).filter(Boolean) || [])].join(', ');

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[98vw] max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Billing Received Summary — {billingDate}</DialogTitle>
          {(statementNames || clientNames) && (
            <div className="text-sm text-muted-foreground mt-1 space-y-0.5">
              {statementNames && <div><span className="font-medium">Statements:</span> {statementNames}</div>}
              {clientNames && <div><span className="font-medium">Client:</span> {clientNames}</div>}
            </div>
          )}
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

            {/* Grouped by Plate # Table */}
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="border-b">
                    {['Plate #', 'Owner / Driver', 'Truck', 'Client', 'Trips', 'Gross Rate', 'Tax (2%)', 'Hidden (4%)', 'Admin (6%)', 'Insurance', 'Other', 'Fuel Subsidy', 'Net Payroll'].map(h => (
                      <th key={h} className="text-left px-3 py-3 font-semibold text-xs text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {plateGroups.map(row => (
                    <tr key={row.plate_number} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-3 font-mono font-semibold text-primary whitespace-nowrap">{row.plate_number}</td>
                      <td className="px-3 py-3 whitespace-nowrap">{row.owner_name}</td>
                      <td className="px-3 py-3">
                        <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">{row.truck_type}</span>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">{row.client_name}</td>
                      <td className="px-3 py-3 text-center text-xs text-muted-foreground">{row.tripCount}</td>
                      <td className="px-3 py-3 text-right font-semibold whitespace-nowrap">₱{row.gross.toFixed(2)}</td>
                      <td className="px-3 py-3 text-right text-red-600 whitespace-nowrap">-₱{row.tax.toFixed(2)}</td>
                      <td className="px-3 py-3 text-right text-orange-600 whitespace-nowrap">-₱{row.hidden.toFixed(2)}</td>
                      <td className="px-3 py-3 text-right text-amber-600 whitespace-nowrap">-₱{row.admin.toFixed(2)}</td>
                      <td className="px-3 py-3 text-right text-blue-600 whitespace-nowrap">-₱{row.insurance.toFixed(2)}</td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">-₱{row.other.toFixed(2)}</td>
                      <td className="px-3 py-3 text-right text-green-600 whitespace-nowrap">+₱{row.fuelSubsidy.toFixed(2)}</td>
                      <td className="px-3 py-3 text-right font-bold text-emerald-700 whitespace-nowrap">₱{row.net.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-muted/50">
                    <td colSpan={12} className="px-3 py-3 text-sm font-semibold text-right">Grand Total Net Payroll</td>
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