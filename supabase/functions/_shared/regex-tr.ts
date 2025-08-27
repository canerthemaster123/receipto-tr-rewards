/**
 * Turkish retail receipt regex patterns
 */

// Date patterns (DD.MM.YYYY, DD/MM/YYYY, DD-MM-YYYY)
export const DATE_PATTERN = /(?:(\d{1,2})[.\/\-](\d{1,2})[.\/\-](\d{4}))/gi;

// Time patterns (HH:MM, H:MM)
export const TIME_PATTERN = /\b([01]?\d|2[0-3]):([0-5]\d)\b/g;

// Money patterns (various Turkish currency formats)
export const MONEY_PATTERN = /(?:₺|\bTL\b)?\s*(\d{1,4}[.,]\d{2})(?:\s*(?:₺|\bTL\b))?/gi;

// VAT patterns (KDV %18: 5,40 or KDV 18 = 5,40)
export const VAT_PATTERN = /KDV\s*%?(\d{1,2})\s*[:=]?\s*(\d+[.,]\d{2})/gi;

// Receipt/Serial number patterns
export const RECEIPT_PATTERN = /(?:Fiş|FIS|Seri.*?Sıra|Seri\s*No|Belge\s*No|Z\s*No)\s*[:#]?\s*([A-Z0-9\-\/]{6,})/gi;

// Fiscal number patterns (Mali Müşavir No, etc.)
export const FISCAL_PATTERN = /(?:Mali\s*Müşavir|Vergi\s*No|VKN)\s*[:#]?\s*(\d{10,11})/gi;

// Card PAN patterns (masked or partial)
export const PAN_PATTERN = /\b(?:\d[\s\-\*]*){10,19}\b/g;

// Total amount patterns (case insensitive)
export const TOTAL_PATTERNS = [
  /(?:GENEL\s*)?TOPLAM\s*[:=]?\s*(\d+[.,]\d{2})/gi,
  /TOTAL\s*[:=]?\s*(\d+[.,]\d{2})/gi,
  /(?:NET\s*)?TUTAR\s*[:=]?\s*(\d+[.,]\d{2})/gi
];

// Subtotal patterns
export const SUBTOTAL_PATTERNS = [
  /(?:ARA\s*)?TOPLAM\s*[:=]?\s*(\d+[.,]\d{2})/gi,
  /SUBTOTAL\s*[:=]?\s*(\d+[.,]\d{2})/gi
];

// Discount patterns
export const DISCOUNT_PATTERNS = [
  /(?:İNDİRİM|DISCOUNT)\s*[:=]?\s*(\d+[.,]\d{2})/gi,
  /(?:İSKONTO|REBATE)\s*[:=]?\s*(\d+[.,]\d{2})/gi
];

// Common Turkish units
export const UNIT_PATTERN = /\b(adet|kg|gr|g|lt|l|ml|cl|pk|paket|kutu|şişe|poşet)\b/gi;

// Quantity patterns (number + optional unit)
export const QTY_PATTERN = /(\d+(?:[.,]\d+)?)\s*(adet|kg|gr|g|lt|l|ml|cl|pk|paket|kutu)?/gi;

// Store/merchant patterns
export const MERCHANT_PATTERNS = [
  /(?:MAĞAZA|STORE|MARKET)\s*[:=]?\s*(.+?)(?:\n|$)/gi,
  /(?:UNVAN|TITLE)\s*[:=]?\s*(.+?)(?:\n|$)/gi
];

// Address patterns
export const ADDRESS_PATTERNS = [
  /(?:ADRES|ADDRESS)\s*[:=]?\s*(.+?)(?:\n|VKN|TEL|$)/gi,
  /(?:MAH|MAHALLE)\s*[.:]\s*(.+?)(?:\s+(?:CAD|CADDE|SOK|SOKAK))/gi,
  /(?:CAD|CADDE|SOK|SOKAK)\s*[.:]\s*(.+?)(?:\s+(?:NO|:))/gi
];

// Payment method patterns
export const PAYMENT_PATTERNS = [
  /(?:KART|CARD)\s*[:=]?\s*(.+?)(?:\n|$)/gi,
  /(?:NAKİT|CASH)\s*[:=]?\s*(\d+[.,]\d{2})/gi,
  /(?:KREDİ\s*KARTI|CREDIT\s*CARD)/gi
];

/**
 * Extract dates from text
 */
export function extractDates(text: string): Array<{ day: number; month: number; year: number }> {
  const dates: Array<{ day: number; month: number; year: number }> = [];
  let match;
  
  DATE_PATTERN.lastIndex = 0;
  while ((match = DATE_PATTERN.exec(text)) !== null) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);
    
    // Basic validation
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2020 && year <= 2030) {
      dates.push({ day, month, year });
    }
  }
  
  return dates;
}

/**
 * Extract times from text
 */
export function extractTimes(text: string): Array<{ hour: number; minute: number }> {
  const times: Array<{ hour: number; minute: number }> = [];
  let match;
  
  TIME_PATTERN.lastIndex = 0;
  while ((match = TIME_PATTERN.exec(text)) !== null) {
    const hour = parseInt(match[1], 10);
    const minute = parseInt(match[2], 10);
    times.push({ hour, minute });
  }
  
  return times;
}

/**
 * Extract receipt numbers from text
 */
export function extractReceiptNumbers(text: string): string[] {
  const numbers: string[] = [];
  let match;
  
  RECEIPT_PATTERN.lastIndex = 0;
  while ((match = RECEIPT_PATTERN.exec(text)) !== null) {
    if (match[1] && match[1].length >= 6) {
      numbers.push(match[1].trim());
    }
  }
  
  return numbers;
}

/**
 * Extract VAT information from text
 */
export function extractVAT(text: string): Array<{ rate: number; amount: number }> {
  const vatInfo: Array<{ rate: number; amount: number }> = [];
  let match;
  
  VAT_PATTERN.lastIndex = 0;
  while ((match = VAT_PATTERN.exec(text)) !== null) {
    const rate = parseInt(match[1], 10);
    const amountStr = match[2].replace(',', '.');
    const amount = parseFloat(amountStr);
    
    if (!isNaN(rate) && !isNaN(amount)) {
      vatInfo.push({ rate, amount });
    }
  }
  
  return vatInfo;
}