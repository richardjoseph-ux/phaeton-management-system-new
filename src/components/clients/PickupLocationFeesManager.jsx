import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2 } from 'lucide-react';

const DEFAULT_TRUCK_FEE = 4;

export default function PickupLocationFeesManager({ pickupLocationFees, availablePickupLocations, onChange }) {
  const fees = Array.isArray(pickupLocationFees) ? pickupLocationFees : [];

  const addPickupLocation = () => {
    onChange([
      ...fees,
      {
        pickup_location: '',
        truck_type_fees: [
          { truck_type: 'AUV', hidden_fee_percentage: DEFAULT_TRUCK_FEE },
          { truck_type: 'Sub-4W', hidden_fee_percentage: DEFAULT_TRUCK_FEE },
          { truck_type: '6-Wheel', hidden_fee_percentage: DEFAULT_TRUCK_FEE },
          { truck_type: '10-Wheel', hidden_fee_percentage: DEFAULT_TRUCK_FEE },
        ],
      },
    ]);
  };

  const removePickupLocation = (index) => {
    onChange(fees.filter((_, i) => i !== index));
  };

  const updatePickupLocation = (index, value) => {
    onChange(fees.map((pf, i) => (i === index ? { ...pf, pickup_location: value } : pf)));
  };

  const updateTruckTypeFee = (pickupIndex, truckTypeIndex, percentage) => {
    onChange(
      fees.map((pf, i) => {
        if (i !== pickupIndex) return pf;
        return {
          ...pf,
          truck_type_fees: pf.truck_type_fees.map((ttf, j) =>
            j === truckTypeIndex
              ? { ...ttf, hidden_fee_percentage: parseFloat(percentage) || 0 }
              : ttf
          ),
        };
      })
    );
  };

  return (
    <Card className="mt-6">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Truck Type Hidden Fee Configuration</CardTitle>
        <p className="text-sm text-gray-600 mt-2">
          Set the hidden fee percentage for each truck type at each pickup location
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {fees.length === 0 ? (
            <p className="text-gray-500 py-4">No pickup location fees configured. Click "Add Pickup Location" to start.</p>
          ) : (
            fees.map((pf, pickupIndex) => (
              <div key={pickupIndex} className="border rounded-lg p-4 bg-gray-50">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex-1">
                    <Label className="text-sm font-semibold mb-2 block">Pickup Location</Label>
                    <Select
                      value={pf.pickup_location}
                      onValueChange={(value) => updatePickupLocation(pickupIndex, value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select pickup location" />
                      </SelectTrigger>
                      <SelectContent>
                        {availablePickupLocations.map((loc) => (
                          <SelectItem key={loc} value={loc}>
                            {loc}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removePickupLocation(pickupIndex)}
                    className="ml-2 mt-6"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {pf.truck_type_fees.map((ttf, ttIndex) => (
                    <div key={ttf.truck_type}>
                      <Label className="text-sm">{ttf.truck_type}</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={ttf.hidden_fee_percentage}
                          onChange={(e) => updateTruckTypeFee(pickupIndex, ttIndex, e.target.value)}
                          className="flex-1"
                          placeholder="0"
                        />
                        <span className="text-sm text-gray-600">%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}

          <Button onClick={addPickupLocation} variant="outline" className="w-full">
            <Plus className="w-4 h-4 mr-2" /> Add Pickup Location
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}