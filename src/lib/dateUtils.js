/**
 * Format a date string (YYYY-MM-DD) to display format like "March 02, 2026"
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @returns {string} Formatted date string
 */
export const formatDateDisplay = (dateString) => {
  if (!dateString) return '—';
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '—';
  
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const month = months[date.getMonth()];
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  
  return `${month} ${day}, ${year}`;
};

/**
 * Format a date to short display format like "Mar 02, 2026"
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @returns {string} Formatted date string
 */
/**
 * Format a number as Philippine Peso amount with commas and 2 decimal places.
 * e.g. 1234567.8 → "1,234,567.80"
 * @param {number} value
 * @returns {string}
 */
export const formatAmount = (value) => {
  return (value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const formatDateShort = (dateString) => {
  if (!dateString) return '—';
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '—';
  
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  
  const month = months[date.getMonth()];
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  
  return `${month} ${day}, ${year}`;
};