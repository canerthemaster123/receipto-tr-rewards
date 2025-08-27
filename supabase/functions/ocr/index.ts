import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

// ============= UTILITIES (INLINE) =============

/**
 * Fix common OCR character errors in numeric contexts only
 */
function fixOcrDigits(str: string): string {
  if (!str) return str;
  
  // Only apply fixes in contexts that look numeric
  const numericPattern = /[\d₺TL,.\s\-*]/;
  if (!numericPattern.test(str)) return str;
  
  return str
    .replace(/O/gi, '0')  // O -> 0
    .replace(/[Il]/g, '1') // I, l -> 1
    .replace(/S/g, '5')    // S -> 5 (only uppercase)
    .replace(/B/g, '8');   // B -> 8 (only uppercase)
}

/**
 * Normalize Turkish currency strings to numbers
 */
function normalizeNumber(str: string): number | null {
  if (!str || typeof str !== 'string') return null;
  
  let normalized = fixOcrDigits(str.trim());
  
  // Remove currency symbols and extra spaces
  normalized = normalized
    .replace(/₺/g, '')
    .replace(/\bTL\b/gi, '')
    .replace(/\s+/g, '');
  
  // Handle Turkish decimal notation (comma as decimal separator)
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
function isMoney(str: string): boolean {
  if (!str) return false;
  
  const normalized = fixOcrDigits(str.trim());
  const patterns = [
    /₺\s*\d{1,4}[.,]\d{2}/,
    /\d{1,4}[.,]\d{2}\s*₺/,
    /\d{1,4}[.,]\d{2}\s*TL/i,
    /\bTL\b\s*\d{1,4}[.,]\d{2}/i,
    /^\d{1,4}[.,]\d{2}$/
  ];
  
  return patterns.some(pattern => pattern.test(normalized));
}

/**
 * Extract all money-like values from a string
 */
function extractMoneyValues(str: string): number[] {
  if (!str) return [];
  
  const normalized = fixOcrDigits(str);
  const values: number[] = [];
  
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
function parseQuantityUnit(str: string): { qty?: number; unit?: string } {
  if (!str) return {};
  
  const normalized = fixOcrDigits(str.trim());
  const qtyUnitPattern = /(\d+(?:[.,]\d+)?)\s*(adet|kg|gr|g|lt|l|ml|cl|pk|paket|kutu)?/i;
  const match = normalized.match(qtyUnitPattern);
  
  if (!match) return {};
  
  const qty = normalizeNumber(match[1]);
  const unit = match[2] ? match[2].toLowerCase() : undefined;
  
  return { qty: qty || undefined, unit };
}

// ============= REGEX PATTERNS =============

const DATE_PATTERN = /(?:(\d{1,2})[.\/\-](\d{1,2})[.\/\-](\d{4}))/gi;
const TIME_PATTERN = /\b([01]?\d|2[0-3]):([0-5]\d)\b/g;
const VAT_PATTERN = /KDV\s*%?(\d{1,2})\s*[:=]?\s*(\d+[.,]\d{2})/gi;
const RECEIPT_PATTERN = /(?:Fiş|FIS|Seri.*?Sıra|Seri\s*No|Belge\s*No|Z\s*No)\s*[:#]?\s*([A-Z0-9\-\/]{6,})/gi;
const PAN_PATTERN = /\b(?:\d[\s\-\*]*){10,19}\b/g;

const TOTAL_PATTERNS = [
  /(?:GENEL\s*)?TOPLAM\s*[:=]?\s*(\d+[.,]\d{2})/gi,
  /TOTAL\s*[:=]?\s*(\d+[.,]\d{2})/gi,
  /(?:NET\s*)?TUTAR\s*[:=]?\s*(\d+[.,]\d{2})/gi
];

const SUBTOTAL_PATTERNS = [
  /(?:ARA\s*)?TOPLAM\s*[:=]?\s*(\d+[.,]\d{2})/gi,
  /SUBTOTAL\s*[:=]?\s*(\d+[.,]\d{2})/gi
];

const DISCOUNT_PATTERNS = [
  /(?:İNDİRİM|DISCOUNT)\s*[:=]?\s*(\d+[.,]\d{2})/gi,
  /(?:İSKONTO|REBATE)\s*[:=]?\s*(\d+[.,]\d{2})/gi
];

/**
 * Extract dates from text
 */
function extractDates(text: string): Array<{ day: number; month: number; year: number }> {
  const dates: Array<{ day: number; month: number; year: number }> = [];
  let match;
  
  DATE_PATTERN.lastIndex = 0;
  while ((match = DATE_PATTERN.exec(text)) !== null) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);
    
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2020 && year <= 2030) {
      dates.push({ day, month, year });
    }
  }
  
  return dates;
}

