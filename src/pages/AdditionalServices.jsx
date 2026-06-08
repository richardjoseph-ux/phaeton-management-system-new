import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Fuel, Sheet } from 'lucide-react';
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
  const [exporting, setExporting] = useState(false);

  const queryClient = useQueryClient();

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

  const handleGoogleSheetExport = async () => {
    if (!googleSheetUrl.trim()) {
      alert('Please enter a Google Sheet URL');
      return;
    }
    
    setExporting(true);
    try {
      // Extract sheet ID from URL
      const match = googleSheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (!match) {
        alert('Invalid Google Sheet URL');
        setExporting(false);
        return;
      }
      
      const sheetId = match[1];
      
      // Fetch all fuel subsidies
      const allSubsidies = await base44.entities.FuelSubsidy.list();
      
      // Prepare data for Google Sheets
      const values = [
        ['Client Name', 'Start Date', 'End Date', 'Subsidy %', 'Total Gross Rate', 'Subsidy Amount', 'Status', 'Notes'],
        ...allSubsidies.map(s => [
          s.client_name,
          s.start_date,
          s.end_date,
          s.subsidy_percentage,
          s.total_gross_rate,
          s.subsidy_amount,
          s.status,
          s.notes || ''
        ])
      ];
      
      // Note: This requires Google Sheets API integration
      // For now, we'll create a CSV download as fallback
      const csvContent = values.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Fuel_Subsidies_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
      
      alert('Data exported as CSV. For direct Google Sheets integration, please connect Google Sheets connector.');
    } catch (error) {
      alert('Error exporting: ' + error.message);
    }
    setExporting(false);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <PageHeader
          title="Additional Services"
          subtitle="Manage fuel subsidies and other additional services"
          actions={
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
                    <Input
                      id="start_date"
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="end_date">End Date</Label>
                    <Input
                      id="end_date"
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="subsidy_percentage">Fuel Subsidy Percentage (%)</Label>
                    <Input
                      id="subsidy_percentage"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      placeholder="e.g., 5"
                      value={formData.subsidy_percentage}
                      onChange={(e) => setFormData({ ...formData, subsidy_percentage: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="notes">Notes (Optional)</Label>
                    <Input
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Additional notes"
                    />
                  </div>

                  {formData.subsidy_percentage && formData.client_account_id && (
                    <div className="bg-muted p-3 rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        This will calculate {formData.subsidy_percentage}% of the total gross rate for all trips in the selected period.
                      </p>
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createSubsidyMutation.isPending}>
                      {createSubsidyMutation.isPending ? 'Calculating...' : 'Create Subsidy'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          }
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
                      </tr>
                    ))}
                    {subsidies.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
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
                Enter your Google Sheet URL to export fuel subsidy data. The data will be downloaded as a CSV file that you can import into Google Sheets.
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
                </div>
                
                <Button 
                  onClick={handleGoogleSheetExport} 
                  disabled={exporting || !googleSheetUrl.trim()}
                  className="gap-2"
                >
                  <Sheet className="w-4 h-4" />
                  {exporting ? 'Exporting...' : 'Export Data'}
                </Button>
              </div>
              
              <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium mb-2">Note:</p>
                <p className="text-sm text-muted-foreground">
                  For direct Google Sheets integration (automatic sync), please connect the Google Sheets connector in your account settings. 
                  Currently, this exports data as a CSV file that you can manually import into your Google Sheet.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}