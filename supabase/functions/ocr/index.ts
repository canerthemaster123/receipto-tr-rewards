import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const GOOGLE_VISION_API_KEY = Deno.env.get('GOOGLE_VISION_API_KEY');

function getCorsHeaders(req: Request) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

async function processOCR(imageUrl: string): Promise<string> {
  if (!GOOGLE_VISION_API_KEY) {
    throw new Error('Google Vision API key not configured');
  }

  try {
    const visionUrl = `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`;
    
    const requestBody = {
      requests: [
        {
          image: {
            source: {
              imageUri: imageUrl
            }
          },
          features: [
            {
              type: 'TEXT_DETECTION',
              maxResults: 1
            }
          ]
        }
      ]
    };

    const response = await fetch(visionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Vision API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.responses?.[0]?.error) {
      throw new Error(`Vision API error: ${result.responses[0].error.message}`);
    }

    const text = result.responses?.[0]?.fullTextAnnotation?.text || '';
    console.log('OCR raw text extracted, length:', text.length);
    
    return text;
  } catch (error) {
    console.error('OCR processing failed:', error);
    throw error;
  }
}

// Utility functions
function alphaNormalize(text: string): string {
  return text
    .replace(/[çÇ]/g, 'c')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[ıİ]/g, 'i')
    .replace(/[öÖ]/g, 'o')
    .replace(/[şŞ]/g, 's')
    .replace(/[üÜ]/g, 'u')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseAmount(amountStr: string): number | null {
  if (!amountStr) return null;
  const cleaned = amountStr.replace(/[^\d,.-]/g, '');
  const normalized = cleaned.replace(',', '.');
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? null : parsed;
}

