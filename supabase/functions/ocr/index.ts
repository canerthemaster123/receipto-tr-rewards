import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

// ============= TURKISH RETAIL RECEIPT OCR ENGINE =============

/**
 * Turkish retail receipt (Migros, BIM, CarrefourSA) OCR+data extraction engine
 * INPUT: Single receipt photo (png/jpg)
 * OUTPUT: Structured JSON matching the specified schema
 */

// Supabase client setup
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// CORS configuration
function getCorsHeaders(_req: Request) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin'
  };
}

// ============= UTILITY FUNCTIONS =============

/**
 * Normalize Turkish characters and common OCR errors
 */
function normalizeText(text: string): string {
  if (!text) return '';
  
  return text
    .trim()
    .replace(/MIGROS/gi, 'Migros')
    .replace(/BIM/gi, 'BİM')
    .replace(/CARREFOUR\s*SA/gi, 'CarrefourSA');
}

/**
 * Alpha-normalize: convert ambiguous OCR digits back to letters for keyword detection
 */
function alphaNormalize(s: string): string {
  if (!s) return '';
  return s
    .replace(/0/g, 'O')
    .replace(/1/g, 'I')
    .replace(/5/g, 'S')
    .replace(/8/g, 'B');
}

/**
 * Parse monetary amounts from Turkish text
 */
function parseAmount(text: string): number | null {
  if (!text) return null;
  
  // Remove currency symbols and normalize
  const normalized = text
    .replace(/₺/g, '')
    .replace(/\bTL\b/gi, '')
    .replace(/\s+/g, '')
    .trim();
  
  // Handle Turkish decimal notation (comma as decimal separator)
  const match = normalized.match(/(\d{1,6})[.,]?(\d{2})?/);
  if (!match) return null;
  
  const integerPart = match[1];
  const decimalPart = match[2] || '00';
  
  return parseFloat(`${integerPart}.${decimalPart}`);
}

/**
 * Extract dates in YYYY-MM-DD format
 */
function extractDate(text: string): string | null {
  const patterns = [
    /(\d{1,2})[.\/\-](\d{1,2})[.\/\-](\d{4})/,
    /(\d{4})[.\/\-](\d{1,2})[.\/\-](\d{1,2})/
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let day, month, year;
      
      if (match[3].length === 4) {
        // DD/MM/YYYY format
        day = parseInt(match[1], 10);
        month = parseInt(match[2], 10);
        year = parseInt(match[3], 10);
      } else {
        // YYYY/MM/DD format
        year = parseInt(match[1], 10);
        month = parseInt(match[2], 10);
        day = parseInt(match[3], 10);
      }
      
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2020 && year <= 2030) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }
  }
  
  return null;
}

/**
 * Extract time in HH:MM format with OCR tolerance
 */
function extractTime(text: string): string | null {
  // Enhanced pattern with OCR tolerance for colon and digits
  const patterns = [
    /(\d{1,2}):(\d{2})/,           // Standard HH:MM
    /(\d{1,2});(\d{2})/,           // OCR may confuse : with ;
    /(\d{1,2})\.(\d{2})/,          // OCR may confuse : with .
    /SAAT[:.:\s]*(\d{1,2}):(\d{2})/i, // Migros specific pattern
    /SAAT[:.:\s]*(\d{1,2});(\d{2})/i, // Migros with OCR error
    /SAAT[:.:\s]*(\d{1,2})\.(\d{2})/i  // Migros with OCR error
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let hour = parseInt(match[1], 10);
      let minute = parseInt(match[2], 10);
      
      // Apply OCR corrections for digits in time context
      if (match[1] === 'l' || match[1] === 'I') hour = 1;
      if (match[1] === 'O') hour = 0;
      
      if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
        return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      }
    }
  }
  
  return null;
}

/**
 * Mask card number: show only last 4 digits
 */
function maskCardNumber(cardNumber: string): string | null {
  if (!cardNumber) return null;
  
  const digits = cardNumber.replace(/\D/g, '');
  if (digits.length < 12) return null;
  
  const last4 = digits.slice(-4);
  const maskedLength = digits.length - 4;
  
  return `${'*'.repeat(maskedLength)}${last4}`;
}

/**
 * Parse Turkish address components
 */
function parseAddress(addressText: string): { street?: string; neighborhood?: string; city?: string } {
  if (!addressText) return {};
  
  const normalized = addressText.toLowerCase();
  const result: any = {};
  
  // Turkish cities
  const cities = [
    'istanbul', 'ankara', 'izmir', 'bursa', 'antalya', 'adana', 'konya', 'gaziantep',
    'mersin', 'kayseri', 'eskişehir', 'diyarbakır', 'samsun', 'denizli', 'şanlıurfa',
    'adapazarı', 'malatya', 'kahramanmaraş', 'erzurum', 'van', 'batman', 'elazığ'
  ];
  
  for (const city of cities) {
    if (normalized.includes(city)) {
      result.city = city.charAt(0).toUpperCase() + city.slice(1);
      break;
    }
  }
  
  // Neighborhood (mahalle)
  const neighborhoodMatch = normalized.match(/([a-zçğıöşü\s]+)(?:\s+mah\.?|\s+mahallesi)/i);
  if (neighborhoodMatch) {
    result.neighborhood = neighborhoodMatch[1].trim();
  }
  
  // Street (cadde, sokak, bulvar)
  const streetMatch = normalized.match(/([a-zçğıöşü\s]+)(?:\s+cad\.?|\s+cadde|\s+sok\.?|\s+sokak|\s+bulv\.?|\s+bulvarı)/i);
  if (streetMatch) {
    result.street = streetMatch[1].trim();
  }
  
  return result;
}

