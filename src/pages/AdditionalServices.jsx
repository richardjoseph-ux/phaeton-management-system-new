import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Fuel, Sheet, Trash2 } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { format } from 'date-fns';

export default function AdditionalServices() {
  const [activeTab, setActiveTab] = useState('fuel-subsidies');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    client_account_id: '',
    client_name: '',
    start_date: '',
    end_date: '',
    subsidy_percentage: '',
    notes: ''
  });
  const [googleSheetUrl, setGoogleSheetUrl] = useState('');
  const [savedSheetUrl, setSavedSheetUrl] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportingDeductions, setExportingDeductions] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);

  const queryClient = useQueryClient();

  // Load saved Google Sheet URL on mount
  useEffect(() => {
    const loadSavedUrl = async () => {
      const subsidies = await base44.entities.FuelSubsidy.list();
      if (subsidies.length > 0 && subsidies[0].google_sheet_url) {
        const url = subsidies[0].google_sheet_url;
        setSavedSheetUrl(url);
        setGoogleSheetUrl(url); // Pre-fill the input field
      }
    };
    loadSavedUrl();
  }, []);

  const { data: subsidies, isLoading } = useQuery({
    queryKey: ['fuelSubsidies'],
    queryFn: () => base44.entities.FuelSubsidy.list('-created_date'),
    initialData: [],
  });

  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.ClientAccount.list(),
    initialData: [],
  });

  const deleteSubsidyMutation = useMutation({
    mutationFn: (id) => base44.entities.FuelSubsidy.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fuelSubsidies'] }),
  });

  const createSubsidyMutation = useMutation({
    mutationFn: async (data) => {
      // Fetch trips for the selected client and date range
      const allTrips = await base44.entities.TripRecord.list();
      const filteredTrips = allTrips.filter(trip => 
        trip.client_account_id === data.client_account_id &&
        trip.delivery_date >= data.start_date &&
        trip.delivery_date <= data.end_date
      );

      const totalGrossRate = filteredTrips.reduce((sum, trip) => sum + (trip.gross_rate || 0), 0);
      const subsidyAmount = totalGrossRate * (data.subsidy_percentage / 100);

      return base44.entities.FuelSubsidy.create({
        ...data,
        subsidy_percentage: parseFloat(data.subsidy_percentage),
        total_gross_rate: totalGrossRate,
        subsidy_amount: subsidyAmount
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fuelSubsidies'] });
      setShowForm(false);
      setFormData({
        client_account_id: '',
        client_name: '',
        start_date: '',
        end_date: '',
        subsidy_percentage: '',
        notes: ''
      });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createSubsidyMutation.mutate(formData);
  };

  const handleClientChange = (value) => {
    const client = clients.find(c => c.id === value);
    setFormData({
      ...formData,
      client_account_id: value,
      client_name: client?.client_name || ''
    });
  };

  const handleSaveUrl = async () => {
    if (!googleSheetUrl.trim()) {
      alert('Please enter a Google Sheet URL');
      return;
    }
    
    // Validate URL format
    const match = googleSheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) {
      alert('Invalid Google Sheet URL format');
      return;
    }
    
    try {
      // Save to first fuel subsidy record as a global setting
      const subsidies = await base44.entities.FuelSubsidy.list();
      if (subsidies.length > 0) {
        await base44.entities.FuelSubsidy.update(subsidies[0].id, { google_sheet_url: googleSheetUrl });
      } else {
        // Create a dummy record if none exists
        await base44.entities.FuelSubsidy.create({ 
          google_sheet_url: googleSheetUrl,
          client_account_id: 'settings',
          client_name: 'System Settings',
          start_date: new Date().toISOString().split('T')[0],
          end_date: new Date().toISOString().split('T')[0],
          subsidy_percentage: 0
        });
      }
      setSavedSheetUrl(googleSheetUrl);
      alert('Google Sheet URL saved successfully! The URL will persist across page reloads.');
    } catch (error) {
      alert('Error saving URL: ' + error.message);
    }
  };

  const handleTestConnection = async () => {
    const urlToTest = savedSheetUrl || googleSheetUrl;
    if (!urlToTest.trim()) {
      alert('Please enter or save a Google Sheet URL first');
      return;
    }
    
    setTestingConnection(true);
    setConnectionStatus(null);
    
    try {
      // Call backend function to test connection (avoids CORS issues)
      const response = await base44.functions.invoke('testGoogleSheetConnection', {
        sheetUrl: urlToTest
      });
      
      const result = response.data;
      setConnectionStatus({ 
        success: result.success, 
        message: result.message 
      });
    } catch (error) {
      setConnectionStatus({ success: false, message: 'Connection failed: ' + error.message });
    }
    setTestingConnection(false);
  };

  const handleGoogleSheetExport = async () => {
    const urlToUse = savedSheetUrl || googleSheetUrl;
    if (!urlToUse.trim()) {
      alert('Please enter and save a Google Sheet URL');
      return;
    }

    setExporting(true);
    try {
      const [allTrips, allSubsidies] = await Promise.all([
        base44.entities.TripRecord.list('-delivery_date', 2000),
        base44.entities.FuelSubsidy.list(),
      ]);

      const getFuelSubsidy = (trip) => {
        const tripDate = new Date(trip.delivery_date);
        return allSubsidies.find(s =>
          s.client_account_id === trip.client_account_id &&
          tripDate >= new Date(s.start_date) &&
          tripDate <= new Date(s.end_date)
        );
      };

      const tripData = allTrips.map(trip => {
        const gross = trip.gross_rate || 0;
        const tax = gross * 0.02;
        const afterTax = gross - tax;
        const hidden = afterTax * 0.04;
        const admin = afterTax * 0.06;
        const fs = getFuelSubsidy(trip);
        const fuelSubsidy = fs ? gross * (fs.subsidy_percentage / 100) : 0;
        const net = gross - tax - hidden - admin + fuelSubsidy;
        return {
          plate_number: trip.plate_number,
          owner_name: trip.owner_name,
          truck_type: trip.truck_type,
          client_name: trip.client_name,
          sub_account_name: trip.sub_account_name || '',
          delivery_date: trip.delivery_date,
          dr_number: trip.dr_number,
          pickup_location: trip.pickup_location,
          delivery_location: trip.delivery_location,
          delivery_code: trip.delivery_code,
          trip_route_code: trip.trip_route_code || '',
          billing_cycle_name: trip.billing_cycle_name,
          gross_rate: gross,
          tax_2_percent: tax,
          hidden_fee_4_percent: hidden,
          admin_fee_6_percent: admin,
          fuel_subsidy: fuelSubsidy,
          net_payroll: net,
        };
      });

      const response = await base44.functions.invoke('exportToGoogleSheet', { sheetUrl: urlToUse, trips: tripData });
      if (response.data.success) {
        alert(`Successfully exported ${tripData.length} trips to the TRIP tab!`);
      } else {
        alert('Export failed: ' + response.data.message);
      }
    } catch (error) {
      alert('Error exporting: ' + error.message);
    }
    setExporting(false);
  };

  const handleDeductionExport = async () => {
    const urlToUse = savedSheetUrl || googleSheetUrl;
    if (!urlToUse.trim()) {
      alert('Please enter and save a Google Sheet URL');
      return;
    }

    setExportingDeductions(true);
    try {
      const allDeductions = await base44.entities.BillingDeduction.list('-billing_received_date', 2000);
      const response = await base44.functions.invoke('exportToGoogleSheet', {
        sheetUrl: urlToUse,
        deductions: allDeductions,
        exportType: 'deductions'
      });
      if (response.data.success) {
        alert(`Successfully exported ${allDeductions.length} deductions to the DEDUCTION tab!`);
      } else {
        alert('Export failed: ' + response.data.message);
      }
    } catch (error) {
      alert('Error exporting: ' + error.message);
    }
    setExportingDeductions(false);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <PageHeader
          title="Additional Services"
          subtitle="Manage fuel subsidies and other additional services"
        />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="fuel-subsidies" className="gap-2">
              <Fuel className="w-4 h-4" />
              Fuel Subsidies
            </TabsTrigger>
            <TabsTrigger value="google-sheets" className="gap-2">
              <Sheet className="w-4 h-4" />
              Google Sheets Export
            </TabsTrigger>
          </TabsList>

          <TabsContent value="fuel-subsidies" className="mt-4">
            <div className="flex justify-end mb-3">
              <Dialog open={showForm} onOpenChange={setShowForm}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="w-4 h-4" />
                    Add Fuel Subsidy
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Fuel className="w-5 h-5" />
                      Add Fuel Subsidy
                    </DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="client">Client Account</Label>
                      <Select value={formData.client_account_id} onValueChange={handleClientChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select client" />
                        </SelectTrigger>
                        <SelectContent>
                          {clients.map(client => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.client_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="start_date">Start Date</Label>
                      <Input id="start_date" type="date" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} required />
                    </div>
                    <div>
                      <Label htmlFor="end_date">End Date</Label>
                      <Input id="end_date" type="date" value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} required />
                    </div>
                    <div>
                      <Label htmlFor="subsidy_percentage">Fuel Subsidy Percentage (%)</Label>
                      <Input id="subsidy_percentage" type="number" step="0.01" min="0" max="100" placeholder="e.g., 5" value={formData.subsidy_percentage} onChange={(e) => setFormData({ ...formData, subsidy_percentage: e.target.value })} required />
                    </div>
                    <div>
                      <Label htmlFor="notes">Notes (Optional)</Label>
                      <Input id="notes" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Additional notes" />
                    </div>
                    {formData.subsidy_percentage && formData.client_account_id && (
                      <div className="bg-muted p-3 rounded-lg">
                        <p className="text-sm text-muted-foreground">This will calculate {formData.subsidy_percentage}% of the total gross rate for all trips in the selected period.</p>
                      </div>
                    )}
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                      <Button type="submit" disabled={createSubsidyMutation.isPending}>
                        {createSubsidyMutation.isPending ? 'Calculating...' : 'Create Subsidy'}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            <div className="bg-card rounded-lg shadow-sm border">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium">Client</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Period</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Subsidy %</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Total Gross</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Subsidy Amount</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Created</th>
                      <th className="px-4 py-3 text-left text-sm font-medium"></th>
                      </tr>
                      </thead>
                      <tbody>
                      {subsidies.map((subsidy) => (
                      <tr key={subsidy.id} className="border-b hover:bg-muted/30">
                        <td className="px-4 py-3 text-sm">{subsidy.client_name}</td>
                        <td className="px-4 py-3 text-sm">
                          {format(new Date(subsidy.start_date), 'MMM d, yyyy')} - {format(new Date(subsidy.end_date), 'MMM d, yyyy')}
                        </td>
                        <td className="px-4 py-3 text-sm">{subsidy.subsidy_percentage}%</td>
                        <td className="px-4 py-3 text-sm">₱{subsidy.total_gross_rate?.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm font-medium">₱{subsidy.subsidy_amount?.toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            subsidy.status === 'Paid' ? 'bg-green-100 text-green-700' :
                            subsidy.status === 'Approved' ? 'bg-blue-100 text-blue-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {subsidy.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {format(new Date(subsidy.created_date), 'MMM d, yyyy')}
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              if (confirm('Delete this fuel subsidy entry?')) {
                                deleteSubsidyMutation.mutate(subsidy.id);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                        </tr>
                        ))}
                    {subsidies.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                          No fuel subsidies yet. Click "Add Fuel Subsidy" to create one.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="google-sheets" className="mt-4">
            <div className="bg-card rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold mb-4">Export to Google Sheets</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Save your Google Sheet URL to export fuel subsidy data. The data will be downloaded as a CSV file that you can import into Google Sheets.
              </p>
              
              <div className="space-y-4 max-w-lg">
                <div>
                  <Label htmlFor="sheetUrl">Google Sheet URL</Label>
                  <Input
                    id="sheetUrl"
                    type="url"
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    value={googleSheetUrl}
                    onChange={(e) => setGoogleSheetUrl(e.target.value)}
                  />
                  {savedSheetUrl && (
                    <p className="text-xs text-green-600 mt-1">✓ URL saved and will persist</p>
                  )}
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    onClick={handleSaveUrl}
                    variant="default"
                    disabled={!googleSheetUrl.trim()}
                    className="gap-2"
                  >
                    Save URL
                  </Button>
                  
                  <Button 
                    onClick={handleTestConnection} 
                    variant="outline"
                    disabled={testingConnection || !(savedSheetUrl || googleSheetUrl)}
                    className="gap-2"
                  >
                    {testingConnection ? 'Testing...' : 'Test Connection'}
                  </Button>
                </div>
                
                {connectionStatus && (
                  <div className={`p-3 rounded-lg border ${
                    connectionStatus.success 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-red-50 border-red-200'
                  }`}>
                    <p className={`text-sm font-medium ${
                      connectionStatus.success ? 'text-green-800' : 'text-red-800'
                    }`}>
                      {connectionStatus.success ? '✓' : '✗'} {connectionStatus.message}
                    </p>
                  </div>
                )}
                
                <div className="pt-4 border-t space-y-2">
                  <Button 
                    onClick={handleGoogleSheetExport} 
                    disabled={exporting || !(savedSheetUrl || googleSheetUrl)}
                    className="gap-2 w-full"
                  >
                    <Sheet className="w-4 h-4" />
                    {exporting ? 'Exporting...' : 'Export All Trips to Google Sheet (TRIP tab)'}
                  </Button>
                  <Button 
                    onClick={handleDeductionExport} 
                    disabled={exportingDeductions || !(savedSheetUrl || googleSheetUrl)}
                    variant="outline"
                    className="gap-2 w-full"
                  >
                    <Sheet className="w-4 h-4" />
                    {exportingDeductions ? 'Exporting...' : 'Export All Deductions to Google Sheet (DEDUCTION tab)'}
                  </Button>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium mb-2">Note:</p>
                <p className="text-sm text-muted-foreground">
                  Make sure your Google Sheet has tabs named exactly <strong>TRIP</strong> and <strong>DEDUCTION</strong> and the connected Google account has edit access.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}