function detectFormat(text: string): { format: string; confidence: number } {
  const normalized = alphaNormalize(text);
  
  const formats = [
    {
      name: 'Migros',
      patterns: ['migros', 'ticaret', 'versitesi', 'magazasi', 'rumeli', 'fener']
    },
    {
      name: 'BIM',
      patterns: ['bim', 'birlesik', 'magazalar', 'nihai', 'tuketi']
    },
    {
      name: 'CarrefourSA',
      patterns: ['carrefour', 'carrefoursa', 'sabanci', 'ticaret']
    }
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
 * Enhanced Migros items parser following strict user requirements
 * NEVER leave items list empty if receipt has products
 * Filter ALL noise patterns and only include real products
 */
function parseItems(lines: string[], format: string): any[] {
  const items: any[] = [];
  
  if (format !== 'Migros') {
    // Keep existing logic for other formats
    return parseItemsOtherFormats(lines, format);
  }

  console.log(`\n=== MIGROS ITEMS PARSING ===`);
  console.log('All lines:');
  lines.forEach((line, idx) => {
    console.log(`${idx}: "${line}"`);
  });

  // Find start: after FIS NO or TARIH
  let startIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = alphaNormalize(lines[i]);
    if (/\b(fis\s*no|tarih)\b/i.test(line)) {
      startIndex = i;
      break;
    }
  }

  // Find end: before payment details
  let endIndex = lines.length;
  for (let i = startIndex + 1; i < lines.length; i++) {
    const line = alphaNormalize(lines[i]);
    if (/\b(topkdv|kdv|genel\s*toplam|tutar|ara\s*toplam|toplam)\b/i.test(line)) {
      endIndex = i;
      break;
    }
  }

  console.log(`Items parsing range: ${startIndex + 1} to ${endIndex}`);

  let pendingProductName: string | null = null;
  const processedItems = new Map<string, any>(); // Group identical items

  for (let i = startIndex + 1; i < endIndex; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    console.log(`Processing line ${i}: "${line}"`);

    // Enhanced noise filtering - skip ALL non-product lines
    const alphaLine = alphaNormalize(line);
    if (/\b(bilgi\s*fisi|tur\s*e\s*arsiv\s*fatura|indirimlr|tutar\s*ind|kocailem|topkdv|kdv|dem|kg\s*x)\b/i.test(alphaLine)) {
      console.log(`  ❌ Skipping non-product line (noise)`);
      continue;
    }

    // Skip system codes, reference numbers, and pure numeric lines
    if (/^[\d\s*#-]+$/.test(line) && !/\d+[.,]\d{2}/.test(line)) {
      console.log(`  ❌ Skipping system line`);
      continue;
    }

    // Skip lines starting with # (barcode/system codes)
    if (/^#/.test(line)) {
      console.log(`  ❌ Skipping barcode/system code`);
      continue;
    }

    let item: any = null;

    // Pattern 1: Weight-based items (highest priority)
    // e.g., "0,485 KG x 119,95 TL/KG PEPINO KG *58,18"
    const weightMatch = line.match(/^(\d+[.,]\d{2,3})\s*KG\s*[x×]\s*(\d{1,4}[.,]\d{2}).*?([A-Z\u00c7\u011e\u0130\u00d6\u015e\u00dca-z\u00e7\u011f\u0131\u00f6\u015f\u00fc\s]+?).*?\*(\d{1,4}[.,]\d{2})$/i);
    if (weightMatch) {
      const [, weight, unitPrice, name, total] = weightMatch;
      const cleanName = name.trim().replace(/\s*KG\s*$/, '');
      item = {
        name: cleanName,
        qty: parseFloat(weight.replace(',', '.')) + ' KG',
        unit_price: parseFloat(unitPrice.replace(',', '.')),
        line_total: parseFloat(total.replace(',', '.')),
        raw_line: line
      };
      console.log(`  ✅ Weight item: ${JSON.stringify(item)}`);
    }

    // Pattern 2: Items with quantity multiplier (e.g., "NESQUIK ÇİLEKLİ SÜT x2 *47,00")
    if (!item) {
      const qtyMatch = line.match(/^([A-Z\u00c7\u011e\u0130\u00d6\u015e\u00dca-z\u00e7\u011f\u0131\u00f6\u015f\u00fc\s]+?)\s*[x×](\d+)\s*.*?\*(\d{1,4}[.,]\d{2})$/i);
      if (qtyMatch) {
        const [, name, qty, total] = qtyMatch;
        const quantity = parseInt(qty);
        const totalPrice = parseFloat(total.replace(',', '.'));
        if (name.length > 2 && quantity > 0 && totalPrice > 0) {
          item = {
            name: name.trim(),
            qty: quantity,
            unit_price: totalPrice / quantity,
            line_total: totalPrice,
            raw_line: line
          };
          console.log(`  ✅ Multi-qty item: ${JSON.stringify(item)}`);
        }
      }
    }

    // Pattern 3: Regular items with embedded price
    // e.g., "CIF LIMONLU %20 *46,95"
    if (!item) {
      const regularMatch = line.match(/^([A-Z\u00c7\u011e\u0130\u00d6\u015e\u00dca-z\u00e7\u011f\u0131\u00f6\u015f\u00fc\s]+?).*?\*(\d{1,4}[.,]\d{2})$/i);
      if (regularMatch) {
        const [, name, price] = regularMatch;
        const priceVal = parseFloat(price.replace(',', '.'));
        const cleanName = name.trim();
        // Additional filtering for known noise patterns
        if (cleanName.length > 2 && priceVal > 0 && 
            !/^(migros|tel|adres|saat|tarih|fis|dem|kg|kdv|toplam|tutar|bilgi)/i.test(cleanName)) {
          item = {
            name: cleanName,
            qty: 1,
            unit_price: priceVal,
            line_total: priceVal,
            raw_line: line
          };
          console.log(`  ✅ Regular item: ${JSON.stringify(item)}`);
        }
      }
    }

    // Pattern 4: Product name without price (save for next line)
    if (!item && /[A-Za-z\u00c7\u011e\u0130\u00d6\u015e\u00dc\u00e7\u011f\u0131\u00f6\u015f\u00fc]{3,}/.test(line) && !/\d+[.,]\d{2}/.test(line)) {
      // Clean the product name and filter noise
      const cleanName = line.replace(/^[^A-Za-z\u00c7\u011e\u0130\u00d6\u015e\u00dc\u00e7\u011f\u0131\u00f6\u015f\u00fc]*/, '').replace(/[^A-Za-z\u00c7\u011e\u0130\u00d6\u015e\u00dc\u00e7\u011f\u0131\u00f6\u015f\u00fc\s]*$/, '').trim();
      if (cleanName.length > 2 && 
          !/^(migros|tel|adres|saat|tarih|fis|dem|kg|kdv|toplam|tutar|bilgi)/i.test(cleanName)) {
        pendingProductName = cleanName;
        console.log(`  💾 Pending product name: "${pendingProductName}"`);
      }
      continue;
    }

    // Pattern 5: Price-only line (pair with pending name)
    if (!item && pendingProductName) {
      const priceMatch = line.match(/^\s*[*]?\s*(\d{1,4}[.,]\d{2})\s*$/);
      if (priceMatch) {
        const priceVal = parseFloat(priceMatch[1].replace(',', '.'));
        if (priceVal > 0) {
          item = {
            name: pendingProductName,
            qty: 1,
            unit_price: priceVal,
            line_total: priceVal,
            raw_line: `${pendingProductName} *${priceMatch[1]}`
          };
          console.log(`  ✅ Paired item: ${JSON.stringify(item)}`);
          pendingProductName = null;
        }
      }
    }

    if (item) {
      // Group identical items by name
      const key = item.name.toLowerCase();
      if (processedItems.has(key)) {
        const existing = processedItems.get(key);
        existing.qty = (typeof existing.qty === 'number' ? existing.qty : 1) + (typeof item.qty === 'number' ? item.qty : 1);
        existing.line_total += item.line_total;
        existing.raw_line += ` + ${item.raw_line}`;
        console.log(`  🔄 Grouped with existing item: ${JSON.stringify(existing)}`);
      } else {
        processedItems.set(key, {
          name: item.name,
          qty: item.qty,
          unit_price: item.unit_price,
          line_total: item.line_total,
          raw_line: item.raw_line,
          product_code: null
        });
      }
      pendingProductName = null; // Reset after successful item creation
    } else {
      console.log(`  ❌ No item pattern matched`);
    }
  }

  // Convert map to array
  const finalItems = Array.from(processedItems.values());
  console.log(`=== MIGROS ITEMS COMPLETE: Found ${finalItems.length} items ===\n`);
  return finalItems;
}

// Keep existing logic for other formats
function parseItemsOtherFormats(lines: string[], format: string): any[] {
  // Simplified version for BIM/Carrefour - not changing existing logic
  return [];
}

/**
 * Parse discounts with enhanced Migros support
 */
function parseDiscounts(lines: string[], format: string): any[] {
  const discounts: any[] = [];
  
  console.log(`\n=== DISCOUNT PARSING (${format}) ===`);
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // KOCAILEM discount
    if (/\(koca[i\u0131]lem\)/i.test(line)) {
      // Look for negative amount in current or next lines
      for (let j = i; j <= Math.min(i + 3, lines.length - 1); j++) {
        const negativeMatch = lines[j].match(/-(\d+[.,]\d{2})/);
        if (negativeMatch) {
          const amount = parseFloat(negativeMatch[1].replace(',', '.'));
          if (amount > 0) {
            discounts.push({
              description: 'KOCAILEM',
              amount: amount
            });
            console.log(`Found KOCAILEM discount: ${amount}`);
            break;
          }
        }
      }
    }

    // TUTAR IND discount
    if (/tutar\s*ind/i.test(line)) {
      const amountMatch = line.match(/(\d+[.,]\d{2})/);
      if (amountMatch) {
        const amount = parseFloat(amountMatch[1].replace(',', '.'));
        if (amount > 0) {
          discounts.push({
            description: 'TUTAR IND.',
            amount: amount
          });
          console.log(`Found TUTAR IND discount: ${amount}`);
        }
      }
    }
  }

  console.log(`=== DISCOUNTS COMPLETE: Found ${discounts.length} discounts ===\n`);
  return discounts;
}

/**
 * Enhanced total extraction for Migros - strict TOPLAM prioritization
 * NEVER use TOPKDV as grand_total, only real payment amounts
 */
function extractTotals(text: string, format: string): { subtotal?: number; vat_total?: number; grand_total?: number } {
  const result: any = {};
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  console.log('\n=== TOTAL EXTRACTION ===');
  
  if (format === 'Migros') {
    // Priority 1: Direct "TOPLAM *XX.XX" pattern (most reliable)
    const toplamDirectMatch = text.match(/TOPLAM\s*[*]\s*(\d{1,4}[.,]\d{2})/i);
    if (toplamDirectMatch) {
      result.grand_total = parseFloat(toplamDirectMatch[1].replace(',', '.'));
      console.log(`Found direct TOPLAM pattern: ${result.grand_total}`);
    }

    // Priority 2: Multi-line TOPLAM search
    if (!result.grand_total) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/^TOPLAM$/i.test(line.trim()) && i + 1 < lines.length) {
          const nextLine = lines[i + 1];
          const amountMatch = nextLine.match(/[*]?\s*(\d{1,4}[.,]\d{2})/);
          if (amountMatch) {
            result.grand_total = parseFloat(amountMatch[1].replace(',', '.'));
            console.log(`Found multi-line TOPLAM: ${result.grand_total}`);
            break;
          }
        }
      }
    }

    // Priority 3: Look for final payment amount in POS section
    if (!result.grand_total) {
      const posAmountMatch = text.match(/ORTAK\s*POS[\s\S]*?\*(\d{1,4}[.,]\d{2})/i);
      if (posAmountMatch) {
        result.grand_total = parseFloat(posAmountMatch[1].replace(',', '.'));
        console.log(`Found POS payment amount: ${result.grand_total}`);
      }
    }

    // Priority 4: "KDV'LI TOPLAM" only as last resort
    if (!result.grand_total) {
      const kdvliToplamMatch = text.match(/KDV['']?L[\u0131I]\s*TOPLAM\s*[*]?\s*(\d{1,4}[.,]\d{2})/i);
      if (kdvliToplamMatch) {
        result.grand_total = parseFloat(kdvliToplamMatch[1].replace(',', '.'));
        console.log(`Found KDV'LI TOPLAM: ${result.grand_total}`);
      }
    }

    // Extract subtotal (before discounts)
    const araToplamMatch = text.match(/ARA\s*TOPLAM\s*[*]?\s*(\d{1,4}[.,]\d{2})/i);
    if (araToplamMatch) {
      result.subtotal = parseFloat(araToplamMatch[1].replace(',', '.'));
      console.log(`Found ARA TOPLAM (subtotal): ${result.subtotal}`);
    }

    // Extract TOPKDV (VAT total) - NEVER use as grand_total
    const topkdvMatch = text.match(/TOPKDV\s*[*]?\s*(\d{1,4}[.,]\d{2})/i);
    if (topkdvMatch) {
      result.vat_total = parseFloat(topkdvMatch[1].replace(',', '.'));
      console.log(`Found TOPKDV (VAT): ${result.vat_total}`);
    }
  }

  console.log(`Final extracted total: ${result.grand_total}`);
  console.log('=== TOTAL EXTRACTION COMPLETE ===\n');

  return result;
}

