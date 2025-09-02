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

// ---------- utils ----------
const TR = 'çğıöşüÇĞİÖŞÜ';
const PRICE = '(\\d{1,3}(?:[.,]\\d{3})*[.,]\\d{2})';
const MONEY = new RegExp(`${PRICE}(?:\\s*TL)?\\s*$`);
const HAS_PRICE = MONEY; // satır sonunda fiyat
const FORBID =
  /(BİLGİ FİŞİ|BILGI FISI|TÜR:|TUR:|E-ARŞİV|E-ARSIV|MERS[İI]S|KAS[İI]YER|ORTAK POS|SAT[İI]Ş|SATIS|TOPKDV|KDV TUTAR[Iİ]|GENEL TOPLAM|TOPLAM TUTAR|REF NO|F[İI]Ş NO|FIS NO)/i;
const DISCOUNT_RX =
  /(TUTAR\s*İND|TUTAR\s*IND|KOCA[İI]LEM|(?<!İND)İND[İI]R[İI]M(?!LER)|(?<!IND)INDIRIM(?!LER))/i;
const DOC_CODE = /^#\s*\d{10,}/;
const WEIGHT =
  new RegExp(String.raw`(?:(?<name>[A-Z0-9 ${TR}\.\-\/]+?)\s+)?(?<qty>\d+[.,]\d+)\s*KG.*?=\s*(?<price>${PRICE})\s*$`, 'i');

const toNum = (s?: string) =>
  s ? Number(s.replace(/\./g, '').replace(',', '.')) : 0;
const round2 = (n: number) => Math.round(n * 100) / 100;

const clean = (s: string) =>
  s.replace(/\s{2,}/g, ' ').replace(/\s*[-–—=]+$/,'').trim();

// ---------- V4 MIGROS PARSER ----------
function parseMigrosV4(lines: string[]) {
  const items: Array<{ name: string; quantity?: string; line_total: number }> = [];
  const discounts: Array<{ label: string; amount: number }> = [];

  let inBody = false;

  for (let raw of lines) {
    let line = (raw || '').trim();
    if (!line) continue;

    if (DOC_CODE.test(line)) { inBody = true; continue; }
    if (!inBody && /TAR[İI]H|B[İI]LG[İI]\s*F[İI]Ş[İI]/i.test(line)) inBody = true;

    // ödeme/özet bölgesine geldiysek ürün taramasını bitir
    if (/^(?:GENEL\s+)?TOPLAM|SATI[ŞS]/i.test(line)) break;

    // -------- İndirim(ürün değil) --------
    if (DISCOUNT_RX.test(line)) {
      const m = line.match(MONEY);
      if (m) discounts.push({ label: clean(line), amount: -Math.abs(toNum(m[1])) });
      continue;
    }

    // başlık/duyuru; fakat fiyat da yoksa at
    if (FORBID.test(line) && !HAS_PRICE.test(line)) continue;

    // -------- Tartılı ürün --------
    const w = line.match(WEIGHT);
    if (w?.groups?.price) {
      items.push({
        name: clean(w.groups.name || line.replace(WEIGHT, '').trim() || 'Tartılı Ürün'),
        quantity: `${(w.groups.qty || '').replace('.', ',')} kg`,
        line_total: toNum(w.groups.price),
      });
      continue;
    }

    // -------- Klasik ürün: adı + (opsiyonel x<qty>) + fiyata biter --------
    if (HAS_PRICE.test(line) && !DISCOUNT_RX.test(line)) {
      const price = toNum(line.match(MONEY)![1]);
      const name = clean(
        line
          .replace(MONEY, '')            // sondaki fiyatı at
          .replace(/\s*x[\d.,]+\s*$/i,'')// sondaki x<qty> varsa at
      );
      // hiç bir koşulda "*" veya 2 harften kısa metin ekleme
      if (name.replace(/[^A-Za-z0-9${TR}]/g,'').length >= 3 && !FORBID.test(name)) {
        items.push({ name, line_total: price });
      }
    }
  }

  // ----- totals -----
  const items_sum = round2(items.reduce((a, i) => a + i.line_total, 0));
  const discount_total = round2(discounts.reduce((a, d) => a + d.amount, 0));

  // satış/çekilen tutarı (varsa) oku
  const text = lines.join('\n');
  const sale = text.match(new RegExp(`SATI[ŞS]\\s+(${PRICE})\\s*TL?`, 'i'))?.[1];
  const topl = text.match(new RegExp(`^(?:GENEL\\s+)?TOPLAM(?:\\s+TUTAR)?\\s+(${PRICE})`, 'im'))?.[1];

  let grand_total = sale ? toNum(sale) : (topl ? toNum(topl) : round2(items_sum + discount_total));
  const computed = round2(items_sum + discount_total);
  if (Math.abs(grand_total - computed) <= 0.05) grand_total = computed;

  return { items, discounts, items_sum, discount_total, grand_total };
}

// ---------- Legacy Fallback (basit & tutucu) ----------
function parseMigrosLegacyFallback(lines: string[]) {
  const items: any[] = [];
  const discounts: any[] = [];
  let inBody = false;

  for (let raw of lines) {
    let line = (raw || '').trim();
    if (!line) continue;

    if (DOC_CODE.test(line)) { inBody = true; continue; }
    if (!inBody && /TAR[İI]H|B[İI]LG[İI]\s*F[İİ]Ş[İI]/i.test(line)) inBody = true;
    if (/^(?:GENEL\s+)?TOPLAM|SATI[ŞS]/i.test(line)) break;

    if (DISCOUNT_RX.test(line)) {
      const m = line.match(MONEY);
      if (m) discounts.push({ label: clean(line), amount: -Math.abs(toNum(m[1])) });
      continue;
    }

    if (HAS_PRICE.test(line) && !FORBID.test(line)) {
      const price = toNum(line.match(MONEY)![1]);
      const name = clean(line.replace(MONEY, ''));
      if (name.replace(/[^A-Za-z0-9${TR}]/g,'').length >= 3) {
        items.push({ name, line_total: price });
      }
    }
  }

  const items_sum = round2(items.reduce((a, i) => a + i.line_total, 0));
  const discount_total = round2(discounts.reduce((a, d) => a + d.amount, 0));
  const computed = round2(items_sum + discount_total);
  return { items, discounts, items_sum, discount_total, grand_total: computed };
}

