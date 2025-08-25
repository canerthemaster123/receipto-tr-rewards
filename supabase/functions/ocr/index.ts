import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

// Get Supabase client for analytics operations
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// CORS configuration with allowlist from environment
const getAllowedOrigins = () => {
  const allowedOriginsEnv = Deno.env.get('ALLOWED_ORIGINS');
  if (allowedOriginsEnv) {
    return allowedOriginsEnv.split(',').map(origin => origin.trim());
  }
  // Default fallback for development
  return [
    'https://receipto-tr-rewards.lovable.app',
    'https://loving-warmth-production.lovable.app', 
    'https://id-preview--90fb07b9-7b58-43af-8664-049e890948e4.lovable.app',
    'http://localhost:5173',
    'http://localhost:3000'
  ];
};

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? '';
  const allowedOrigins = getAllowedOrigins();
  const isAllowed = allowedOrigins.includes(origin);
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : allowedOrigins[0],
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin'
  };
}

interface OCRResult {
  merchant_raw: string;
  merchant_brand: string;
  purchase_date: string;
  purchase_time: string | null;
  store_address: string | null;
  total: number;
  items: {
    name: string;
    qty?: number;
    unit_price?: number;
    line_total?: number;
    raw_line: string;
    product_code?: string;
  }[];
  payment_method: string | null;
  receipt_unique_no: string | null;
  fis_no: string | null;
  barcode_numbers: string[];
  raw_text: string;
}

/**
 * Normalize merchant to chain group using local patterns
 */
function normalizeMerchantLocal(merchantRaw: string): string {
  if (!merchantRaw || typeof merchantRaw !== 'string') {
    return 'Unknown';
  }

  const merchant = merchantRaw.trim().toLowerCase();

  // Migros patterns
  if (merchant.includes('migros')) {
    return 'Migros';
  }

  // A101 patterns  
  if (merchant.includes('a101') || merchant.includes('a-101')) {
    return 'A101';
  }

  // BIM patterns
  if (merchant.includes('bim') || merchant.includes('bİm')) {
    return 'BIM';
  }

  // SOK patterns
  if (merchant.includes('sok') || merchant.includes('şok')) {
    return 'SOK';
  }

  // CarrefourSA patterns
  if (merchant.includes('carrefour')) {
    return 'CarrefourSA';
  }

  // Return original if no match
  return merchantRaw.trim();
}

/**
 * Normalize merchant brand (fuzzy) — show brand only
 */
function normalizeBrand(merchantRaw: string): string {
  if (!merchantRaw || typeof merchantRaw !== 'string') {
    return '';
  }

  let normalized = merchantRaw.toLowerCase();

  // Replace Turkish characters with base equivalents
  const turkishCharMap: Record<string, string> = {
    'İ': 'i', 'ı': 'i', 'I': 'i',
    'Ğ': 'g', 'ğ': 'g',
    'Ş': 's', 'ş': 's', 
    'Ç': 'c', 'ç': 'c',
    'Ö': 'o', 'ö': 'o',
    'Ü': 'u', 'ü': 'u'
  };
  
  Object.entries(turkishCharMap).forEach(([turkish, base]) => {
    normalized = normalized.replace(new RegExp(turkish, 'g'), base);
  });

  // Remove spaces and punctuation
  normalized = normalized.replace(/[\s\.\-_,;:!@#$%^&*()+={}|\[\]\\\/?"'<>~`]/g, '');

  // Strip company suffix words
  const suffixesToRemove = [
    'ticaret', 'as', 'ase', 'ltd', 'sti', 'sanayi', 've', 'vb',
    'gida', 'market', 'magazasi', 'perakende', 'satis'
  ];
  
  suffixesToRemove.forEach(suffix => {
    normalized = normalized.replace(new RegExp(`\\b${suffix}\\b`, 'g'), '');
  });

  // Brand dictionary with common variants and broken OCR forms
  const brandDictionary: Record<string, string> = {
    // Migros variants
    'migros': 'Migros',
    'mgros': 'Migros', 
    'mıgros': 'Migros',
    'mıgr0s': 'Migros',
    
    // BİM variants  
    'bim': 'BİM',
    'b1m': 'BİM',
    'bım': 'BİM',
    
    // A101 variants
    'a101': 'A101',
    'a1o1': 'A101',
    'a10l': 'A101',
    
    // ŞOK variants
    'sok': 'ŞOK',
    'şok': 'ŞOK',
    's0k': 'ŞOK',
    
    // CarrefourSA variants
    'carrefour': 'CarrefourSA',
    'carrefoursa': 'CarrefourSA',
    'carref0ur': 'CarrefourSA',
    
    // Other major chains
    'metro': 'Metro',
    'macr0': 'Macro',
    'macro': 'Macro',
    'real': 'Real',
    'teknosa': 'Teknosa',
    'vatan': 'Vatan',
    'mediamarkt': 'MediaMarkt'
  };

  // Direct match
  if (brandDictionary[normalized]) {
    return brandDictionary[normalized];
  }

  // Fuzzy matching for broken OCR (simple includes)
  for (const [key, brand] of Object.entries(brandDictionary)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return brand;
    }
  }

  // Levenshtein distance ≤2 fallback (simplified version)
  for (const [key, brand] of Object.entries(brandDictionary)) {
    if (Math.abs(normalized.length - key.length) <= 2) {
      let distance = 0;
      const maxLen = Math.max(normalized.length, key.length);
      for (let i = 0; i < maxLen; i++) {
        if (normalized[i] !== key[i]) distance++;
      }
      if (distance <= 2) {
        return brand;
      }
    }
  }

  // Fallback: return cleaned version of original
  return merchantRaw.trim();
}

// Parsing helpers
function extractMerchant(text: string): string {
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  
  // Look for common Turkish store names in the text
  const storePatterns = [
    { pattern: /MİGROS|MIGROS/i, name: 'Migros' },
    { pattern: /BİM/i, name: 'BİM' },
    { pattern: /A101/i, name: 'A101' },
    { pattern: /ŞOK/i, name: 'ŞOK' },
    { pattern: /CARREFOUR/i, name: 'CarrefourSA' },
    { pattern: /TEKNOSA/i, name: 'Teknosa' },
    { pattern: /REAL/i, name: 'Real' },
    { pattern: /METRO/i, name: 'Metro' }
  ];
  
  // Check entire text for store patterns
  for (const store of storePatterns) {
    if (store.pattern.test(text)) {
      return store.name;
    }
  }
  
  // Look for company indicators in lines
  for (const line of lines) {
    if ((line.includes('A.Ş.') || line.includes('A.S.') || line.includes('LTD') || line.includes('ŞTİ')) 
        && line.length > 5 && line.length < 50) {
      return line.trim();
    }
  }
  
  // Look for lines that might contain store name (avoid receipt header junk)
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const line = lines[i].trim();
    
    // Skip obvious non-store lines
    if (line.match(/^\d+$/) || line.includes('TEL:') || line.includes('THIS') || 
        line.includes('GRIZON') || line.length < 3 || line.length > 50) {
      continue;
    }
    
    // If it contains letters and is substantial, might be store name
    if (line.match(/[A-Za-zÇĞİÖŞÜçğıöşü]/) && line.length > 3) {
      return line;
    }
  }
  
  return lines[0]?.trim() || '';
}

