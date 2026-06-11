import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  Truck, Users, Building2, FileText, BarChart3, Menu, X,
  ChevronRight, LogOut, CreditCard, ClipboardList, Fuel, MinusCircle
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

const navItems = [
  { path: '/', label: 'Trip Encoding', icon: ClipboardList, roles: ['admin', 'user'] },
  { path: '/subcontractors', label: 'Subcontractors', icon: Truck, roles: ['admin', 'user'] },
  { path: '/clients', label: 'Client Accounts', icon: Building2, roles: ['admin', 'user'] },
  { path: '/billing', label: 'Billing Cycles', icon: CreditCard, roles: ['admin', 'user'] },
  { path: '/payroll', label: 'Payroll', icon: FileText, roles: ['admin', 'user'] },
  { path: '/deductions', label: 'Deductions & Reimbursements', icon: MinusCircle, roles: ['admin', 'user'] },
  { path: '/additional-services', label: 'Additional Services', icon: Fuel, roles: ['admin'] },
  { path: '/reports', label: 'Reports', icon: BarChart3, roles: ['admin', 'user'] },
  { path: '/users', label: 'User Management', icon: Users, roles: ['admin'] },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { user: currentUser } = useAuth();

  const role = currentUser?.role || 'user';
  const visibleNav = navItems.filter(item => item.roles.includes(role));

  const handleLogout = () => base44.auth.logout('/login');

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-30 w-64 flex flex-col
        bg-[hsl(var(--sidebar-background))] text-[hsl(var(--sidebar-foreground))]
        transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
      `}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-[hsl(var(--sidebar-border))]">
          <div className="w-9 h-9 bg-white/15 rounded-lg flex items-center justify-center">
            <Truck className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">Phaeton Trucking Services</p>
            <p className="text-white/50 text-xs">Management System</p>
          </div>
          <button className="ml-auto lg:hidden text-white/60" onClick={() => setSidebarOpen(false)}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {visibleNav.map(({ path, label, icon: Icon }) => {
            const active = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                  transition-colors duration-150
                  ${active
                    ? 'bg-white/20 text-white'
                    : 'text-white/65 hover:bg-white/10 hover:text-white'
                  }
                `}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{label}</span>
                {active && <ChevronRight className="w-3 h-3 ml-auto" />}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="px-3 py-4 border-t border-[hsl(var(--sidebar-border))]">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-white text-xs font-semibold">
              {currentUser?.full_name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium truncate">{currentUser?.full_name || 'User'}</p>
              <p className="text-white/50 text-xs capitalize">{role}</p>
            </div>
            <button onClick={handleLogout} className="text-white/50 hover:text-white transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar (mobile) */}
        <header className="lg:hidden flex items-center gap-3 px-4 h-14 border-b bg-card">
          <button onClick={() => setSidebarOpen(true)} className="text-muted-foreground">
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-semibold text-sm">PT Tracking Payroll</span>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}