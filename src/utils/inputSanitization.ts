// Input sanitization utilities
export const sanitizeText = (input: string): string => {
  if (!input || typeof input !== 'string') return '';
  
  return input
    .trim()
    .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove script tags
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .substring(0, 1000); // Limit length
};

export const sanitizeNumber = (input: string | number): number => {
  const num = typeof input === 'string' ? parseFloat(input) : input;
  return isNaN(num) ? 0 : Math.max(0, num);
};

export const sanitizeStoreName = (storeName: string): string => {
  return sanitizeText(storeName).substring(0, 100);
};

export const sanitizeItems = (items: string): string => {
  return sanitizeText(items).substring(0, 500);
};

export const sanitizePaymentMethod = (paymentMethod: string): string => {
  // Allow digits, asterisks, spaces, and dashes for payment method
  return sanitizeText(paymentMethod)
    .replace(/[^0-9*\s-]/g, '') // Only allow digits, asterisks, spaces, and dashes
    .substring(0, 50);
};

export const validateReceiptData = (data: any): {
  isValid: boolean;
  errors: string[];
  sanitizedData: any;
} => {
  const errors: string[] = [];
  
  const sanitizedData = {
    storeName: sanitizeStoreName(data.storeName || ''),
    totalAmount: sanitizeNumber(data.totalAmount || 0),
    paymentMethod: sanitizePaymentMethod(data.paymentMethod || ''),
    items: sanitizeItems(data.items || ''),
    date: data.date || new Date().toISOString().split('T')[0],
    purchaseTime: sanitizeText(data.purchaseTime || '').substring(0, 10), // Limit time string
    storeAddress: sanitizeText(data.storeAddress || '').substring(0, 200) // Limit address length
  };

  if (!sanitizedData.storeName) {
    errors.push('Store name is required');
  }

  if (sanitizedData.totalAmount <= 0) {
    errors.push('Total amount must be greater than 0');
  }

  if (sanitizedData.totalAmount > 10000) {
    errors.push('Total amount seems unusually high');
  }

  if (!sanitizedData.paymentMethod) {
    errors.push('Payment method is required');
  }

  if (!sanitizedData.items.trim()) {
    errors.push('Items list is required');
  }

  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(sanitizedData.date)) {
    errors.push('Invalid date format');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData
  };
};