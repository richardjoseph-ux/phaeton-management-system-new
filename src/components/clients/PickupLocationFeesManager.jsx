import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
  // Reuse any saved values for matching pickups; supply defaults for pickups with no record yet.
  // We never call onChange on our own — only when the user actually edits a value — so the
  // displayed blocks correspond 1:1 to pickup locations and edits always land on the right one.
  const savedFees = Array.isArray(pickupLocationFees) ? pickupLocationFees : [];
  const savedMap = new Map(
    savedFees.map(f => [f.pickup_location?.toLowerCase(), f])
  );
  const displayFees = availablePickupLocations.map(loc => {
    const saved = savedMap.get(loc.toLowerCase());
    return saved ? { ...saved } : defaultFeeEntry(loc);
  });

  const updateTruckTypeFee = (pickupIndex, truckType, percentage) => {
    const next = displayFees.map((pf, i) => {
      if (i !== pickupIndex) return pf;
      return {
        ...pf,
        truck_type_fees: pf.truck_type_fees.map(ttf =>
          ttf.truck_type === truckType
            ? { ...ttf, hidden_fee_percentage: parseFloat(percentage) || 0 }
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
          Each pickup location has its own hidden fee percentage per truck type. Changing fees for one pickup location does not affect the others.
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {displayFees.length === 0 ? (
            <p className="text-gray-500 py-4">
              No pickup locations available. Add a route with a pickup location first.
            </p>
          ) : (
            displayFees.map((pf, pickupIndex) => (
              <div key={pf.pickup_location || pickupIndex} className="border rounded-lg p-4 bg-gray-50">
                <Label className="text-sm font-semibold mb-4 block">
                  Pickup Location: <span className="text-primary">{pf.pickup_location || '—'}</span>
                </Label>

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