/**
 * Extract times from text
 */
function extractTimes(text: string): Array<{ hour: number; minute: number }> {
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
function extractReceiptNumbers(text: string): string[] {
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
function extractVAT(text: string): Array<{ rate: number; amount: number }> {
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

// ============= LUHN VALIDATION =============

/**
 * Validate a card number using Luhn algorithm
 */
function luhnValid(cardNumber: string): boolean {
  if (!cardNumber) return false;
  
  const digits = cardNumber.replace(/\D/g, '');
  if (digits.length < 12) return false;
  
  let sum = 0;
  let alternate = false;
  
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
 * Detect card scheme from card number
 */
function detectCardScheme(cardNumber: string): string | null {
  if (!cardNumber) return null;
  
  const digits = cardNumber.replace(/\D/g, '');
  
  if (digits.startsWith('4')) return 'Visa';
  if (digits.startsWith('5') || digits.startsWith('2')) return 'Mastercard';
  if (digits.startsWith('37') || digits.startsWith('34')) return 'American Express';
  if (digits.startsWith('6011') || digits.startsWith('65')) return 'Discover';
  
  return null;
}

/**
 * Create masked PAN display
 */
function maskCardNumber(cardNumber: string): string | null {
  if (!cardNumber) return null;
  
  const digits = cardNumber.replace(/\D/g, '');
  if (digits.length < 12) return null;
  
  const last4 = digits.slice(-4);
  const maskedLength = Math.max(0, digits.length - 4);
  const masked = '*'.repeat(maskedLength);
  
  if (digits.length === 16) {
    return `${masked.slice(0, 4)}-${masked.slice(4, 8)}-${masked.slice(8, 12)}-${last4}`;
  }
  
  return `${masked}-${last4}`;
}

// ============= MERCHANT NORMALIZATION =============

/**
 * Normalize merchant name to chain group
 */
function normalizeMerchantToChain(merchantRaw: string): string {
  if (!merchantRaw || typeof merchantRaw !== 'string') {
    return 'Unknown';
  }
  
  const normalized = merchantRaw.toLowerCase().trim();
  
  const chains = [
    { patterns: ['migros', 'mıgros'], name: 'Migros' },
    { patterns: ['a101', 'a-101', 'a 101'], name: 'A101' },
    { patterns: ['bim', 'bİm', 'b.i.m'], name: 'BIM' },
    { patterns: ['sok', 'şok', 's.o.k'], name: 'SOK' },
    { patterns: ['carrefour', 'carrefoursa'], name: 'CarrefourSA' },
    { patterns: ['metro'], name: 'Metro' },
    { patterns: ['real'], name: 'Real' },
    { patterns: ['macro', 'macrocenter'], name: 'Macrocenter' }
  ];
  
  for (const chain of chains) {
    for (const pattern of chain.patterns) {
      if (normalized.includes(pattern)) {
        return chain.name;
      }
    }
  }
  
  return merchantRaw.trim();
}

/**
 * Extract merchant brand from raw text
 */
function extractMerchantBrand(text: string): string | null {
  if (!text) return null;
  
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i];
    
    if (/^\d+/.test(line) || /(?:CAD|SOK|MAH|NO)/i.test(line)) continue;
    
    const normalized = normalizeMerchantToChain(line);
    if (normalized !== 'Unknown' && normalized !== line) {
      return normalized;
    }
    
    if (line.length > 3 && /[A-Za-zÇĞİÖŞÜçğıöşü]/.test(line)) {
      return line;
    }
  }
  
  return null;
}

/**
 * Clean merchant name for display
 */
function cleanMerchantName(merchantName: string): string {
  if (!merchantName) return '';
  
  return merchantName
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\sÇĞİÖŞÜçğıöşü\-\.]/g, '')
    .replace(/\b(LTD|ŞTI|A\.Ş|AŞ|SAN|TIC)\b\.?/gi, '')
    .trim();
}