// ---------- Kart (PAN) tespiti: her zaman son 4; "ORTAK POS" asla dönme ----------
function extractCardLast4(lines: string[]) {
  // ör: 52820******6309 , 494314******4645
  for (const raw of lines) {
    const line = (raw || '').trim();
    const m = line.match(/\b\d{4,6}\*{4,}\d{4}\b/);
    if (m) return m[0].slice(-4);
  }
  return null;
}

// ---------- Ana akışta Migros için kullan ----------
function parseMigrosSafely(lines: string[]) {
  const v4 = parseMigrosV4(lines);
  const validV4 = (v4.items?.length ?? 0) > 0 && isFinite(v4.grand_total ?? NaN);
  const use = validV4 ? v4 : parseMigrosLegacyFallback(lines);
  
  // Validations
  if (!validV4) {
    console.log("[MIGROS] fallback engaged");
  }
  
  if (use.discount_total > 0) {
    console.log("[MIGROS] Warning: discount_total should be <= 0, got:", use.discount_total);
  }
  
  const totalDiff = Math.abs(use.grand_total - (use.items_sum + use.discount_total));
  if (totalDiff > 0.05) {
    console.log("[MIGROS] Warning: total calculation mismatch:", totalDiff);
  }
  
  // kart son4
  const card_last4 = extractCardLast4(lines);
  
  // Saat HH:MM (SAAT:14:06) yoksa sadece saat varsa :00 ekle
  let timeFormatted: string | null = null;
  for (const line of lines) {
    const m1 = line.match(/SAAT\s*[:.;\s]*([01]?\d|2[0-3]):([0-5]\d)/i);
    if (m1) { timeFormatted = `${String(Number(m1[1])).padStart(2, '0')}:${m1[2]}`; break; }
    const m2 = line.match(/SAAT\s*[:.;\s]*([01]?\d|2[0-3])\b/i);
    if (m2) { timeFormatted = `${String(Number(m2[1])).padStart(2, '0')}:00`; }
  }

  // Adres temizleme (TEL: çıkar)
  let addressClean = '';
  for (const line of lines) {
    if (/MERKEZ\s*ADRESİ:/i.test(line)) {
      addressClean = line
        .replace(/.*MERKEZ\s*ADRESİ:\s*/i, '')
        .replace(/\s*TEL.*$/i, '')
        .replace(/0\(\d{3}\)\s*\d{3}\s*\d{2}\s*\d{2}/, '')
        .trim();
      break;
    }
  }
  
  return { 
    ...use, 
    card_last4,
    time: timeFormatted,
    store_address: addressClean,
    warnings: use.items.length === 0 ? ['NO_PRODUCTS_FOUND'] : []
  };
}

/**
 * Parse items from receipt lines based on format - Legacy function for non-Migros formats
 */
function parseItems(lines: string[], format: string): any[] {
  // Migros now uses parseMigrosSafely directly in parseReceiptText
  if (format === 'Migros') {
    throw new Error('Migros parsing should use parseMigrosSafely, not parseItems');
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
  // For Migros, should use parseMigrosSafely directly in parseReceiptText
  if (format === 'Migros') {
    throw new Error('Migros discounts should be parsed via parseMigrosSafely, not parseDiscounts');
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

  // For Migros, should use parseMigrosSafely directly in parseReceiptText
  if (format === 'Migros') {
    throw new Error('Migros totals should be extracted via parseMigrosSafely, not extractTotals');
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

  // If discounts are negative (Migros), add; if positive (others), subtract
  const hasNegative = discounts.some((d) => (d.amount || 0) < 0);
  const expectedTotal = hasNegative ? (itemsSum + discountsSum) : (itemsSum - discountsSum);
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
  let items, discounts, totals;
  
  if (merchantDisplay === 'Migros') {
    // Use the new failsafe Migros parser
    const migrosResult = parseMigrosSafely(lines);
    items = migrosResult.items.map((item: any) => ({
      name: item.name,
      qty: item.quantity === 'x1' ? 1 : item.quantity,
      unit_price: item.line_total, // For single items, unit_price equals line_total
      line_total: item.line_total,
      raw_line: `${item.name} ${item.quantity || ''} ${item.line_total}`,
      product_code: null
    }));
    discounts = migrosResult.discounts.map((disc: any) => ({
      description: disc.label,
      amount: disc.amount // already negative
    }));
    totals = {
      subtotal: null,
      vat_total: null,
      grand_total: migrosResult.grand_total
    };
    
    // Update address and time from parseMigrosSafely
    if (migrosResult.store_address) {
      addressFull = migrosResult.store_address;
      addressParsed = parseAddress(addressFull);
    }
    if (migrosResult.time) {
      receiptTime = migrosResult.time;
    }
    if (migrosResult.card_last4) {
      cardMasked = `****${migrosResult.card_last4}`;
    }
  } else {
    // Use existing logic for other formats
    items = parseItems(lines, merchantDisplay);
    discounts = parseDiscounts(lines, merchantDisplay);
    totals = extractTotals(normalizedText, merchantDisplay);
  }
  
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
