import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { sheetUrl, trips, deductions, reimbursements, exportType } = await req.json();
        
        if (!sheetUrl) {
            return Response.json({ 
                success: false, 
                message: 'Invalid sheet URL' 
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

        // Get Google Sheets access token
        const { accessToken } = await base44.asServiceRole.connectors.getConnection("googlesheets");

        // Handle DEDUCTION export (includes reimbursements)
        if (exportType === 'deductions') {
            const allDeductions = deductions || [];
            const allReimbursements = reimbursements || [];

            if (allDeductions.length === 0 && allReimbursements.length === 0) {
                return Response.json({ success: false, message: 'No deduction or reimbursement data provided' });
            }

            const dedHeaders = ['Type', 'Billing Received Date', 'Plate #', 'Owner / Driver', 'Amount (₱)', 'Notes'];
            const dedRows = allDeductions.map(d => [
                'Deduction',
                d.billing_received_date,
                d.plate_number,
                d.owner_name,
                '-' + ((d.insurance_charge || 0) + (d.other_charges || 0)).toFixed(2),
                d.notes || ''
            ]);
            const reimbRows = allReimbursements.map(r => [
                'Reimbursement',
                r.billing_received_date,
                r.plate_number,
                r.owner_name,
                '+' + (r.reimbursement_amount || 0).toFixed(2),
                r.notes || ''
            ]);

            const dedValues = [dedHeaders, ...dedRows, ...reimbRows];

            await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/DEDUCTION!A1:Z10000:clear`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
            });

            const dedResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/DEDUCTION!A1:append?valueInputOption=USER_ENTERED`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ values: dedValues })
            });

            if (!dedResponse.ok) {
                const error = await dedResponse.json();
                throw new Error(error.error?.message || 'Failed to append data');
            }

            return Response.json({ success: true, message: `Successfully exported ${allDeductions.length} deductions and ${allReimbursements.length} reimbursements to Google Sheet (DEDUCTION tab)!` });
        }

        // Handle TRIP export (default)
        if (!trips || trips.length === 0) {
            return Response.json({ success: false, message: 'No trip data provided' });
        }

        // Prepare data for Google Sheets API
        const headers = [
            'Plate #', 'Owner/Driver', 'Truck Type', 'Client', 'Sub-Account', 'Delivery Date', 
            'DR #', 'Waybill #', 'Pickup', 'Delivery', 'Delivery Code', 'Trip Route Code', 'Billing Cycle',
            'Billing Received Date', 'Gross Rate', 'Tax (2%)', 'Hidden Fee (4%)', 'Admin Fee (6%)', 
            'Fuel Subsidy', 'Net Payroll'
        ];

        const rows = trips.map(trip => {
            const gross = trip.gross_rate || 0;
            const tax = trip.tax_2_percent || (gross * 0.02);
            const hidden = trip.hidden_fee_4_percent || ((gross - tax) * 0.04);
            const admin = trip.admin_fee_6_percent || ((gross - tax) * 0.06);
            const fuelSubsidy = trip.fuel_subsidy || 0;
            const net = trip.net_payroll || (gross - tax - hidden - admin + fuelSubsidy);

            return [
                trip.plate_number,
                trip.owner_name,
                trip.truck_type,
                trip.client_name,
                trip.sub_account_name || '',
                trip.delivery_date,
                trip.dr_number,
                trip.waybill_number || '', // Added Waybill Number
                trip.pickup_location,
                trip.delivery_location,
                trip.delivery_code,
                trip.trip_route_code || '',
                trip.billing_cycle_name,
                trip.billing_received_date || '',
                gross.toFixed(2),
                tax.toFixed(2),
                hidden.toFixed(2),
                admin.toFixed(2),
                fuelSubsidy.toFixed(2),
                net.toFixed(2)
            ];
        });

        const values = [headers, ...rows];

        // Clear existing data in the sheet and append new data
        // First, clear the sheet
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/TRIP!A1:Z1000:clear`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        // Then append the new data
        const appendResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/TRIP!A1:append?valueInputOption=USER_ENTERED`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                values: values
            })
        });

        if (!appendResponse.ok) {
            const error = await appendResponse.json();
            throw new Error(error.error?.message || 'Failed to append data');
        }

        return Response.json({ 
            success: true, 
            message: `Successfully exported ${trips.length} trips to Google Sheet (TRIP tab)!`,
            sheetId: sheetId
        });

    } catch (error) {
        return Response.json({ 
            success: false, 
            message: 'Export failed: ' + error.message 
        });
    }
});