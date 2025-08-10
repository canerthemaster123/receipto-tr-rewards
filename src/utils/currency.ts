/**
 * Currency formatting utilities for Turkish Lira (TRY)
 * Prompt 5: Use Turkish Lira everywhere (no $)
 */

/**
 * Format a number as Turkish Lira currency
 * Uses Turkish locale formatting with ₺ symbol
 */
export function formatTRY(amount: number | string): string {
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numericAmount) || numericAmount === null || numericAmount === undefined) {
    return '₺0,00';
  }

  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(numericAmount);
}

/**
 * Format a number as Turkish Lira without decimal places
 * Useful for charts and large amounts
 */
export function formatTRYCompact(amount: number | string): string {
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numericAmount) || numericAmount === null || numericAmount === undefined) {
    return '₺0';
  }

  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(numericAmount);
}

/**
 * Parse a currency string back to number
 * Handles Turkish locale formatting
 */
export function parseTRY(currencyString: string): number {
  if (!currencyString || typeof currencyString !== 'string') {
    return 0;
  }

  // Remove currency symbol and spaces
  const cleanString = currencyString
    .replace(/₺/g, '')
    .replace(/\s/g, '')
    .replace(/\./g, '') // Remove thousands separators
    .replace(/,/g, '.'); // Convert decimal comma to dot

  const parsed = parseFloat(cleanString);
  return isNaN(parsed) ? 0 : parsed;
}