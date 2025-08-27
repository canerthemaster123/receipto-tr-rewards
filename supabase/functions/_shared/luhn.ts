/**
 * Luhn algorithm for card number validation
 */

/**
 * Validate a card number using Luhn algorithm
 */
export function luhnValid(cardNumber: string): boolean {
  if (!cardNumber) return false;
  
  // Extract only digits
  const digits = cardNumber.replace(/\D/g, '');
  
  // Must be at least 12 digits for a valid card
  if (digits.length < 12) return false;
  
  let sum = 0;
  let alternate = false;
  
  // Process digits from right to left
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i], 10);
    
    if (alternate) {
      digit *= 2;
      if (digit > 9) {
        digit = Math.floor(digit / 10) + (digit % 10);
      }
    }
    
    sum += digit;
    alternate = !alternate;
  }
  
  return (sum % 10) === 0;
}

/**
 * Extract last 4 digits from a card number (for display)
 */
export function getCardLast4(cardNumber: string): string | null {
  if (!cardNumber) return null;
  
  const digits = cardNumber.replace(/\D/g, '');
  if (digits.length < 4) return null;
  
  return digits.slice(-4);
}

/**
 * Detect card scheme from card number
 */
export function detectCardScheme(cardNumber: string): string | null {
  if (!cardNumber) return null;
  
  const digits = cardNumber.replace(/\D/g, '');
  
  // Common Turkish card schemes
  if (digits.startsWith('4')) return 'Visa';
  if (digits.startsWith('5') || digits.startsWith('2')) return 'Mastercard';
  if (digits.startsWith('37') || digits.startsWith('34')) return 'American Express';
  if (digits.startsWith('6011') || digits.startsWith('65')) return 'Discover';
  
  return null;
}

/**
 * Create masked PAN display (e.g., "****-****-****-1234")
 */
export function maskCardNumber(cardNumber: string): string | null {
  if (!cardNumber) return null;
  
  const digits = cardNumber.replace(/\D/g, '');
  if (digits.length < 12) return null;
  
  const last4 = digits.slice(-4);
  const maskedLength = Math.max(0, digits.length - 4);
  const masked = '*'.repeat(maskedLength);
  
  // Format with dashes for readability
  if (digits.length === 16) {
    return `${masked.slice(0, 4)}-${masked.slice(4, 8)}-${masked.slice(8, 12)}-${last4}`;
  }
  
  return `${masked}-${last4}`;
}