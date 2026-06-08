import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { sheetUrl } = await req.json();
        
        if (!sheetUrl || typeof sheetUrl !== 'string') {
            return Response.json({ 
                success: false, 
                message: 'Invalid or missing sheet URL' 
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

        // Try to access the sheet metadata (public check)
        const response = await fetch(
            `https://docs.google.com/feeds/download/spreadsheets/Export?key=${sheetId}&exportFormat=xlsx`,
            { method: 'HEAD' }
        );

        if (response.ok || response.status === 200 || response.status === 302) {
            return Response.json({ 
                success: true, 
                message: 'Successfully accessed Google Sheet!' 
            });
        } else {
            return Response.json({ 
                success: false, 
                message: 'Cannot access sheet. Make sure it\'s shared with "Anyone with the link" or connect Google Sheets connector.' 
            });
        }
    } catch (error) {
        return Response.json({ 
            success: false, 
            message: 'Connection failed: ' + error.message 
        });
    }
});