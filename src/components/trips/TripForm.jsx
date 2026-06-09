import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function TripForm({ open, onClose, onSaved, editData, isDuplicate = false, clients, subcontractors, billingCycles }) {
  const [form, setForm] = useState({
    plate_number: '', subcontractor_id: '', owner_name: '', truck_type: '',
    client_account_id: '', client_name: '', sub_account_id: '', sub_account_name: '',
    pickup_location: '',
    delivery_location: '', delivery_code: '', trip_route_code: '',
    first_cheque_date: '', delivery_date: '', billing_date: '',
    particular: '', dr_number: '', waybill_number: '',
    billing_cycle_id: '', billing_cycle_name: ''
  });
  const [saving, setSaving] = useState(false);
  const [pickupOpen, setPickupOpen] = useState(false);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [pickupSearch, setPickupSearch] = useState('');
  const [deliverySearch, setDeliverySearch] = useState('');
  const [codeSearch, setCodeSearch] = useState('');

  // Derived options
  const selectedClient = clients.find(c => c.id === form.client_account_id);
  const pickupOptions = [...new Set((selectedClient?.routes || []).map(r => r.pickup_location).filter(Boolean))];
  
  // Filter routes by client and pickup location safely matching space/casing anomalies
  const routesForPickup = (selectedClient?.routes || []).filter(r => 
    r.pickup_location?.trim().toUpperCase() === form.pickup_location?.trim().toUpperCase()
  );
  
  // Get unique delivery locations for current client + pickup
  const deliveryLocations = [...new Set(routesForPickup.map(r => r.delivery_location).filter(Boolean))];
  
  // Get delivery codes for selected delivery location safely
  const codesForDelivery = routesForPickup
    .filter(r => r.delivery_location?.trim().toUpperCase() === form.delivery_location?.trim().toUpperCase())
    .map(r => ({ code: r.delivery_code, trip_route_code: r.trip_route_code || '' }));

  // Get unique plate numbers
  const uniquePlates = [...new Set(subcontractors.map(s => s.plate_number))];
  
  // Get truck types available for the selected plate
  const availableTruckTypes = [...new Set(
    subcontractors
      .filter(s => s.plate_number?.toUpperCase() === form.plate_number.toUpperCase())
      .map(s => s.truck_type)
      .filter(Boolean)
  )];

  // Helper targeting your schema layout explicitly: matchedRoute -> rates -> [truck_type]
  const getDirectRouteRate = (matchedRoute, truckType) => {
    if (!matchedRoute || !matchedRoute.rates || !truckType) return 0;
    
    const targetRates = matchedRoute.rates;
    
    // Direct lookup matching exact key string variations (e.g., 'Sub-4W')
    if (targetRates[truckType] !== undefined && targetRates[truckType] !== null) {
      return Number(targetRates[truckType]);
    }

    // Secondary deep string cleaning sweep to clear hyphen/case mismatches 
    const cleanedType = truckType.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    for (const key of Object.keys(targetRates)) {
      if (key.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === cleanedType) {
        return Number(targetRates[key]);
      }
    }

    return 0;
  };

  useEffect(() => {
    if (editData) {
      setForm({
        plate_number: editData.plate_number || '',
        subcontractor_id: editData.subcontractor_id || '',
        owner_name: editData.owner_name || '',
        truck_type: editData.truck_type || '',
        client_account_id: editData.client_account_id || '',
        client_name: editData.client_name || '',
        sub_account_id: editData.sub_account_id || '',
        sub_account_name: editData.sub_account_name || '',
        pickup_location: editData.pickup_location || '',
        delivery_location: editData.delivery_location || '',
        delivery_code: editData.delivery_code || '',
        trip_route_code: editData.trip_route_code || '',
        first_cheque_date: editData.first_cheque_date || '',
        delivery_date: editData.delivery_date || '',
        billing_date: editData.billing_date || '',
        particular: editData.particular || '',
        dr_number: editData.dr_number || '',
        waybill_number: editData.waybill_number || '',
        billing_cycle_id: editData.billing_cycle_id || '',
        billing_cycle_name: editData.billing_cycle_name || '',
      });
    } else {
      setForm({
        plate_number: '', subcontractor_id: '', owner_name: '', truck_type: '',
        client_account_id: '', client_name: '', sub_account_id: '', sub_account_name: '',
        pickup_location: '',
        delivery_location: '', delivery_code: '', trip_route_code: '',
        first_cheque_date: '', delivery_date: '', billing_date: '',
        particular: '', dr_number: '', waybill_number: '',
        billing_cycle_id: '', billing_cycle_name: ''
      });
    }
  }, [editData, open]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handlePlateChange = (value) => {
    const matchingSubs = subcontractors.filter(s => s.plate_number?.toUpperCase() === value.toUpperCase());
    
    if (matchingSubs.length === 0) {
      setForm(p => ({
        ...p,
        plate_number: value.toUpperCase(),
        subcontractor_id: '',
        owner_name: '',
        truck_type: '',
      }));
    } else if (matchingSubs.length === 1) {
      const sub = matchingSubs[0];
      setForm(p => ({
        ...p,
        plate_number: value.toUpperCase(),
        subcontractor_id: sub?.id || '',
        owner_name: sub?.owner_name || '',
        truck_type: sub?.truck_type || '',
      }));
    } else {
      setForm(p => ({
        ...p,
        plate_number: value.toUpperCase(),
        subcontractor_id: matchingSubs[0]?.id || '',
        owner_name: matchingSubs[0]?.owner_name || '',
        truck_type: '', 
      }));
    }
  };

  const handleClientChange = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    setForm(p => ({
      ...p,
      client_account_id: clientId,
      client_name: client?.client_name || '',
      sub_account_id: '',
      sub_account_name: '',
      pickup_location: '',
      delivery_location: '',
      delivery_code: '',
      trip_route_code: '',
    }));
    setClientSearch('');
  };

  const handlePickupChange = (pickup) => {
    setForm(p => ({
      ...p,
      pickup_location: pickup,
      delivery_location: '',
      delivery_code: '',
      trip_route_code: '',
    }));
    setPickupSearch('');
  };

  const handleDeliveryChange = (location) => {
    setForm(p => ({
      ...p,
      delivery_location: location,
      delivery_code: '',
      trip_route_code: '',
    }));
    setDeliverySearch('');
  };

  const handleCodeChange = (codeObj) => {
    setForm(p => ({
      ...p,
      delivery_code: codeObj.code,
      trip_route_code: codeObj.trip_route_code,
    }));
    setCodeSearch('');
  };

  const handleBillingCycleChange = (cycleId) => {
    const cycle = billingCycles.find(c => c.id === cycleId);
    setForm(p => ({
      ...p,
      billing_cycle_id: cycleId,
      billing_cycle_name: cycle?.cycle_name || '',
    }));
  };

  const handleSubAccountChange = (subAccountId, client) => {
    const subAccount = client.sub_accounts?.find(s => s.sub_account_id === subAccountId || s.sub_account_name === subAccountId);
    setForm(p => ({
      ...p,
      sub_account_id: subAccount?.sub_account_id || subAccountId,
      sub_account_name: subAccount?.sub_account_name || subAccountId,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    if (!editData || isDuplicate) {
      const existingTrips = await base44.entities.TripRecord.list();
      const duplicate = existingTrips.find(t => 
        t.plate_number?.toUpperCase() === form.plate_number?.toUpperCase() &&
        t.dr_number === form.dr_number &&
        t.delivery_date === form.delivery_date
      );
      if (duplicate) {
        alert('A trip with the same Plate Number, DR Number, and Delivery Date already exists. Please check your entry.');
        setSaving(false);
        return;
      }
    }

    // Context map to handle state asynchronous primitives
    const currentClientId = form.client_account_id || editData?.client_account_id;
    const currentPickup = form.pickup_location || editData?.pickup_location;
    const currentDelivery = form.delivery_location || editData?.delivery_location;
    const currentCode = form.delivery_code || editData?.delivery_code;
    const currentTruckType = form.truck_type || editData?.truck_type;

    const client = clients.find(c => c.id === currentClientId);
    
    // Alphanumeric deep matching validation sweep used on save
    const cleanSaveCode = currentCode?.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const cleanSavePickup = currentPickup?.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const cleanSaveDelivery = currentDelivery?.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

    const matchedRoute = (client?.routes || []).find(r =>
      r.pickup_location?.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === cleanSavePickup &&
      r.delivery_location?.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === cleanSaveDelivery &&
      r.delivery_code?.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === cleanSaveCode
    );
    
    const grossRate = getDirectRouteRate(matchedRoute, currentTruckType);
    
    const taxDeduction = grossRate * 0.02;
    const hiddenFee = grossRate * 0.04;
    const adminFee = grossRate * 0.06;
    const netPayroll = grossRate * 0.88;

    const data = { 
      ...form, 
      gross_rate: grossRate, 
      tax_deduction: taxDeduction, 
      hidden_fee: hiddenFee, 
      admin_fee: adminFee, 
      net_payroll: netPayroll 
    };

    if (editData && !isDuplicate) {
      await base44.entities.TripRecord.update(editData.id, data);
    } else {
      await base44.entities.TripRecord.create(data);
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  const filteredClients = clients.filter(c => 
    c.status === 'Active' && 
    c.client_name.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const filteredPickups = pickupOptions.filter(p => 
    p.toLowerCase().includes(pickupSearch.toLowerCase())
  );

  const filteredDeliveries = deliveryLocations.filter(loc => 
    loc.toLowerCase().includes(deliverySearch.toLowerCase())
  );

  const filteredCodes = codesForDelivery.filter(obj => 
    obj.code.toLowerCase().includes(codeSearch.toLowerCase())
  );

  const activeBillingCycles = billingCycles.filter(bc => !bc.is_archived);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isDuplicate ? 'Duplicate Trip (Modify Before Saving)' : editData ? 'Edit Trip Record' : 'Encode New Trip'}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-2">
          {/* Vehicle Info */}
          <div className="col-span-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Vehicle Information</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Plate Number *</Label>
                <Input
                  value={form.plate_number}
                  onChange={e => handlePlateChange(e.target.value)}
                  placeholder="ABC 1234"
                  list="plate-suggestions"
                />
                <datalist id="plate-suggestions">
                  {uniquePlates.map(plate => <option key={plate} value={plate} />)}
                </datalist>
              </div>
              <div className="space-y-1.5">
                <Label>Owner / Driver</Label>
                <Input value={form.owner_name} readOnly className="bg-muted" placeholder="Auto-filled" />
              </div>
              <div className="space-y-1.5">
                <Label>Truck Type *</Label>
                <Select value={form.truck_type} onValueChange={v => set('truck_type', v)} disabled={!form.plate_number || availableTruckTypes.length === 0}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {availableTruckTypes.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Route */}
          <div className="col-span-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Route Information</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Client Account *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between h-9">
                      {form.client_account_id ? clients.find(c => c.id === form.client_account_id)?.client_name : 'Select client...'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput 
                        placeholder="Search client..." 
                        value={clientSearch}
                        onValueChange={setClientSearch}
                        className="h-9"
                      />
                      <CommandList>
                        <CommandEmpty>No client found.</CommandEmpty>
                        <CommandGroup>
                          {filteredClients.map(c => (
                            <CommandItem
                              key={c.id}
                              value={c.client_name}
                              onSelect={() => handleClientChange(c.id)}
                            >
                              {c.client_name}
                              <Check className={cn("ml-auto h-4 w-4", form.client_account_id === c.id ? "opacity-100" : "opacity-0")} />
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="space-y-1.5">
                <Label>Pickup Location *</Label>
                <Popover open={pickupOpen} onOpenChange={setPickupOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={pickupOpen} className="w-full justify-between h-9" disabled={!form.client_account_id}>
                      {form.pickup_location || 'Select pickup...'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search pickup..." value={pickupSearch} onValueChange={setPickupSearch} className="h-9" />
                      <CommandList>
                        <CommandEmpty>No pickup found.</CommandEmpty>
                        <CommandGroup>
                          {filteredPickups.map(p => (
                            <CommandItem
                              key={p}
                              value={p}
                              onSelect={() => {
                                handlePickupChange(p);
                                setPickupOpen(false);
                              }}
                            >
                              {p}
                              <Check className={cn("ml-auto h-4 w-4", form.pickup_location === p ? "opacity-100" : "opacity-0")} />
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1.5">
                <Label>Delivery Location *</Label>
                <Popover open={deliveryOpen} onOpenChange={setDeliveryOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={deliveryOpen} className="w-full justify-between h-9" disabled={!form.pickup_location}>
                      {form.delivery_location || 'Select delivery...'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search delivery location..." value={deliverySearch} onValueChange={setDeliverySearch} className="h-9" />
                      <CommandList>
                        <CommandEmpty>No delivery location found.</CommandEmpty>
                        <CommandGroup>
                          {filteredDeliveries.map((loc) => (
                            <CommandItem
                              key={loc}
                              value={loc}
                              onSelect={() => {
                                handleDeliveryChange(loc);
                                setDeliveryOpen(false);
                              }}
                            >
                              {loc}
                              <Check className={cn("ml-auto h-4 w-4", form.delivery_location === loc ? "opacity-100" : "opacity-0")} />
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* FIX 1: Delivery Code Dropdown Tracking Update */}
              <div className="space-y-1.5">
                <Label>Delivery Code *</Label>
                <Popover open={codeOpen} onOpenChange={setCodeOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={codeOpen} className="w-full justify-between h-9" disabled={!form.delivery_location}>
                      {form.delivery_code || 'Select code...'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search delivery code..." value={codeSearch} onValueChange={setCodeSearch} className="h-9" />
                      <CommandList>
                        <CommandEmpty>No code found.</CommandEmpty>
                        <CommandGroup>
                          {filteredCodes.map((obj, idx) => {
                            const searchToken = `${obj.code}-${idx}`;
                            return (
                              <CommandItem
                                key={idx}
                                value={searchToken}
                                onSelect={() => {
                                  handleCodeChange(obj);
                                  setCodeOpen(false);
                                }}
                              >
                                {obj.code}
                                <Check className={cn("ml-auto h-4 w-4", form.delivery_code === obj.code ? "opacity-100" : "opacity-0")} />
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1.5">
                <Label>Trip Route Code</Label>
                <Input value={form.trip_route_code} onChange={e => set('trip_route_code', e.target.value)} placeholder="Auto-filled or manual" />
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="col-span-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Dates</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>First Cheque Date</Label>
                <Input type="date" value={form.first_cheque_date} onChange={e => set('first_cheque_date', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Delivery Date *</Label>
                <Input type="date" value={form.delivery_date} onChange={e => set('delivery_date', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Billing Date</Label>
                <Input type="date" value={form.billing_date} onChange={e => set('billing_date', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="col-span-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Trip Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Particular (Drop-off name)</Label>
                <Input value={form.particular} onChange={e => set('particular', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>DR Number</Label>
                <Input value={form.dr_number} onChange={e => set('dr_number', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Waybill Number</Label>
                <Input value={form.waybill_number} onChange={e => set('waybill_number', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Sub-Account (Optional)</Label>
                <Select 
                  value={form.sub_account_id} 
                  onValueChange={(val) => {
                    const client = clients.find(c => c.id === form.client_account_id);
                    handleSubAccountChange(val, client);
                  }}
                  disabled={!form.client_account_id}
                >
                  <SelectTrigger><SelectValue placeholder="Select sub-account" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>No sub-account</SelectItem>
                    {(clients.find(c => c.id === form.client_account_id)?.sub_accounts || []).map(sub => (
                      <SelectItem key={sub.sub_account_name} value={sub.sub_account_name}>
                        {sub.sub_account_name} {sub.sub_account_code && `(${sub.sub_account_code})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Billing Statement</Label>
                <Select value={form.billing_cycle_id} onValueChange={handleBillingCycleChange}>
                  <SelectTrigger><SelectValue placeholder="Select billing statement" /></SelectTrigger>
                  <SelectContent>
                    {activeBillingCycles.map(bc => (
                      <SelectItem key={bc.id} value={bc.id}>{bc.cycle_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* FIX 2: Rate Preview UI Panel String-Cleaning Match Implementation */}
          {form.truck_type && form.client_account_id && form.pickup_location && form.delivery_location && form.delivery_code && (() => {
            const client = clients.find(c => c.id === form.client_account_id);
            
            const cleanFormCode = form.delivery_code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            const cleanFormPickup = form.pickup_location.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            const cleanFormDelivery = form.delivery_location.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

            const matchedRoute = (client?.routes || []).find(r =>
              r.pickup_location?.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === cleanFormPickup &&
              r.delivery_location?.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === cleanFormDelivery &&
              r.delivery_code?.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === cleanFormCode
            );
            
            const gross = getDirectRouteRate(matchedRoute, form.truck_type);
            if (!gross) return null;
            
            return (
              <div className="col-span-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs font-semibold text-blue-800 mb-2">Rate Breakdown</p>
                <div className="grid grid-cols-4 gap-2 text-xs text-blue-700">
                  <div><span className="text-blue-500">Gross Rate</span><br />₱{gross.toFixed(2)}</div>
                  <div><span className="text-blue-500">Tax (2%)</span><br />-₱{(gross * 0.02).toFixed(2)}</div>
                  <div><span className="text-blue-500">Hidden Fee (4%)</span><br />-₱{(gross * 0.04).toFixed(2)}</div>
                  <div><span className="text-blue-800 font-semibold">Net Payroll (88%)</span><br /><span className="font-bold">₱{(gross * 0.88).toFixed(2)}</span></div>
                </div>
              </div>
            );
          })()}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.plate_number || !form.client_account_id || !form.delivery_location || !form.delivery_code || !form.delivery_date}>
            {saving ? 'Saving...' : isDuplicate ? 'Save as New Trip' : editData ? 'Update Trip' : 'Save Trip'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}