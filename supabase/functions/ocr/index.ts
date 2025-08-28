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
    .replace(/MIGROS/gi, 'MİGROS')
    .replace(/BIM/gi, 'BİM')
    .replace(/CARREFOUR\s*SA/gi, 'CarrefourSA')
    .replace(/O/g, '0') // O -> 0 in numeric contexts
    .replace(/[Il]/g, '1') // I, l -> 1
    .replace(/S/g, '5') // S -> 5 (context dependent)
    .replace(/B/g, '8'); // B -> 8 (context dependent)
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
 * Extract time in HH:MM format
 */
function extractTime(text: string): string | null {
  const match = text.match(/(\d{1,2}):(\d{2})/);
  if (match) {
    const hour = parseInt(match[1], 10);
    const minute = parseInt(match[2], 10);
    
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
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
  const normalized = text.toLowerCase();
  
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
 * Parse items from receipt lines
 */
function parseItems(lines: string[]): any[] {
  const items: any[] = [];
  let lineNo = 1;

  const isHeaderOrSystem = (s: string) => /migros|mi̇gros|bim|bi̇m|carrefour|tarih|saat|fiş|fis|bilgi\s*fişi|tür\s*:|e-?arşiv|fatura|mü?şteri|tckn|vkn|mersis|tel|http|https|earsiv|ref\s*no|onay\s*kodu|işyeri|terminal|sıra\s*no|batch\s*no|satış|satıs|pos|ortak\s*pos|z\s*no|ekü\s*no|imza|adres|alışveriş|fişinizde|money/i.test(s);
  const moneyRe = /[*\s]*([0-9]{1,4}[.,][0-9]{2})/;
  const vatRe = /%\s*(\d{1,2})/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (isHeaderOrSystem(line)) continue;

    // Heuristic: candidate item name line (contains letters, not just numbers/money)
    const looksLikeName = /[A-Za-zÇĞİÖŞÜçğıöşü]/.test(line) && !moneyRe.test(line);
    if (!looksLikeName) continue;

    // Look ahead for VAT and price within next 3 lines
    let vatRate: number | null = null;
    let price: number | null = null;
    let consumedUntil = i;

    for (let j = i + 1; j <= Math.min(i + 3, lines.length - 1); j++) {
      const next = lines[j].trim();
      const v = next.match(vatRe);
      if (v && vatRate === null) {
        vatRate = parseInt(v[1], 10);
        consumedUntil = Math.max(consumedUntil, j);
        continue;
      }
      const m = next.match(moneyRe);
      if (m && price === null) {
        price = parseAmount(m[1]);
        consumedUntil = Math.max(consumedUntil, j);
        break; // usually price ends the block
      }
    }

    const name = line.replace(/^\*+/, '').trim();
    if (name.length < 2) continue;

    items.push({
      line_no: lineNo++,
      name,
      quantity: 1,
      unit: 'adet',
      unit_price: price || 0,
      total_price: price || 0,
      vat_rate: vatRate ?? null
    });

    // Skip consumed lines
    i = consumedUntil;
  }

  // Quantity refinement: if a following line near an item has quantity, update
  for (let idx = 0; idx < items.length; idx++) {
    const baseLineIndex = items[idx].line_no - 1; // approx
    for (let j = baseLineIndex; j < Math.min(baseLineIndex + 3, lines.length); j++) {
      const qtyMatch = lines[j]?.match(/(\d+(?:[.,]\d+)?)\s*(kg|lt|adet|paket)/i);
      if (qtyMatch) {
        items[idx].quantity = parseFloat(qtyMatch[1].replace(',', '.'));
        items[idx].unit = qtyMatch[2].toLowerCase();
        if (items[idx].unit_price && !items[idx].total_price) {
          items[idx].total_price = items[idx].unit_price * items[idx].quantity;
        }
        break;
      }
    }
  }

  return items;
}

/**
 * Parse discounts from receipt lines
 */
function parseDiscounts(lines: string[]): any[] {
  const discounts: any[] = [];
  
  for (const line of lines) {
    const discountMatch = line.match(/(ind|indirim|kasa ind|kart ind|promo|kupon)/i);
    if (discountMatch) {
      const amountMatch = line.match(/(\d+[.,]\d{2})/);
      if (amountMatch) {
        const amount = parseAmount(amountMatch[1]);
        if (amount && amount > 0) {
          discounts.push({
            applies_to_line: null,
            reason: discountMatch[1],
            amount: amount
          });
        }
      }
    }
  }
  
  return discounts;
}

/**
 * Extract totals from receipt text
 */
function extractTotals(text: string): { subtotal?: number; vat_total?: number; grand_total?: number } {
  const result: any = {};
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Subtotal patterns (same line)
  const subtotalMatch = text.match(/(?:ara\s*toplam|subtotal)\s*[:=]?\s*(\d+[.,]\d{2})/i);
  if (subtotalMatch) {
    result.subtotal = parseAmount(subtotalMatch[1]);
  }

  // VAT total patterns (same line)
  const vatMatch = text.match(/(?:topkdv|kdv\s*tutari|toplam\s*kdv)\s*[:=]?\s*(\d+[.,]\d{2})/i);
  if (vatMatch) {
    result.vat_total = parseAmount(vatMatch[1]);
  }

  // Grand total patterns (same line)
  const totalPatterns = [
    /(?:genel\s*)?toplam\s*[:=]?\s*(\d+[.,]\d{2})/i,
    /(?:kdv'li\s*toplam|ödenecek.*tutar)\s*[:=]?\s*(\d+[.,]\d{2})/i,
    /total\s*[:=]?\s*(\d+[.,]\d{2})/i
  ];

  for (const pattern of totalPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.grand_total = parseAmount(match[1]);
      break;
    }
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
    const idx = lines.findIndex(l => /\bara\s*toplam\b/i.test(l));
    if (idx >= 0) result.subtotal = moneyNear(idx) ?? result.subtotal;
  }

  if (result.vat_total == null) {
    const idx = lines.findIndex(l => /\b(topkdv|kdv\s*tutari|toplam\s*kdv)\b/i.test(l));
    if (idx >= 0) result.vat_total = moneyNear(idx) ?? result.vat_total;
  }

  if (result.grand_total == null) {
    const idx = lines.findIndex(l => /\b(genel\s*toplam|kdv'li\s*toplam|ödenecek.*tutar|toplam)\b/i.test(l));
    if (idx >= 0) result.grand_total = moneyNear(idx) ?? result.grand_total;
  }

  return result;
}

/**
 * Calculate computed totals and reconciliation
 */
function calculateComputedTotals(items: any[], discounts: any[], totals: any): any {
  const itemsSum = items.reduce((sum, item) => sum + (item.total_price || 0), 0);
  const discountsSum = discounts.reduce((sum, discount) => sum + (discount.amount || 0), 0);
  
  const expectedTotal = itemsSum - discountsSum + (totals.vat_total || 0);
  const actualTotal = totals.grand_total || 0;
  
  const difference = Math.abs(expectedTotal - actualTotal);
  const reconciles = difference <= (actualTotal * 0.01); // 1% tolerance
  
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
  
  // Extract merchant info
  const merchantLine = lines.find(line => 
    line.match(/migros|bim|carrefour/i) && !line.match(/\d{2}[.\/]\d{2}/)
  ) || lines[0];
  
  const merchantName = merchantLine ? merchantLine.trim() : 'Unknown';
  // Prefer chain group name
  const merchantDisplay = (() => {
    if (formatDetection.format !== 'Unknown') {
      return formatDetection.format === 'BIM' ? 'BİM' : formatDetection.format;
    }
    if (/carrefour/i.test(merchantName)) return 'CarrefourSA';
    if (/b[iİ]m/i.test(merchantName)) return 'BİM';
    if (/migros|mi̇gros/i.test(merchantName)) return 'Migros';
    return merchantName;
  })();
  
  const addressLines = lines.filter(line => 
    line.match(/mah|cad|sok|bulv|tel|adres/i) && !line.match(/migros|bim|carrefour/i)
  );
  const addressFull = addressLines.join(' ');
  const addressParsed = parseAddress(addressFull);
  
  // Extract receipt details
  const dateText = lines.find(line => line.match(/tarih|date/i)) || normalizedText;
  const timeText = lines.find(line => line.match(/saat|time/i)) || normalizedText;
  const receiptDate = extractDate(dateText);
  const receiptTime = extractTime(timeText);
  
  // Extract receipt number
  const receiptNoMatch = normalizedText.match(/(?:fiş|fis|no|belge)\s*[:=]?\s*([a-z0-9\-\/]{4,})/i);
  const receiptNo = receiptNoMatch ? receiptNoMatch[1] : null;
  
  // Extract payment method (prefer masked PAN like 406281******9820)
  const panMatch = normalizedText.match(/\b\d{4,6}\*{4,10}\d{4}\b/);
  const paymentMethod = panMatch ? panMatch[0] : (/\bNAK[İI]T\b/i.test(normalizedText) ? 'NAKIT' : (/\bKART\b/i.test(normalizedText) ? 'KART' : null));
  const cardMasked = panMatch ? `---${panMatch[0].slice(-4)}` : null;
  
  // Parse items and discounts
  const items = parseItems(lines).slice(0, 50);
  const discounts = parseDiscounts(lines);
  
  // Extract totals
  const totals = extractTotals(normalizedText);
  // Fallback: choose largest money value when still missing
  if (!totals.grand_total) {
    const matches = [...normalizedText.matchAll(/(\d{1,4}[.,]\d{2})/g)];
    let maxVal = 0;
    for (const m of matches) {
      const v = parseAmount(m[1]);
      if (v && v > maxVal) maxVal = v;
    }
    if (maxVal > 0) totals.grand_total = maxVal;
  }
  
  // Calculate computed totals
  const computedTotals = calculateComputedTotals(items, discounts, totals);
  
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