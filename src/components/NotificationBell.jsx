import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Bell } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatDateDisplay } from '@/lib/dateUtils';
import { Link } from 'react-router-dom';

export default function NotificationBell() {
  const [alerts, setAlerts] = useState([]);
  const [open, setOpen] = useState(false);

  const loadAlerts = async () => {
    const data = await base44.entities.Alert.filter({ status: 'unread' }, '-created_date', 50);
    setAlerts(data);
  };

  useEffect(() => {
    loadAlerts();
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

  const unreadCount = alerts.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
      <PopoverContent className="w-80 p-0" align="end" side="right">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <p className="font-semibold text-sm">Notifications</p>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="text-xs text-primary hover:underline">
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {alerts.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
              No new notifications
            </div>
          ) : (
            alerts.map(alert => (
              <div key={alert.id} className="px-4 py-3 border-b last:border-0 hover:bg-muted/30">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-0.5">
                      {alert.quarter_label} Insurance Renewal
                    </p>
                    <p className="text-sm font-medium">{alert.plate_number} — {alert.owner_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Due: {formatDateDisplay(alert.due_date)}
                    </p>
                  </div>
                  <button
                    onClick={() => markRead(alert.id)}
                    className="text-[10px] text-muted-foreground hover:text-foreground shrink-0 mt-0.5 underline"
                  >
                    Dismiss
                  </button>
                </div>
                <Link
                  to="/deductions"
                  onClick={() => { markRead(alert.id); setOpen(false); }}
                  className="inline-block mt-2 text-xs text-primary hover:underline font-medium"
                >
                  → Go to Deductions
                </Link>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}