/**
 * Detect retail chain format from text patterns
 */
function detectFormat(text: string): { format: string; confidence: number } {
  const normalized = alphaNormalize(text).toLowerCase();
  
  // Migros patterns
  const migrosPatterns = [
    'migros ticaret', 'tarih:', 'saat:', 'fiş no', 'ara toplam', 'topkdv', 'mersis no', 'kasiyer', 'ortak pos'
  ];
  
  // BIM patterns
  const bimPatterns = [
    'bim birleşik mağazalar', 'e-arşiv fatura', 'fatura no', 'ettn', 'tckn', 'vkn', 'toplam kdv', 'ödenecek kdv dahil tutar'
  ];
  
  // CarrefourSA patterns
  const carrefourPatterns = [
    'carrefoursa', 'müşteri ekstresi', 'kredi karti', 'topkdv', 'kasa ind', 'kart indirimi'
  ];
  
  const formats = [
    { name: 'Migros', patterns: migrosPatterns },
    { name: 'BIM', patterns: bimPatterns },
    { name: 'CarrefourSA', patterns: carrefourPatterns }
  ];
  
  let bestMatch = { format: 'Unknown', confidence: 0 };
  
  for (const format of formats) {
    const matches = format.patterns.filter(pattern => normalized.includes(pattern)).length;
    const confidence = matches / format.patterns.length;
    
    if (confidence > bestMatch.confidence) {
      bestMatch = { format: format.name, confidence };
    }
  }
  
  return bestMatch;
}

/**
 * Enhanced Migros V3 parsing for products and handling discounts correctly
 */
