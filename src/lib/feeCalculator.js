/**
 * Fee Calculator Utility
 * Handles lookup of truck type-specific hidden fees per pickup location
 * and calculation of all fee amounts
 */

/**
 * Get the hidden fee percentage for a specific truck type at a pickup location
 * @param {Object} clientData - The ClientAccount data object
 * @param {string} pickupLocation - The pickup location code
 * @param {string} truckType - The truck type (AUV, Sub-4W, 6-Wheel, 10-Wheel)
 * @returns {number} The hidden fee percentage (e.g., 3, 4, 4.5) or 4 (default)
 */
export const getTruckTypeFeePercentage = (clientData, pickupLocation, truckType) => {
  if (!clientData || !pickupLocation || !truckType) {
    return 4; // Default 4% if any parameter is missing
  }

  // Find the pickup location fee configuration
  const pickupFeeConfig = clientData?.pickup_location_fees?.find(
    pf => pf.pickup_location?.toLowerCase() === pickupLocation?.toLowerCase()
  );

  if (!pickupFeeConfig) {
    return 4; // Default 4% if pickup location not found
  }

  // Find the truck type fee within that pickup location
  const truckTypeFee = pickupFeeConfig.truck_type_fees?.find(
    tf => tf.truck_type === truckType
  );

  if (!truckTypeFee) {
    return 4; // Default 4% if truck type not found
  }

  return truckTypeFee.hidden_fee_percentage || 4;
};

/**
 * Calculate hidden fee amount based on gross rate and fee percentage
 * @param {number} grossRate - The gross rate/amount
 * @param {number} feePercentage - The fee percentage (e.g., 3, 4, 4.5)
 * @returns {number} The calculated hidden fee amount
 */
export const calculateHiddenFee = (grossRate, feePercentage) => {
  if (!grossRate || !feePercentage) {
    return 0;
  }
  return grossRate * (feePercentage / 100);
};

/**
 * Calculate all fee deductions for a trip
 * @param {number} grossRate - The gross rate/amount
 * @param {number} hiddenFeePercentage - Hidden fee percentage (e.g., 4)
 * @param {number} taxPercentage - Tax percentage (default 2)
 * @param {number} adminFeePercentage - Admin fee percentage (default 6)
 * @returns {Object} Object with calculated fee amounts
 */
export const calculateFees = (
  grossRate,
  hiddenFeePercentage = 4,
  taxPercentage = 2,
  adminFeePercentage = 6
) => {
  // Tax is calculated on gross rate
  const tax = grossRate * (taxPercentage / 100);
  
  // After-tax amount = Gross - Tax
  const afterTax = grossRate - tax;
  
  // Hidden fee and admin fee are calculated on after-tax amount
  const hiddenFee = afterTax * (hiddenFeePercentage / 100);
  const adminFee = afterTax * (adminFeePercentage / 100);

  return {
    tax,
    hiddenFee,
    adminFee,
    netPayroll: grossRate - tax - hiddenFee - adminFee,
  };
};

/**
 * Calculate net payroll after all deductions and additions
 * @param {number} grossRate - The gross rate/amount
 * @param {Object} fees - Object containing { tax, hiddenFee, adminFee }
 * @param {number} insuranceCharge - Insurance charge (flat amount)
 * @param {number} otherCharges - Other miscellaneous charges (flat amount)
 * @param {number} fuelSubsidy - Fuel subsidy (amount to add)
 * @returns {number} Final net payroll
 */
export const calculateNetPayroll = (
  grossRate,
  fees,
  insuranceCharge = 0,
  otherCharges = 0,
  fuelSubsidy = 0
) => {
  const baseNet = grossRate - fees.tax - fees.hiddenFee - fees.adminFee;
  return baseNet - insuranceCharge - otherCharges + fuelSubsidy;
};

/**
 * Comprehensive fee calculation for a trip
 * Combines all calculations into a single call
 * @param {Object} params - Parameters object
 * @param {number} params.grossRate - The gross rate
 * @param {Object} params.clientData - The ClientAccount data
 * @param {string} params.pickupLocation - The pickup location code
 * @param {string} params.truckType - The truck type
 * @param {number} params.insuranceCharge - Insurance charge (optional)
 * @param {number} params.otherCharges - Other charges (optional)
 * @param {number} params.fuelSubsidy - Fuel subsidy (optional)
 * @returns {Object} Complete fee breakdown
 */
export const calculateTripFees = ({
  grossRate,
  clientData,
  pickupLocation,
  truckType,
  insuranceCharge = 0,
  otherCharges = 0,
  fuelSubsidy = 0,
}) => {
  // Get the hidden fee percentage for this client/pickup/truck combination
  const hiddenFeePercentage = getTruckTypeFeePercentage(
    clientData,
    pickupLocation,
    truckType
  );

  // Calculate all fees
  const fees = calculateFees(grossRate, hiddenFeePercentage, 2, 6);

  // Calculate final net payroll
  const netPayroll = calculateNetPayroll(
    grossRate,
    fees,
    insuranceCharge,
    otherCharges,
    fuelSubsidy
  );

  return {
    gross_rate: grossRate,
    tax_deduction: fees.tax,
    hidden_fee: fees.hiddenFee,
    hidden_fee_percentage: hiddenFeePercentage,
    admin_fee: fees.adminFee,
    insurance_charge: insuranceCharge,
    other_charges: otherCharges,
    fuel_subsidy: fuelSubsidy,
    net_payroll: netPayroll,
  };
};
