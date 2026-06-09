import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Layout from '@/components/Layout';
import Login from '@/pages/Login';

// Page imports
import TripEncoding from '@/pages/TripEncoding';
import Subcontractors from '@/pages/Subcontractors';
import ClientAccounts from '@/pages/ClientAccounts';
import BillingCycles from '@/pages/BillingCycles';
import Payroll from '@/pages/Payroll';
import Reports from '@/pages/Reports';
import UserManagement from '@/pages/UserManagement';
import AdditionalServices from '@/pages/AdditionalServices';
import Deductions from '@/pages/Deductions';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, isAuthenticated } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  // Redirect unauthenticated users to login (unless already on login page)
  if (!isLoadingAuth && !isAuthenticated && window.location.pathname !== '/login') {
    navigateToLogin();
    return null;
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Layout />}>
        <Route path="/" element={<TripEncoding />} />
        <Route path="/subcontractors" element={<Subcontractors />} />
        <Route path="/clients" element={<ClientAccounts />} />
        <Route path="/billing" element={<BillingCycles />} />
        <Route path="/payroll" element={<Payroll />} />
        <Route path="/additional-services" element={<AdditionalServices />} />
        <Route path="/deductions" element={<Deductions />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/users" element={<UserManagement />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App