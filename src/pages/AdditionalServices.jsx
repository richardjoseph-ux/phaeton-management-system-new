import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Fuel } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { format } from 'date-fns';

export default function AdditionalServices() {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    client_account_id: '',
    client_name: '',
    start_date: '',
    end_date: '',
    subsidy_percentage: '',
    notes: ''
  });

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

        <div className="bg-card rounded-lg shadow-sm border mt-6">
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
      </div>
    </div>
  );
}