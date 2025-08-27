/**
 * Numeric utilities for Turkish OCR parsing
 */

/**
 * Fix common OCR character errors in numeric contexts only
 */
export function fixOcrDigits(str: string): string {
  if (!str) return str;
  
  // Only apply fixes in contexts that look numeric (contains digits, comma/period, currency symbols)
  const numericPattern = /[\d₺TL,.\s\-*]/;
  if (!numericPattern.test(str)) return str;
  
  return str
    .replace(/O/gi, '0')  // O -> 0
    .replace(/[Il]/g, '1') // I, l -> 1
    .replace(/S/g, '5')    // S -> 5 (only uppercase to avoid 's' in words)
    .replace(/B/g, '8');   // B -> 8 (only uppercase to avoid 'b' in words)
}

/**
 * Normalize Turkish currency strings to numbers
 */
export function normalizeNumber(str: string): number | null {
  if (!str || typeof str !== 'string') return null;
  
  // Apply OCR fixes first
  let normalized = fixOcrDigits(str.trim());
  
  // Remove currency symbols and extra spaces
  normalized = normalized
    .replace(/₺/g, '')
    .replace(/\bTL\b/gi, '')
    .replace(/\s+/g, '');
  
  // Handle Turkish decimal notation (comma as decimal separator)
  // Look for pattern: digits,digits at end (decimal)
  const commaDecimalMatch = normalized.match(/^(\d{1,4}),(\d{2})$/);
  if (commaDecimalMatch) {
    return parseFloat(`${commaDecimalMatch[1]}.${commaDecimalMatch[2]}`);
  }
  
  // Handle thousands separator: digits.digits,digits
  const thousandsMatch = normalized.match(/^(\d{1,3})\.(\d{3}),(\d{2})$/);
  if (thousandsMatch) {
    return parseFloat(`${thousandsMatch[1]}${thousandsMatch[2]}.${thousandsMatch[3]}`);
  }
  
  // Convert comma to period and parse
  normalized = normalized.replace(',', '.');
  
  const num = parseFloat(normalized);
  return isNaN(num) ? null : num;
}

/**
 * Check if a string looks like a money amount
 */
export function isMoney(str: string): boolean {
  if (!str) return false;
  
  const normalized = fixOcrDigits(str.trim());
  
  // Turkish money patterns
  const patterns = [
    /₺\s*\d{1,4}[.,]\d{2}/,           // ₺23,50
    /\d{1,4}[.,]\d{2}\s*₺/,          // 23,50₺
    /\d{1,4}[.,]\d{2}\s*TL/i,        // 23,50 TL
    /\bTL\b\s*\d{1,4}[.,]\d{2}/i,    // TL 23,50
    /^\d{1,4}[.,]\d{2}$/             // 23,50 (standalone)
  ];
  
  return patterns.some(pattern => pattern.test(normalized));
}

/**
 * Extract all money-like values from a string
 */
export function extractMoneyValues(str: string): number[] {
  if (!str) return [];
  
  const normalized = fixOcrDigits(str);
  const values: number[] = [];
  
  // Find all money patterns and extract values
  const patterns = [
    /₺\s*(\d{1,4}[.,]\d{2})/g,
    /(\d{1,4}[.,]\d{2})\s*₺/g,
    /(\d{1,4}[.,]\d{2})\s*TL/gi,
    /TL\s*(\d{1,4}[.,]\d{2})/gi
  ];
  
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(normalized)) !== null) {
      const value = normalizeNumber(match[1]);
      if (value !== null) {
        values.push(value);
      }
    }
  });
  
  return values;
}

/**
 * Parse quantity and unit from Turkish text
 */
export function parseQuantityUnit(str: string): { qty?: number; unit?: string } {
  if (!str) return {};
  
  const normalized = fixOcrDigits(str.trim());
  
  // Pattern: number + optional unit
  const qtyUnitPattern = /(\d+(?:[.,]\d+)?)\s*(adet|kg|gr|g|lt|l|ml|cl|pk|paket|kutu)?/i;
  const match = normalized.match(qtyUnitPattern);
  
  if (!match) return {};
  
  const qty = normalizeNumber(match[1]);
  const unit = match[2] ? match[2].toLowerCase() : undefined;
  
  return { qty: qty || undefined, unit };
}