// ============= STORE MATCHING =============

/**
 * Parse Turkish address components from raw text
 */
function parseAddressComponents(addressRaw: string): { city?: string; district?: string; neighborhood?: string; street?: string } {
  if (!addressRaw) return {};
  
  const normalized = addressRaw.toLowerCase().trim();
  const components: any = {};
  
  const cities = [
    'istanbul', 'ankara', 'izmir', 'bursa', 'antalya', 'adana', 'konya', 'gaziantep'
  ];
  
  for (const city of cities) {
    if (normalized.includes(city)) {
      components.city = city.charAt(0).toUpperCase() + city.slice(1);
      break;
    }
  }
  
  const mahMatch = normalized.match(/([a-zçğıöşü\s]+)(?:\s+mah\.?|\s+mahalle)/i);
  if (mahMatch) {
    components.neighborhood = mahMatch[1].trim();
  }
  
  return components;
}

/**
 * Upsert store with location components
 */
async function upsertStore(
  supabase: any,
  chainGroup: string,
  addressRaw?: string
): Promise<string | null> {
  try {
    const components = addressRaw ? parseAddressComponents(addressRaw) : {};
    
    const { data, error } = await supabase.rpc('upsert_store_dim', {
      p_chain_group: chainGroup,
      p_city: components.city || null,
      p_district: components.district || null,
      p_neighborhood: components.neighborhood || null,
      p_address: addressRaw || null,
      p_lat: null,
      p_lng: null,
      p_h3_8: null
    });
    
    if (error) {
      console.error('Store upsert error:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Store upsert error:', error);
    return null;
  }
}

// Supabase client setup
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// CORS configuration
const getAllowedOrigins = () => {
  const allowedOriginsEnv = Deno.env.get('ALLOWED_ORIGINS');
  if (allowedOriginsEnv) {
    return allowedOriginsEnv.split(',').map(origin => origin.trim());
  }
  return [
    'https://receipto-tr-rewards.lovable.app',
    'https://loving-warmth-production.lovable.app', 
    'https://id-preview--90fb07b9-7b58-43af-8664-049e890948e4.lovable.app',
    'http://localhost:5173',
    'http://localhost:3000'
  ];
};

function getCorsHeaders(_req: Request) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin'
  };
}

// Types
interface OcrTextAnnotation {
  description: string;
  boundingPoly?: {
    vertices: Array<{ x?: number; y?: number }>;
  };
}

interface OcrDoc {
  textAnnotations: OcrTextAnnotation[];
  fullTextAnnotation?: {
    text: string;
  };
}