// Extract purchase time from receipt text
function extractPurchaseTime(text: string): string | null {
  const lines = text.split('\n');
  
  for (const line of lines) {
    const cleanLine = line.trim();
    
    // Look for SAAT, Saat, TIME keywords
    if (/\b(SAAT|Saat|TIME)\b/i.test(cleanLine)) {
      const timeMatch = cleanLine.match(/\b([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?\b/);
      if (timeMatch) {
        return timeMatch[0];
      }
    }
    
    // Look for standalone time patterns
    const timeMatch = cleanLine.match(/\b([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?\b/);
    if (timeMatch) {
      // Make sure it's not part of a date (avoid matching dates like 12:34 in 12/34/2023)
      const beforeMatch = cleanLine.substring(0, timeMatch.index);
      const afterMatch = cleanLine.substring((timeMatch.index || 0) + timeMatch[0].length);
      
      // Skip if it looks like part of a date
      if (!/\d/.test(beforeMatch.slice(-1)) && !/^\d/.test(afterMatch)) {
        return timeMatch[0];
      }
    }
  }
  
  return null;
}

// Extract store address from receipt header
function extractStoreAddress(text: string): string | null {
  const lines = text.split('\n');
  const headerLines = lines.slice(0, 15); // Look at more lines for address
  
  for (const line of headerLines) {
    const cleanLine = line.trim();
    
    // Skip empty lines or very short lines
    if (!cleanLine || cleanLine.length < 10) continue;
    
    // Skip merchant names and metadata
    if (/^(CARREFOUR|MİGROS|MIGROS|BİM|A101|ŞOK|SABANCI|TIC|MRK|A\.?S\.?|Ş\.?T\.?İ\.?)/i.test(cleanLine)) continue;
    if (/^(TEL|TELEFON|VERGİ|MERSIS|TARIH|SAAT|FİŞ)/i.test(cleanLine)) continue;
    
    // Look for definitive address indicators
    if (/\b(Cad\.|Caddesi|Mah\.|Mahallesi|Sk\.|Sokak|No\s*[:.]?\s*\d|Bulv\.|Bulvarı)\b/i.test(cleanLine)) {
      console.log(`Found address with street indicator: ${cleanLine}`);
      return cleanLine;
    }
    
    // Look for Turkish city names
    if (/\b(İSTANBUL|ANKARA|İZMİR|BURSA|ANTALYA|ADANA|KONYA|GAZİANTEP|MERSİN|KAYSERİ|ESKİŞEHİR|AYAZAĞA|ATAŞEHİR|BEŞIKTAŞ|BEYOĞLU|KADIKÖY|ÜSKÜDAR)/i.test(cleanLine)) {
      // Make sure it's a proper address line, not just containing city name
      if (cleanLine.split(/\s+/).length >= 3) {
        console.log(`Found address with city name: ${cleanLine}`);
        return cleanLine;
      }
    }
    
    // Look for postal codes (5 digits)
    if (/\b\d{5}\b/.test(cleanLine) && cleanLine.split(/\s+/).length >= 3) {
      console.log(`Found address with postal code: ${cleanLine}`);
      return cleanLine;
    }
    
    // Look for lines with "Cumhuriyet", "Demokrasi" type street names
    if (/\b(Cumhuriyet|Demokrasi|Huzur|Atatürk|Gazi|Millet)\b/i.test(cleanLine) && cleanLine.split(/\s+/).length >= 4) {
      console.log(`Found address with common street name: ${cleanLine}`);
      return cleanLine;
    }
  }
  
  console.log('No store address found');
  return null;
}

function extractDate(text: string): string {
  // Look for Turkish date patterns first
  const datePatterns = [
    /TARİH\s*:\s*(\d{2}\/\d{2}\/\d{4})/i,
    /TARİH\s*:\s*(\d{2}\.\d{2}\.\d{4})/i,
    /(\d{2}\/\d{2}\/\d{4})/,
    /(\d{2}\.\d{2}\.\d{4})/,
    /(\d{4}-\d{2}-\d{2})/
  ];
  
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      let dateStr = match[1] || match[0];
      
      // Convert to YYYY-MM-DD format
      if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
          // DD/MM/YYYY to YYYY-MM-DD
          if (parts[2].length === 4) {
            return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        }
      } else if (dateStr.includes('.')) {
        const parts = dateStr.split('.');
        if (parts.length === 3) {
          // DD.MM.YYYY to YYYY-MM-DD
          if (parts[2].length === 4) {
            return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        }
      } else if (dateStr.includes('-')) {
        // Already in YYYY-MM-DD format
        return dateStr;
      }
    }
  }
  
  // Fallback to today's date
  return new Date().toISOString().split('T')[0];
}

function extractTotal(text: string): number {
  console.log('Extracting total from text');

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Helper to parse numbers with comma or dot
  const parseAmount = (s: string): number | null => {
    const m = s.match(/(\d{1,3}(?:[\.,]\d{3})*[\.,]\d{2}|\d+[\.,]\d{2})/);
    if (!m) return null;
    const norm = m[1].replace(/\./g, '').replace(',', '.');
    const n = parseFloat(norm);
    return isNaN(n) ? null : n;
  };

  // PRIORITY 1: Find exact "TOPLAM" keyword (NOT TOPKDV) and number on same line or adjacent line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Must contain TOPLAM but NOT TOPKDV, ARA TOPLAM, or other compound forms
    if (/\bTOPLAM\b/i.test(line) && !/TOPKDV|ARA\s*TOPLAM|GENEL\s*TOPLAM|KDV.*TOPLAM|TOPLAM.*KDV/i.test(line)) {
      console.log(`Found TOPLAM line: "${line}"`);
      
      // First check same line for amount
      const sameLineAmount = parseAmount(line);
      if (sameLineAmount) {
        console.log(`Found total on same line as TOPLAM: ${sameLineAmount}`);
        return sameLineAmount;
      }
      
      // Check next 3 lines for amount
      for (let j = i + 1; j <= Math.min(i + 3, lines.length - 1); j++) {
        const nextAmount = parseAmount(lines[j]);
        if (nextAmount) {
          console.log(`Found total ${j - i} lines after TOPLAM: ${nextAmount}`);
          return nextAmount;
        }
      }
    }
  }

  // PRIORITY 2: KDV'Lİ TOPLAM and similar compound keywords
  const compoundKeywords = [
    /k?dv[''`\s-]*li\s*toplam/i,
    /genel\s*toplam/i,
    /toplam\s*tutar/i,
  ];

  for (const keyword of compoundKeywords) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (keyword.test(line)) {
        console.log(`Found compound keyword line: "${line}"`);
        
        const sameLineAmount = parseAmount(line);
        if (sameLineAmount) {
          console.log(`Found total with compound keyword: ${sameLineAmount}`);
          return sameLineAmount;
        }
        
        for (let j = i + 1; j <= Math.min(i + 3, lines.length - 1); j++) {
          const nextAmount = parseAmount(lines[j]);
          if (nextAmount) {
            console.log(`Found total after compound keyword: ${nextAmount}`);
            return nextAmount;
          }
        }
      }
    }
  }

  // PRIORITY 3: Payment section with card numbers
  const isMaskedCard = (s: string) => /(\d{4,6}\*{4,6}\d{2,4})/.test(s.replace(/\s+/g, ''));
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/ortak\s*pos|\bpos\b/i.test(line) || isMaskedCard(line)) {
      console.log(`Found payment section line: "${line}"`);
      
      for (let j = Math.max(0, i - 2); j <= Math.min(i + 3, lines.length - 1); j++) {
        const amt = parseAmount(lines[j]);
        if (amt) {
          console.log(`Found total in payment section: ${amt}`);
          return amt;
        }
      }
    }
  }

  // PRIORITY 4: Bottom area fallback - largest reasonable amount
  console.log('Using bottom area fallback');
  const bottomStart = Math.max(0, lines.length - 20);
  let maxAmount = 0;
  
  for (let i = bottomStart; i < lines.length; i++) {
    const amt = parseAmount(lines[i]);
    if (amt && amt > maxAmount && amt < 100000) {
      maxAmount = amt;
    }
  }

  if (maxAmount > 0) {
    console.log(`Bottom area fallback total: ${maxAmount}`);
    return maxAmount;
  }

  console.log('No total found, returning 0');
  return 0;
}

/**
 * Check if a line is a discount/markdown line that should be excluded
 */
function isDiscountLine(line: string): boolean {
  // Normalize the line for checking
  let normalized = line.toLowerCase().trim();
  
  // Replace Turkish characters with base equivalents
  const turkishCharMap: Record<string, string> = {
    'İ': 'i', 'ı': 'i', 'I': 'i',
    'Ğ': 'g', 'ğ': 'g',
    'Ş': 's', 'ş': 's', 
    'Ç': 'c', 'ç': 'c',
    'Ö': 'o', 'ö': 'o',
    'Ü': 'u', 'ü': 'u'
  };
  
  Object.entries(turkishCharMap).forEach(([turkish, base]) => {
    normalized = normalized.replace(new RegExp(turkish, 'g'), base);
  });
  
  // Remove punctuation for pattern matching
  const cleanLine = normalized.replace(/[^\w\s]/g, '');
  
  // Discount patterns to match (case-insensitive Turkish/ASCII variants)
  const discountPatterns = [
    /\bindirim\b/,
    /\bind\b/,
    /\bindt?\b/,
    /\bkampanya\s*indirimi?\b/,
    /\btoplam\s*indirim\b/,
    /\bpromosyon\b/,
    /\btutar\s*ind\b/,
    /\bind\s*tutar\b/,
    /\bindirim\s*tutari?\b/
  ];
  
  return discountPatterns.some(pattern => pattern.test(cleanLine));
}

function parseItems(text: string): {
  name: string;
  qty?: number;
  unit_price?: number;
  line_total?: number;
  raw_line: string;
  product_code?: string;
}[] {
  console.log('Parsing items with comprehensive logic for Turkish receipts');

  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const items: Array<{
    name: string;
    qty?: number;
    unit_price?: number;
    line_total?: number;
    raw_line: string;
    product_code?: string;
  }> = [];

  // Utility helpers
  const hasLetters = (s: string) => /[A-Za-zÇĞİÖŞÜçğıöşü]/.test(s);
  const isPercentOnly = (s: string) => /^%\d+/.test(s.replace(/\s+/g, ''));
  const isMeta = (s: string) => (
    /MERSİS|MERSIS|VD\.|VERGİ|VERGI|TEL:|SAAT|KASİYER|KASIYER|REF\s*NO|ONAY\s*KODU|TERMINAL|EKÜ|EKU|https?:\/\//i.test(s) ||
    /İşyeri\s*ID|Isyeri\s*ID|İŞYERİ\s*ID|MF\s*TV|Z\s*NO|EKÜ\s*NO|IMZA|İMZA|IRSALIYE|IRSALİYE/i.test(s)
  );
  const isSectionMarker = (s: string) => /^(ARA\s+)?TOPLAM|TOPKDV|GENEL\s+TOPLAM|KDV\b/i.test(s);
  const maskedCard = (s: string) => /(\d{4,6}\*{4,6}\d{2,4})/.test(s.replace(/\s+/g, ''));

  // Determine product section: from after header to before totals
  let start = -1, end = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/TAR[İI]H|F[İI]Ş\s*NO/i.test(lines[i])) {
      // find the first plausible item a few lines later
      for (let j = i + 1; j < Math.min(i + 30, lines.length); j++) {
        const L = lines[j];
        if (isMeta(L) || maskedCard(L) || isSectionMarker(L) || isPercentOnly(L)) continue;
        if (hasLetters(L) && !/^#[0-9]+$/.test(L)) { start = j; break; }
      }
      if (start !== -1) break;
    }
  }
  if (start === -1) start = 0; // fallback

  for (let i = start; i < lines.length; i++) {
    if (isSectionMarker(lines[i]) || /ORTAK\s*POS|\bPOS\b/i.test(lines[i]) || maskedCard(lines[i])) { end = i; break; }
  }
  if (end === -1) end = Math.min(lines.length, start + 60);

  console.log(`Product section: lines ${start} to ${end}`);

  // Walk through product section
  for (let i = start; i < end; i++) {
    let line = lines[i];
    if (!hasLetters(line)) continue;
    if (isMeta(line) || isSectionMarker(line) || maskedCard(line) || isPercentOnly(line)) continue;

    // Skip obvious non-item words
    if (/SATIŞ|SATIS|E-ARŞ[İI]V|ADRES[İI]|MÜŞTER[İI]/i.test(line)) continue;

    // Skip ALL receipt metadata and invoice information
    if (/F[İI]Ş\s*NO|B[İI]LG[İI]\s*F[İI]Ş[İI]|FATURA.*SER[İI]|İRSAL[İI]YE.*SER[İI]|TÜR\s*:|MÜŞTER[İI]\s*TCKN|TCKN|E-ARŞ[İI]V|EARSIV|E-ARSIV/i.test(line)) continue;
    
    // Skip date, time, address related lines 
    if (/TAR[İI]H\s*:|SAAT\s*:|TARIH|SAAT|ADRES/i.test(line)) continue;
    
    // Skip merchant, store, and branch info
    if (/MAĞAZA|MAGAZA|ŞUBE|SUBE|M[İI]GROS|BİM|A101|ŞOK|SOK|MERKEZ|CARREFOUR|SABANCI|TIC|MRK/i.test(line)) continue;
    
    // Skip tax, legal, and registration info
    if (/VERGİ|VERGI|V\.?D\.?|BÜYÜK\s*MÜKELLEFL|BUYUK\s*MUKELLEFL|MERSIS|MERSİS|MAH\.|MAHALLESI|CD\.|CADDESI/i.test(line)) continue;
    
    // Skip discount lines using the isDiscountLine function
    if (isDiscountLine(line)) continue;

    // Handle product code starting with #
    const codeMatch = line.match(/^#(\d{6,})/);
    let product_code: string | undefined;
    if (codeMatch) {
      product_code = codeMatch[1];
      // Try to use next meaningful line as name
      const nextName = lines.slice(i + 1, Math.min(i + 4, end)).find(L => hasLetters(L) && !isMeta(L) && !isSectionMarker(L));
      if (nextName) line = nextName;
    }

    // If this line is a pure quantity x unit price line, attach to previous item and continue
    const qtyLineMatch = line.match(/^(\d+(?:[.,]\d+)?)\s*(?:AD|ADET)?\s*[xX×]\s*(\d+(?:[.,]\d{2}))\s*(?:TL(?:\/AD)?|₺)?/i);
    if (qtyLineMatch && items.length > 0) {
      const qty = parseFloat(qtyLineMatch[1].replace(',', '.'));
      const unit_price = parseFloat(qtyLineMatch[2].replace(',', '.'));
      const last = items[items.length - 1];
      last.qty = qty;
      last.unit_price = unit_price;
      if (!last.line_total) last.line_total = +(qty * unit_price).toFixed(2);
      continue;
    }

    // Extract a trailing line total if present on same line
    let line_total: number | undefined;
    const priceMatch = line.match(/[*₺]?\s*(\d{1,4}(?:[.,]\d{3})*[.,]\d{2})\s*$/);
    if (priceMatch) {
      line_total = parseFloat(priceMatch[1].replace(/\./g, '').replace(',', '.'));
      line = line.replace(/[*₺]?\s*\d{1,4}(?:[.,]\d{3})*[.,]\d{2}\s*$/, '').trim();
    }

    // Do NOT convert weights like "90 G" or "110 G" into quantity. Keep them in the name.
    // Clean name
    let name = line
      .replace(/^[#\d\s*%₺]+/, '')
      .replace(/[%₺*]+$/, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Filter out leftovers that look like metadata
    if (!hasLetters(name) || name.length < 2) continue;

    items.push({ name, line_total, raw_line: lines[i], product_code });
    console.log(`Parsed item: "${name}" ${line_total ? `total: ${line_total}` : ''}`);
  }

  console.log(`Total items extracted: ${items.length}`);
  return items;
}

/**
 * Extract barcode/unique receipt number from bottom of receipt
 */
function extractReceiptUniqueNo(text: string): string | null {
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  
  // Scan the last ~10 lines for a single long numeric sequence (18–24 digits)
  const endLines = lines.slice(-10);
  
  for (const line of endLines) {
    // Look for longest numeric sequence 18-24 digits
    const barcodeMatch = line.match(/\b(\d{18,24})\b/);
    if (barcodeMatch) {
      console.log(`Found receipt unique number: ${barcodeMatch[1]}`);
      return barcodeMatch[1];
    }
  }
  
  return null;
}

/**
 * Extract FİŞ NO if present
 */
function extractFisNo(text: string): string | null {
  const fisMatch = text.match(/f(?:i|İ)ş\s*no\s*[:\-]?\s*(\d+)/i);
  if (fisMatch) {
    console.log(`Found FİŞ NO: ${fisMatch[1]}`);
    return fisMatch[1];
  }
  return null;
}

function extractPaymentMethod(text: string): string | null {
  console.log('Extracting payment method from text');
  
  const lines = text.split('\n').map(line => line.trim());
  
  // Migros pattern: 494314******4645 (middle 6 digits masked)
  const migrosPattern = /(\d{6}\*{6}\d{4})/;
  
  // Carrefour credit card patterns: exactly 16 digits with first 12 masked, last 4 visible
  const carrefourCreditPatterns = [
    /\*{4}\s+\*{4}\s+\*{4}\s+(\d{4})/,  // **** **** **** 1234
    /\*{12}(\d{4})/,                     // ************1234
    /(\d{4})\s+\*{4}\s+\*{4}\s+(\d{4})/, // 1234 **** **** 5678 (capture both parts)
  ];
  
  // Standard 16-digit masked card patterns
  const standardPatterns = [
    /(\d{4}\s+\*{4}\s+\*{4}\s+\d{4})/,   // 1234 **** **** 5678
    /(\*{4}\s+\*{4}\s+\*{4}\s+\d{4})/,   // **** **** **** 1234
  ];
  
  // All credit card patterns
  const allPatterns = [migrosPattern, ...carrefourCreditPatterns, ...standardPatterns];
  
  // Look for actual credit card patterns
  for (const line of lines) {
    // Handle CarrefourSA store card vs credit card distinction
    if (/carrefour.*kart/i.test(line)) {
      console.log(`Processing Carrefour line: ${line}`);
      
      // Look for 16-digit credit card pattern in this line
      for (const pattern of carrefourCreditPatterns) {
        const match = line.match(pattern);
        if (match) {
          let cardNumber;
          if (match[2]) {
            // Pattern with two capture groups (first 4 and last 4)
            cardNumber = `${match[1]} **** **** ${match[2]}`;
          } else {
            // Pattern with last 4 digits only
            cardNumber = `**** **** **** ${match[1]}`;
          }
          console.log(`Found Carrefour credit card: ${cardNumber}`);
          return cardNumber;
        }
      }
      
      // If no 16-digit credit card pattern found, this is just store loyalty card
      console.log(`CarrefourSA loyalty card detected (not credit card): ${line}`);
      continue;
    }
    
    // Skip other store loyalty cards
    if (/migros.*kart|bim.*kart|şok.*kart/i.test(line)) {
      console.log(`Store loyalty card detected: ${line}`);
      continue;
    }
    
    // Look for credit card patterns in regular lines
    for (const pattern of allPatterns) {
      const match = line.match(pattern);
      if (match) {
        const cardNumber = match[1];
        console.log(`Found credit card payment method: ${cardNumber}`);
        return cardNumber;
      }
    }
  }
  
  console.log('No credit card payment method found');
  return null;
}

/**
 * Extract and categorize numbers appearing below barcode on receipts
 */
function extractBarcodeNumbers(text: string): string[] {
  console.log('Extracting barcode numbers from text');
  
  const categorizedNumbers: string[] = [];
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  
  // Look for İş Yeri ID specifically mentioned
  for (const line of lines) {
    const workplaceIdMatch = line.match(/(?:iş\s*yeri|işyeri)\s*(?:id|no)\s*[:.]?\s*(\d{8,})/i);
    if (workplaceIdMatch) {
      categorizedNumbers.push(`İş Yeri ID: ${workplaceIdMatch[1]}`);
      console.log(`Found explicit workplace ID: İş Yeri ID: ${workplaceIdMatch[1]}`);
    }
  }
  
  // Look for receipt number under barcode (bottom area)
  const bottomLines = lines.slice(-10);
  for (let i = 0; i < bottomLines.length; i++) {
    const line = bottomLines[i];
    
    // Look for barcode-like patterns (long numbers) 
    const barcodeMatch = line.match(/\b(\d{17,24})\b/);
    if (barcodeMatch) {
      const barcode = barcodeMatch[1];
      categorizedNumbers.push(`Barkod Numarası: ${barcode}`);
      console.log(`Found barcode: ${barcode}`);
      
      // Look for receipt number in next few lines after barcode
      for (let j = i + 1; j < Math.min(i + 3, bottomLines.length); j++) {
        const nextLine = bottomLines[j];
        const receiptMatch = nextLine.match(/\b(\d{8,16})\b/);
        if (receiptMatch && receiptMatch[1] !== barcode) {
          categorizedNumbers.push(`Fiş Numarası: ${receiptMatch[1]}`);
          console.log(`Found receipt number under barcode: ${receiptMatch[1]}`);
          break;
        }
      }
    }
  }
  
  // Look for other numeric sequences with proper categorization
  const bottomLines15 = lines.slice(-15);
  for (const line of bottomLines15) {
    const numericSequences = line.match(/\b\d{8,}\b/g);
    
    if (numericSequences) {
      numericSequences.forEach(seq => {
        if (!isCommonNonBarcodeNumber(seq) && !categorizedNumbers.some(cat => cat.includes(seq))) {
          const categorized = categorizeNumber(seq, text);
          categorizedNumbers.push(categorized);
          console.log(`Found categorized number: ${categorized}`);
        }
      });
    }
  }
  
  // Remove duplicates while preserving order
  const uniqueNumbers = [...new Set(categorizedNumbers)];
  console.log(`Total unique categorized numbers found: ${uniqueNumbers.length}`);
  
  return uniqueNumbers;
}

/**
 * Categorize a number based on its context and format
 */
function categorizeNumber(number: string, text: string): string {
  // 17 haneli barkod numarası
  if (number.length === 17) {
    return `Barkod Numarası: ${number}`;
  }
  
  // Check if it's near "REF NO" or "REFERANS" text
  if (text.toLowerCase().includes(`ref no: ${number}`) || 
      text.toLowerCase().includes(`referans: ${number}`) ||
      text.toLowerCase().includes(`ref no:${number}`)) {
    return `Referans Numarası: ${number}`;
  }
  
  // Check if it's near "Isyeri ID" or "İş yeri" text
  if (text.toLowerCase().includes(`isyeri id:${number}`) || 
      text.toLowerCase().includes(`iş yeri id:${number}`) ||
      text.toLowerCase().includes(`isyeri id: ${number}`)) {
    return `İş Yeri ID: ${number}`;
  }
  
  // For 10-digit numbers, likely to be reference numbers
  if (number.length === 10) {
    return `Referans Numarası: ${number}`;
  }
  
  // For 8-10 digit numbers that aren't 10 digits, likely to be business IDs
  if (number.length >= 8 && number.length <= 9) {
    return `İş Yeri ID: ${number}`;
  }
  
  // Default to barkod numarası for longer sequences
  return `Barkod Numarası: ${number}`;
}

/**
 * Check if a number sequence is likely NOT a barcode (e.g., terminal ID, timestamp, etc.)
 */
function isCommonNonBarcodeNumber(numericString: string): boolean {
  // Skip if it looks like a timestamp (starts with 20 for year)
  if (numericString.startsWith('20') && numericString.length === 8) {
    return true;
  }
  
  // Skip if it's too short or too long for typical barcodes
  if (numericString.length < 8 || numericString.length > 24) {
    return true;
  }
  
  // Skip sequences that are all the same digit or simple patterns
  if (/^(\d)\1+$/.test(numericString) || numericString === '00000000') {
    return true;
  }
  
  return false;
}

/**
 * Simple geocoding function to extract city/district from address
 */
async function geocodeAddress(address: string): Promise<{
  city?: string;
  district?: string; 
  neighborhood?: string;
  lat?: number;
  lng?: number;
} | null> {
  if (!address || address.trim() === '') {
    return null;
  }

  try {
    // Simple pattern-based extraction for Turkish addresses
    const addressLower = address.toLowerCase();
    
    let city, district, neighborhood;
    
    // Extract city
    const cityPatterns = [
      'istanbul', 'ankara', 'izmir', 'bursa', 'antalya', 'adana', 
      'konya', 'gaziantep', 'mersin', 'kayseri', 'eskişehir'
    ];
    
    for (const cityPattern of cityPatterns) {
      if (addressLower.includes(cityPattern)) {
        city = cityPattern.charAt(0).toUpperCase() + cityPattern.slice(1);
        break;
      }
    }
    
    // Extract district from common Istanbul districts
    const districtPatterns = [
      'ataşehir', 'besiktas', 'beşiktaş', 'beyoglu', 'beyoğlu', 'kadikoy', 
      'kadıköy', 'uskudar', 'üsküdar', 'sisli', 'şişli', 'fatih', 'bakirkoy',
      'bakırköy', 'maltepe', 'pendik', 'kartal', 'tuzla', 'ayazaga', 'ayazağa'
    ];
    
    for (const districtPattern of districtPatterns) {
      if (addressLower.includes(districtPattern)) {
        district = districtPattern.charAt(0).toUpperCase() + districtPattern.slice(1);
        break;
      }
    }
    
    // Extract neighborhood from mahalle patterns
    const mahalleMatch = address.match(/(\w+)\s*mah(?:allesi)?/i);
    if (mahalleMatch) {
      neighborhood = mahalleMatch[1];
    }
    
    return { city, district, neighborhood };
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('OCR function called, method:', req.method);
    console.log('Request headers:', Object.fromEntries(req.headers.entries()));
    
    const requestBody = await req.json();
    console.log('Request body:', requestBody);
    const { imageUrl } = requestBody;
    
    // Check for fake OCR header (for E2E tests)
    const fakeOcrHeader = req.headers.get('x-qa-fake-ocr');
    const imageUrlObj = new URL(imageUrl);
    const fakeOcrParam = imageUrlObj.searchParams.get('qa-fake-ocr');
    
    if (fakeOcrHeader === '1' || fakeOcrParam === '1') {
      console.log('Using fake OCR for E2E testing');
      const fakeResult: OCRResult = {
        merchant_raw: "M GROS KO? SN VERS TES MAZAZASI",
        merchant_brand: "Migros",
        purchase_date: "2024-12-22",
        purchase_time: "15:35",
        store_address: "Atatürk Mah. Turgut Özal Bulv. No:7, Ataşehir/İstanbul",
        total: 464.25,
        payment_method: "494314******4645",
        items: [
          { name: "MIGROS SIYAH ZEYTIN", qty: 1, line_total: 99.50, raw_line: "MIGROS SIYAH ZEYTIN 1 99,50" },
          { name: "TWIX 50 GR", qty: 1, line_total: 29.90, raw_line: "TWIX 50 GR 1 29,90" },
          { name: "PIKO PIRINC PATLAKLI", qty: 2, line_total: 14.00, raw_line: "PIKO PIRINC PATLAKLI 2 14,00" }
        ],
        receipt_unique_no: "09290044195241222",
        fis_no: "0078",
        barcode_numbers: ["09290044195241222", "41950929004003"],
        raw_text: "M GROS KO? SN VERS TES MAZAZASI\nFİŞ NO: 0078\nMIGROS SIYAH ZEYTIN 1 99,50\nTWIX 50 GR 1 29,90\nPIKO PIRINC PATLAKLI 2 14,00\nTOPLAM: 464,25\n494314******4645\n09290044195241222"
      };
      
      return new Response(
        JSON.stringify(fakeResult),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
    
    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: 'imageUrl is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const googleVisionKey = Deno.env.get('GOOGLE_VISION_API_KEY');
    if (!googleVisionKey) {
      console.error('Google Vision API key not found');
      return new Response(
        JSON.stringify({ error: 'Google Vision API key not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Processing OCR for image:', imageUrl);
    console.log('Using API key (first 10 chars):', googleVisionKey.substring(0, 10) + '...');

    // Test if the image URL is accessible
    try {
      let testResponse = await fetch(imageUrl, { method: 'HEAD' });
      console.log('Image accessibility test (HEAD) - Status:', testResponse.status);
      if (!testResponse.ok) {
        // Fallback: try a ranged GET (fetch first bytes only)
        const ranged = await fetch(imageUrl, { method: 'GET', headers: { 'Range': 'bytes=0-1' } });
        console.log('Image accessibility test (GET range) - Status:', ranged.status);
        if (!ranged.ok) {
          throw new Error(`Image not accessible: ${ranged.status} ${ranged.statusText}`);
        }
      }
    } catch (error) {
      console.error('Image accessibility error:', error);
      return new Response(
        JSON.stringify({ error: `Image not accessible: ${error.message}` }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Call Google Cloud Vision API with enhanced settings for Turkish
    console.log('Calling Google Vision API with Turkish language hints...');
    const visionResponse = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${googleVisionKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              image: {
                source: {
                  imageUri: imageUrl
                }
              },
              features: [
                {
                  type: 'DOCUMENT_TEXT_DETECTION'
                }
              ],
              imageContext: {
                languageHints: ['tr', 'tr-Latn', 'en']
              }
            }
          ]
        })
      }
    );

    console.log('Vision API response status:', visionResponse.status);
    console.log('Vision API response headers:', Object.fromEntries(visionResponse.headers.entries()));

    if (!visionResponse.ok) {
      const errorText = await visionResponse.text();
      console.error('Vision API error response:', errorText);
      throw new Error(`Vision API error: ${visionResponse.status} ${visionResponse.statusText} - ${errorText}`);
    }

    const visionData = await visionResponse.json();
    console.log('Vision API response structure:', JSON.stringify(visionData, null, 2));

    // Check for API errors in the response
    if (visionData.responses?.[0]?.error) {
      const apiError = visionData.responses[0].error;
      console.error('Vision API returned error:', apiError);
      throw new Error(`Vision API error: ${apiError.code} - ${apiError.message}`);
    }

    // Extract text from the response - prioritize fullTextAnnotation for better structure
    const fullTextAnnotation = visionData.responses?.[0]?.fullTextAnnotation;
    const textAnnotations = visionData.responses?.[0]?.textAnnotations;
    const fullText = fullTextAnnotation?.text || textAnnotations?.[0]?.description || '';

    if (!fullText) {
      return new Response(
        JSON.stringify({
          merchant_raw: '',
          merchant_brand: '',
          purchase_date: new Date().toISOString().split('T')[0],
          total: 0,
          items: [],
          payment_method: null,
          receipt_unique_no: null,
          fis_no: null,
          raw_text: 'No text detected in image'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse the extracted text
    const merchantRaw = extractMerchant(fullText);
    const rawPaymentMethod = extractPaymentMethod(fullText);
    
    // Process payment method to normalize credit card format
    let normalizedPaymentMethod = '';
    if (rawPaymentMethod) {
      // Remove any non-digit characters to get just numbers
      const digits = rawPaymentMethod.replace(/\D/g, '');
      if (digits.length >= 4) {
        // Always format as ****-****-****-XXXX where XXXX are the last 4 digits
        const lastFour = digits.slice(-4);
        normalizedPaymentMethod = `****-****-****-${lastFour}`;
      } else {
        // Keep original if not enough digits
        normalizedPaymentMethod = rawPaymentMethod;
      }
    }
    
    const result: OCRResult = {
      merchant_raw: merchantRaw,
      merchant_brand: normalizeBrand(merchantRaw),
      purchase_date: extractDate(fullText),
      purchase_time: extractPurchaseTime(fullText),
      store_address: extractStoreAddress(fullText),
      total: extractTotal(fullText),
      items: parseItems(fullText),
      payment_method: normalizedPaymentMethod || null,
      receipt_unique_no: extractReceiptUniqueNo(fullText),
      fis_no: extractFisNo(fullText),
      barcode_numbers: extractBarcodeNumbers(fullText),
      raw_text: fullText
    };

    console.log('OCR result:', result);

    // Enhanced analytics: Insert receipt items and update store dimensions if requested
    try {
      const { receiptId, userId } = requestBody;
      
      if (receiptId && userId) {
        console.log(`Processing analytics for receipt ${receiptId}`);
        
        // 1. Normalize merchant to chain group
        const chainGroup = normalizeMerchantLocal(merchantRaw);
        console.log(`Normalized merchant "${merchantRaw}" to chain group: ${chainGroup}`);
        
        // 2. Process store address and geocode
        let storeId = null;
        let h3_8 = null;
        
        if (result.store_address) {
          const geoData = await geocodeAddress(result.store_address);
          if (geoData) {
            console.log('Geocoded address:', geoData);
            
            // Upsert store dimension
            const { data: storeUuid, error: storeError } = await supabase
              .rpc('upsert_store_dim', {
                p_chain_group: chainGroup,
                p_city: geoData.city,
                p_district: geoData.district,
                p_neighborhood: geoData.neighborhood,
                p_address: result.store_address,
                p_lat: geoData.lat,
                p_lng: geoData.lng,
                p_h3_8: h3_8
              });
            
            if (storeError) {
              console.error('Error upserting store dimension:', storeError);
            } else {
              storeId = storeUuid;
              console.log('Upserted store dimension with ID:', storeId);
            }
          }
        }
        
        // 3. Update receipt with store_id and h3_8
        if (storeId || h3_8) {
          const { error: receiptUpdateError } = await supabase
            .from('receipts')
            .update({
              store_id: storeId,
              h3_8: h3_8,
              merchant_brand: chainGroup
            })
            .eq('id', receiptId);
          
          if (receiptUpdateError) {
            console.error('Error updating receipt with store info:', receiptUpdateError);
          } else {
            console.log('Updated receipt with store information');
          }
        }
        
        // 4. Insert receipt items if any were parsed
        if (result.items && result.items.length > 0) {
          const itemsToInsert = result.items.map(item => ({
            receipt_id: receiptId,
            item_name: item.name,
            qty: item.qty,
            unit_price: item.unit_price,
            line_total: item.line_total,
            product_code: item.product_code,
            raw_line: item.raw_line
          }));
          
          const { error: itemsError } = await supabase
            .from('receipt_items')
            .insert(itemsToInsert);
          
          if (itemsError) {
            console.error('Error inserting receipt items:', itemsError);
          } else {
            console.log(`Inserted ${itemsToInsert.length} receipt items`);
          }
        }
        
        // 5. Seed merchant mapping if this is a new merchant
        const { data: existingMapping } = await supabase
          .from('merchant_map')
          .select('id')
          .eq('raw_merchant', merchantRaw)
          .single();
        
        if (!existingMapping && merchantRaw && chainGroup) {
          const { error: mappingError } = await supabase
            .from('merchant_map')
            .insert({
              raw_merchant: merchantRaw,
              chain_group: chainGroup,
              priority: 100,
              active: true
            });
          
          if (mappingError) {
            console.error('Error inserting merchant mapping:', mappingError);
          } else {
            console.log(`Added new merchant mapping: ${merchantRaw} -> ${chainGroup}`);
          }
        }
      }
    } catch (analyticsError) {
      console.error('Analytics processing error:', analyticsError);
      // Don't fail the OCR request if analytics fails
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in OCR function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'OCR processing failed' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
