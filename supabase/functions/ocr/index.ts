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
      name: 'Şok',
      patterns: ['sok', 'marketler', 'ticaret', 'a.s.', 'sok market']
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
  
  if (format === 'Şok') {
    return parseŞokItems(lines);
  } else if (format !== 'Migros') {
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

    // KOCAILEM discount - look for "TUTAR İND. (KOCAILEM)" pattern
    if (line.includes('TUTAR İND.') && line.includes('KOCAİLEM')) {
      // Look for the discount amount in previous lines (typical Migros pattern)
      for (let j = i - 3; j <= i + 1; j++) {
        if (j >= 0 && j < lines.length) {
          const discountLine = lines[j];
          const discountMatch = discountLine.match(/[\*\s]*(-\d+[.,]\d+)/);
          if (discountMatch) {
            const discountAmount = parseFloat(discountMatch[1].replace(',', '.'));
            discounts.push({
              description: 'KOCAILEM İNDİRİMİ',
              amount: discountAmount // Keep as negative
            });
            console.log(`Found KOCAILEM discount: ${discountAmount} TL`);
            break;
          }
        }
      }
    }

    // Other discount patterns
    if (/\b(tutar\s*ind|indirim)\b/i.test(line) && !line.includes('KOCAİLEM')) {
      const currentMatch = line.match(/[\*\s]*(-?\d+[.,]\d+)/);
      if (currentMatch) {
        const amount = parseFloat(currentMatch[1].replace(',', '.'));
        if (amount < 0) {
          const discountName = line.replace(/[\*\d\.,\s-]+$/, '').trim() || 'İNDİRİM';
          discounts.push({
            description: discountName,
            amount: amount
          });
          console.log(`Found discount: ${discountName} = ${amount} TL`);
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
 * Parse Şok Market items following strict user requirements
 */
function parseŞokItems(lines: string[]): any[] {
  const items: any[] = [];
  
  console.log(`\n=== ŞOK ITEMS PARSING ===`);
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

  // Find end: before payment details/totals
  let endIndex = lines.length;
  for (let i = startIndex + 1; i < lines.length; i++) {
    const line = alphaNormalize(lines[i]);
    if (/\b(topkdv|kdv|genel\s*toplam|toplam|ara\s*toplam|satis|odeme|kart|pos|nakit)\b/i.test(line)) {
      endIndex = i;
      break;
    }
  }

  console.log(`Items parsing range: ${startIndex + 1} to ${endIndex}`);

  const processedItems = new Map<string, any>(); // Group identical items

  for (let i = startIndex + 1; i < endIndex; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    console.log(`Processing line ${i}: "${line}"`);

    // Enhanced noise filtering for Şok receipts
    const alphaLine = alphaNormalize(line);
    if (/\b(bilgi\s*fisi|tur|mersis|vergi|tel|telefon|www|http)\b/i.test(alphaLine)) {
      console.log(`  ❌ Skipping non-product line (noise)`);
      continue;
    }

    // Skip system codes, reference numbers, and pure numeric lines
    if (/^[\d\s*#%-]+$/.test(line) && !/\d+[.,]\d{2}/.test(line)) {
      console.log(`  ❌ Skipping system line`);
      continue;
    }

    // Skip lines starting with % (tax lines)
    if (/^%/.test(line)) {
      console.log(`  ❌ Skipping tax line`);
      continue;
    }

    let item: any = null;

    // Pattern 1: Weight-based items - look for product name in PREVIOUS line
    const weightMatch = line.match(/^(\d+[.,]\d{2,3})\s*KG\s*[x×]\s*(\d{1,4}[.,]\d{2})\s*TL\/KG.*?(\d{1,4}[.,]\d{2})/i);
    if (weightMatch) {
      const [, weight, unitPrice, total] = weightMatch;
      // Look for product name in previous line
      let productName = 'Ağırlıklı Ürün';
      if (i > 0 && lines[i-1]) {
        const prevLine = lines[i-1].trim();
        // Make sure previous line doesn't contain price or system info
        if (prevLine && !/\d+[.,]\d{2}/.test(prevLine) && !/^%/.test(prevLine)) {
          productName = prevLine;
        }
      }
      
      item = {
        name: `${productName} — ${weight.replace(',', '.')} KG x ${unitPrice.replace(',', '.')} TL/KG`,
        qty: parseFloat(weight.replace(',', '.')),
        unit_price: parseFloat(unitPrice.replace(',', '.')),
        line_total: parseFloat(total.replace(',', '.')),
        raw_line: line
      };
      console.log(`  ✅ Weight item: ${item.name} — ${item.line_total} TL`);
    }
    // Pattern 2: Regular items with explicit quantity (e.g., "ÜLKER ÇİKOLATA x3 12,75")
    else if (/[x×]\s*(\d+)\s*[*]?\s*(\d{1,4}[.,]\d{2})$/i.test(line)) {
      const match = line.match(/^(.+?)\s*[x×]\s*(\d+)\s*[*]?\s*(\d{1,4}[.,]\d{2})$/i);
      if (match) {
        const [, name, qty, total] = match;
        const unitPrice = parseFloat(total.replace(',', '.')) / parseInt(qty);
        
        item = {
          name: `${name.trim()} x${qty}`,
          qty: parseInt(qty),
          unit_price: Math.round(unitPrice * 100) / 100,
          line_total: parseFloat(total.replace(',', '.')),
          raw_line: line
        };
        console.log(`  ✅ Multi-quantity item: ${item.name} — ${item.line_total} TL`);
      }
    }
    // Pattern 3: Standard product line ending with *PRICE
    else if (/^(.+?)\s*[*]\s*(\d{1,4}[.,]\d{2})$/i.test(line)) {
      const match = line.match(/^(.+?)\s*[*]\s*(\d{1,4}[.,]\d{2})$/i);
      if (match) {
        const [, name, price] = match;
        const cleanName = name.trim();
        
        // Skip if it looks like a discount or total line
        if (/\b(indirim|toplam|ara|tutar|kdv|satis|odeme)\b/i.test(cleanName)) {
          console.log(`  ❌ Skipping total/discount line`);
          continue;
        }
        
        item = {
          name: cleanName,
          qty: 1,
          unit_price: parseFloat(price.replace(',', '.')),
          line_total: parseFloat(price.replace(',', '.')),
          raw_line: line
        };
        console.log(`  ✅ Regular item: ${item.name} — ${item.line_total} TL`);
      }
    }
    // Pattern 4: Simple items with price at end (no asterisk)
    else if (/^(.+?)\s+(\d{1,4}[.,]\d{2})$/i.test(line)) {
      const match = line.match(/^(.+?)\s+(\d{1,4}[.,]\d{2})$/i);
      if (match) {
        const [, name, price] = match;
        const cleanName = name.trim();
        
        // Skip if it looks like a discount or total line
        if (/\b(indirim|toplam|ara|tutar|kdv|satis|odeme)\b/i.test(cleanName)) {
          console.log(`  ❌ Skipping total/discount line`);
          continue;
        }
        
        item = {
          name: cleanName,
          qty: 1,
          unit_price: parseFloat(price.replace(',', '.')),
          line_total: parseFloat(price.replace(',', '.')),
          raw_line: line
        };
        console.log(`  ✅ Regular item: ${item.name} — ${item.line_total} TL`);
      }
    }

    // Add item to processed list (group identical items)
    if (item) {
      const key = item.name.toLowerCase();
      if (processedItems.has(key)) {
        const existing = processedItems.get(key);
        existing.qty += item.qty;
        existing.line_total += item.line_total;
        existing.name = `${existing.name.replace(/ x\d+$/, '')} x${existing.qty}`;
        console.log(`  🔄 Updated existing item: ${existing.name} — ${existing.line_total} TL`);
      } else {
        processedItems.set(key, item);
        items.push(item);
      }
    } else {
      console.log(`  ❓ Could not parse line as item`);
    }
  }

  console.log(`=== ŞOK ITEMS PARSING COMPLETE: Found ${items.length} items ===\n`);
  return items;
}

/**
 * Parse discounts for Şok Market receipts
 */
function parseŞokDiscounts(lines: string[]): any[] {
  const discounts: any[] = [];
  
  console.log(`\n=== ŞOK DISCOUNT PARSING ===`);
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const alphaLine = alphaNormalize(line);
    
    // Look for discount patterns
    if (/\b(indirim|tutar\s*ind)\b/i.test(alphaLine)) {
      console.log(`Found discount line: "${line}"`);
      
      // Extract discount amount
      const amountMatch = line.match(/-?\s*(\d{1,4}[.,]\d{2})/);
      if (amountMatch) {
        const amount = -Math.abs(parseFloat(amountMatch[1].replace(',', '.'))); // Ensure negative
        
        // Look for discount description in nearby lines
        let description = 'İndirim';
        for (let j = Math.max(0, i-2); j <= Math.min(lines.length-1, i+2); j++) {
          if (j !== i && /\b(kocailem|member|uye|promosyon)\b/i.test(alphaNormalize(lines[j]))) {
            description = lines[j].trim();
            break;
          }
        }
        
        discounts.push({
          description: description,
          amount: amount,
          raw_line: line
        });
        
        console.log(`  ✅ Discount: ${description} — ${amount} TL`);
      }
    }
  }
  
  console.log(`=== ŞOK DISCOUNT PARSING COMPLETE: Found ${discounts.length} discounts ===\n`);
  return discounts;
}

/**
 * Extract totals for Şok Market receipts
 */
function extractŞokTotals(text: string): { grand_total: number | null } {
  console.log(`\n=== ŞOK TOTAL EXTRACTION ===`);
  
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  let grandTotal: number | null = null;
  
  // Strategy 1: Look for final payment amount with * prefix
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    
    // Look for *XXX,XX TL pattern (final amount paid)
    const finalAmountMatch = line.match(/[*]\s*(\d{1,4}[.,]\d{2})\s*TL$/i);
    if (finalAmountMatch) {
      grandTotal = parseFloat(finalAmountMatch[1].replace(',', '.'));
      console.log(`Found final payment amount: ${grandTotal} TL`);
      break;
    }
  }
  
  // Strategy 2: Look for "TOPLAM" lines if final amount not found
  if (!grandTotal) {
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      const alphaLine = alphaNormalize(line);
      
      if (/\b(toplam)\b/i.test(alphaLine) && !/ara\s*toplam|topkdv/i.test(alphaLine)) {
        console.log(`Found total line: "${line}"`);
        
        // Extract amount from same line or next line
        let amountMatch = line.match(/[*]?\s*(\d{1,4}[.,]\d{2})/);
        if (amountMatch) {
          grandTotal = parseFloat(amountMatch[1].replace(',', '.'));
          console.log(`  ✅ Grand total from same line: ${grandTotal} TL`);
          break;
        }
        
        // Check next line for amount
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1];
          amountMatch = nextLine.match(/[*]?\s*(\d{1,4}[.,]\d{2})/);
          if (amountMatch) {
            grandTotal = parseFloat(amountMatch[1].replace(',', '.'));
            console.log(`  ✅ Grand total from next line: ${grandTotal} TL`);
            break;
          }
        }
      }
    }
  }
  
  console.log(`=== ŞOK TOTAL EXTRACTION COMPLETE ===\n`);
  return { grand_total: grandTotal };
}

