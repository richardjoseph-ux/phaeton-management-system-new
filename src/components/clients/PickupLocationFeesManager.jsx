import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
  const savedFees = Array.isArray(pickupLocationFees) ? pickupLocationFees : [];
  const savedMap = useMemo(
    () => new Map(savedFees.map(f => [String(f.pickup_location || '').toLowerCase(), f])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(savedFees)]
  );

  // Build the display list: one block per pickup location (1:1 with availablePickupLocations).
  // Always deep-clone so edits never mutate shared references across pickups.
  const displayFees = availablePickupLocations.map(loc => {
    const saved = savedMap.get(String(loc).toLowerCase());
    if (saved) {
      return {
        pickup_location: saved.pickup_location || loc,
        truck_type_fees: TRUCK_TYPES.map(t => {
          const match = saved.truck_type_fees?.find(x => x.truck_type === t);
          return {
            truck_type: t,
            hidden_fee_percentage: match ? Number(match.hidden_fee_percentage) : DEFAULT_TRUCK_FEE,
          };
        }),
      };
    }
    return defaultFeeEntry(loc);
  });

  const [selectedKey, setSelectedKey] = useState(displayFees[0]?.pickup_location || '');

  const selected = displayFees.find(
    pf => String(pf.pickup_location).toLowerCase() === String(selectedKey).toLowerCase()
  ) || displayFees[0];

  // If the previously selected pickup no longer exists (removed), fall back to the first.
  const effectiveKey = selected ? selected.pickup_location : (displayFees[0]?.pickup_location || '');

  const updateFee = (pickupLocation, truckType, percentage) => {
    const targetKey = String(pickupLocation).toLowerCase();
    const next = displayFees.map(pf => {
      if (String(pf.pickup_location).toLowerCase() !== targetKey) {
        return pf;
      }
      return {
        ...pf,
        truck_type_fees: pf.truck_type_fees.map(ttf =>
          ttf.truck_type === truckType
            ? { ...ttf, hidden_fee_percentage: Number(percentage) || 0 }
            : ttf
        ),
      };
    });
    onChange(next);
  };

  return (
    <Card className="mt-6">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Truck Type Hidden Fee Configuration</CardTitle>
        <p className="text-sm text-gray-600 mt-2">
          Each pickup location has its own hidden fee percentage per truck type. Select a pickup location to view and edit its fees.
        </p>
      </CardHeader>
      <CardContent>
        {displayFees.length === 0 ? (
          <p className="text-gray-500 py-4">
            No pickup locations available. Add a route with a pickup location first.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Pickup Location</Label>
              <Select value={effectiveKey} onValueChange={setSelectedKey}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a pickup location" />
                </SelectTrigger>
                <SelectContent>
                  {displayFees.map(pf => (
                    <SelectItem key={`opt__${pf.pickup_location}`} value={pf.pickup_location}>
                      {pf.pickup_location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selected && (
              <div
                key={`fee_block__${selected.pickup_location}`}
                className="border rounded-lg p-4 bg-gray-50"
              >
                <Label className="text-sm font-semibold mb-4 block">
                  Hidden Fees: <span className="text-primary">{selected.pickup_location}</span>
                </Label>

                <div className="grid grid-cols-2 gap-4">
                  {selected.truck_type_fees.map((ttf) => (
                    <div key={`fee__${selected.pickup_location}__${ttf.truck_type}`}>
                      <Label className="text-sm">{ttf.truck_type}</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={ttf.hidden_fee_percentage}
                          onChange={(e) => updateFee(selected.pickup_location, ttf.truck_type, e.target.value)}
                          className="flex-1"
                          placeholder="0"
                        />
                        <span className="text-sm text-gray-600">%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}