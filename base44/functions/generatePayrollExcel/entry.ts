import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import XLSX from 'npm:xlsx@0.18.5';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { trips } = await req.json();

    if (!trips || !Array.isArray(trips)) {
      return Response.json({ error: 'Invalid trips data' }, { status: 400 });
    }

    // Group trips by plate number
    const tripsByPlate = trips.reduce((acc, trip) => {
      if (!acc[trip.plate_number]) acc[trip.plate_number] = [];
      acc[trip.plate_number].push(trip);
      return acc;
    }, {});

    // Create workbook
    const wb = XLSX.utils.book_new();

    // Process each plate
    Object.entries(tripsByPlate).forEach(([plate, plateTrips]) => {
      const ownerName = plateTrips[0]?.owner_name || '';
      const cycleNames = [...new Set(plateTrips.map(t => t.billing_cycle_name).filter(Boolean))].join(', ') || 'All Open Cycles';
      
      // Find payroll period
      const dates = plateTrips.map(t => new Date(t.delivery_date)).sort((a, b) => a - b);
      const startDate = dates.length ? dates[0].toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';
      const endDate = dates.length ? dates[dates.length - 1].toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';
      const payrollPeriod = dates.length ? `${startDate} - ${endDate}` : '';
      const currentDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

      // Build sheet data matching template structure
      const sheetData = [
        // Row 0-4: Header metadata
        ['Block 3 Lot 1, Pacita 2-B, Cyan St., ', '', '', 'Owners Name:', '', ownerName],
        ['Brgy. San Lorenzo Ruiz, City of San Pedro', '', '', 'Plate #:', '', plate],
        ['Laguna, Philippines', '', '', 'BS/SOA#:', '', cycleNames],
        ['Tin:', '274-546-612-00000', '', 'Payroll Period:', '', payrollPeriod],
        ['Mobile #: 0931-974-6058', '', '', 'Date:', '', currentDate],
        [], // Row 5: Spacer
        // Row 6: Column headers
        ['NO.', 'DATE', 'DR NO.', 'VEHICLE TYPE', 'DESTINATION', '', 'RATE', 'FUEL SUBSIDY'],
        // Row 7: Sub-headers for DESTINATION
        ['', '', '', '', 'FROM', 'TO', '', ''],
      ];

      // Add trip rows starting at Row 8 (index 8)
      plateTrips.forEach((trip, idx) => {
        const gross = trip.gross_rate || 0;
        const tax = gross * 0.02;
        const afterTax = gross - tax;
        const hidden = afterTax * 0.04;
        const admin = afterTax * 0.06;
        const insurance = trip.insurance_charge || 0;
        const other = trip.other_charges || 0;
        const net = gross - tax - hidden - admin - insurance - other;

        sheetData.push([
          idx + 1,
          new Date(trip.delivery_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
          trip.dr_number || '-',
          trip.truck_type || '',
          trip.pickup_location,
          trip.delivery_location || trip.delivery_code,
          net,
          '' // Fuel subsidy calculated separately if needed
        ]);
      });

      // Add spacer row
      sheetData.push([]);

      // Add totals row
      const totalNet = plateTrips.reduce((sum, t) => {
        const gross = t.gross_rate || 0;
        const tax = gross * 0.02;
        const afterTax = gross - tax;
        const hidden = afterTax * 0.04;
        const admin = afterTax * 0.06;
        const insurance = t.insurance_charge || 0;
        const other = t.other_charges || 0;
        return sum + (gross - tax - hidden - admin - insurance - other);
      }, 0);

      sheetData.push(['TOTALS', '', '', '', '', '', totalNet, '']);

      // Create worksheet
      const ws = XLSX.utils.aoa_to_sheet(sheetData);

      // Merge DESTINATION header (Row 6, columns E-F / index 4-5)
      ws['!merges'] = [{ s: { r: 6, c: 4 }, e: { r: 6, c: 5 } }];

      // Set column widths
      ws['!cols'] = [
        { wch: 5 },   // NO.
        { wch: 18 },  // DATE
        { wch: 12 },  // DR NO.
        { wch: 14 },  // VEHICLE TYPE
        { wch: 22 },  // FROM
        { wch: 22 },  // TO
        { wch: 16 },  // RATE
        { wch: 16 }   // FUEL SUBSIDY
      ];

      // Add sheet to workbook
      const sheetName = plate.substring(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    // Generate buffer
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

    return new Response(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Payroll_Report_${new Date().toISOString().split('T')[0]}.xlsx"`
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});