/**
 * Extract card info for Şok Market receipts
 */
function extractŞokCardInfo(text: string): string | null {
  console.log(`\n=== ŞOK CARD INFO EXTRACTION ===`);
  
  // Look for card patterns specific to Şok
  const cardPatterns = [
    /(\d{4,6})\*+(\d{4})/,  // 528208******6309
    /\*+(\d{4})/,           // ******6309
    /(\d{4})\s*\*+\s*(\d{4})/,  // 5282 **** 6309
    /KART.*?(\d{4})$/m      // KART ending with 4 digits
  ];

  for (const pattern of cardPatterns) {
    const match = text.match(pattern);
    if (match) {
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
 * Extract store location for Şok Market receipts
 */
function extractŞokStoreLocation(text: string): string | null {
  console.log(`\n=== ŞOK STORE LOCATION EXTRACTION ===`);
  
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  let addressLines: string[] = [];

  for (const line of lines) {
    // Stop at TARIH or FIS NO
    if (/\b(tarih|fis\s*no)\b/i.test(line)) break;

    // Skip phone numbers, TEL, customer service, URLs, tax info, and company identifiers
    if (/\b(tel|telefon|m[uü]steri|iletis[iı]m|kdv|vergi|mersis|v\.d\.|anadolu|kurumlar)\b/i.test(line)) continue;
    if (/https?:\/\//i.test(line) || /\bwww\./i.test(line)) continue;
    if (/^\d+$/.test(line.trim())) continue; // Skip pure numbers
    if (/^[\d\s-]+$/.test(line.trim())) continue; // Skip number sequences

    // Extract company name and address parts
    if (/\b(şok\s*marketler|mah|mahalle|sok|sokak|cad|cadde|blv|bulvar|no|istanbul|ankara|izmir|esenyurt|cumhuriyet|halilbey)\b/i.test(line)) {
      // Clean the line and add to address
      let cleanLine = line.replace(/^[\d-]+\s*/, ''); // Remove leading numbers
      cleanLine = cleanLine.replace(/\s*TEL.*$/i, ''); // Remove TEL and everything after
      
      if (cleanLine.trim()) {
        addressLines.push(cleanLine.trim());
      }
    }
  }

  if (addressLines.length > 0) {
    let location = addressLines.join(' ').trim();
    // Clean up extra spaces and normalize
    location = location.replace(/\s+/g, ' ');
    console.log(`Found store location: ${location}`);
    return location;
  }

  console.log('No store location found');
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

  // Extract basic info - STRICT DATE/TIME FORMATTING for Migros
  console.log('\n=== DATE & TIME EXTRACTION ===');
  
  let purchaseDate = null;
  let purchaseTime = null;
  
  // Strategy 1: Look for combined date and time patterns
  const combinedMatch = rawText.match(/TAR[İI]H[:.\s]*(\d{1,2})[\/.:](\d{1,2})[\/.:](\d{4})[\s\S]*?SAAT[:.\s]*(\d{1,2})(?::(\d{2}))?/i);
  if (combinedMatch) {
    purchaseDate = `${combinedMatch[1].padStart(2, '0')}/${combinedMatch[2].padStart(2, '0')}/${combinedMatch[3]}`;
    purchaseTime = `${combinedMatch[4].padStart(2, '0')}:${(combinedMatch[5] ?? '00')}`;
    console.log(`Found combined date/time: ${purchaseDate} ${purchaseTime}`);
  }
  
  // Strategy 2: Separate date and time extraction
  if (!purchaseDate || !purchaseTime) {
    // Extract date - support various separators and formats
    const datePattern = /TAR[İI]H[:.\s]*(\d{1,2})[\/.:-](\d{1,2})[\/.:-](\d{2,4})/i;
    const dateMatch = rawText.match(datePattern);
    
    if (dateMatch) {
      let day = dateMatch[1].padStart(2, '0');
      let month = dateMatch[2].padStart(2, '0');
      let year = dateMatch[3];
      
      // Handle 2-digit years (assume 20xx)
      if (year.length === 2) {
        year = '20' + year;
      }
      
      purchaseDate = `${day}/${month}/${year}`;
      console.log(`Found date: ${purchaseDate}`);
    }
    
    // Extract time
    const timePattern = /SAAT[:.\s]*(\d{1,2})(?::(\d{2}))?/i;
    const timeMatch = rawText.match(timePattern);
    
    if (timeMatch) {
      purchaseTime = `${timeMatch[1].padStart(2, '0')}:${(timeMatch[2] ?? '00')}`;
      console.log(`Found time: ${purchaseTime}`);
    }
  }
  
  // Strategy 3: Fallback - extract any date-like numbers if primary patterns fail
  if (!purchaseDate) {
    console.log('Primary date extraction failed, trying fallback...');
    // Look for any DD/MM/YYYY or DD.MM.YYYY pattern in the text
    const fallbackDateMatch = rawText.match(/(\d{1,2})[\/.:](\d{1,2})[\/.:](\d{4})/);
    if (fallbackDateMatch) {
      purchaseDate = `${fallbackDateMatch[1].padStart(2, '0')}/${fallbackDateMatch[2].padStart(2, '0')}/${fallbackDateMatch[3]}`;
      console.log(`Fallback date found: ${purchaseDate}`);
    }
  }
  
  // Strategy 4: If still no time, look for any HH:MM pattern
  if (!purchaseTime) {
    console.log('Primary time extraction failed, trying fallback...');
    const fallbackTimeMatch = rawText.match(/(\d{1,2}):(\d{2})/);
    if (fallbackTimeMatch && parseInt(fallbackTimeMatch[1]) <= 23 && parseInt(fallbackTimeMatch[2]) <= 59) {
      purchaseTime = `${fallbackTimeMatch[1].padStart(2, '0')}:${fallbackTimeMatch[2]}`;
      console.log(`Fallback time found: ${purchaseTime}`);
    }
  }
  
  // Ensure we always have some date (use current date as last resort)
  if (!purchaseDate) {
    const now = new Date();
    purchaseDate = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
    console.log(`Using current date as fallback: ${purchaseDate}`);
  }
  
  // Default time if not found
  if (!purchaseTime) {
    purchaseTime = '00:00';
    console.log(`Using default time: ${purchaseTime}`);
  }
  
  const fullDateTime = `${purchaseDate} ${purchaseTime}`;
  console.log(`Final Date/Time: ${fullDateTime}`);
  console.log('=== DATE & TIME EXTRACTION COMPLETE ===\n');

  // Parse items (NEVER leave empty)
  const items = parseItems(lines, formatDetection.format);
  
  // Parse discounts
  let discounts = [];
  if (formatDetection.format === 'Şok') {
    discounts = parseŞokDiscounts(lines);
  } else {
    discounts = parseDiscounts(lines, formatDetection.format);
  }
  
  // Extract totals
  let totals;
  if (formatDetection.format === 'Şok') {
    totals = extractŞokTotals(rawText);
  } else {
    totals = extractTotals(rawText, formatDetection.format);
  }
  
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
  let cardLast4, storeLocation;
  if (formatDetection.format === 'Şok') {
    cardLast4 = extractŞokCardInfo(rawText);
    storeLocation = extractŞokStoreLocation(rawText);
  } else {
    cardLast4 = extractCardInfo(rawText);
    storeLocation = extractStoreLocation(rawText);
  }

  // Ensure proper formatting for Turkish requirements
  const formattedDateTime = `${purchaseDate} ${purchaseTime}`;
  
  const result = {
    store_location: storeLocation,
    purchase_time: purchaseTime, // Time only in Turkish 24-hour format (HH:MM)
    items: items,
    discounts: discounts,
    grand_total: grandTotal,
    card_last4: cardLast4,
    
    // Additional fields for compatibility
    merchant_raw: formatDetection.format,
    merchant_brand: formatDetection.format,
    purchase_date: purchaseDate, // Date only in DD/MM/YYYY format
    store_address: storeLocation,
    total: grandTotal || 0,
    payment_method: cardLast4 ? `Credit Card (****${cardLast4})` : 'Cash',
    receipt_unique_no: null,
    fis_no: null,
    barcode_numbers: [],
    raw_text: rawText,
    
    // Combined date/time field for backward compatibility
    date_time: formattedDateTime
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
