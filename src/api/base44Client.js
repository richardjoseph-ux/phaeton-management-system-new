import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl,
  // Define your schema entities here so the SDK recognizes them
  entities: {
    TripRecord: {},
    BillingDeduction: {},
    Reimbursement: {},
    OtherCharge: {}, // Add this line
    // ... include any other entities you use
  }
});