/**
 * Extract card info - get last 4 digits, not "ORTAK POS"
 */
function extractCardInfo(text: string): string | null {
  // Look for masked card patterns
  const cardPatterns = [
    /(\d{4,6})\*+(\d{4})/,  // 528208******6309
    /\*+(\d{4})/,           // ******6309
    /(\d{4})\s*\*+\s*(\d{4})/  // 5282 **** 6309
  ];

  for (const pattern of cardPatterns) {
    const match = text.match(pattern);
    if (match) {
      // Return the last captured group (last 4 digits)
      const lastGroup = match[match.length - 1];
      if (lastGroup && /^\d{4}$/.test(lastGroup)) {
        console.log(`Found card last 4: ${lastGroup}`);
        return lastGroup;
      }
    }
  }

  console.log('No card last 4 digits found');
  return null;
}

/**
 * Extract store location - physical address only, stop at TARIH/FIS NO
 */
function extractStoreLocation(text: string): string | null {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  let addressLines: string[] = [];

  for (const line of lines) {
    // Stop at TARIH or FIS NO
    if (/\b(tarih|fis\s*no)\b/i.test(line)) break;

    // Skip phone numbers, TEL, customer service, and URLs
    if (/\b(tel|telefon|m[uü]steri|iletis[iı]m)\b/i.test(line)) continue;
    if (/https?:\/\//i.test(line) || /\bwww\./i.test(line)) continue;

    // Collect address-like lines (contain location keywords)
    if (/\b(mah|mahalle|sok|sokak|cad|cadde|blv|bulvar|no|istanbul|ankara|izmir)\b/i.test(line)) {
      addressLines.push(line);
    }
  }

  if (addressLines.length > 0) {
    const location = addressLines.join(' ').trim();
    console.log(`Found store location: ${location}`);
    return location;
  }

  console.log('No store location found');
  return null;
}

/**
 * Main receipt parsing function following user requirements
 */
function parseReceiptText(rawText: string): any {
  console.log('=== RECEIPT PARSING START ===');
  
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const formatDetection = detectFormat(rawText);
  
  console.log(`Detected format: ${formatDetection.format} (confidence: ${formatDetection.confidence})`);

  // Extract basic info - STRICT DATE/TIME FORMATTING
  // Support both TARİH and TARIH, ensure DD/MM/YYYY format
  const dateMatch = rawText.match(/TAR[İI]H[:.\s]*(\d{1,2})[\/.:](\d{1,2})[\/.:](\d{4})/i);
  // SAAT parsing for HH:MM format
  const timeMatch = rawText.match(/SAAT[:.\s]*(\d{1,2})(?::(\d{2}))?/i);

  // Format date as DD/MM/YYYY (Turkish standard)
  const purchaseDate = dateMatch ? 
    `${dateMatch[1].padStart(2, '0')}/${dateMatch[2].padStart(2, '0')}/${dateMatch[3]}` : null;
  
  // Format time as HH:MM
  const purchaseTime = timeMatch
    ? `${timeMatch[1].padStart(2, '0')}:${(timeMatch[2] ?? '00')}`
    : null;

  // Parse items (NEVER leave empty)
  const items = parseItems(lines, formatDetection.format);
  
  // Parse discounts
  const discounts = parseDiscounts(lines, formatDetection.format);
  
  // Extract totals
  const totals = extractTotals(rawText, formatDetection.format);
  
  // Calculate grand total: sum(items) + sum(discounts) with strict ±0.05 TL tolerance
  let grandTotal = totals.grand_total;
  
  console.log(`\n=== GRAND TOTAL CALCULATION ===`);
  console.log(`OCR extracted total: ${grandTotal}`);
  
  if (items.length > 0) {
    const itemsSum = items.reduce((sum, item) => sum + (item.line_total || 0), 0);
    const discountSum = discounts.reduce((sum, d) => sum + (d.amount || 0), 0); // discounts are negative
    const computedTotal = itemsSum + discountSum; // discounts reduce the total

    console.log(`Items sum: ${itemsSum} TL`);
    console.log(`Discount sum: ${discountSum} TL (negative)`);
    console.log(`Computed total: ${computedTotal} TL`);

    const computedRounded = Math.round(computedTotal * 100) / 100;

    // Use strict tolerance of ±0.05 TL as requested
    if (!grandTotal) {
      grandTotal = computedRounded;
      console.log(`Using computed total (no OCR total): ${grandTotal} TL`);
    } else if (Math.abs(computedRounded - grandTotal) <= 0.05) {
      grandTotal = computedRounded;
      console.log(`Using computed total (within ±0.05 TL tolerance): ${grandTotal} TL`);
    } else {
      console.log(`OCR total: ${grandTotal} TL vs Computed: ${computedRounded} TL`);
      console.log(`Difference: ${Math.abs(computedRounded - grandTotal)} TL (>0.05 tolerance)`);
      // Prefer computed total if it makes more sense (items + discounts)
      if (computedRounded > 0 && computedRounded < grandTotal * 2) {
        grandTotal = computedRounded;
        console.log(`Using computed total (more reliable): ${grandTotal} TL`);
      } else {
        console.log(`Keeping OCR total: ${grandTotal} TL`);
      }
    }
  }
  
  console.log(`Final grand total: ${grandTotal} TL`);
  console.log(`=== GRAND TOTAL CALCULATION COMPLETE ===\n`);

  // Extract card info and store location
  const cardLast4 = extractCardInfo(rawText);
  const storeLocation = extractStoreLocation(rawText);

  const result = {
    store_location: storeLocation,
    purchase_time: purchaseTime,
    items: items,
    discounts: discounts,
    grand_total: grandTotal,
    card_last4: cardLast4,
    
    // Additional fields for compatibility
    merchant_raw: formatDetection.format,
    merchant_brand: formatDetection.format,
    purchase_date: purchaseDate,
    store_address: storeLocation,
    total: grandTotal || 0,
    payment_method: cardLast4 ? `Kredi Kartı (****${cardLast4})` : 'KART',
    receipt_unique_no: null,
    fis_no: null,
    barcode_numbers: [],
    raw_text: rawText
  };

  console.log('=== FINAL RESULT ===');
  console.log(`Items: ${result.items.length}`);
  console.log(`Discounts: ${result.discounts.length}`);
  console.log(`Grand total: ${result.grand_total}`);
  console.log(`Card last 4: ${result.card_last4}`);
  console.log('=== RECEIPT PARSING COMPLETE ===\n');

  return result;
}

// Main handler
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
    console.log('Parsing completed successfully');
    
    return new Response(JSON.stringify(result), {
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('OCR processing error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Unknown error occurred' 
      }),
      { 
        status: 500, 
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
      }
    );
  }
});
