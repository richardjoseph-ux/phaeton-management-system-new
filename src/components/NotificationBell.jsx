import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Bell, Link2, X, Check, ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatDateDisplay } from '@/lib/dateUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function NotificationBell() {
  const [alerts, setAlerts] = useState([]);
  const [open, setOpen] = useState(false);
  const [billingDates, setBillingDates] = useState([]);
  const [linkingAlert, setLinkingAlert] = useState(null); // alert being linked
  const [linkForm, setLinkForm] = useState({ billing_received_date: '', insurance_charge: '' });
  const [saving, setSaving] = useState(false);
  const [savedAlertId, setSavedAlertId] = useState(null);

  const loadAlerts = async () => {
    const data = await base44.entities.Alert.filter({ status: 'unread' }, '-created_date', 50);
    setAlerts(data);
  };

  const loadBillingDates = async () => {
    const cycles = await base44.entities.BillingCycle.list('-billing_received_date', 200);
    const seen = new Set();
    const dates = [];
    cycles.forEach(c => {
      if (c.billing_received_date && !seen.has(c.billing_received_date)) {
        seen.add(c.billing_received_date);
        dates.push(c.billing_received_date);
      }
    });
    setBillingDates(dates.sort((a, b) => b.localeCompare(a)));
  };

  useEffect(() => {
    loadAlerts();
    loadBillingDates();
    const unsubscribe = base44.entities.Alert.subscribe(() => loadAlerts());
    return unsubscribe;
  }, []);

  const markRead = async (alertId) => {
    await base44.entities.Alert.update(alertId, { status: 'read' });
    setAlerts(prev => prev.filter(a => a.id !== alertId));
  };

  const markAllRead = async () => {
    await Promise.all(alerts.map(a => base44.entities.Alert.update(a.id, { status: 'read' })));
    setAlerts([]);
  };

  const startLinking = (alert) => {
    setLinkingAlert(alert);
    setLinkForm({ billing_received_date: '', insurance_charge: '' });
    setSavedAlertId(null);
  };

  const cancelLinking = () => {
    setLinkingAlert(null);
    setLinkForm({ billing_received_date: '', insurance_charge: '' });
  };

  const handleLink = async () => {
    if (!linkForm.billing_received_date || !linkingAlert) return;
    setSaving(true);

    // Check if a BillingDeduction already exists for this plate + date
    const existing = await base44.entities.BillingDeduction.filter({
      billing_received_date: linkForm.billing_received_date,
      plate_number: linkingAlert.plate_number,
    });

    const deductionData = {
      billing_received_date: linkForm.billing_received_date,
      plate_number: linkingAlert.plate_number,
      owner_name: linkingAlert.owner_name,
      insurance_charge: parseFloat(linkForm.insurance_charge) || 0,
      other_charges: existing[0]?.other_charges || 0,
      notes: `${linkingAlert.quarter_label} insurance renewal — linked from alert`,
    };

    if (existing.length > 0) {
      // Merge: update just the insurance_charge field
      await base44.entities.BillingDeduction.update(existing[0].id, {
        insurance_charge: deductionData.insurance_charge,
        notes: deductionData.notes,
        owner_name: deductionData.owner_name,
      });
    } else {
      await base44.entities.BillingDeduction.create(deductionData);
    }

    // Mark the alert as read
    await base44.entities.Alert.update(linkingAlert.id, { status: 'read' });
    setAlerts(prev => prev.filter(a => a.id !== linkingAlert.id));
    setSavedAlertId(linkingAlert.id);
    setLinkingAlert(null);
    setLinkForm({ billing_received_date: '', insurance_charge: '' });
    setSaving(false);
  };

  const unreadCount = alerts.length;

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) cancelLinking(); }}>
      <PopoverTrigger asChild>
        <button className="relative p-2 rounded-lg hover:bg-sidebar-accent transition-colors text-sidebar-foreground">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-84 p-0" align="end" side="right">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <p className="font-semibold text-sm">Notifications</p>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="text-xs text-primary hover:underline">
              Mark all read
            </button>
          )}
        </div>

        <div className="max-h-[28rem] overflow-y-auto">
          {alerts.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
              No new notifications
            </div>
          ) : (
            alerts.map(alert => (
              <div key={alert.id} className="border-b last:border-0">
                {/* Alert row */}
                <div className="px-4 py-3 hover:bg-muted/20">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wide mb-0.5">
                        {alert.quarter_label} Insurance Renewal
                      </p>
                      <p className="text-sm font-semibold truncate">{alert.plate_number} — {alert.owner_name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Due: {formatDateDisplay(alert.due_date)}
                      </p>
                    </div>
                    <button
                      onClick={() => markRead(alert.id)}
                      className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5 p-0.5 rounded"
                      title="Dismiss"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Link to Billing Cycle button */}
                  {linkingAlert?.id !== alert.id && (
                    <button
                      onClick={() => startLinking(alert)}
                      className="mt-2 flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      Link to Billing Cycle
                    </button>
                  )}
                </div>

                {/* Inline link form */}
                {linkingAlert?.id === alert.id && (
                  <div className="px-4 pb-4 bg-primary/5 border-t space-y-3">
                    <p className="text-xs font-semibold text-foreground pt-3">Link to a Billing Deduction</p>

                    <div className="space-y-1">
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Billing Received Date</p>
                      <Select
                        value={linkForm.billing_received_date}
                        onValueChange={v => setLinkForm(f => ({ ...f, billing_received_date: v }))}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Select date..." />
                        </SelectTrigger>
                        <SelectContent>
                          {billingDates.map(d => (
                            <SelectItem key={d} value={d} className="text-xs">{formatDateDisplay(d)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Insurance Charge (₱)</p>
                      <Input
                        type="number"
                        placeholder="0.00"
                        className="h-8 text-xs"
                        value={linkForm.insurance_charge}
                        onChange={e => setLinkForm(f => ({ ...f, insurance_charge: e.target.value }))}
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 h-7 text-xs"
                        disabled={saving || !linkForm.billing_received_date}
                        onClick={handleLink}
                      >
                        <Check className="w-3.5 h-3.5 mr-1" />
                        {saving ? 'Saving...' : 'Create Deduction'}
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={cancelLinking}>
                        Cancel
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      This will create (or update) a BillingDeduction record for <strong>{alert.plate_number}</strong> on the selected date.
                    </p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}