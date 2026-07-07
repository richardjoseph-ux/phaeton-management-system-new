import { createContext, useContext } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const QUERY_CONFIG = { staleTime: Infinity, gcTime: Infinity };

const AppDataContext = createContext(null);

export function AppDataProvider({ children }) {
  const queryClient = useQueryClient();

  const billingCycles = useQuery({
    queryKey: ['billingCycles'],
    queryFn: () => base44.entities.BillingCycle.list('-created_date', 100),
    ...QUERY_CONFIG,
  });

  const clients = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.ClientAccount.list('client_name', 50),
    ...QUERY_CONFIG,
  });

  const subcontractors = useQuery({
    queryKey: ['subcontractors'],
    queryFn: () => base44.entities.Subcontractor.list('-created_date', 100),
    ...QUERY_CONFIG,
  });

  const billingDeductions = useQuery({
    queryKey: ['billingDeductions'],
    queryFn: () => base44.entities.BillingDeduction.list('-billing_received_date', 200),
    ...QUERY_CONFIG,
  });

  const reimbursements = useQuery({
    queryKey: ['reimbursements'],
    queryFn: () => base44.entities.Reimbursement.list('-billing_received_date', 200),
    ...QUERY_CONFIG,
  });

  const billingReceivedSummaries = useQuery({
    queryKey: ['billingReceivedSummaries'],
    queryFn: () => base44.entities.BillingReceivedSummary.list('-billing_received_date', 100),
    ...QUERY_CONFIG,
  });

  const fuelSubsidies = useQuery({
    queryKey: ['fuelSubsidies'],
    queryFn: () => base44.entities.FuelSubsidy.list('-created_date', 50),
    ...QUERY_CONFIG,
  });

  const otherCharges = useQuery({
    queryKey: ['otherCharges'],
    queryFn: () => base44.entities.OtherCharges.list('-billing_received_date', 200),
    ...QUERY_CONFIG,
  });

  const invalidate = (collection) => {
    queryClient.invalidateQueries({ queryKey: [collection] });
  };

  // Helper to update a single item in a cached collection (optimistic update)
  const updateCacheItem = (collection, id, updatedFields) => {
    queryClient.setQueryData([collection], (old) =>
      old ? old.map(item => item.id === id ? { ...item, ...updatedFields } : item) : old
    );
  };

  // Helper to add a new item to a cached collection
  const addCacheItem = (collection, newItem, prepend = true) => {
    queryClient.setQueryData([collection], (old) =>
      old ? (prepend ? [newItem, ...old] : [...old, newItem]) : [newItem]
    );
  };

  // Helper to remove an item from a cached collection
  const removeCacheItem = (collection, id) => {
    queryClient.setQueryData([collection], (old) =>
      old ? old.filter(item => item.id !== id) : old
    );
  };

  const value = {
    billingCycles: billingCycles.data ?? [],
    clients: clients.data ?? [],
    subcontractors: subcontractors.data ?? [],
    billingDeductions: billingDeductions.data ?? [],
    reimbursements: reimbursements.data ?? [],
    billingReceivedSummaries: billingReceivedSummaries.data ?? [],
    fuelSubsidies: fuelSubsidies.data ?? [],
    otherCharges: otherCharges.data ?? [],
    isLoading: {
      billingCycles: billingCycles.isLoading,
      clients: clients.isLoading,
      subcontractors: subcontractors.isLoading,
      billingDeductions: billingDeductions.isLoading,
      reimbursements: reimbursements.isLoading,
      billingReceivedSummaries: billingReceivedSummaries.isLoading,
      fuelSubsidies: fuelSubsidies.isLoading,
      otherCharges: otherCharges.isLoading,
    },
    invalidate,
    updateCacheItem,
    addCacheItem,
    removeCacheItem,
  };

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider');
  return ctx;
}