interface LineCluster {
  y_center: number;
  y_min: number;
  y_max: number;
  spans: Array<{
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
}

interface ParsedHeader {
  merchant_raw?: string;
  merchant_brand?: string;
  chain_group?: string;
  address_raw?: string;
  city?: string;
  district?: string;
  neighborhood?: string;
  receipt_unique_no?: string;
  fis_no?: string;
  purchase_date?: string;
  purchase_time?: string;
  payment_method?: string;
  masked_pan?: string;
  card_scheme?: string;
}

interface ParsedItem {
  line_no: number;
  bbox: { x: number; y: number; w: number; h: number };
  item_name_raw: string;
  item_name_norm: string;
  qty?: number;
  unit?: string;
  unit_price?: number;
  line_total?: number;
  vat_rate?: number;
  vat_amount?: number;
  ean13?: string;
}

interface ParsedTotals {
  subtotal?: number;
  discount_total?: number;
  vat_total?: number;
  total?: number;
}

interface ValidationResult {
  parse_confidence: number;
  warnings: string[];
  items_sum_valid: boolean;
  vat_valid: boolean;
  luhn_valid: boolean;
  duplicate_receipt: boolean;
}

// Generate request ID for logging
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Parse header information from OCR document
 */
function parseHeader(ocr: OcrDoc, requestId: string): ParsedHeader {
  console.log(`[${requestId}] Parsing header information`);
  
  const fullText = ocr.fullTextAnnotation?.text || '';
  const lines = fullText.split('\n').map(line => line.trim()).filter(Boolean);
  
  const header: ParsedHeader = {};
  
  // Extract merchant information from first few lines
  const merchantBrand = extractMerchantBrand(fullText);
  if (merchantBrand) {
    header.merchant_raw = merchantBrand;
    header.merchant_brand = cleanMerchantName(merchantBrand);
    header.chain_group = normalizeMerchantToChain(merchantBrand);
  }
  
  // Extract address (look for lines with address indicators)
  for (const line of lines) {
    if (/(?:ADRES|MAH|CAD|SOK)/i.test(line) && line.length > 10) {
      header.address_raw = line;
      const components = parseAddressComponents(line);
      header.city = components.city;
      header.district = components.district;
      header.neighborhood = components.neighborhood;
      break;
    }
  }
  
  // Extract receipt numbers
  const receiptNumbers = extractReceiptNumbers(fullText);
  if (receiptNumbers.length > 0) {
    header.receipt_unique_no = receiptNumbers[0];
  }
  
  // Extract dates
  const dates = extractDates(fullText);
  if (dates.length > 0) {
    const date = dates[0];
    // Default to 2024 if year is 2025 (OCR error fix)
    const year = date.year === 2025 ? 2024 : date.year;
    header.purchase_date = `${year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
  }
  
  // Extract times
  const times = extractTimes(fullText);
  if (times.length > 0) {
    const time = times[0];
    header.purchase_time = `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}:00`;
  }
  
  // Extract payment information
  if (/(?:KART|CARD)/i.test(fullText)) {
    header.payment_method = 'KART';
    
    // Look for PAN patterns
    const panMatches = fullText.match(PAN_PATTERN);
    if (panMatches) {
      for (const pan of panMatches) {
        const cleanPan = pan.replace(/\D/g, '');
        if (cleanPan.length >= 12) {
          header.masked_pan = maskCardNumber(pan);
          header.card_scheme = detectCardScheme(pan);
          break;
        }
      }
    }
  } else if (/NAKİT|CASH/i.test(fullText)) {
    header.payment_method = 'NAKİT';
  }
  
  console.log(`[${requestId}] Header parsed:`, {
    merchant: header.merchant_brand,
    chain: header.chain_group,
    date: header.purchase_date,
    payment: header.payment_method
  });
  
  return header;
}

/**
 * Cluster text lines by Y-coordinate
 */
function clusterLines(ocr: OcrDoc): LineCluster[] {
  if (!ocr.textAnnotations || ocr.textAnnotations.length === 0) return [];
  
  const spans = ocr.textAnnotations.slice(1).map(annotation => {
    const vertices = annotation.boundingPoly?.vertices || [];
    if (vertices.length === 0) return null;
    
    const x_coords = vertices.map(v => v.x || 0);
    const y_coords = vertices.map(v => v.y || 0);
    
    return {
      text: annotation.description,
      x: Math.min(...x_coords),
      y: Math.min(...y_coords),
      width: Math.max(...x_coords) - Math.min(...x_coords),
      height: Math.max(...y_coords) - Math.min(...y_coords)
    };
  }).filter(Boolean) as Array<{
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  
  if (spans.length === 0) return [];
  
  // Calculate median text height for clustering threshold
  const heights = spans.map(s => s.height).sort((a, b) => a - b);
  const medianHeight = heights[Math.floor(heights.length / 2)] || 20;
  const clusterThreshold = medianHeight * 0.8;
  
  // Sort spans by Y coordinate
  spans.sort((a, b) => a.y - b.y);
  
  const clusters: LineCluster[] = [];
  let currentCluster: typeof spans = [];
  let currentY = spans[0].y;
  
  for (const span of spans) {
    if (Math.abs(span.y - currentY) <= clusterThreshold) {
      currentCluster.push(span);
    } else {
      if (currentCluster.length > 0) {
        const y_coords = currentCluster.map(s => s.y);
        const y_heights = currentCluster.map(s => s.y + s.height);
        clusters.push({
          y_center: (Math.min(...y_coords) + Math.max(...y_heights)) / 2,
          y_min: Math.min(...y_coords),
          y_max: Math.max(...y_heights),
          spans: currentCluster.sort((a, b) => a.x - b.x) // Sort by X within line
        });
      }
      currentCluster = [span];
      currentY = span.y;
    }
  }
  
  // Add final cluster
  if (currentCluster.length > 0) {
    const y_coords = currentCluster.map(s => s.y);
    const y_heights = currentCluster.map(s => s.y + s.height);
    clusters.push({
      y_center: (Math.min(...y_coords) + Math.max(...y_heights)) / 2,
      y_min: Math.min(...y_coords),
      y_max: Math.max(...y_heights),
      spans: currentCluster.sort((a, b) => a.x - b.x)
    });
  }
  
  return clusters.sort((a, b) => a.y_center - b.y_center);
}

/**
 * Parse items from clustered lines
 */
function parseItems(ocr: OcrDoc, requestId: string): ParsedItem[] {
  console.log(`[${requestId}] Parsing items from clustered lines`);
  
  const clusters = clusterLines(ocr);
  const items: ParsedItem[] = [];
  let lineNo = 1;
  
  for (const cluster of clusters) {
    const lineText = cluster.spans.map(s => s.text).join(' ');
    
    // Skip lines that don't look like item lines
    if (lineText.length < 3 || 
        /^(TOPLAM|TOTAL|KDV|VAT|KART|NAKİT|FIS|SERI)/i.test(lineText) ||
        /^\d{2}[\/\.\-]\d{2}[\/\.\-]\d{4}/.test(lineText)) {
      continue;
    }
    
    // Extract money values from the line
    const moneyValues = extractMoneyValues(lineText);
    if (moneyValues.length === 0) continue; // Skip lines without prices
    
    // Segment the line into columns
    const rightmostMoney = moneyValues[moneyValues.length - 1]; // LINE_TOTAL
    let unitPrice: number | undefined;
    let qty: number | undefined;
    let unit: string | undefined;
    
    // Look for quantity/unit patterns
    const qtyParsed = parseQuantityUnit(lineText);
    qty = qtyParsed.qty;
    unit = qtyParsed.unit;
    
    // Find unit price (money value left of line total)
    if (moneyValues.length > 1) {
      unitPrice = moneyValues[moneyValues.length - 2];
      
      // If qty is missing but we have unit price and line total, calculate qty
      if (!qty && unitPrice && unitPrice > 0) {
        qty = rightmostMoney / unitPrice;
        if (Math.abs(qty - Math.round(qty)) < 0.1) {
          qty = Math.round(qty);
        }
      }
    } else {
      unitPrice = rightmostMoney; // Only one price, assume unit price = line total
      qty = qty || 1;
    }
    
    // Extract item name (text before prices)
    let itemName = lineText;
    for (const money of moneyValues) {
      const moneyStr = money.toString().replace('.', ',');
      itemName = itemName.replace(new RegExp(`₺?\\s*${moneyStr}\\s*₺?`, 'g'), '');
    }
    
    // Clean up item name
    itemName = itemName
      .replace(/\d+\s*(adet|kg|gr|lt|ml|cl|pk)/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (itemName.length === 0) continue;
    
    const item: ParsedItem = {
      line_no: lineNo++,
      bbox: {
        x: Math.min(...cluster.spans.map(s => s.x)),
        y: cluster.y_min,
        w: Math.max(...cluster.spans.map(s => s.x + s.width)) - Math.min(...cluster.spans.map(s => s.x)),
        h: cluster.y_max - cluster.y_min
      },
      item_name_raw: lineText,
      item_name_norm: itemName,
      qty,
      unit,
      unit_price: unitPrice,
      line_total: rightmostMoney
    };
    
    items.push(item);
  }
  
  console.log(`[${requestId}] Parsed ${items.length} items`);
  return items;
}

/**
 * Parse totals from OCR document
 */
function parseTotals(ocr: OcrDoc, requestId: string): ParsedTotals {
  console.log(`[${requestId}] Parsing totals`);
  
  const fullText = ocr.fullTextAnnotation?.text || '';
  const totals: ParsedTotals = {};
  
  // Extract main total
  for (const pattern of TOTAL_PATTERNS) {
    pattern.lastIndex = 0;
    const match = pattern.exec(fullText);
    if (match) {
      const value = normalizeNumber(match[1]);
      if (value !== null) {
        totals.total = value;
        break;
      }
    }
  }
  
  // Extract subtotal
  for (const pattern of SUBTOTAL_PATTERNS) {
    pattern.lastIndex = 0;
    const match = pattern.exec(fullText);
    if (match) {
      const value = normalizeNumber(match[1]);
      if (value !== null) {
        totals.subtotal = value;
        break;
      }
    }
  }
  
  // Extract discount
  for (const pattern of DISCOUNT_PATTERNS) {
    pattern.lastIndex = 0;
    const match = pattern.exec(fullText);
    if (match) {
      const value = normalizeNumber(match[1]);
      if (value !== null) {
        totals.discount_total = value;
        break;
      }
    }
  }
  
  // Extract VAT total
  const vatInfo = extractVAT(fullText);
  if (vatInfo.length > 0) {
    totals.vat_total = vatInfo.reduce((sum, vat) => sum + vat.amount, 0);
  }
  
  console.log(`[${requestId}] Totals parsed:`, totals);
  return totals;
}

/**
 * Validate parsed data and calculate confidence score
 */
async function validateAndScore(
  header: ParsedHeader,
  items: ParsedItem[],
  totals: ParsedTotals,
  requestId: string
): Promise<ValidationResult> {
  console.log(`[${requestId}] Validating parsed data`);
  
  const warnings: string[] = [];
  let confidence = 0.5; // Base confidence
  
  // Check if total is present
  if (!totals.total) {
    warnings.push('MISSING_TOTAL');
  } else {
    confidence += 0.15;
  }
  
  // Validate items sum against total
  const itemsSum = items.reduce((sum, item) => sum + (item.line_total || 0), 0);
  const itemsSumValid = totals.total ? Math.abs(itemsSum - totals.total) <= 0.50 : false;
  
  if (totals.total && !itemsSumValid) {
    warnings.push('ITEMS_MISMATCH');
  } else if (itemsSumValid) {
    confidence += 0.2;
  }
  
  // Check VAT consistency
  const totalVatFromItems = items.reduce((sum, item) => sum + (item.vat_amount || 0), 0);
  const vatValid = !totals.vat_total || Math.abs(totalVatFromItems - totals.vat_total) <= 0.10;
  
  if (!vatValid) {
    warnings.push('VAT_INCONSISTENT');
  } else if (totals.vat_total) {
    confidence += 0.1;
  }
  
  // Validate Luhn for card payments
  let luhnValidResult = true;
  if (header.masked_pan) {
    const digits = header.masked_pan.replace(/\D/g, '');
    luhnValidResult = luhnValid(digits);
    if (!luhnValidResult) {
      warnings.push('INVALID_LUHN');
    } else {
      confidence += 0.15;
    }
  }
  
  // Check for duplicate receipt
  let duplicateReceipt = false;
  if (header.receipt_unique_no) {
    try {
      const { data: existing } = await supabase
        .from('receipts')
        .select('id')
        .eq('receipt_unique_no', header.receipt_unique_no)
        .limit(1);
      
      if (existing && existing.length > 0) {
        duplicateReceipt = true;
        warnings.push('DUP_RECEIPT_NO');
      }
    } catch (error) {
      console.error(`[${requestId}] Error checking duplicate receipt:`, error);
    }
  }
  
  // Bonus points for good parsing
  if (header.purchase_date) confidence += 0.1;
  if (header.purchase_time) confidence += 0.1;
  if (items.length >= 3) confidence += 0.1;
  if (header.chain_group && header.chain_group !== 'Unknown') confidence += 0.1;
  
  // Low confidence warning
  if (confidence < 0.7) {
    warnings.push('LOW_CONFIDENCE');
  }
  
  console.log(`[${requestId}] Validation complete. Confidence: ${confidence.toFixed(3)}, Warnings: ${warnings.length}`);
  
  return {
    parse_confidence: Math.min(1, Math.max(0, confidence)),
    warnings,
    items_sum_valid: itemsSumValid,
    vat_valid: vatValid,
    luhn_valid: luhnValidResult,
    duplicate_receipt: duplicateReceipt
  };
}

/**
 * Persist parsed data to database
 */
async function persistData(
  receiptId: string,
  header: ParsedHeader,
  items: ParsedItem[],
  totals: ParsedTotals,
  validation: ValidationResult,
  ocrRaw: any,
  requestId: string
): Promise<void> {
  console.log(`[${requestId}] Persisting data for receipt ${receiptId}`);
  
  try {
    // Determine receipt status based on validation
    let status = 'pending';
    if (!validation.items_sum_valid || validation.duplicate_receipt || validation.warnings.includes('MISSING_TOTAL')) {
      status = 'pending_review';
    }
    
    // Match or upsert store
    let storeId: string | null = null;
    if (header.chain_group) {
      storeId = await upsertStore(supabase, header.chain_group, header.address_raw);
    }
    
    // Update receipt with parsed data
    const receiptUpdate: any = {
      merchant: header.merchant_raw,
      merchant_brand: header.merchant_brand,
      total: totals.total,
      subtotal: totals.subtotal,
      discount_total: totals.discount_total,
      vat_total: totals.vat_total,
      purchase_date: header.purchase_date,
      purchase_time: header.purchase_time,
      store_id: storeId,
      receipt_unique_no: header.receipt_unique_no,
      fis_no: header.fis_no,
      payment_method: header.payment_method,
      masked_pan: header.masked_pan,
      card_scheme: header.card_scheme,
      address_raw: header.address_raw,
      city: header.city,
      district: header.district,
      neighborhood: header.neighborhood,
      ocr_json: {
        raw: ocrRaw,
        parsed: { header, items, totals },
        warnings: validation.warnings,
        timestamp: new Date().toISOString()
      },
      ocr_engine: 'gcv',
      parse_confidence: validation.parse_confidence,
      status,
      updated_at: new Date().toISOString()
    };
    
    const { error: receiptError } = await supabase
      .from('receipts')
      .update(receiptUpdate)
      .eq('id', receiptId);
    
    if (receiptError) {
      throw new Error(`Receipt update failed: ${receiptError.message}`);
    }
    
    // Insert receipt items
    if (items.length > 0) {
      const itemsData = items.map(item => ({
        receipt_id: receiptId,
        line_no: item.line_no,
        bbox: item.bbox,
        item_name_raw: item.item_name_raw,
        item_name_norm: item.item_name_norm,
        item_name: item.item_name_norm, // For existing column compatibility
        qty: item.qty,
        unit: item.unit,
        unit_price: item.unit_price,
        line_total: item.line_total,
        vat_rate: item.vat_rate,
        vat_amount: item.vat_amount,
        ean13: item.ean13,
        raw_line: item.item_name_raw
      }));
      
      const { error: itemsError } = await supabase
        .from('receipt_items')
        .insert(itemsData);
      
      if (itemsError) {
        console.error(`[${requestId}] Items insert failed:`, itemsError);
        // Don't throw here, partial success is acceptable
      }
    }
    
    console.log(`[${requestId}] Data persisted successfully`);
  } catch (error) {
    console.error(`[${requestId}] Persistence error:`, error);
    throw error;
  }
}

/**
 * Main OCR processing function
 */
async function processOCR(imageUrl: string, userId: string, requestId: string) {
  console.log(`[${requestId}] Starting OCR processing for user ${userId}`);
  
  // Create initial receipt record
  const { data: receiptData, error: receiptError } = await supabase
    .from('receipts')
    .insert({
      user_id: userId,
      image_url: imageUrl,
      status: 'pending',
      points: 100
    })
    .select()
    .single();
  
  if (receiptError || !receiptData) {
    throw new Error(`Failed to create receipt: ${receiptError?.message}`);
  }
  
  const receiptId = receiptData.id;
  console.log(`[${requestId}] Created receipt ${receiptId}`);
  
  try {
    // Call Google Vision API
    const visionApiKey = Deno.env.get('GOOGLE_VISION_API_KEY');
    if (!visionApiKey) {
      throw new Error('Google Vision API key not configured');
    }
    
    const visionResponse = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${visionApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            image: { source: { imageUri: imageUrl } },
            features: [{ type: 'TEXT_DETECTION' }]
          }]
        })
      }
    );
    
    if (!visionResponse.ok) {
      throw new Error(`Vision API error: ${visionResponse.status}`);
    }
    
    const visionData = await visionResponse.json();
    const ocrResult = visionData.responses?.[0];
    
    if (ocrResult?.error) {
      throw new Error(`Vision API error: ${ocrResult.error.message}`);
    }
    
    if (!ocrResult?.textAnnotations) {
      throw new Error('No text detected in image');
    }
    
    console.log(`[${requestId}] OCR completed, found ${ocrResult.textAnnotations.length} text annotations`);
    
    // Parse OCR results
    const header = parseHeader(ocrResult, requestId);
    const items = parseItems(ocrResult, requestId);
    const totals = parseTotals(ocrResult, requestId);
    
    // Validate and score
    const validation = await validateAndScore(header, items, totals, requestId);
    
    // Persist to database
    await persistData(receiptId, header, items, totals, validation, ocrResult, requestId);
    
    console.log(`[${requestId}] Processing complete`);
    
    return {
      success: true,
      receiptId,
      itemsCount: items.length,
      parseConfidence: validation.parse_confidence,
      warnings: validation.warnings,
      stats: {
        words: ocrResult.textAnnotations.length,
        lines: items.length,
        total: totals.total,
        itemsSum: items.reduce((sum, item) => sum + (item.line_total || 0), 0),
        mismatchDelta: totals.total ? Math.abs(items.reduce((sum, item) => sum + (item.line_total || 0), 0) - totals.total) : 0
      }
    };
  } catch (error) {
    console.error(`[${requestId}] Processing error:`, error);
    
    // Update receipt with error status
    await supabase
      .from('receipts')
      .update({ 
        status: 'failed',
        ocr_json: { error: error.message, timestamp: new Date().toISOString() }
      })
      .eq('id', receiptId);
    
    throw error;
  }
}

/**
 * Main server handler
 */
serve(async (req) => {
  const requestId = generateRequestId();
  console.log(`[${requestId}] ${req.method} ${req.url}`);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req) });
  }
  
  try {
    const { imageUrl, userId } = await req.json();
    
    if (!imageUrl || !userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing imageUrl or userId' }),
        { status: 400, headers: getCorsHeaders(req) }
      );
    }
    
    const result = await processOCR(imageUrl, userId, requestId);
    
    return new Response(
      JSON.stringify(result),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error(`[${requestId}] Request failed:`, error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        requestId 
      }),
      { 
        status: 500, 
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
      }
    );
  }
});