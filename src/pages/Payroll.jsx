import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Sheet, ShieldCheck, PackageMinus, PlusCircle, Info } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { formatDateDisplay } from '@/lib/dateUtils';
import { useAppData } from '@/lib/AppDataContext';
import { jsPDF } from 'jspdf';

export default function Payroll() {
  const {
    billingCycles,
    fuelSubsidies,
    billingDeductions,
    reimbursements,
    billingReceivedSummaries: summaryRecords,
    isLoading,
  } = useAppData();

  const loading = isLoading.billingCycles || isLoading.fuelSubsidies || isLoading.billingDeductions || isLoading.reimbursements || isLoading.billingReceivedSummaries;

  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedOwner, setSelectedOwner] = useState(null);

  const [dateTrips, setDateTrips] = useState([]);
  const [loadingTrips, setLoadingTrips] = useState(false);

  const [googleSheetUrl, setGoogleSheetUrl] = useState('');
  const [exporting, setExporting] = useState(false);
  const [tripsPage, setTripsPage] = useState(1);
  const rowsPerPage = 10;

  // Pre-fill google sheet URL from fuelSubsidies
  useEffect(() => {
    if (fuelSubsidies.length > 0 && fuelSubsidies[0].google_sheet_url) {
      setGoogleSheetUrl(fuelSubsidies[0].google_sheet_url);
    }
  }, [fuelSubsidies]);

  const activeCycles = useMemo(() => {
    if (!selectedDate) return [];
    return billingCycles.filter(c => c.billing_received_date === selectedDate);
  }, [selectedDate, billingCycles]);

  const dateGroups = (() => {
    const groups = {};
    billingCycles.forEach(c => {
      if (c.billing_received_date) {
        if (!groups[c.billing_received_date]) groups[c.billing_received_date] = [];
        groups[c.billing_received_date].push(c);
      }
    });
    return Object.entries(groups)
      .map(([date, cycles]) => ({ date, cycles }))
      .sort((a, b) => b.date.localeCompare(a.date))
      .filter(g => {
        const rec = summaryRecords.find(r => r.billing_received_date === g.date);
        return !rec?.payroll_processed;
      });
  })();

  const selectDate = async (date) => {
    setSelectedDate(date);
    setSelectedOwner(null);
    setDateTrips([]);
    const group = dateGroups.find(g => g.date === date);
    if (!group) return;
    setLoadingTrips(true);
    const allTrips = await Promise.all(
      group.cycles.map(c => base44.entities.TripRecord.filter({ billing_cycle_id: c.id }, '-delivery_date', 500))
    );
    setDateTrips(allTrips.flat());
    setLoadingTrips(false);
  };

  const ownerList = (() => {
    const seen = {};
    dateTrips.forEach(t => {
      if (!seen[t.plate_number]) {
        seen[t.plate_number] = { plate_number: t.plate_number, owner_name: t.owner_name };
      }
    });
    return Object.values(seen).sort((a, b) => a.plate_number.localeCompare(b.plate_number));
  })();

  const getFuelSubsidy = (trip) => {
    const tripDate = new Date(trip.delivery_date);
    return fuelSubsidies.find(s =>
      s.client_account_id === trip.client_account_id &&
      tripDate >= new Date(s.start_date) &&
      tripDate <= new Date(s.end_date)
    );
  };

  const calculateTripNet = (trip) => {
    const gross = trip.gross_rate || 0;
    const tax = trip.tax_deduction || 0;
    const hidden = trip.hidden_fee || 0;
    const admin = trip.admin_fee || 0;
    const fs = getFuelSubsidy(trip);
    const fuelSubsidy = fs ? gross * (fs.subsidy_percentage / 100) : 0;
    const net = gross - tax - hidden - admin + fuelSubsidy; 
    return { gross, tax, hidden, admin, fuelSubsidy, net };
  };

  const displayedTrips = selectedOwner
    ? dateTrips.filter(t => t.plate_number === selectedOwner)
    : dateTrips;

  const tripsTotalPages = Math.ceil(displayedTrips.length / rowsPerPage);
  const paginatedTrips = displayedTrips.slice((tripsPage - 1) * rowsPerPage, tripsPage * rowsPerPage);

  useEffect(() => { setTripsPage(1); }, [selectedDate, selectedOwner]);

  const tripTotals = useMemo(() => {
    return displayedTrips.reduce((acc, trip) => {
      const t = calculateTripNet(trip);
      acc.gross += t.gross;
      acc.tax += t.tax;
      acc.afterTax += (t.gross - t.tax); 
      acc.hidden += t.hidden;
      acc.admin += t.admin;
      acc.fuelSubsidy += t.fuelSubsidy;
      acc.net += t.net;
      return acc;
    }, { gross: 0, tax: 0, afterTax: 0, hidden: 0, admin: 0, fuelSubsidy: 0, net: 0 });
  }, [displayedTrips]);

  const applicableDeductions = (() => {
    if (!selectedDate) return [];
    const forDate = billingDeductions.filter(d => d.billing_received_date === selectedDate);
    if (selectedOwner) return forDate.filter(d => d.plate_number === selectedOwner);
    return forDate;
  })();

  const applicableReimbursements = useMemo(() => {
    if (!selectedDate) return [];
    const forDate = reimbursements.filter(r => r.billing_received_date === selectedDate);
    return selectedOwner ? forDate.filter(r => r.plate_number === selectedOwner) : forDate;
  }, [reimbursements, selectedDate, selectedOwner]);

  const flatInsurance = applicableDeductions.reduce((s, d) => s + (d.insurance_charge || 0), 0);
  const flatOther = applicableDeductions.reduce((s, d) => s + (d.other_charges || 0), 0);
  const totalReimbursement = applicableReimbursements.reduce((sum, r) => sum + (r.reimbursement_amount || 0), 0);
  
  const grandNetPayroll = tripTotals.net - flatInsurance - flatOther + totalReimbursement;

  const exportPDF = () => {
    if (!selectedDate) return;
    const doc = new jsPDF();
    const ownerLabel = selectedOwner
      ? ownerList.find(o => o.plate_number === selectedOwner)?.owner_name || selectedOwner
      : 'All Owners';

    doc.setFontSize(16);
    doc.text('PT Tracking - Payroll Report', 14, 18);
    doc.setFontSize(10);
    doc.text(`Billing Received: ${selectedDate}`, 14, 26);
    doc.text(`Owner / Driver: ${ownerLabel}`, 14, 32);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 38);

    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    let y = 48;
    doc.text('Plate #', 14, y); doc.text('Owner', 35, y); doc.text('Route', 75, y);
    doc.text('Gross', 120, y); doc.text('Fuel Sub', 148, y); doc.text('Net', 176, y);
    doc.setFont(undefined, 'normal');
    y += 2; doc.line(14, y, 196, y); y += 5;

    displayedTrips.forEach(trip => {
      if (y > 270) { doc.addPage(); y = 20; }
      const t = calculateTripNet(trip);
      doc.text(trip.plate_number, 14, y);
      doc.text((trip.owner_name || '').substring(0, 18), 35, y);
      doc.text(`${trip.delivery_code || ''}`, 75, y);
      doc.text(`₱${t.gross.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 120, y);
      doc.text(t.fuelSubsidy > 0 ? `₱${t.fuelSubsidy.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-', 148, y);
      doc.text(`₱${t.net.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 176, y);
      y += 6;
    });

    y += 3; doc.line(14, y, 196, y); y += 5;
    doc.setFont(undefined, 'bold');
    doc.text(`Subtotal Net (Trips): ₱${tripTotals.net.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 14, y); y += 6;
    if (flatInsurance > 0) { doc.setFont(undefined, 'normal'); doc.text(`Insurance Deduction: -₱${flatInsurance.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 14, y); y += 6; }
    if (flatOther > 0) { doc.setFont(undefined, 'normal'); doc.text(`Other Charges Deduction: -₱${flatOther.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 14, y); y += 6; }
    if (totalReimbursement > 0) { doc.setFont(undefined, 'normal'); doc.text(`Reimbursements: +₱${totalReimbursement.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 14, y); y += 6; }
    doc.setFont(undefined, 'bold');
    doc.text(`GRAND TOTAL NET PAYROLL: ₱${grandNetPayroll.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 14, y);
    doc.save(`Payroll_${selectedDate}_${ownerLabel.replace(/\s/g, '_')}.pdf`);
  };

  const exportToGoogleSheet = async () => {
    if (!googleSheetUrl.trim()) {
      alert('No Google Sheet URL configured. Please set it in Additional Services > Google Sheets Export tab.');
      return;
    }
    setExporting(true);
    const tripData = displayedTrips.map(trip => {
      const t = calculateTripNet(trip);
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
        tax_2_percent: t.tax,
        hidden_fee_4_percent: t.hidden,
        admin_fee_6_percent: t.admin,
        fuel_subsidy: t.fuelSubsidy,
        net_payroll: t.net,
      };
    });
    const response = await base44.functions.invoke('exportToGoogleSheet', { sheetUrl: googleSheetUrl, trips: tripData });
    if (response.data.success) {
      alert(`Exported ${tripData.length} trips to Google Sheet successfully!`);
    } else {
      alert('Export failed: ' + response.data.message);
    }
    setExporting(false);
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Payroll Report"
        subtitle="Select a billing received date, then filter by owner / driver"
        actions={
          selectedDate && (
            <div className="flex gap-2">
              <Button onClick={exportToGoogleSheet} size="sm" variant="outline" disabled={exporting}>
                <Sheet className="w-4 h-4 mr-1.5" /> {exporting ? 'Exporting...' : 'Export to Sheet'}
              </Button>
              <Button onClick={exportPDF} size="sm" variant="outline">
                <FileText className="w-4 h-4 mr-1.5" /> Export PDF
              </Button>
            </div>
          )
        }
      />

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Loading...</div>
      ) : (
        <div>
          <div className="flex items-end gap-4 mb-5">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Billing Received Date</p>
              <Select value={selectedDate || ''} onValueChange={v => selectDate(v)}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Select date..." />
                </SelectTrigger>
                <SelectContent>
                  {dateGroups.map(g => (
                    <SelectItem key={g.date} value={g.date}>
                      {formatDateDisplay(g.date)} ({g.cycles.length} stmt{g.cycles.length > 1 ? 's' : ''})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedDate && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Owner / Driver</p>
                <Select
                  value={selectedOwner || '__all__'}
                  onValueChange={v => setSelectedOwner(v === '__all__' ? null : v)}
                  disabled={loadingTrips}
                >
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="All Owners" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Owners ({dateTrips.length})</SelectItem>
                    {ownerList.map(o => {
                      const count = dateTrips.filter(t => t.plate_number === o.plate_number).length;
                      return (
                        <SelectItem key={o.plate_number} value={o.plate_number}>
                          {o.plate_number} — {o.owner_name} ({count})
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div>
            {!selectedDate ? (
              <div className="text-center py-24 text-muted-foreground">
                <p className="text-sm">Select a billing received date to view payroll</p>
              </div>
            ) : loadingTrips ? (
              <div className="text-center py-24 text-muted-foreground">Loading trips...</div>
            ) : displayedTrips.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <FileText className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">No trips found</p>
              </div>
            ) : (
              <>
                {activeCycles.length > 0 && (
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4 flex items-center gap-3">
                    <Info className="w-5 h-5 text-blue-600 shrink-0" />
                    <div className="text-sm">
                      <p className="font-semibold text-blue-900">Statements included:</p>
                      <p className="text-blue-700">{activeCycles.map(c => c.cycle_name).join(', ')}</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                  <div className="bg-card border rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Total Trips</p>
                    <p className="text-xl font-bold mt-1">{displayedTrips.length}</p>
                  </div>
                  <div className="bg-card border rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Gross - 2% Tax</p>
                    <p className="text-xl font-bold mt-1 text-blue-700">₱{tripTotals.afterTax.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                  <div className="bg-card border rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Fuel Subsidy</p>
                    <p className="text-xl font-bold mt-1 text-green-700">₱{tripTotals.fuelSubsidy.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                  <div className="bg-card border rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Trip Subtotal Net</p>
                    <p className="text-xl font-bold mt-1 text-slate-700">₱{tripTotals.net.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                </div>

                <div className="bg-card border rounded-lg overflow-hidden mb-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          {['Plate #', 'Owner / Driver', 'Truck', 'Client', 'Route', 'Del. Code', 'Del. Date', 'Gross', 'Tax (2%)', 'Hidden (4%)', 'Admin (6%)', 'Fuel Sub', 'Net Payroll'].map(h => (
                            <th key={h} className="text-left px-3 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedTrips.map(trip => {
                          const t = calculateTripNet(trip);
                          return (
                            <tr key={trip.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
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
                              <td className="px-3 py-3 font-mono text-xs whitespace-nowrap">{trip.delivery_code}</td>
                              <td className="px-3 py-3 text-sm whitespace-nowrap">{formatDateDisplay(trip.delivery_date)}</td>
                              <td className="px-3 py-3 text-right font-semibold whitespace-nowrap">₱{t.gross.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td className="px-3 py-3 text-right text-red-600 whitespace-nowrap">-₱{t.tax.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td className="px-3 py-3 text-right text-orange-600 whitespace-nowrap">-₱{t.hidden.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td className="px-3 py-3 text-right text-amber-600 whitespace-nowrap">-₱{t.admin.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td className="px-3 py-3 text-right text-green-600 whitespace-nowrap">{t.fuelSubsidy > 0 ? `+₱${t.fuelSubsidy.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}</td>
                              <td className="px-3 py-3 text-right font-bold text-slate-700 whitespace-nowrap">₱{t.net.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {tripsTotalPages > 1 && (
                    <div className="flex items-center justify-between mt-3 mb-1 px-3">
                      <span className="text-xs text-muted-foreground">Showing {(tripsPage - 1) * rowsPerPage + 1}–{Math.min(tripsPage * rowsPerPage, displayedTrips.length)} of {displayedTrips.length} trips</span>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="sm" disabled={tripsPage === 1} onClick={() => setTripsPage(1)} className="px-2.5">«</Button>
                        <Button variant="outline" size="sm" disabled={tripsPage === 1} onClick={() => setTripsPage(p => p - 1)}>Previous</Button>
                        <span className="text-xs text-muted-foreground px-3 py-1.5 border rounded-md bg-muted/40 font-medium">{tripsPage} / {tripsTotalPages}</span>
                        <Button variant="outline" size="sm" disabled={tripsPage === tripsTotalPages} onClick={() => setTripsPage(p => p + 1)}>Next</Button>
                        <Button variant="outline" size="sm" disabled={tripsPage === tripsTotalPages} onClick={() => setTripsPage(tripsTotalPages)} className="px-2.5">»</Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-card border rounded-lg overflow-hidden mb-4">
                  <div className="px-4 py-3 bg-muted/40 border-b flex items-center gap-2">
                    <PackageMinus className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">Billing Deductions</span>
                  </div>
                  {applicableDeductions.length > 0 ? (
                    <table className="w-full text-sm">
                      <tbody>
                        {applicableDeductions.map(d => (
                          <tr key={d.id} className="border-b last:border-0 hover:bg-muted/20">
                            <td className="px-4 py-2.5 font-mono font-semibold">{d.plate_number}</td>
                            <td className="px-4 py-2.5">{d.owner_name}</td>
                            <td className="px-4 py-2.5 text-right text-blue-700 font-semibold">{(d.insurance_charge || 0) > 0 ? `-₱${d.insurance_charge.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}</td>
                            <td className="px-4 py-2.5 text-right text-orange-700 font-semibold">{(d.other_charges || 0) > 0 ? `-₱${d.other_charges.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}</td>
                            <td className="px-4 py-2.5 text-muted-foreground text-xs">{d.notes || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : <div className="px-4 py-3 text-xs text-muted-foreground">No deductions.</div>}
                </div>

                <div className="bg-card border rounded-lg overflow-hidden mb-4">
                  <div className="px-4 py-3 bg-muted/40 border-b flex items-center gap-2">
                    <PlusCircle className="w-4 h-4 text-green-700" />
                    <span className="text-sm font-semibold">Subcontractor Reimbursements</span>
                  </div>
                  {applicableReimbursements.length > 0 ? (
                    <table className="w-full text-sm">
                      <tbody>
                        {applicableReimbursements.map(r => (
                          <tr key={r.id} className="border-b last:border-0">
                            <td className="px-4 py-2 font-mono font-semibold">{r.plate_number}</td>
                            <td className="px-4 py-2 capitalize">{r.reimbursement_type}</td>
                            <td className="px-4 py-2 text-right text-green-700 font-bold">+₱{r.reimbursement_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            <td className="px-4 py-2 text-xs text-muted-foreground">{r.notes || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : <div className="px-4 py-3 text-xs text-muted-foreground">No reimbursements.</div>}
                </div>

                <div className="flex items-center justify-between px-4 py-4 bg-emerald-50 border-t rounded-lg">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-700" />
                      <span className="font-bold text-emerald-800">Grand Total Net Payroll</span>
                    </div>
                    <span className="text-xs text-emerald-600 mt-1">
                      (Trip Net ₱{tripTotals.net.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      {flatInsurance > 0 ? ` − Insurance ₱${flatInsurance.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}
                      {flatOther > 0 ? ` − Other ₱${flatOther.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}
                      {totalReimbursement > 0 ? ` + Reimbursement ₱${totalReimbursement.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''})
                    </span>
                  </div>
                  <span className="text-2xl font-bold text-emerald-700">₱{grandNetPayroll.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}