import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { sheetUrl, trips } = await req.json();
        
        if (!sheetUrl || !trips || trips.length === 0) {
            return Response.json({ 
                success: false, 
                message: 'Invalid sheet URL or no trip data provided' 
            });
        }

        // Extract sheet ID from URL
        const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (!match) {
            return Response.json({ 
                success: false, 
                message: 'Invalid Google Sheet URL format' 
            });
        }

        const sheetId = match[1];

        // Prepare data for Google Sheets API
        // Note: This requires Google Sheets connector for full integration
        // For now, we'll prepare the data and return it for client-side handling
        
        const headers = [
            'Plate #', 'Owner/Driver', 'Truck Type', 'Client', 'Delivery Date', 
            'DR #', 'Pickup', 'Delivery', 'Delivery Code', 'Billing Cycle',
            'Gross Rate', 'Insurance', 'Other Charges', 'Fuel Subsidy', 'Net Payroll'
        ];

        const rows = trips.map(trip => {
            const gross = trip.gross_rate || 0;
            const tax = gross * 0.02;
            const afterTax = gross - tax;
            const hidden = afterTax * 0.04;
            const admin = afterTax * 0.06;
            const insurance = trip.insurance_charge || 0;
            const other = trip.other_charges || 0;
            const fuelSubsidy = trip.fuel_subsidy || 0;
            const net = gross - tax - hidden - admin - insurance - other + fuelSubsidy;

            return [
                trip.plate_number,
                trip.owner_name,
                trip.truck_type,
                trip.client_name,
                trip.delivery_date,
                trip.dr_number,
                trip.pickup_location,
                trip.delivery_location,
                trip.delivery_code,
                trip.billing_cycle_name,
                gross.toFixed(2),
                insurance.toFixed(2),
                other.toFixed(2),
                fuelSubsidy.toFixed(2),
                net.toFixed(2)
            ];
        });

        const values = [headers, ...rows];

        // For direct Google Sheets integration, we need the Sheets API
        // Since we don't have the connector, we'll create an Excel file instead
        const xlsx = await import('npm:xlsx@0.18.5');
        
        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.aoa_to_sheet(values);
        
        // Set column widths
        ws['!cols'] = [
            { wch: 12 }, { wch: 20 }, { wch: 12 }, { wch: 20 }, { wch: 12 },
            { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 15 },
            { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }
        ];
        
        xlsx.utils.book_append_sheet(wb, ws, 'Trip Records');

        // Generate Excel buffer
        const excelBuffer = xlsx.write(wb, { type: 'array', bookType: 'xlsx' });

        return Response.json({ 
            success: true, 
            message: `Prepared ${trips.length} trips for export. Download the Excel file and import to Google Sheets.`,
            excelData: Array.from(new Uint8Array(excelBuffer)),
            sheetId: sheetId
        });
    } catch (error) {
        return Response.json({ 
            success: false, 
            message: 'Export failed: ' + error.message 
        });
    }
});