function migrosParseV3(rawText: string): any {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const items: any[] = [];
  const discounts: any[] = [];
  
  // Helper function to normalize prices
  const toNumber = (s: string): number => {
    return parseFloat(s.replace(/\./g, '').replace(',', '.'));
  };
  
  // 1. Product section detection - more conservative approach
  let productStart = -1;
  let productEnd = lines.length;
  
  // Find start after key anchors but don't get stuck on document codes
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();
    
    // Start markers
    if (line.includes('müşteri tckn') || line.includes('tarih:') || line.includes('saat:')) {
      productStart = i;
      break;
    }
    
    // If we see a document code (#600208...), skip it but don't stop
    if (/^\s*#\d{10,}\s*$/.test(lines[i])) {
      productStart = i;
      continue;
    }
  }
  
  // Find end before totals section
  for (let i = productStart + 1; i < lines.length; i++) {
    const line = lines[i].toLowerCase();
    if (line.match(/^(topkdv|kdv|ara toplam|genel toplam|toplam tutar|toplam|satiş|satis)$/)) {
      productEnd = i;
      break;
    }
  }
  
  // 2. Noise patterns (exclude from products but don't stop parsing)
  const noisePatterns = [
    /^\s*(bilgi fiş|tür:?\s*e-arşiv|müşteri tckn|fiş no|tarih|saat|kasa|kasiyer)/i,
    /^\s*(jetkasa|ortak pos|mersis|e-arşiv faturasina|http|www|tel:)/i,
    /^\s*(ara toplam|topkdv|genel toplam|toplam tutar|satiş|satis|ref no|onay kodu)/i,
    /^\s*(işyeri id|terminal|bu belgeye istinadne|irsaliye yerine geçer)/i,
    /^\s*#\d{10,}\s*$/i, // Document codes - skip but continue
    /^\s*(tutar ind\.|tutar indirim|indirimler?|kocailem|money)\b/i,
    /^\s*(txw|bbsm|absm|l2ek|kvdev|joand|ha dtml|rmeyen kutularda sak|sea)\s*$/i
  ];
  
  // 3. Parse products in the detected window
  for (let i = productStart + 1; i < productEnd; i++) {
    const line = lines[i];
    if (!line) continue;
    
    // Skip noise patterns
    const isNoise = noisePatterns.some(pattern => pattern.test(line));
    if (isNoise) {
      if (/^\s*#\d{10,}\s*$/.test(line)) {
        console.log(`Skipping document code but continuing: ${line}`);
      }
      continue;
    }
    
    // Must have letters and price pattern for products
    if (!/[A-ZÇĞİÖŞÜa-zçğıöşü]/.test(line)) continue;
    if (!/\d+[.,]\d{2}/.test(line)) continue;
    
    let item = null;
    
    // 3.1 Weight-based items (KG format)
    const weightMatch1 = line.match(/^(.+?)\s+(\d+[.,]\d{1,3})\s*KG\s*x\s*(\d{1,4}[.,]\d{2})\s*TL\/KG\s*=\s*(\d{1,4}[.,]\d{2})$/i);
    if (weightMatch1) {
      const [, name, qty, unit, total] = weightMatch1;
      item = {
        name: name.trim(),
        quantity: `${qty} KG`,
        unit_price: toNumber(unit),
        line_total: toNumber(total)
      };
    }
    
    // Alternative weight format
    if (!item) {
      const weightMatch2 = line.match(/^(.+?)\s+KG\s+(\d+[.,]\d{1,3})\s*x\s*(\d{1,4}[.,]\d{2}).*=\s*(\d{1,4}[.,]\d{2})$/i);
      if (weightMatch2) {
        const [, name, qty, unit, total] = weightMatch2;
        item = {
          name: name.trim(),
          quantity: `${qty} KG`,
          unit_price: toNumber(unit),
          line_total: toNumber(total)
        };
      }
    }
    
    // 3.2 Regular items with quantity (x1, x2, etc.)
    if (!item) {
      const qtyMatch = line.match(/^(.+?)\s+x(\d+)\s+(\d{1,4}[.,]\d{2})$/i);
      if (qtyMatch) {
        const [, name, qty, price] = qtyMatch;
        const quantity = parseInt(qty);
        const lineTotal = toNumber(price);
        item = {
          name: name.trim(),
          quantity: `x${qty}`,
          unit_price: quantity > 0 ? lineTotal / quantity : lineTotal,
          line_total: lineTotal
        };
      }
    }
    
    // 3.3 Simple items (name and price)
    if (!item) {
      const simpleMatch = line.match(/^(.+?)\s+(\d{1,4}[.,]\d{2})$/);
      if (simpleMatch) {
        const [, name, price] = simpleMatch;
        if (name.length > 3 && /[A-ZÇĞİÖŞÜa-zçğıöşü]/.test(name)) {
          item = {
            name: name.trim(),
            quantity: 'x1',
            unit_price: toNumber(price),
            line_total: toNumber(price)
          };
        }
      }
    }
    
    // Clean and validate item
    if (item && item.name && item.line_total > 0) {
      // Clean product name
      item.name = item.name
        .replace(/\s*%\d+\s*$/g, '') // Remove VAT percentages
        .replace(/\s*kdv\w*\s*$/gi, '') // Remove KDV suffixes
        .replace(/\s*x\d+\s*$/g, '') // Remove quantity remnants
        .replace(/\s+/g, ' ')
        .trim();
      
      // Exclude discount lines disguised as products
      if (!/^(indirim|tutar ind|kocailem|money)/i.test(item.name)) {
        items.push(item);
      }
    }
  }
  
  // 4. Parse discounts (separate from products)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Discount patterns
    const discountMatch = line.match(/^\s*(tutar\s*ind\.?|tutar\s*indirim|indirimler?|kocailem)\b.*?(\d+[.,]\d{2})/i);
    if (discountMatch) {
      let amount = toNumber(discountMatch[2]);
      // Store as negative for discounts
      if (amount > 0) {
        discounts.push({
          label: discountMatch[1].trim(),
          amount: `-${amount.toFixed(2).replace('.', ',')}`
        });
      }
    }
  }
  
  // 5. Calculate totals - real paid amount
  const itemsSum = items.reduce((sum, item) => sum + item.line_total, 0);
  const discountSum = discounts.reduce((sum, disc) => sum + Math.abs(toNumber(disc.amount)), 0);
  const grandTotal = itemsSum - discountSum;
  
  // 6. Extract time in HH:MM format
  let timeFormatted = null;
  for (const line of lines) {
    const timeMatch = line.match(/saat:\s*(\d{1,2}):(\d{2})/i);
    if (timeMatch) {
      timeFormatted = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
      break;
    }
  }
  
  // 7. Extract clean address (remove phone numbers)
  let addressClean = '';
  for (const line of lines) {
    if (line.includes('MERKEZ ADRESİ:')) {
      addressClean = line.replace(/.*MERKEZ ADRESİ:\s*/, '')
        .replace(/\s*TEL.*$/, '')
        .replace(/\d{4}\s*\d{3}\s*\d{2}\s*\d{2}/, '')
        .replace(/0\(\d{3}\)\s*\d{3}\s*\d{2}\s*\d{2}/, '')
        .trim();
      break;
    }
  }
  
  return {
    items,
    discounts,
    grand_total: grandTotal.toFixed(2).replace('.', ','),
    vat_total: null, // Will be extracted separately if needed
    time: timeFormatted,
    store_address: addressClean,
    items_count: items.length,
    discount_total: discountSum.toFixed(2).replace('.', ','),
    sum_items: itemsSum.toFixed(2).replace('.', ','),
    delta: Math.abs(grandTotal - itemsSum + discountSum).toFixed(2),
    warnings: items.length === 0 ? ['NO_PRODUCTS_FOUND'] : []
  };
}

/**
 * Parse items from receipt lines based on format - Now calls migrosParseV3 for Migros
 */
