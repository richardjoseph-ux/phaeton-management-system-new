import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ClipboardList } from 'lucide-react';

export default function BillingReceivedSummaryDialog({ open, onClose, billingDate, cycles, fuelSubsidies }) {
  const [trips, setTrips] = useState([]);
  const [billingDeductions, setBillingDeductions] = useState([]);
  const [reimbursements, setReimbursements] = useState([]);
  const [otherCharges, setOtherCharges] = useState([]); // New state
  const [loading, setLoading] = useState(false);

  const cycleIds = cycles?.map(c => c.id) || [];

  useEffect(() => {
    if (open && cycleIds.length > 0) {
      loadData();
    }
  }, [open, cycleIds.join(',')]);

  const loadData = async () => {
    setLoading(true);
    const [allTrips, deductions, reimbs, otherChargesData] = await Promise.all([
      Promise.all(cycleIds.map(id => base44.entities.TripRecord.filter({ billing_cycle_id: id }, '-delivery_date', 500))).then(r => r.flat()),
      base44.entities.BillingDeduction.filter({ billing_received_date: billingDate }, 'plate_number', 200),
      base44.entities.Reimbursement.filter({ billing_received_date: billingDate }, 'plate_number', 200),
      base44.entities.OtherCharges.filter({ billing_received_date: billingDate }, 'charge_type', 200),
    ]);
    setTrips(allTrips);
    setBillingDeductions(deductions);
    setReimbursements(reimbs);
    setOtherCharges(otherChargesData);
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
    const tax = trip.tax_deduction || 0;
    const hidden = trip.hidden_fee || 0;
    const admin = trip.admin_fee || 0;
    const fuelSubsidyAmount = (() => {
      const s = getFuelSubsidy(trip);
      return s ? gross * (s.subsidy_percentage / 100) : 0;
    })();
    const net = trip.net_payroll || (gross - tax - hidden - admin + fuelSubsidyAmount);
    return { gross, tax, hidden, admin, fuelSubsidy: fuelSubsidyAmount, net };
  };

  const plateGroups = (() => {
    const groups = {};
    trips.forEach(trip => {
      const key = trip.plate_number;
      if (!groups[key]) {
        groups[key] = { plate_number: trip.plate_number, owner_name: trip.owner_name, truck_type: trip.truck_type, client_name: trip.client_name, gross: 0, tax: 0, hidden: 0, admin: 0, fuelSubsidy: 0, tripNet: 0, tripCount: 0 };
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
    return Object.values(groups).map(row => {
      const ded = billingDeductions.find(d => d.plate_number === row.plate_number);
      const insurance = ded?.insurance_charge || 0;
      const other = ded?.other_charges || 0;
      const totalReimbursement = reimbursements.filter(r => r.plate_number === row.plate_number).reduce((sum, r) => sum + (r.reimbursement_amount || 0), 0);
      
      // Fixed net formula below: explicitly added "+ row.fuelSubsidy" to the end
      return { 
        ...row, 
        insurance, 
        other, 
        reimbursement: totalReimbursement, 
        net: row.tripNet - insurance - other + totalReimbursement + row.fuelSubsidy 
      };
    }).sort((a, b) => a.plate_number.localeCompare(b.plate_number));
  })();

  const grandTotals = plateGroups.reduce((acc, row) => {
    acc.gross += row.gross;
    acc.tax += row.tax;
    acc.other += row.other;
    acc.fuelSubsidy += row.fuelSubsidy;
    acc.net += row.net;
    return acc;
  }, { gross: 0, tax: 0, other: 0, fuelSubsidy: 0, net: 0 });

// 1. Separate the revenue charges during the reduce loop
const chargeTotals = dateOtherCharges.reduce((acc, oc) => {
  const amount = oc.amount || 0;
  const type = oc.charge_type || '';

  if (type === 'Demurrage') {
    acc.demurrage += amount;
  } else if (type === 'Fuel Subsidy') {
    acc.fuelSubsidy += amount;
  } else {
    acc.others += amount; // This is the "Other" dropdown option (0% tax)
  }
  
  return acc;
}, { demurrage: 0, fuelSubsidy: 0, others: 0 });

// 2. Calculate the combined subtotal subject to the 2% Withholding Tax
// (Total Gross Rate + Demurrage + Fuel Subsidy)
const taxableSubtotal = tripTotals.gross + chargeTotals.demurrage + chargeTotals.fuelSubsidy;

// 3. Apply the 2% withholding tax directly onto that combined sum total
const totalTax = taxableSubtotal * 0.02;

// 4. Final Cheque Calculation:
// Subtract the 2% tax from the taxable subtotal, then add the untaxed "Others" revenue additions.
// (Deductions are excluded as they apply to driver subcon payroll payouts, not client billing cheques)
const chequeAmount = (taxableSubtotal - totalTax) + chargeTotals.others;

  const platesWithTrips = new Set(plateGroups.map(p => p.plate_number));
  const orphanReimbursements = reimbursements.filter(r => !platesWithTrips.has(r.plate_number)).reduce((sum, r) => sum + (r.reimbursement_amount || 0), 0);
  grandTotals.net += orphanReimbursements;

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
            <div className="border rounded-lg overflow-x-auto mb-4">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="border-b">
                    {['Plate #', 'Owner / Driver', 'Truck', 'Client', 'Trips', 'Gross Rate', 'Tax (2%)', 'Hidden (4%)', 'Admin (6%)', 'Insurance', 'Other', 'Reimbursement', 'Fuel Subsidy', 'Net Payroll'].map(h => (
                      <th key={h} className="text-left px-3 py-3 font-semibold text-xs text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {plateGroups.map(row => (
                    <tr key={row.plate_number} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-3 font-mono font-semibold text-primary whitespace-nowrap">{row.plate_number}</td>
                      <td className="px-3 py-3 whitespace-nowrap">{row.owner_name}</td>
                      <td className="px-3 py-3"><span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">{row.truck_type}</span></td>
                      <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">{row.client_name}</td>
                      <td className="px-3 py-3 text-center text-xs text-muted-foreground">{row.tripCount}</td>
                      <td className="px-3 py-3 text-right font-semibold whitespace-nowrap">₱{row.gross.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-3 py-3 text-right text-red-600 whitespace-nowrap">-₱{row.tax.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-3 py-3 text-right text-orange-600 whitespace-nowrap">-₱{row.hidden.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-3 py-3 text-right text-amber-600 whitespace-nowrap">-₱{row.admin.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-3 py-3 text-right text-blue-600 whitespace-nowrap">-₱{row.insurance.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">-₱{row.other.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-3 py-3 text-right text-green-600 whitespace-nowrap">{row.reimbursement > 0 ? `+₱${row.reimbursement.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}</td>
                      <td className="px-3 py-3 text-right text-green-600 whitespace-nowrap">+₱{row.fuelSubsidy.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-3 py-3 text-right font-bold text-emerald-700 whitespace-nowrap">₱{row.net.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Other Charges & Reimbursements */}
            {otherCharges.length > 0 && (
              <div className="border rounded-lg overflow-x-auto mb-4">
                <div className="px-4 py-3 border-b bg-muted/50"><h3 className="font-semibold text-sm">Revenue Adjustments</h3></div>
                <div className="p-4 space-y-2">
                  {otherCharges.map(oc => (
                    <div key={oc.id} className="flex justify-between text-sm">
                      <span>{oc.charge_type} <span className="text-muted-foreground text-xs italic">({oc.description})</span></span>
                      <span className="font-semibold text-blue-600">+₱{oc.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {reimbursements.length > 0 && (
              <div className="border rounded-lg overflow-x-auto mb-4">
                <div className="px-4 py-3 border-b bg-muted/50"><h3 className="font-semibold text-sm text-foreground">Additional Reimbursements</h3></div>
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr className="border-b">{['Plate #', 'Reason', 'Amount (₱)'].map(h => <th key={h} className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {reimbursements.map(r => (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className="px-4 py-3 font-mono font-semibold">{r.plate_number}</td>
                        <td className="px-4 py-3 text-xs">{r.notes || '—'}</td>
                        <td className="px-4 py-3 text-right font-semibold text-green-600">+₱{(r.reimbursement_amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
                <p className="text-xs text-blue-600 font-medium uppercase">Grand Total</p>
                <p className="text-2xl font-bold mt-2 text-blue-700">₱{finalGrandTotalGross.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-5">
                <p className="text-xs text-amber-600 font-medium uppercase">Cheque Amount</p>
                <p className="text-2xl font-bold mt-2 text-amber-700">₱{chequeAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-5">
                <p className="text-xs text-emerald-600 font-medium uppercase">Subcon Payout</p>
                <p className="text-2xl font-bold mt-2 text-emerald-700">₱{grandTotals.net.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
              </div>
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