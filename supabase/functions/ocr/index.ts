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
    /SAAT[:.\s]*(\d{1,2}):(\d{2})/i, // Migros specific pattern
    /SAAT[:.\s]*(\d{1,2});(\d{2})/i, // Migros with OCR error
    /SAAT[:.\s]*(\d{1,2})\.(\d{2})/i  // Migros with OCR error
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
 * Parse items from receipt lines based on format - Enhanced for Migros v2
 */
function parseItems(lines: string[], format: string): any[] {
  const items: any[] = [];
  let startIndex = -1;
  let endIndex = lines.length;

  // Format-specific item extraction
  if (format === 'BIM') {
    // BIM: between 'NIHAI TUKETİCİ' and 'Toplam KDV'
    startIndex = lines.findIndex(line => /nihai\s*tuketi[çc]i/i.test(alphaNormalize(line)));
    endIndex = lines.findIndex(line => /toplam\s*kdv/i.test(alphaNormalize(line)));
  } else if (format === 'CarrefourSA') {
    // Carrefour: between 'FİŞ NO' and 'TOPKDV'
    startIndex = lines.findIndex(line => /fi[şs]\s*no/i.test(alphaNormalize(line)));
    endIndex = lines.findIndex(line => /topkdv/i.test(alphaNormalize(line)));
  } else if (format === 'Migros') {
    // Migros: Enhanced section detection - look for start anchors
    const alphaLines = lines.map(l => alphaNormalize(l));
    
    // Start after TCKN, FİŞ NO, or first product-like line
    let idxTckn = alphaLines.findIndex(line => /m[uü]şter[iİ]\s*tckn/i.test(line));
    let idxFisNo = alphaLines.findIndex(line => /f[iİ]ş\s*no/i.test(line));
    let idxDocCode = alphaLines.findIndex(line => /^\s*#\d{10,}\s*$/i.test(line));
    
    // Start parsing after the administrative section
    if (idxTckn !== -1) {
      startIndex = idxTckn;
    } else if (idxFisNo !== -1) {
      startIndex = idxFisNo;
    } else if (idxDocCode !== -1) {
      startIndex = idxDocCode;
    } else {
      // Look for first product-like line (contains price pattern)
      startIndex = alphaLines.findIndex(line => /\d+[.,]\d{2}/.test(line)) - 1;
      if (startIndex < 0) startIndex = 0;
    }
    
    // Find end: before discount/total blocks
    const endCandidates = [
      alphaLines.findIndex(line => /ind[iİ]r[iİ]mler/i.test(line)),
      alphaLines.findIndex(line => /tutar\s*[iİ]nd/i.test(line)),
      alphaLines.findIndex(line => /topkdv/i.test(line)),
      alphaLines.findIndex(line => /\btoplam\b/i.test(line) && !/ara\s*toplam/i.test(line))
    ].filter(i => i !== -1) as number[];
    
    if (endCandidates.length > 0) {
      endIndex = Math.min(...endCandidates);
    }
  }

  if (startIndex === -1) startIndex = 0;
  if (endIndex === -1) endIndex = lines.length;

  // Enhanced Migros noise filtering and product parsing
  for (let i = startIndex + 1; i < endIndex; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const alphaLine = alphaNormalize(line);
    const rawLower = line.toLowerCase();

    // MIGROS V2: Comprehensive noise filtering
    if (format === 'Migros') {
      // Enhanced non-item patterns - expanded for better filtering
      const migrosNonItemPatterns = [
        // Header and document info
        /^\s*(b[iİ]lg[iİ]\s*f[iİ]ş[iİ]|t[uü]r:?\s*e-?arş[iİ]v\s*fatura)\s*$/i,
        /^\s*(e-arş[iİ]v\s*faturasina|bu\s*belgeye\s*istinadne|nihai\s*tuketici)\s*$/i,
        /^\s*(irsaliye\s*yerine\s*gecer|musteri\s*iletisim\s*merkezi)\s*$/i,
        /^\s*m[uü]şter[iİ]\s*tckn.*$/i,
        /^\s*m[eu]rs[iİ]s\s*no.*$/i,
        /^\s*merkez\s*adresi.*$/i,
        /^\s*(kampanya|adresi\s*uzerinden\s*ulasabilirsiniz).*$/i,
        
        // Totals and calculations
        /^\s*ara\s*toplam\s*$/i,
        /^\s*topkdv\s*$/i,
        /^\s*toplam\s*$/i,
        /^\s*genel\s*toplam\s*$/i,
        /^\s*toplam\s*tutar\s*$/i,
        /^\s*kdv(\s*tutari|l[iİ]|\s*%\d+)?.*$/i,
        
        // Discount and payment lines (CRITICAL: exclude from products)
        /^\s*(tutar\s*ind\.?|tutar\s*indirim|indirim|indiriml?er)\s*$/i,
        /^\s*(kocailem|money)\s*$/i,
        
        // POS and payment info
        /^\s*ortak\s*pos.*$/i,
        /^\s*onay\s*kodu.*$/i,
        /^\s*ref\s*no.*$/i,
        /^\s*isyeri\s*id.*$/i,
        /^\s*terminal\s*id.*$/i,
        /^\s*batch.*$/i,
        /^\s*satiş\s*$/i,
        /^\s*kas[iİ]yer.*$/i,
        /^\s*(z\s*no.*|eku\s*no.*|mf\s*tv.*)\s*$/i,
        
        // Document/stock codes (skip but continue parsing)
        /^\s*#\d{10,}\s*$/i,
        
        // Web and contact info
        /^\s*http.*$/i,
        /^\s*www\..*$/i,
        /^\s*jetkasa.*$/i,
        
        // OCR noise patterns (specific problematic patterns)
        /^\s*(txw|bbsm|absm|l2ek|kvdev|joand|ha\s*dtml)\s*a?\d*\s*$/i,
        /^\s*rmeyen\s*kutularda\s*sak.*$/i,
        /^\s*sea\s*$/i,
        /^\s*[a-z0-9+/'". -]{1,4}\s*$/i, // Short random character combinations
      ];
      
      // Check against Migros-specific noise patterns
      let isMigrosNonItem = false;
      for (const pattern of migrosNonItemPatterns) {
        if (pattern.test(line)) {
          isMigrosNonItem = true;
          // Document codes don't stop parsing, just skip
          if (/^\s*#\d{10,}\s*$/i.test(line)) {
            console.log(`Skipping document code but continuing: ${line}`);
          }
          break;
        }
      }
      
      if (isMigrosNonItem) continue;
    }

    // General system line detection (for all formats)
    const isSystemLine = /tarih|saat|fi[şs]|no|kdv|toplam|tutar|ref|onay|kodu|pos|terminal|batch|eku|mersis|tckn|vkn|tel|adres|₺|tl|\d+[.,]\d{2}|^\d+$|^[*]+$|^#+/i.test(alphaLine);

    // Skip quantity-only unit lines like ",564 KG X" or "0,836 KG X"
    const isQtyUnitOnly = (
      /^\s*[.,-]?\d*[.,]\d+\s*(kg|gr|lt|l)\b.*\b(x|×)\b/i.test(rawLower)
    ) || (
      /^\s*[,\.\d][\d.,]*\s*(kg|gr|lt|l)\b.*\bx\b/i.test(alphaLine)
    );

    // Skip discount suffix-only lines like ",18-D"
    const isDiscountNoise = (
      /[.,]\d+\s*[-–]?\s*d\b/i.test(rawLower)
    ) || (
      /^\s*[,\.\d][\d.,]*\s*[-–]?\s*d\b/i.test(alphaLine)
    );

    // Skip card/payment comment lines
    const isCardNoise = /(kart\s*ile|csa\s*kart|kart\s*indirimi|kasa\s*ind|promo|kupon|electron|elektron)/i.test(alphaLine);

    if (isSystemLine || isQtyUnitOnly || isDiscountNoise || isCardNoise) continue;

    // Must contain letters for product name
    const hasLetters = /[A-Za-zÇĞİÖŞÜçğıöşü]/.test(line);
    if (!hasLetters) continue;

    // Enhanced item parsing for different formats
    let item = null;

    // 1. Weight-based items (KG format - Migros specific)
    if (format === 'Migros') {
      // Weight format with leading quantity: 0,485 KG x 119,95 TL/KG PEPINO KG %1 *58,18
      const weightMatch1 = line.match(/^(\d+[.,]\d{3})\s*KG\s*x\s*(\d{1,4}[.,]\d{2}).*?([A-ZÇĞİÖŞÜa-zçğıöşü\s]+?).*?\*(\d{1,4}[.,]\d{2})$/i);
      if (weightMatch1) {
        const [, weight, unitPrice, name, total] = weightMatch1;
        item = {
          name: name.trim(),
          qty: parseFloat(weight.replace(',', '.')),
          unit_price: parseFloat(unitPrice.replace(',', '.')),
          line_total: parseFloat(total.replace(',', '.')),
          raw_line: line
        };
      }

      // Alternative weight format: NAME KG 0,485 KG x 119,95 TL/KG = 58,18
      if (!item) {
        const weightMatch2 = line.match(/^(.+?)\s+KG\s+(\d+[.,]\d{3})\s*KG\s*x\s*(\d{1,4}[.,]\d{2})\s*TL\/KG.*?(\d{1,4}[.,]\d{2})$/i);
        if (weightMatch2) {
          const [, name, weight, unitPrice, total] = weightMatch2;
          item = {
            name: name.trim(),
            qty: parseFloat(weight.replace(',', '.')),
            unit_price: parseFloat(unitPrice.replace(',', '.')),
            line_total: parseFloat(total.replace(',', '.')),
            raw_line: line
          };
        }
      }
    }

    // 2. Regular items with explicit quantity (x1, x2, etc.)
    if (!item) {
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
    }

    // 3. Simple items (name and price only) - Enhanced for Migros
    if (!item) {
      // First try: Pattern with * prefix: NESQUIK CILEKLI SUT %1 *29,75
      const starMatch = line.match(/^(.+?)\s+[%]\d+\s+\*(\d{1,4}[.,]\d{2})$/);
      if (starMatch) {
        const [, name, price] = starMatch;
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
      
      // Second try: Simple pattern without * but with price at end
      if (!item) {
        const simpleMatch = line.match(/^(.+?)\s+[*]?(\d{1,4}[.,]\d{2})$/);
        if (simpleMatch) {
          const [, name, price] = simpleMatch;
          // Validate this looks like a product name
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
    }

    // Clean and validate item
    if (item && item.name && item.line_total > 0) {
      // Enhanced product name cleaning
      item.name = item.name
        .replace(/^\*+|^#+/, '') // Remove leading symbols
        .replace(/^\d+\s*/, '') // Remove leading numbers
        .replace(/\s+\d+[.,]\d{2}\s*[*]?\s*$/, '') // Remove trailing prices
        .replace(/\s+\d+[.,]\d{2}[^A-Za-zÇĞİÖŞÜçğıöşü]*$/, '') // Remove price with suffixes
        .replace(/\s*x\s*\d+\s*$/i, '') // Remove quantity markers
        .replace(/\s*\*.*$/, '') // Remove everything after "*"
        .replace(/\s*(sex|edu|sons|kdv)\s*/gi, ' ') // Remove OCR garbage words
        .replace(/\s+/g, ' ') // Normalize whitespace
        .replace(/^[-.*,:\s]+|[-.*,:\s]+$/g, '') // Remove leading/trailing punctuation
        .trim();

      // Final validation: reasonable product name
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
 * Parse discounts from receipt lines - Enhanced for Migros v2
 */
function parseDiscounts(lines: string[], format: string = 'Unknown'): any[] {
  const discounts: any[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Enhanced discount detection for Migros v2
    if (format === 'Migros') {
      // 1. Look for "TUTAR İND." or "TUTAR İNDİRİM" patterns
      const migrosDiscountMatch = line.match(/(tutar\s*[iİ]nd\.?|tutar\s*[iİ]nd[iİ]r[iİ]m)\s*[-:]?\s*(-?\d+[.,]\d{2})/i);
      if (migrosDiscountMatch) {
        let amount = parseAmount(migrosDiscountMatch[2]);
        if (amount) {
          // Store as positive value (we'll subtract when calculating totals)
          amount = Math.abs(amount);
          discounts.push({
            description: 'TUTAR İNDİRİM',
            amount: amount
          });
          continue;
        }
      }
      
      // 2. Look for "İNDİRİM" or "İNDİRİMLER" standalone lines with amounts
      if (/^\s*(indirim|indiriml?er)\s*$/i.test(line)) {
        // Check same line or next few lines for amounts
        for (let j = i; j <= Math.min(i + 2, lines.length - 1); j++) {
          const checkLine = lines[j];
          const amountMatch = checkLine.match(/(-?\d+[.,]\d{2})/);
          if (amountMatch) {
            let amount = parseAmount(amountMatch[1]);
            if (amount) {
              amount = Math.abs(amount); // Always store as positive
              discounts.push({
                description: 'İNDİRİM',
                amount: amount
              });
              break;
            }
          }
        }
        continue;
      }
      
      // 3. Look for (KOCAİLEM) discount patterns
      if (/\(koca[iİ]lem\)/i.test(line)) {
        // Check current line first, then next few lines for amounts
        for (let j = i; j <= Math.min(i + 3, lines.length - 1); j++) {
          const checkLine = lines[j];
          const negativeAmountMatch = checkLine.match(/-(\d+[.,]\d{2})/);
          if (negativeAmountMatch) {
            const amount = parseAmount(negativeAmountMatch[1]);
            if (amount) {
              discounts.push({
                description: 'KOCAİLEM',
                amount: amount
              });
              break;
            }
          }
        }
        continue;
      }
      
      // 4. Look for product-specific discounts (negative amounts after products)
      if (line.includes('*İNDİRİM') || line.includes('*INDIRIM')) {
        // Look for negative amounts on same line or next line
        for (let j = i; j <= Math.min(i + 1, lines.length - 1); j++) {
          const checkLine = lines[j];
          const negativeMatch = checkLine.match(/\*(-?\d+[.,]\d{2})/);
          if (negativeMatch) {
            let amount = parseAmount(negativeMatch[1]);
            if (amount < 0) {
              amount = Math.abs(amount);
              discounts.push({
                description: 'ÜRÜN İNDİRİMİ',
                amount: amount
              });
              break;
            }
          }
        }
        continue;
      }
      
      // 5. Look for lines containing discount keywords with amounts on same line
      const discountKeywordMatch = line.match(/(indirim|tutar\s*ind|koca[iİ]lem).*?(-?\d+[.,]\d{2})/i);
      if (discountKeywordMatch) {
        let amount = parseAmount(discountKeywordMatch[2]);
        if (amount) {
          amount = Math.abs(amount);
          discounts.push({
            description: discountKeywordMatch[1].trim().toUpperCase(),
            amount: amount
          });
          continue;
        }
      }
    }
    
    // General discount patterns for all formats (BIM, CarrefourSA)
    if (format !== 'Migros') {
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

  // Format-specific total patterns
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
  } else if (format === 'Migros') {
    // Migros: Do not use broad regex here (it catches "KDV'Lİ TOPLAM").
    // We'll resolve using the line-by-line scan below to avoid VAT lines and ARA TOPLAM.
    totalPatterns = [];
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
    if (format === 'Migros') {
      // For Migros: Prefer 'KDV'Lİ TOPLAM' or plain 'TOPLAM' near the bottom (exclude ARA TOPLAM, TOPKDV, KDV TUTARI)
      let idxToplam = -1;
      for (let i = linesAlpha.length - 1; i >= 0; i--) {
        const la = linesAlpha[i];
        if ((/\bkdv[’'`]?li\s*toplam\b/i.test(la) || /\btoplam\b/i.test(la)) &&
            !/\bara\s*toplam\b/i.test(la) &&
            !/\btopkdv\b/i.test(la) &&
            !/\bkdv\s*tutari\b/i.test(la)) {
          idxToplam = i;
          break;
        }
      }
      if (idxToplam >= 0) {
        const amount = moneyNear(idxToplam);
        if (amount) {
          result.grand_total = amount;
        }
      }
    } else if (format === 'CarrefourSA') {
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
      } else if (format === 'Migros') {
        // For Migros, be very specific about what we consider as final total
        totalKeywords = ['genel toplam', 'kdv li toplam', 'toplam'];
      } else {
        totalKeywords = ['genel toplam', 'kdv li toplam', 'odenecek.*tutar', 'toplam'];
      }
      for (const keyword of totalKeywords) {
        const idx = linesAlpha.findIndex(l => {
          const regex = new RegExp(`\\b${keyword}\\b`, 'i');
          const hasKeyword = regex.test(l);
          
          // For Migros, exclude lines with "ARA TOPLAM" when looking for "toplam"
          if (format === 'Migros' && keyword === 'toplam' && /\bara\s*toplam\b/i.test(l)) {
            return false;
          }
          // Skip lines that mention KDV when keyword is generic 'toplam'
          if (/toplam/i.test(keyword) && /\bkdv\b/i.test(l)) return false;
          
          return hasKeyword;
        });
        
        if (idx >= 0) {
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
  
  // Strict Store Location extraction for Migros per rules
  let addressFull = '';
  let addressParsed = {};
  
  if (merchantDisplay === 'Migros') {
    // Stop markers and patterns to prevent address spillover
    const stopLineRe = /(?:TAR[İI]H|SAAT|F[İI]Ş\s*NO|F[İI]Ş|KDV|TOPKDV|GENEL\s*TOPLAM|TOPLAM|TUTAR|KAS[İI]YER|SATI[ŞS]|ORTAK\s*POS|MERS[İI]S|REF\s*NO|ONAY|EKU|Z\s*NO)/i;
    const productStartRe = /^\s*(?:[#*]?\d{6,}|(?:\d+[.,]\d{3})\s*(?:KG|GR|LT|L)\s*x)/i;
    const looksLikeAddress = (s: string) => {
      const a = alphaNormalize(s);
      return /(MAH|MAHALLE|CAD|CADDE|SOK|SOKAK|BULV|BULVAR|NO[:.]|\/[A-ZÇĞİÖŞÜ])/i.test(a) && !stopLineRe.test(a) && !/TEL/i.test(a);
    };

    const alphaLines = lines.map(l => alphaNormalize(l));
    let startIdx = alphaLines.findIndex(l => /MERKEZ\s*ADRES[İI]?\s*[:：]?/i.test(l));

    if (startIdx !== -1) {
      // Take remainder of the MERKEZ ADRES line only, cut at stop markers
      let remainder = lines[startIdx].replace(/.*ADRES[İI]?\s*[:：]/i, '').trim();
      remainder = remainder.replace(/\b(TEL|PHONE)\b.*$/i, '').trim();
      remainder = remainder.replace(/(?:TAR[İI]H|SAAT|F[İI]Ş\s*NO|F[İI]Ş|KDV|TOPKDV|GENEL\s*TOPLAM|TOPLAM|TUTAR).*$/i, '').trim();
      addressFull = remainder;

      // Optionally append the next line if it still looks like address
      const next = lines[startIdx + 1];
      if (next && looksLikeAddress(next) && !productStartRe.test(next)) {
        let extra = next.replace(/\b(TEL|PHONE)\b.*$/i, '')
                        .replace(/(?:TAR[İI]H|SAAT|F[İI]Ş\s*NO|F[İI]Ş|KDV|TOPKDV|GENEL\s*TOPLAM|TOPLAM|TUTAR).*$/i, '')
                        .trim();
        if (extra) addressFull = `${addressFull} ${extra}`.trim();
      }
    } else {
      // Fallback: find the first address-like line and accumulate up to 3 lines until a stop marker
      const idx = lines.findIndex(looksLikeAddress);
      if (idx !== -1) {
        const parts: string[] = [];
        for (let i = idx; i < Math.min(lines.length, idx + 3); i++) {
          const l = lines[i];
          const a = alphaNormalize(l);
          if (stopLineRe.test(a) || productStartRe.test(l)) break;
          if (!looksLikeAddress(l)) break;
          let cleaned = l.replace(/\b(TEL|PHONE)\b.*$/i, '')
                         .replace(/(?:TAR[İI]H|SAAT|F[İI]Ş\s*NO|F[İI]Ş|KDV|TOPKDV|GENEL\s*TOPLAM|TOPLAM|TUTAR).*$/i, '')
                         .trim();
          if (cleaned) parts.push(cleaned);
        }
        addressFull = parts.join(' ').trim();
      }
    }

    // Final cleanup: squeeze spaces and ensure we cut anything after a stop token
    addressFull = (addressFull || '')
      .replace(/\s{2,}/g, ' ')
      .replace(/\s*,\s*/g, ', ')
      .replace(/(?:TAR[İI]H|SAAT|F[İI]Ş\s*NO|F[İI]Ş|KDV|TOPKDV|GENEL\s*TOPLAM|TOPLAM|TUTAR|KAS[İI]YER|SATI[ŞS]|ORTAK\s*POS|MERS[İI]S|REF\s*NO|ONAY|EKU|Z\s*NO).*$/i, '')
      .trim();
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
    const dateMatch = normalizedText.match(/TARİH[:.\s]*(\d{2}\/\d{2}\/\d{4})/i);
    if (dateMatch) {
      const [day, month, year] = dateMatch[1].split('/');
      receiptDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    // Look for "SAAT:" pattern specifically with full HH:MM capture
    const timeMatch = normalizedText.match(/SAAT[:.\s]*([01]?\d|2[0-3]):([0-5]\d)/i);
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
  
  // Extract payment method and masked PAN (Carrefour/BİM variations)
  const panRegexes = [
    /\b\d{4,6}\*{4,10}\d{4}\b/,                   // 406281******9820
    /\b(?:[Xx\*#•·●]{4}\s*){2,4}\d{4}\b/,         // **** **** **** 1234 (2-4 masked groups)
    /\*{6,}\d{4}\b/,                                 // ************1234
    /(?:[Xx\*#•·●]{1,4}\s*){2,6}\d{4}\b/,          // generic masks with varying group counts
    /\b\d{4}\s+\*{2,}\s+\d{2,4}\s+\*{2,}\s+\d{4}\b/ // mixed spacing masks
  ];
  let panRaw: string | null = null;

  // Carrefour: PAN and card info is typically 2 lines above the bottom 'TUTAR' line
  if (formatDetection.format === 'CarrefourSA') {
    const alphaLines = lines.map(l => alphaNormalize(l));
    let idxTutar = -1;
    for (let i = alphaLines.length - 1; i >= 0; i--) {
      if (/\btutar\b/i.test(alphaLines[i]) && !/\bkdv\b/i.test(alphaLines[i])) {
        idxTutar = i;
        break;
      }
    }
    if (idxTutar >= 1) {
      // Look primarily 4 lines above TUTAR (per receipt pattern), but scan a window of -6..-1
      const regionCandidates: string[] = [];
      for (let off = 6; off >= 1; off--) {
        if (idxTutar - off >= 0) regionCandidates.push(lines[idxTutar - off]);
      }
      for (const candidate of regionCandidates) {
        if (!candidate) continue;
        // Try strict patterns first
        for (const rx of panRegexes) {
          const m = candidate.match(rx);
          if (m) { panRaw = m[0]; break; }
        }
        if (panRaw) break;
        const candAlpha = alphaNormalize(candidate);
        // If line mentions card brand or has mask chars, guess last 4 at line end
        if (/(mastercard|visa|debit|kredi|kart|\*{2,}|[#•·●]{2,})/i.test(candAlpha)) {
          const last4Match = candidate.match(/(\d{4})(?!.*\d)/);
          if (last4Match) {
            panRaw = `**** **** **** ${last4Match[1]}`;
            break;
          }
        }
      }
    }
  }

  // Global fallback search
  if (!panRaw) {
    for (const rx of panRegexes) {
      const m = normalizedText.match(rx);
      if (m) { panRaw = m[0]; break; }
    }
  }
  const cardLast4 = panRaw ? panRaw.replace(/[^0-9]/g, '').slice(-4) : null;
  const cardMasked = cardLast4 ? `---${cardLast4}` : null;
  const isCash = /\bNAK[İI]T\b/i.test(normalizedText);
  const isCardKeyword = /(kredi\s*kart|debit|visa|mastercard|world|bonus|axess|maxim(?:um)?|paraf|troy|kart)/i.test(normalizedText);
  const paymentMethod = isCash ? 'NAKIT' : (cardLast4 || isCardKeyword ? 'KART' : null);
  
  // Parse items and discounts (pass format for better extraction)
  const items = parseItems(lines, merchantDisplay).slice(0, 50);
  const discounts = parseDiscounts(lines, merchantDisplay);
  
  // Extract totals (pass format for better detection)
  const totals = extractTotals(normalizedText, merchantDisplay);
  
  // Enhanced total validation for Migros - ALWAYS compute from items
  if (merchantDisplay === 'Migros') {
    console.log(`\n=== MIGROS TOTAL CALCULATION DEBUG ===`);
    console.log(`Items found: ${items.length}`);
    items.forEach((item, idx) => {
      console.log(`Item ${idx + 1}: ${item.name} - ${item.line_total}`);
    });
    console.log(`Discounts found: ${discounts.length}`);
    discounts.forEach((discount, idx) => {
      console.log(`Discount ${idx + 1}: ${discount.description} - ${discount.amount}`);
    });
    
    // Ensure TOPKDV is never used as grand_total
    if (totals.grand_total === totals.vat_total && totals.vat_total) {
      console.log('WARNING: Detected TOPKDV being used as grand_total, resetting...');
      totals.grand_total = null;
    }
    
    // ALWAYS compute from items for Migros to avoid picking wrong large numbers
    if (items.length > 0) {
      const itemsSum = items.reduce((sum, item) => sum + (item.line_total || 0), 0);
      const discountSum = discounts.reduce((sum, discount) => sum + (discount.amount || 0), 0);
      const computedTotal = itemsSum - discountSum;
      
      console.log(`Items sum: ${itemsSum}, Discounts sum: ${discountSum}, Computed total: ${computedTotal}`);
      
      if (computedTotal > 0) {
        // If we found a TOPLAM in the text, verify it matches our computation
        if (totals.grand_total && Math.abs(totals.grand_total - computedTotal) > 0.5) {
          console.log(`Detected total ${totals.grand_total} doesn't match computed ${computedTotal}, using computed`);
          warnings.push(`Grand total corrected from ${totals.grand_total} to ${computedTotal} using items calculation`);
        } else if (!totals.grand_total) {
          warnings.push('Grand total computed from items and discounts');
        }
        totals.grand_total = Math.round(computedTotal * 100) / 100;
        console.log(`Final grand total set to: ${totals.grand_total}`);
      } else {
        console.log(`Computed total ${computedTotal} is not positive, not setting grand_total`);
      }
    } else {
      console.log('No items found, cannot compute total');
    }
    console.log(`=== END MIGROS DEBUG ===\n`);
  }
  
  // Fallback: choose largest money value when still missing (but NOT for Migros - too unreliable)
  if (!totals.grand_total && merchantDisplay !== 'Migros') {
    const matches = [...normalizedText.matchAll(/(\d{1,4}[.,]\d{2})/g)];
    let maxVal = 0;
    for (const m of matches) {
      const v = parseAmount(m[1]);
      if (v && v > maxVal && v !== totals.vat_total) {
        maxVal = v;
      }
    }
    if (maxVal > 0) totals.grand_total = maxVal;
  }
  
  // Calculate computed totals
  const computedTotals = calculateComputedTotals(items, discounts, totals);

  // For Migros, if detected grand_total doesn't reconcile or is missing, use items - discounts
  if (merchantDisplay === 'Migros') {
    const corrected = Math.round((computedTotals.items_sum - computedTotals.discounts_sum) * 100) / 100;
    console.log(`Migros reconciliation check: Current total: ${totals.grand_total}, Computed: ${corrected}, Reconciles: ${computedTotals.reconciles}`);
    
    if (!totals.grand_total || (!computedTotals.reconciles && corrected > 0)) {
      console.log(`Setting grand_total to computed value: ${corrected}`);
      totals.grand_total = corrected;
      warnings.push('Grand total set from items minus discounts calculation');
    }
  }
  
  // Tax ID extraction
  const taxIdMatch = normalizedText.match(/(?:vkn|vergi\s*no)\s*[:=]?\s*(\d{10,11})/i);
  const taxId = taxIdMatch ? taxIdMatch[1] : null;
  
  // Phone extraction
  const phoneMatch = normalizedText.match(/tel\s*[:=]?\s*([\d\s\(\)\-]{10,})/i);
  const phone = phoneMatch ? phoneMatch[1].replace(/\D/g, '') : null;
  
  // Add warnings for missing or uncertain data
  if (!receiptDate) warnings.push('Date not found or uncertain');
  if (!totals.grand_total) warnings.push('Grand total not found');
  if (items.length === 0) warnings.push('No items detected');
  if (!computedTotals.reconciles) warnings.push('Totals do not reconcile');
  
  // Build final result
  const result = {
    merchant: {
      name: merchantDisplay,
      branch: null,
      address_full: addressFull || null,
      address_parsed: addressParsed,
      tax_id: taxId,
      phone: phone
    },
    receipt: {
      date: receiptDate,
      time: receiptTime,
      receipt_no: receiptNo,
      pos_id: null,
      cashier_id: null,
      payment_method: paymentMethod,
      card_last4_masked: cardMasked
    },
    items: items,
    discounts: discounts,
    totals: {
      subtotal: totals.subtotal || null,
      vat_total: totals.vat_total || null,
      grand_total: totals.grand_total || null
    },
    computed_totals: computedTotals,
    source: {
      format_detected: formatDetection.format,
      confidence: Math.round(formatDetection.confidence * 100) / 100,
      warnings: warnings
    },
    raw_text: rawText
  };
  
  return result;
}

// ============= MAIN HANDLER =============

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req) });
  }
  
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405, 
      headers: getCorsHeaders(req) 
    });
  }
  
  try {
    const { imageUrl } = await req.json();
    
    if (!imageUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing imageUrl' }),
        { 
          status: 400, 
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
        }
      );
    }
    
    console.log('Processing OCR for image:', imageUrl);
    
    // Process OCR
    const rawText = await processOCR(imageUrl);
    console.log('OCR completed, raw text length:', rawText.length);
    
    // Parse to structured format
    const result = parseReceiptText(rawText);
    console.log('Parsing completed, confidence:', result.source.confidence);
    
    return new Response(JSON.stringify(result), {
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('OCR processing error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Processing failed',
        source: {
          format_detected: 'Unknown',
          confidence: 0,
          warnings: ['Processing error: ' + error.message]
        }
      }),
      { 
        status: 500, 
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
      }
    );
  }
});