function parseItems(lines: string[], format: string): any[] {
  // Use new Migros V3 parser for Migros receipts
  if (format === 'Migros') {
    const migrosResult = migrosParseV3(lines.join('\n'));
    return migrosResult.items.map((item: any) => ({
      name: item.name,
      qty: item.quantity === 'x1' ? 1 : item.quantity,
      unit_price: item.unit_price,
      line_total: item.line_total,
      raw_line: `${item.name} ${item.quantity} ${item.line_total}`,
      product_code: null
    }));
  }

  // Existing logic for BIM and CarrefourSA (unchanged)
  const items: any[] = [];
  let startIndex = -1;
  let endIndex = lines.length;

  if (format === 'BIM') {
    startIndex = lines.findIndex(line => /nihai\s*tuketi[çc]i/i.test(alphaNormalize(line)));
    endIndex = lines.findIndex(line => /toplam\s*kdv/i.test(alphaNormalize(line)));
  } else if (format === 'CarrefourSA') {
    startIndex = lines.findIndex(line => /fi[şs]\s*no/i.test(alphaNormalize(line)));
    endIndex = lines.findIndex(line => /topkdv/i.test(alphaNormalize(line)));
  }

  if (startIndex === -1) startIndex = 0;
  if (endIndex === -1) endIndex = lines.length;

  for (let i = startIndex + 1; i < endIndex; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const alphaLine = alphaNormalize(line);
    const rawLower = line.toLowerCase();

    // General system line detection (for BIM/CarrefourSA)
    const isSystemLine = /tarih|saat|fi[şs]|no|kdv|toplam|tutar|ref|onay|kodu|pos|terminal|batch|eku|mersis|tckn|vkn|tel|adres|₺|tl|\d+[.,]\d{2}|^\d+$|^[*]+$|^#+/i.test(alphaLine);

    const isQtyUnitOnly = /^\s*[.,-]?\d*[.,]\d+\s*(kg|gr|lt|l)\b.*\b(x|×)\b/i.test(rawLower);
    const isDiscountNoise = /[.,]\d+\s*[-–]?\s*d\b/i.test(rawLower);
    const isCardNoise = /(kart\s*ile|csa\s*kart|kart\s*indirimi|kasa\s*ind|promo|kupon|electron|elektron)/i.test(alphaLine);

    if (isSystemLine || isQtyUnitOnly || isDiscountNoise || isCardNoise) continue;

    const hasLetters = /[A-Za-zÇĞİÖŞÜçğıöşü]/.test(line);
    if (!hasLetters) continue;

    let item = null;

    // Regular items with explicit quantity
    const regularMatch = line.match(/^(.+?)\s+x(\d+)\s+[*]?(\d{1,4}[.,]\d{2})$/i);
    if (regularMatch) {
      const [, name, qty, price] = regularMatch;
      const quantity = parseInt(qty);
      const lineTotal = parseFloat(price.replace(',', '.'));
      item = {
        name: name.trim(),
        qty: quantity,
        unit_price: quantity > 0 ? lineTotal / quantity : lineTotal,
        line_total: lineTotal,
        raw_line: line
      };
    }

    // Simple items (name and price only)
    if (!item) {
      const simpleMatch = line.match(/^(.+?)\s+[*]?(\d{1,4}[.,]\d{2})$/);
      if (simpleMatch) {
        const [, name, price] = simpleMatch;
        if (name.length > 3 && /[A-ZÇĞİÖŞÜa-zçğıöşü]/.test(name)) {
          item = {
            name: name.trim(),
            qty: 1,
            unit_price: parseFloat(price.replace(',', '.')),
            line_total: parseFloat(price.replace(',', '.')),
            raw_line: line
          };
        }
      }
    }

    if (item && item.name && item.line_total > 0) {
      item.name = item.name
        .replace(/^\*+|^#+/, '')
        .replace(/^\d+\s*/, '')
        .replace(/\s+\d+[.,]\d{2}\s*[*]?\s*$/, '')
        .replace(/\s*x\s*\d+\s*$/i, '')
        .replace(/\s*\*.*$/, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (item.name.length >= 3 && !item.name.match(/^[^A-ZÇĞİÖŞÜa-zçğıöşü]*$/)) {
        items.push({
          name: item.name,
          qty: item.qty || 1,
          unit_price: item.unit_price,
          line_total: item.line_total,
          raw_line: item.raw_line,
          product_code: null
        });
      }
    }
  }

  return items;
}

/**
 * Parse discounts from receipt lines - Enhanced for Migros v3 with proper detection
 */
function parseDiscounts(lines: string[], format: string = 'Unknown'): any[] {
  // For Migros, use the V3 parser's discount handling
  if (format === 'Migros') {
    const migrosResult = migrosParseV3(lines.join('\n'));
    return migrosResult.discounts.map((disc: any) => ({
      description: disc.label,
      amount: Math.abs(parseFloat(disc.amount.replace(',', '.')))
    }));
  }

  const discounts: any[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // General discount patterns for BIM/CarrefourSA
    const generalDiscountMatch = line.match(/(ind|indirim|kasa\s*ind|kart\s*ind|promo|kupon)/i);
    if (generalDiscountMatch) {
      const amountMatch = line.match(/(-?\d+[.,]\d{2})/);
      if (amountMatch) {
        let amount = parseAmount(amountMatch[1]);
        if (amount && amount > 0) {
          discounts.push({
            description: generalDiscountMatch[1],
            amount: amount
          });
        }
      }
    }
  }
  
  return discounts;
}

/**
 * Extract totals from receipt text based on format
 */
function extractTotals(text: string, format: string): { subtotal?: number; vat_total?: number; grand_total?: number } {
  const result: any = {};
  const textAlpha = alphaNormalize(text);
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const linesAlpha = textAlpha.split('\n').map(l => l.trim()).filter(Boolean);

  // For Migros, use V3 parser's total calculation
  if (format === 'Migros') {
    const migrosResult = migrosParseV3(text);
    return {
      grand_total: parseFloat(migrosResult.grand_total.replace(',', '.')),
      vat_total: migrosResult.vat_total ? parseFloat(migrosResult.vat_total.replace(',', '.')) : null,
      subtotal: null // Will be calculated from items if needed
    };
  }

  // Format-specific total patterns for other formats
  let totalPatterns: RegExp[] = [];
  
  if (format === 'BIM') {
    // BIM: 'Odenecek KDV dahil tutar'
    totalPatterns = [
      /(?:odenecek\s*kdv\s*dahil\s*tutar)\s*[:=]?\s*(\d+[.,]\d{2})/i,
      /(?:kdv\s*dahil\s*tutar)\s*[:=]?\s*(\d+[.,]\d{2})/i
    ];
  } else if (format === 'CarrefourSA') {
    // Carrefour: 'TOPLAM' (but NOT 'Toplam KDV')
    totalPatterns = [
      /(?:^|\s)toplam(?!\s*kdv)\s*[:=]?\s*(\d+[.,]\d{2})/i
    ];
  } else {
    // Default patterns
    totalPatterns = [
      /(?:genel\s*)?toplam\s*[:=]?\s*(\d+[.,]\d{2})/i,
      /(?:kdv'li\s*toplam|ödenecek.*tutar)\s*[:=]?\s*(\d+[.,]\d{2})/i,
      /total\s*[:=]?\s*(\d+[.,]\d{2})/i
    ];
  }

  // Try format-specific patterns first
  for (const pattern of totalPatterns) {
    const match = textAlpha.match(pattern);
    if (match) {
      result.grand_total = parseAmount(match[1]);
      break;
    }
  }

  // Subtotal patterns (same line)
  const subtotalMatch = textAlpha.match(/(?:ara\s*toplam|subtotal)\s*[:=]?\s*(\d+[.,]\d{2})/i);
  if (subtotalMatch) {
    result.subtotal = parseAmount(subtotalMatch[1]);
  }

  // VAT total patterns (same line) - CRITICAL: Ensure TOPKDV is not used as grand_total
  const vatMatch = textAlpha.match(/(?:topkdv|kdv\s*tutari|toplam\s*kdv)(?!\s*[:=]?\s*toplam)\s*[:=]?\s*(\d+[.,]\d{2})/i);
  if (vatMatch) {
    result.vat_total = parseAmount(vatMatch[1]);
    // NEVER use TOPKDV as grand_total
  }

  // Fallback: multi-line totals where amount is on next line (often with *)
  const moneyNear = (startIdx: number): number | null => {
    for (let k = startIdx; k <= Math.min(startIdx + 2, lines.length - 1); k++) {
      const m = lines[k].match(/[*\s]*([0-9]{1,4}[.,][0-9]{2})/);
      if (m) return parseAmount(m[1]);
    }
    return null;
  };

  if (result.subtotal == null) {
    const idx = linesAlpha.findIndex(l => /\bara\s*toplam\b/i.test(l));
    if (idx >= 0) result.subtotal = moneyNear(idx) ?? result.subtotal;
  }

  if (result.vat_total == null) {
    const idx = linesAlpha.findIndex(l => /\b(topkdv|kdv\s*tutari|toplam\s*kdv)\b/i.test(l));
    if (idx >= 0) result.vat_total = moneyNear(idx) ?? result.vat_total;
  }

  // Multi-line total fallback with format-specific keywords
  if (result.grand_total == null) {
    if (format === 'CarrefourSA') {
      // Prefer the bottom 'TUTAR' line (exclude lines mentioning KDV)
      let idxTutar = -1;
      for (let i = linesAlpha.length - 1; i >= 0; i--) {
        if (/\btutar\b/i.test(linesAlpha[i]) && !/\bkdv\b/i.test(linesAlpha[i])) {
          idxTutar = i;
          break;
        }
      }
      if (idxTutar >= 0) {
        const amount = moneyNear(idxTutar);
        if (amount) {
          result.grand_total = amount;
        }
      }
    }

    if (result.grand_total == null && format === 'CarrefourSA') {
      // Fallback to 'TOPLAM' (but NOT 'Toplam KDV')
      const idx = linesAlpha.findIndex(l => /\btoplam\b/i.test(l) && !/\bkdv\b/i.test(l));
      if (idx >= 0) {
        const amount = moneyNear(idx);
        if (amount) {
          result.grand_total = amount;
        }
      }
    }

    if (result.grand_total == null) {
      let totalKeywords: string[] = [];
      if (format === 'BIM') {
        totalKeywords = ['odenecek kdv dahil tutar', 'kdv dahil tutar'];
      } else {
        totalKeywords = ['genel toplam', 'kdv li toplam', 'odenecek.*tutar', 'toplam'];
      }
      for (const keyword of totalKeywords) {
        const idx = linesAlpha.findIndex(l => new RegExp(`\\b${keyword}\\b`, 'i').test(l));
        if (idx >= 0) {
          // Skip lines that mention KDV when keyword is generic 'toplam'
          if (/toplam/i.test(keyword) && /\bkdv\b/i.test(linesAlpha[idx])) continue;
          const amount = moneyNear(idx);
          if (amount) {
            result.grand_total = amount;
            break;
          }
        }
      }
    }
  }

  // Ultimate fallback: largest amount in text
  if (!result.grand_total) {
    const matches = [...text.matchAll(/(\d{1,4}[.,]\d{2})/g)];
    let maxVal = 0;
    for (const m of matches) {
      const v = parseAmount(m[1]);
      if (v && v > maxVal) maxVal = v;
    }
    if (maxVal > 0) result.grand_total = maxVal;
  }

  return result;
}

/**
 * Calculate computed totals and reconciliation - Enhanced for Migros discount handling
 */
function calculateComputedTotals(items: any[], discounts: any[], totals: any): any {
  const itemsSum = items.reduce((sum, item) => sum + (item.line_total || 0), 0);
  const discountsSum = discounts.reduce((sum, discount) => sum + (discount.amount || 0), 0);
  
  // For Migros: grand_total should equal items_sum - discounts (VAT already included in item prices)
  const expectedTotal = itemsSum - discountsSum;
  const actualTotal = totals.grand_total || 0;
  
  const difference = Math.abs(expectedTotal - actualTotal);
  const reconciles = difference <= 0.50; // 0.50 TL tolerance as specified
  
  return {
    items_sum: Math.round(itemsSum * 100) / 100,
    discounts_sum: Math.round(discountsSum * 100) / 100,
    reconciles
  };
}

/**
 * Download image bytes supporting both public URLs and Supabase Storage paths
 */
async function downloadImage(imageUrl: string): Promise<Uint8Array> {
  // If it's a direct URL, try fetching
  if (/^https?:\/\//i.test(imageUrl)) {
    const resp = await fetch(imageUrl);
    if (resp.ok) {
      const buf = new Uint8Array(await resp.arrayBuffer());
      return buf;
    }

    // Try to extract storage path from URL (e.g., /object/sign/receipts/<path>?token=...)
    const m = imageUrl.match(/\/object\/(?:sign\/)?receipts\/([^?]+)/);
    if (m && m[1]) {
      const path = decodeURIComponent(m[1]);
      const { data, error } = await supabase.storage.from('receipts').download(path);
      if (error) throw new Error(`Storage download failed: ${error.message}`);
      const buf = new Uint8Array(await data.arrayBuffer());
      return buf;
    }

    throw new Error(`Failed to download image via HTTP: ${resp.status}`);
  }

  // Otherwise, assume it's a storage path within the receipts bucket
  const path = imageUrl.replace(/^\/+/, '');
  const { data, error } = await supabase.storage.from('receipts').download(path);
  if (error) throw new Error(`Storage download failed: ${error.message}`);
  const buf = new Uint8Array(await data.arrayBuffer());
  return buf;
}

/**
 * Main OCR processing function
 */
async function processOCR(imageUrl: string): Promise<any> {
  const googleVisionApiKey = Deno.env.get('GOOGLE_VISION_API_KEY');
  if (!googleVisionApiKey) {
    throw new Error('Google Vision API key not configured');
  }
  
  try {
    // Download image (supports Supabase Storage or public URLs)
    const imageBytes = await downloadImage(imageUrl);
    const base64Image = base64Encode(imageBytes);

    // Call Google Vision API
    const visionResponse = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${googleVisionApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            image: { content: base64Image },
            features: [{ type: 'TEXT_DETECTION', maxResults: 1 }]
          }]
        })
      }
    );
    
    if (!visionResponse.ok) {
      throw new Error(`Vision API error: ${visionResponse.status}`);
    }
    
    const visionData = await visionResponse.json();
    
    if (!visionData.responses?.[0]?.textAnnotations?.[0]) {
      throw new Error('No text detected in image');
    }
    
    const rawText = visionData.responses[0].textAnnotations[0].description;
    return rawText;
    
  } catch (error) {
    console.error('OCR processing error:', error);
    throw error;
  }
}

