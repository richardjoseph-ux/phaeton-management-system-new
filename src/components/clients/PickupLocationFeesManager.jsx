import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Save } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const TRUCK_TYPES = ['AUV', 'Sub-4W', '6-Wheel', '10-Wheel'];

export default function PickupLocationFeesManager({ clientAccount, onUpdate }) {
  const [pickupLocationFees, setPickupLocationFees] = useState([]);
  const [saving, setSaving] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);

  useEffect(() => {
    if (clientAccount?.pickup_location_fees) {
      setPickupLocationFees(JSON.parse(JSON.stringify(clientAccount.pickup_location_fees)));
    } else {
      setPickupLocationFees([]);
    }
  }, [clientAccount]);

  // Get unique pickup locations from routes
  const availablePickupLocations = clientAccount?.routes
    ? [...new Set(clientAccount.routes.map(r => r.pickup_location).filter(Boolean))]
    : [];

  const addPickupLocation = () => {
    setPickupLocationFees([
      ...pickupLocationFees,
      {
        pickup_location: '',
        truck_type_fees: [
          { truck_type: 'AUV', hidden_fee_percentage: 4 },
          { truck_type: 'Sub-4W', hidden_fee_percentage: 4 },
          { truck_type: '6-Wheel', hidden_fee_percentage: 4 },
          { truck_type: '10-Wheel', hidden_fee_percentage: 4 },
        ],
      },
    ]);
  };

  const removePickupLocation = (index) => {
    setPickupLocationFees(pickupLocationFees.filter((_, i) => i !== index));
  };

  const updatePickupLocation = (index, value) => {
    const updated = [...pickupLocationFees];
    updated[index].pickup_location = value;
    setPickupLocationFees(updated);
  };

  const updateTruckTypeFee = (pickupIndex, truckTypeIndex, percentage) => {
    const updated = [...pickupLocationFees];
    updated[pickupIndex].truck_type_fees[truckTypeIndex].hidden_fee_percentage = parseFloat(percentage) || 0;
    setPickupLocationFees(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Validate that all pickup locations are filled
      const hasEmptyLocation = pickupLocationFees.some(pf => !pf.pickup_location);
      if (hasEmptyLocation) {
        alert('Please select a pickup location for all entries');
        setSaving(false);
        return;
      }

      await base44.entities.ClientAccount.update(clientAccount.id, {
        ...clientAccount,
        pickup_location_fees: pickupLocationFees,
      });

      alert('Pickup location fees saved successfully!');
      if (onUpdate) {
        onUpdate({ ...clientAccount, pickup_location_fees: pickupLocationFees });
      }
    } catch (error) {
      alert('Error saving fees: ' + error.message);
    }
    setSaving(false);
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
          {pickupLocationFees.length === 0 ? (
            <p className="text-gray-500 py-4">No pickup location fees configured. Click "Add Pickup Location" to start.</p>
          ) : (
            pickupLocationFees.map((pf, pickupIndex) => (
              <div key={pickupIndex} className="border rounded-lg p-4 bg-gray-50">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex-1">
                    <Label className="text-sm font-semibold mb-2 block">Pickup Location</Label>
                    <Select value={pf.pickup_location} onValueChange={(value) => updatePickupLocation(pickupIndex, value)}>
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

          <Button onClick={handleSave} disabled={saving} className="w-full">
            <Save className="w-4 h-4 mr-2" /> {saving ? 'Saving...' : 'Save Fees'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
