import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { FileText, Download, Pencil, Sheet } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { jsPDF } from 'jspdf';
import moment from 'moment';
import TripEditDialog from '@/components/payroll/TripEditDialog';

export default function Payroll() {
  const [trips, setTrips] = useState([]);
  const [billingCycles, setBillingCycles] = useState([]);
  const [fuelSubsidies, setFuelSubsidies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCycles, setSelectedCycles] = useState([]);
  const [editTrip, setEditTrip] = useState(null);
  const [googleSheetUrl, setGoogleSheetUrl] = useState('');
  const [exporting, setExporting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [t, b, s] = await Promise.all([
        base44.entities.TripRecord.list('-delivery_date', 500),
        base44.entities.BillingCycle.list('-created_date', 100),
        base44.entities.FuelSubsidy.list('-created_date', 100),
      ]);
      setTrips(t);
      setBillingCycles(b);
      setFuelSubsidies(s);
      // Extract Google Sheet URL from subsidies
      if (s.length > 0 && s[0].google_sheet_url) {
        setGoogleSheetUrl(s[0].google_sheet_url);
      }
    } catch (error) {
      console.error('Error loading payroll data:', error);
      alert('Failed to load data. Please wait a moment and try again.');
    }
    setLoading(false);
  };

  useEffect(() => { 
    load(); 
  }, []);

  const filteredTrips = trips.filter(t => {
    if (selectedCycles.length === 0) return true;
    return selectedCycles.includes(t.billing_cycle_id);
  });

  const getFuelSubsidy = (trip) => {
    const tripDate = new Date(trip.delivery_date);
    const applicableSubsidy = fuelSubsidies.find(subsidy => {
      const startDate = new Date(subsidy.start_date);
      const endDate = new Date(subsidy.end_date);
      return subsidy.client_account_id === trip.client_account_id &&
             tripDate >= startDate &&
             tripDate <= endDate;
    });
    return applicableSubsidy;
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
    return { gross, afterTax, tax, hidden, admin, insurance, other, net, fuelSubsidy: fuelSubsidyAmount, hasSubsidy: !!fuelSubsidy };
  };

  const grandTotal = filteredTrips.reduce((sum, trip) => {
    return sum + calculateTotals(trip).net;
  }, 0);

  const grandGross = filteredTrips.reduce((sum, trip) => {
    return sum + trip.gross_rate || 0;
  }, 0);

  const exportToGoogleSheet = async () => {
    if (!googleSheetUrl.trim()) {
      alert('No Google Sheet URL configured. Please set it in Additional Services > Google Sheets Export tab.');
      return;
    }

    setExporting(true);
    try {
      // Prepare trip data with all calculations
      const tripData = filteredTrips.map(trip => {
        const totals = calculateTotals(trip);
        return {
          plate_number: trip.plate_number,
          owner_name: trip.owner_name,
          truck_type: trip.truck_type,
          client_name: trip.client_name,
          delivery_date: trip.delivery_date,
          dr_number: trip.dr_number,
          pickup_location: trip.pickup_location,
          delivery_location: trip.delivery_location,
          delivery_code: trip.delivery_code,
          billing_cycle_name: trip.billing_cycle_name,
          gross_rate: trip.gross_rate,
          insurance_charge: trip.insurance_charge,
          other_charges: trip.other_charges,
          fuel_subsidy: totals.fuelSubsidy
        };
      });

      // Call backend function to prepare Excel for Google Sheets
      const response = await base44.functions.invoke('exportToGoogleSheet', {
        sheetUrl: googleSheetUrl,
        trips: tripData
      });

      if (response.data.success) {
        // Download the Excel file
        const blob = new Blob([new Uint8Array(response.data.excelData)], { 
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Trip_Records_${new Date().toISOString().split('T')[0]}.xlsx`;
        link.click();
        window.URL.revokeObjectURL(url);
        
        alert(`Exported ${tripData.length} trips! File downloaded - you can now import it to your Google Sheet.`);
      } else {
        alert('Export failed: ' + response.data.message);
      }
    } catch (error) {
      alert('Error exporting: ' + error.message);
    }
    setExporting(false);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    const cycleLabel = selectedCycles.length === 0 ? 'All Cycles' : 
      selectedCycles.length === 1 ? billingCycles.find(b => b.id === selectedCycles[0])?.cycle_name :
      `Multiple (${selectedCycles.length} cycles)`;

    doc.setFontSize(16);
    doc.text('PT Tracking - Payroll Report', 14, 18);
    doc.setFontSize(10);
    doc.text(`Billing Cycle: ${cycleLabel}`, 14, 26);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 32);

    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    let y = 42;
    doc.text('Plate #', 14, y);
    doc.text('Owner', 35, y);
    doc.text('Truck', 75, y);
    doc.text('Route', 95, y);
    doc.text('Gross', 130, y);
    doc.text('Fuel Sub', 160, y);
    doc.text('Net', 180, y);
    doc.setFont(undefined, 'normal');
    y += 2;
    doc.line(14, y, 196, y);
    y += 5;

    filteredTrips.forEach(trip => {
      if (y > 270) { doc.addPage(); y = 20; }
      const totals = calculateTotals(trip);
      doc.text(trip.plate_number, 14, y);
      doc.text(trip.owner_name?.substring(0, 18) || '', 35, y);
      doc.text(trip.truck_type || '', 75, y);
      doc.text(`${trip.delivery_code}`, 95, y);
      doc.text(`₱${totals.gross.toFixed(2)}`, 130, y);
      doc.text(totals.hasSubsidy ? `₱${totals.fuelSubsidy.toFixed(2)}` : '-', 160, y);
      doc.text(`₱${totals.net.toFixed(2)}`, 180, y);
      y += 6;
    });

    y += 3;
    doc.line(14, y, 196, y);
    y += 5;
    doc.setFont(undefined, 'bold');
    doc.text(`TOTAL NET PAYROLL: ₱${grandTotal.toFixed(2)}`, 14, y);

    doc.save(`Payroll_${cycleLabel.replace(/\s/g, '_')}.pdf`);
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Payroll Report"
        subtitle="View and manage trip payroll by billing cycle"
        actions={
          <div className="flex gap-2">
            <Button onClick={exportToGoogleSheet} size="sm" variant="outline" disabled={exporting}>
               <Sheet className="w-4 h-4 mr-1.5" /> {exporting ? 'Exporting...' : 'Export to TRIP Sheet'}
             </Button>
            <Button onClick={exportPDF} size="sm" variant="outline">
              <FileText className="w-4 h-4 mr-1.5" /> Export PDF
            </Button>
          </div>
        }
      />

      {/* Filter */}
      <div className="mb-6">
        <p className="text-sm font-medium text-muted-foreground mb-3">Billing Cycles</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCycles([])}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedCycles.length === 0
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            All Open Cycles
          </button>
          {billingCycles.filter(b => b.status === 'Open').map(b => (
            <button
              key={b.id}
              onClick={() => {
                if (selectedCycles.includes(b.id)) {
                  setSelectedCycles(selectedCycles.filter(id => id !== b.id));
                } else {
                  setSelectedCycles([...selectedCycles, b.id]);
                }
              }}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedCycles.includes(b.id)
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {b.cycle_name}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Total Trips</p>
          <p className="text-xl font-bold mt-1">{filteredTrips.length}</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Gross Amount - 2% Tax</p>
          <p className="text-xl font-bold mt-1 text-blue-700">₱{filteredTrips.reduce((sum, trip) => sum + calculateTotals(trip).afterTax, 0).toFixed(2)}</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Total Fuel Subsidy</p>
          <p className="text-xl font-bold mt-1 text-green-700">₱{filteredTrips.reduce((sum, trip) => sum + calculateTotals(trip).fuelSubsidy, 0).toFixed(2)}</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Net Payroll</p>
          <p className="text-xl font-bold mt-1 text-emerald-700">₱{grandTotal.toFixed(2)}</p>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Loading payroll data...</div>
      ) : filteredTrips.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">No trips found for the selected billing cycle</p>
        </div>
      ) : (
        <div className="bg-card border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  {['Plate #', 'Owner / Driver', 'Truck', 'Client', 'Route', 'Delivery Code', 'Delivery Date', 'Gross Rate', 'Tax (2%)', 'Hidden (4%)', 'Admin (6%)', 'Insurance', 'Other', 'Fuel Subsidy', 'Net Payroll', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredTrips.map(trip => {
                  const totals = calculateTotals(trip);
                  return (
                    <tr key={trip.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono font-semibold text-primary">{trip.plate_number}</td>
                      <td className="px-4 py-3">{trip.owner_name}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">{trip.truck_type}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{trip.client_name}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        <div>{trip.pickup_location}</div>
                        <div className="text-muted-foreground/60">→ {trip.delivery_location}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{trip.delivery_code}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{new Date(trip.delivery_date).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-right font-semibold">₱{totals.gross.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-red-600">-₱{totals.tax.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-orange-600">-₱{totals.hidden.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-amber-600">-₱{totals.admin.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-blue-600">-₱{totals.insurance.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right">-₱{totals.other.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-green-600 font-semibold">+₱{totals.fuelSubsidy.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-700">₱{totals.net.toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <button 
                          onClick={() => setEditTrip(trip)} 
                          className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/50">
                  <td colSpan={13} className="px-4 py-3 text-sm font-semibold text-right">Grand Total Net Payroll</td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-700 text-base">₱{grandTotal.toFixed(2)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <TripEditDialog
        open={!!editTrip}
        onClose={() => setEditTrip(null)}
        onSaved={load}
        trip={editTrip}
        fuelSubsidies={fuelSubsidies}
      />
    </div>
  );
}