/**
 * Main parsing function that converts OCR text to structured JSON
 */
function parseReceiptText(rawText: string): any {
  const normalizedText = normalizeText(rawText);
  const lines = normalizedText.split('\n').filter(line => line.trim());
  
  const warnings: string[] = [];
  
  // Detect format
  const formatDetection = detectFormat(normalizedText);
  
  const merchantIdx = lines.findIndex(line => 
    /migros|bim|carrefour/i.test(alphaNormalize(line)) && !/\d{2}[.\/]\d{2}/.test(line)
  );
  const merchantLine = merchantIdx >= 0 ? lines[merchantIdx] : lines[0];
  
  // Enhanced Turkish retail parsing with Migros focus
  const merchantName = merchantLine ? merchantLine.trim() : 'Unknown';
  
  // Enhanced chain detection with specific patterns
  const merchantDisplay = (() => {
    const text = normalizedText.toLowerCase();
    
    // Migros detection (priority patterns)
    if (text.includes('m*gros') || text.includes('migros') || 
        text.includes('e-arşiv faturasina') || text.includes('ortak pos') ||
        text.includes('mersis no: 062') || text.includes('müşteri tckn')) {
      return 'Migros';
    }
    
    // BIM detection
    if (text.includes('bim birleşik mağazalar') || text.includes('ettn') ||
        text.includes('ödenecek kdv dahil tutar') || /b[iİ]m/i.test(merchantName)) {
      return 'BİM';
    }
    
    // CarrefourSA detection
    if (text.includes('carrefoursa') || text.includes('carrefour') || 
        /carrefour/i.test(merchantName)) {
      return 'CarrefourSA';
    }
    
    return formatDetection.format !== 'Unknown' ? 
      (formatDetection.format === 'BIM' ? 'BİM' : formatDetection.format) : 
      merchantName;
  })();
  
  // Enhanced address extraction with Migros-specific cleaning
  let addressFull = '';
  let addressParsed = {};
  
  if (merchantDisplay === 'Migros') {
    // Enhanced address extraction - remove phone numbers and noise
    const merkez_pattern = /MERKEZ\s*ADRESİ[:]\s*([^]+?)(?:TEL:|İSTANBUL\s*TEL:|SARIYER.*TEL:|$)/i;
    const merkez_match = normalizedText.match(merkez_pattern);
    
    if (merkez_match) {
      addressFull = merkez_match[1]
        .replace(/\s*TEL.*$/gmi, '') // Remove all phone lines
        .replace(/\d{4}\s*\d{3}\s*\d{2}\s*\d{2}/g, '') // Remove phone patterns
        .replace(/0\(\d{3}\)\s*\d{3}\s*\d{2}\s*\d{2}/g, '') // Remove (850) format phones
        .replace(/\s*İSTANBUL\s*$/, '/İSTANBUL') // Proper city format
        .replace(/\s+/g, ' ') // Normalize spaces
        .trim();
    } else {
      // Fallback for address detection
      const addressLines = lines.filter(line => 
        line.match(/atatürk|turgut|özal|bulv|mah|cad|sok|no:/i) && 
        !line.match(/migros|tel:|phone/i)
      );
      addressFull = addressLines.join(' ').replace(/\d{4}\s*\d{3}/g, '').trim();
    }
  } else {
    // General address extraction for other formats
    const addressLines = lines.filter(line => 
      line.match(/mah|cad|sok|bulv|tel|adres/i) && 
      !line.match(/migros|bim|carrefour/i)
    );
    addressFull = addressLines.join(' ');
  }
  
  addressParsed = parseAddress(addressFull);
  
  // Enhanced date/time extraction with Turkish format priority
  let receiptDate: string | null = null;
  let receiptTime: string | null = null;

  // Migros-specific date/time extraction
  if (merchantDisplay === 'Migros') {
    // Look for "TARİH:" pattern specifically
    const dateMatch = normalizedText.match(/TARİH[.:\s]*(\d{2}\/\d{2}\/\d{4})/i);
    if (dateMatch) {
      const [day, month, year] = dateMatch[1].split('/');
      receiptDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    // Look for "SAAT:" pattern specifically with full HH:MM capture
    const timeMatch = normalizedText.match(/SAAT[.:\s]*([01]?\d|2[0-3]):([0-5]\d)/i);
    if (timeMatch) {
      receiptTime = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
    }
  }

  // CarrefourSA format handling (existing logic)
  if (formatDetection.format === 'CarrefourSA' && !receiptDate) {
    const alphaLines = lines.map(l => alphaNormalize(l));
    const idxDate = alphaLines.findIndex(l => /\btari[h]?\b/i.test(l));
    if (idxDate !== -1) {
      receiptDate = extractDate(lines[idxDate]) || extractDate(lines[idxDate + 1] || '') || null;
      const relativeSaatIdx = alphaLines.slice(idxDate, idxDate + 4).findIndex(l => /\bsaat\b/i.test(l));
      if (relativeSaatIdx !== -1) {
        const saatIdx = idxDate + relativeSaatIdx;
        receiptTime = extractTime(lines[saatIdx]) || extractTime(lines[saatIdx + 1] || '') || null;
      } else {
        receiptTime = extractTime(lines[idxDate]) || extractTime(lines[idxDate + 1] || '') || extractTime(lines[idxDate + 2] || '') || null;
      }
    }
  }

  // Global fallbacks if still missing
  if (!receiptDate) {
    const dateText = lines.find(line => /tarih|date/i.test(line)) || normalizedText;
    receiptDate = extractDate(dateText);
  }
  if (!receiptTime) {
    const timeText = lines.find(line => /saat|time/i.test(line)) || normalizedText;
    receiptTime = extractTime(timeText);
  }
  
  // Enhanced receipt number extraction with Migros pattern
  let receiptNo: string | null = null;
  
  if (merchantDisplay === 'Migros') {
    // Look for "FİŞ NO:" pattern specifically
    const migrosFisMatch = normalizedText.match(/FİŞ\s*NO\s*[:\-]?\s*([0-9A-Za-z]+)/i);
    if (migrosFisMatch) {
      receiptNo = migrosFisMatch[1];
    }
  }
  
  // Fallback to general pattern
  if (!receiptNo) {
    const receiptNoMatch = normalizedText.match(/(?:fiş|fis|no|belge)\s*[:=]?\s*([a-z0-9\-\/]{4,})/i);
    receiptNo = receiptNoMatch ? receiptNoMatch[1] : null;
  }
  
  // Enhanced card number extraction with better patterns
  const cardPatterns = [
    /\b(\d{4}\*{2,}\d{4})\b/g,           // 1234**1234
    /\b(\d{6}\*{6}\d{4})\b/g,            // 123456******1234
    /\b(?:(\d[\s*xX•]{0,}){12}\d{4})\b/g // 1234 **** **** 1234
  ];
  
  let cardMasked: string | null = null;
  for (const pattern of cardPatterns) {
    const matches = [...normalizedText.matchAll(pattern)];
    if (matches.length > 0) {
      const cardNumber = matches[0][0];
      cardMasked = maskCardNumber(cardNumber);
      if (cardMasked) break;
    }
  }
  
  // Enhanced payment method extraction with Turkish bank detection
  let paymentMethod: string | null = null;
  const paymentPatterns = [
    /(?:YAPI|AKBANK|GARANTİ|BBVA|ZİRAAT|İŞ BANKASI|VAKIF|HALK)/i,
    /(?:ORTAK POS|WORLDCARD|MasterCard|VISA)/i,
    /(?:KREDİ KARTI|NAKIT|HAVALE)/i
  ];
  
  for (const pattern of paymentPatterns) {
    const match = normalizedText.match(pattern);
    if (match) {
      paymentMethod = match[0];
      break;
    }
  }
  
  // Parse items using format-specific logic
  const items = parseItems(lines, merchantDisplay);
  const discounts = parseDiscounts(lines, merchantDisplay);
  const totals = extractTotals(normalizedText, merchantDisplay);
  
  // Enhanced computed totals and reconciliation
  const computed = calculateComputedTotals(items, discounts, totals);
  
  // Enhanced confidence scoring
  let confidence = 0.0;
  if (receiptDate && receiptTime) confidence += 0.15;
  if (totals.grand_total) confidence += 0.2;
  if (computed.reconciles) confidence += 0.2;
  if (items.length >= 3) confidence += 0.15;
  if (merchantDisplay === 'Migros' && formatDetection.confidence > 0.5) confidence += 0.1;
  if (cardMasked) confidence += 0.2;
  
  confidence = Math.min(1.0, confidence);
  
  // Enhanced warnings
  if (items.length === 0) warnings.push('NO_ITEMS_FOUND');
  if (!totals.grand_total) warnings.push('TOTAL_MISSING');
  if (!computed.reconciles) warnings.push('ITEMS_MISMATCH');
  if (!cardMasked && paymentMethod) warnings.push('CARD_MISSING');
  
  // Format specific validation warnings
  if (merchantDisplay === 'Migros') {
    if (!receiptTime || !receiptTime.includes(':')) warnings.push('TIME_FORMAT_ISSUE');
    if (addressFull.includes('TEL:')) warnings.push('ADDRESS_CONTAINS_PHONE');
    
    // Log debug information for Migros
    console.log(`Migros parsing results: items=${items.length}, discounts=${discounts.length}, grand_total=${totals.grand_total}`);
  }
  
  // Build final response matching expected schema
  return {
    merchant_raw: merchantName,
    merchant_brand: merchantDisplay,
    purchase_date: receiptDate,
    purchase_time: receiptTime,
    store_address: addressFull,
    total: totals.grand_total || 0,
    items: items.map(item => ({
      name: item.name,
      qty: item.qty,
      unit_price: item.unit_price,
      line_total: item.line_total,
      raw_line: item.raw_line,
      product_code: item.product_code
    })),
    payment_method: paymentMethod,
    receipt_unique_no: receiptNo,
    fis_no: receiptNo, // Alias for compatibility
    barcode_numbers: [], // TODO: extract barcodes if present
    raw_text: rawText,
    
    // Enhanced metadata
    format_detected: merchantDisplay,
    confidence: confidence,
    warnings: warnings,
    discounts: discounts,
    totals: {
      subtotal: totals.subtotal,
      vat_total: totals.vat_total,
      grand_total: totals.grand_total
    },
    computed_totals: computed,
    address_parsed: addressParsed,
    masked_card: cardMasked
  };
}

// ============= MAIN SERVER HANDLER =============

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }), 
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
  
  try {
    const { imageUrl } = await req.json();
    
    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing imageUrl parameter' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    console.log(`Processing OCR for image: ${imageUrl}`);
    
    // Process OCR
    const rawText = await processOCR(imageUrl);
    console.log(`OCR completed, raw text length: ${rawText.length}`);
    
    // Parse the OCR text
    const parsedData = parseReceiptText(rawText);
    console.log(`Parsing completed, confidence: ${parsedData.confidence.toFixed(2)}`);
    
    return new Response(
      JSON.stringify(parsedData), 
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
    
  } catch (error) {
    console.error('OCR function error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'OCR processing failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
