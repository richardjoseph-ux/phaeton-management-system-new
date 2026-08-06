import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2 } from 'lucide-react';

const TRUCK_TYPES = ['AUV', 'Sub-4W', '6-Wheel', '10-Wheel'];
const DEFAULT_TRUCK_FEE = 4;

const defaultFeeEntry = (pickupLocation) => ({
  pickup_location: pickupLocation,
  truck_type_fees: TRUCK_TYPES.map(t => ({
    truck_type: t,
    hidden_fee_percentage: DEFAULT_TRUCK_FEE,
  })),
});

export default function PickupLocationFeesManager({ pickupLocationFees, availablePickupLocations, onChange }) {
  const fees = Array.isArray(pickupLocationFees) ? pickupLocationFees : [];

  // Auto-create a fee block for every pickup location defined in the client's routes,
  // while preserving any previously customized values for matching pickups.
  // Removes blocks for pickups that no longer exist in routes.
  useEffect(() => {
    const existing = new Map(
      fees.map(f => [f.pickup_location?.toLowerCase(), f])
    );
    const synced = availablePickupLocations.map(loc =>
      existing.get(loc.toLowerCase()) || defaultFeeEntry(loc)
    );

    const changed =
      synced.length !== fees.length ||
      synced.some((f, i) => f.pickup_location !== fees[i]?.pickup_location);

    if (changed) {
      onChange(synced);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availablePickupLocations.join('||')]);

  const removePickupLocation = (index) => {
    onChange(fees.filter((_, i) => i !== index));
  };

  const updateTruckTypeFee = (pickupIndex, truckType, percentage) => {
    onChange(
      fees.map((pf, i) => {
        if (i !== pickupIndex) return pf;
        return {
          ...pf,
          truck_type_fees: pf.truck_type_fees.map(ttf =>
            ttf.truck_type === truckType
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
          Each pickup location has its own hidden fee percentage per truck type. Changes to one pickup location do not affect the others.
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {fees.length === 0 ? (
            <p className="text-gray-500 py-4">
              No pickup locations available. Add a route with a pickup location first.
            </p>
          ) : (
            fees.map((pf, pickupIndex) => (
              <div key={pf.pickup_location || pickupIndex} className="border rounded-lg p-4 bg-gray-50">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex-1">
                    <Label className="text-sm font-semibold mb-2 block">
                      Pickup Location: <span className="text-primary">{pf.pickup_location || '—'}</span>
                    </Label>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removePickupLocation(pickupIndex)}
                    className="ml-2"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {pf.truck_type_fees.map((ttf) => (
                    <div key={ttf.truck_type}>
                      <Label className="text-sm">{ttf.truck_type}</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={ttf.hidden_fee_percentage}
                          onChange={(e) => updateTruckTypeFee(pickupIndex, ttf.truck_type, e.target.value)}
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
        </div>
      </CardContent>
    </Card>
  );
}