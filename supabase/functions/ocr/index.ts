import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

// Import shared utilities
import { normalizeNumber, isMoney, extractMoneyValues, parseQuantityUnit, fixOcrDigits } from '../_shared/numeric.ts';
import { 
  extractDates, extractTimes, extractReceiptNumbers, extractVAT,
  TOTAL_PATTERNS, SUBTOTAL_PATTERNS, DISCOUNT_PATTERNS, PAN_PATTERN, PAYMENT_PATTERNS
} from '../_shared/regex-tr.ts';
import { luhnValid, getCardLast4, detectCardScheme, maskCardNumber } from '../_shared/luhn.ts';
import { normalizeMerchantToChain, extractMerchantBrand, cleanMerchantName } from '../_shared/merchant-normalize.ts';
import { matchStore, upsertStore, parseAddressComponents } from '../_shared/store-match.ts';

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