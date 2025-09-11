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
 * Preprocess and normalize Şok receipt text for better parsing
 */
function preprocessŞokText(text: string): string {
  console.log('\n=== ŞOK TEXT PREPROCESSING ===');
  
  let processed = text;
  
  // Fix common OCR issues for Turkish characters
  processed = processed.replace(/İ/g, 'I').replace(/ı/g, 'i');
  processed = processed.replace(/[Ğğ]/g, 'g').replace(/[Şş]/g, 's');
  processed = processed.replace(/[Çç]/g, 'c').replace(/[Üü]/g, 'u');
  processed = processed.replace(/[Öö]/g, 'o');
  
  // Normalize price formats
  processed = processed.replace(/(\d+)\s*([,.]\s*\d{2})\s*TL/g, '$1$2');
  processed = processed.replace(/(\d+)\s*,\s*(\d{2})/g, '$1,$2');
  
  // Fix broken KG patterns
  processed = processed.replace(/(\d+[.,]\d{2,3})\s*K\s*G/gi, '$1 KG');
  processed = processed.replace(/(\d+[.,]\d{2})\s*T\s*L\s*\/\s*K\s*G/gi, '$1 TL/KG');
  
  // Remove excessive whitespace but preserve structure
  processed = processed.replace(/[ \t]+/g, ' ');
  processed = processed.replace(/\n\s*\n/g, '\n');
  
  console.log('Text preprocessing complete');
  return processed;
}

/**
 * Parse Şok Market items with comprehensive two-pass approach
 * CRITICAL: Every individual product must appear in items list
 * NEVER collapse or group items - list each product separately
 */
function parseŞokItems(lines: string[]): any[] {
  const items: any[] = [];
  
  console.log(`\n=== ŞOK ITEMS PARSING (TWO-PASS) ===`);
  console.log('All input lines:');
  lines.forEach((line, idx) => {
    console.log(`${idx}: "${line}"`);
  });

  // PASS 1: Identify parsing boundaries
  let startIndex = -1;
  let endIndex = lines.length;
  
  // Find start: after header but before items
  for (let i = 0; i < lines.length; i++) {
    const line = alphaNormalize(lines[i]);
    if (/\b(fis\s*no|tarih|saat)\b/i.test(line)) {
      startIndex = i;
      break;
    }
  }
  
  // Fallback: start after store info
  if (startIndex === -1) {
    for (let i = 0; i < Math.min(8, lines.length); i++) {
      if (/\b(şok|marketler|t\.a\.ş)\b/i.test(lines[i])) {
        startIndex = i + 1;
        break;
      }
    }
  }
  
  // Find end: before payment/total section
  for (let i = startIndex + 1; i < lines.length; i++) {
    const line = alphaNormalize(lines[i]);
    if (/\b(topkdv|ara\s*toplam|genel\s*toplam|satis|odeme|kart.*pos|nakit|garanti|onay\s*kodu|toplam.*tl)\b/i.test(line)) {
      endIndex = i;
      break;
    }
  }
  
  console.log(`PASS 1: Items parsing range: ${startIndex + 1} to ${endIndex - 1}`);

  // PASS 2: Extract items with strict individual parsing
  let pendingProductName: string | null = null;
  let consecutiveNonItems = 0;

  for (let i = startIndex + 1; i < endIndex; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    console.log(`PASS 2: Processing line ${i}: "${line}"`);

    // Noise filtering - exclude ONLY clear administrative lines
    const alphaLine = alphaNormalize(line);
    const isNoiseLine = /\b(bilgi\s*fisi|tur:|mersis\s*no|vergi\s*daire|tel:|telefon|www\.|http|v\.d\.|sicil\s*no|anadolu|kurumlar|topkdv|kdv\s*orani)\b/i.test(alphaLine);
    
    if (isNoiseLine) {
      console.log(`  ❌ NOISE: Administrative line`);
      consecutiveNonItems++;
      continue;
    }

    // Skip pure system reference codes
    if (/^(#\d+|REF\s*NO:|Z\s*NO:|%\d+)$/i.test(line)) {
      console.log(`  ❌ NOISE: System reference`);
      consecutiveNonItems++;
      continue;
    }

    let item: any = null;
    consecutiveNonItems = 0; // Reset on potential item

    // PATTERN 1: Complete item on single line (text + price)
    const singleLineMatch = line.match(/^(.+?)\s*[*]?\s*(\d{1,4}[.,]\d{2})(?:\s*TL)?$/i);
    if (singleLineMatch) {
      const [, namepart, price] = singleLineMatch;
      const cleanName = namepart.trim();
      const priceVal = parseFloat(price.replace(',', '.'));
      
      // Exclude only clear total/admin lines - be very specific
      if (/\b(toplam|ara\s*toplam|topkdv|kdv|indirim|tutar\s*ind|satis\s*tutari|odeme|kart\s*ile|pos\s*ile|garanti|nakit)\b/i.test(cleanName)) {
        console.log(`  ❌ SKIP: Admin/total line: "${cleanName}"`);
      } else if (cleanName.length > 1 && priceVal > 0) {
        item = {
          name: cleanName,
          qty: 1,
          unit_price: priceVal,
          line_total: priceVal,
          raw_line: line,
          product_code: null
        };
        console.log(`  ✅ ITEM: Single-line product: ${item.name} — ${item.line_total} TL`);
      }
    }

    // PATTERN 2: Weight-based items (KG pricing)
    if (!item) {
      const weightMatch = line.match(/^(\d+[.,]\d{2,3})\s*KG\s*[x×]\s*(\d{1,4}[.,]\d{2})\s*TL\/KG.*?(\d{1,4}[.,]\d{2})/i);
      if (weightMatch) {
        const [, weight, unitPrice, total] = weightMatch;
        
        // Look for product name in previous line(s)
        let productName = 'Ağırlıklı Ürün';
        for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
          const prevLine = lines[j]?.trim();
          if (prevLine && 
              /[A-Za-zÇĞİÖŞÜçğıöşü]{3,}/.test(prevLine) && 
              !/\d+[.,]\d{2}/.test(prevLine) && 
              !/\b(kdv|toplam|fis|tarih)\b/i.test(prevLine)) {
            productName = prevLine;
            break;
          }
        }
        
        item = {
          name: `${productName}`,
          qty: parseFloat(weight.replace(',', '.')),
          unit_price: parseFloat(unitPrice.replace(',', '.')),
          line_total: parseFloat(total.replace(',', '.')),
          raw_line: `${productName} ${line}`,
          product_code: null
        };
        console.log(`  ✅ ITEM: Weight-based: ${item.name} (${item.qty} KG x ${item.unit_price} = ${item.line_total} TL)`);
      }
    }

    // PATTERN 3: Product name without price (prepare for next line)
    if (!item && 
        /[A-Za-zÇĞİÖŞÜçğıöşü]{3,}/.test(line) && 
        !/\d+[.,]\d{2}/.test(line) &&
        !/\b(tel|tarih|fis|kdv|toplam|mersis|v\.d|sicil|saat|onay)\b/i.test(line)) {
      
      const cleanName = line.replace(/^[^\p{L}]*/u, '').replace(/[^\p{L}\s]*$/u, '').trim();
      if (cleanName.length > 2) {
        pendingProductName = cleanName;
        console.log(`  💾 PENDING: Product name: "${pendingProductName}"`);
        continue;
      }
    }

    // PATTERN 4: Price-only line (pair with pending name)
    if (!item && pendingProductName) {
      const priceOnlyMatch = line.match(/^\s*[*]?\s*(\d{1,4}[.,]\d{2})\s*$/);
      if (priceOnlyMatch) {
        const priceVal = parseFloat(priceOnlyMatch[1].replace(',', '.'));
        if (priceVal > 0) {
          item = {
            name: pendingProductName,
            qty: 1,
            unit_price: priceVal,
            line_total: priceVal,
            raw_line: `${pendingProductName} ${line}`,
            product_code: null
          };
          console.log(`  ✅ ITEM: Paired item: ${item.name} — ${item.line_total} TL`);
          pendingProductName = null;
        }
      }
    }

    // Add item to list (NO grouping, NO collapsing)
    if (item) {
      items.push(item);
      pendingProductName = null;
      console.log(`  📝 ADDED: Item ${items.length}: ${item.name}`);
    } else {
      console.log(`  ❓ UNMATCHED: Could not parse as item`);
    }

    // Safety check: if too many consecutive non-items, we might be in wrong section
    if (consecutiveNonItems > 5) {
      console.log(`  ⚠️  WARNING: Too many consecutive non-items, may have reached end of items section`);
      break;
    }
  }

  // Validation: ensure we found items
  if (items.length === 0) {
    console.log('⚠️  WARNING: No items found! Attempting fallback parsing...');
    
    // Fallback: scan entire text for any line ending with price
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const fallbackMatch = line.match(/^(.+?)\s*(\d{1,4}[.,]\d{2})$/i);
      if (fallbackMatch) {
        const [, name, price] = fallbackMatch;
        const cleanName = name.trim();
        
        // Only exclude very obvious non-products
        if (!/\b(toplam|kdv|indirim|tarih|fis|tel|garanti|satis\s*tutari)\b/i.test(cleanName) && 
            cleanName.length > 2) {
          
          const priceVal = parseFloat(price.replace(',', '.'));
          if (priceVal > 0) {
            items.push({
              name: cleanName,
              qty: 1,
              unit_price: priceVal,
              line_total: priceVal,
              raw_line: line,
              product_code: null
            });
            console.log(`  🔄 FALLBACK ITEM: ${cleanName} — ${priceVal} TL`);
          }
        }
      }
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
    if (/\b(indirim|tutar\s*ind|kocailem)\b/i.test(alphaLine)) {
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
 * Extract totals for Şok Market receipts with enhanced validation
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
 * Extract card info for Şok Market receipts - always show last 4 digits when card was used
 */
function extractŞokCardInfo(text: string): string | null {
  console.log(`\n=== ŞOK CARD INFO EXTRACTION ===`);
  
  // Enhanced card patterns for Şok Market receipts
  const cardPatterns = [
    /(\d{6})\*+(\d{4})/,           // 521824******9016
    /(\d{4,6})\*+(\d{4})/,         // 528208******6309
    /\*+(\d{4})(?:\s+TEK\s+POS)?/i, // ******9016 TEK POS
    /(\d{4})\s*\*+\s*(\d{4})/,     // 5218 **** 9016
    /KART.*?(\d{4})$/m,            // Any line with KART ending with 4 digits
    /POS.*?(\d{4})$/m,             // Any line with POS ending with 4 digits
    /SATIS.*?(\d{6})\*+(\d{4})/i,  // SATIS with card number
    /#(\d{6})\*+(\d{4})/           // #521824******9016
  ];

  for (const pattern of cardPatterns) {
    const match = text.match(pattern);
    if (match) {
      // Get the last captured group (should be last 4 digits)
      const lastGroup = match[match.length - 1];
      if (lastGroup && /^\d{4}$/.test(lastGroup)) {
        console.log(`Found card last 4: ${lastGroup}`);
        return lastGroup;
      }
    }
  }

  // Fallback: look for any 4-digit sequence near payment-related keywords
  const paymentLines = text.split('\n').filter(line => 
    /\b(kart|pos|satis|odeme|garanti|onay)\b/i.test(line)
  );
  
  for (const line of paymentLines) {
    const digitMatch = line.match(/(\d{4})(?!\d)/g);
    if (digitMatch) {
      const lastDigits = digitMatch[digitMatch.length - 1];
      if (lastDigits && /^\d{4}$/.test(lastDigits)) {
        console.log(`Found card last 4 (fallback): ${lastDigits}`);
        return lastDigits;
      }
    }
  }

  console.log('No card last 4 digits found');
  return null;
}

/**
 * Extract store location for Şok Market receipts
 * Extract full address up to building number, exclude contact info
 */
function extractŞokStoreLocation(text: string): string | null {
  console.log(`\n=== ŞOK STORE LOCATION EXTRACTION ===`);
  
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  let addressLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Stop at TARIH or FIS NO or SAAT
    if (/\b(tarih|fis\s*no|saat)\b/i.test(line)) break;

    // Skip phone numbers, contact info, URLs, tax info
    if (/\b(tel:|telefon|m[uü]steri|iletis[iı]m|mersis\s*no|v\.d\.|sicil|anadolu\s*kurumlar)\b/i.test(line)) {
      console.log(`Skipping contact/admin line: ${line}`);
      continue;
    }
    if (/^https?:\/\//i.test(line) || /^www\./i.test(line)) {
      console.log(`Skipping URL line: ${line}`);
      continue;
    }

    // Include lines that contain address components or store info
    if (/\b(şok\s*marketler|t\.a\.ş|mah|mahalle|sok|sokak|cad|cadde|blv|bulvar|no:|cumhuriyet|halilbey|esenyurt|istanbul|ankara|izmir)\b/i.test(line)) {
      // Extract the actual address part, keeping building numbers
      let cleanLine = line;
      
      // Remove leading store codes but keep address
      cleanLine = cleanLine.replace(/^\d{4}-/, ''); // Remove store codes like "8654-"
      
      // Stop before TEL info if found in same line
      cleanLine = cleanLine.replace(/\s*TEL[-:\s].*$/i, '');
      
      // Clean extra spaces
      cleanLine = cleanLine.trim();
      
      if (cleanLine && cleanLine.length > 3) {
        addressLines.push(cleanLine);
        console.log(`Added address line: ${cleanLine}`);
      }
    }
  }

  if (addressLines.length > 0) {
    // Join address parts and clean up
    let location = addressLines.join(' ').trim();
    
    // Normalize spaces and punctuation
    location = location.replace(/\s+/g, ' ');
    location = location.replace(/\s*-\s*/g, ' '); // Fix broken dashes
    
    // Stop before contact information if it somehow got included
    location = location.replace(/\s*(TEL|TELEFON).*$/i, '');
    
    console.log(`Found store location: ${location}`);
    return location;
  }

  console.log('No store location found');
  return null;
}

// Enhanced general parsing functions for other formats
function parseItems(lines: string[], format: string): any[] {
  const items: any[] = [];
  
  if (format !== 'Migros') {
    return [];
  }

  console.log(`\n=== MIGROS ITEMS PARSING ===`);
  
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

  let pendingProductName: string | null = null;

  for (let i = startIndex + 1; i < endIndex; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Enhanced noise filtering
    const alphaLine = alphaNormalize(line);
    if (/\b(bilgi\s*fisi|tur\s*e\s*arsiv|indirimlr|tutar\s*ind|kocailem|topkdv|kdv)\b/i.test(alphaLine)) {
      continue;
    }

    let item: any = null;

    // Weight-based items
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
    }

    // Regular items with price
    if (!item) {
      const regularMatch = line.match(/^([A-Z\u00c7\u011e\u0130\u00d6\u015e\u00dca-z\u00e7\u011f\u0131\u00f6\u015f\u00fc\s]+?).*?\*(\d{1,4}[.,]\d{2})$/i);
      if (regularMatch) {
        const [, name, price] = regularMatch;
        const priceVal = parseFloat(price.replace(',', '.'));
        const cleanName = name.trim();
        if (cleanName.length > 2 && priceVal > 0 && 
            !/^(migros|tel|adres|saat|tarih|fis|dem|kg|kdv|toplam|tutar|bilgi)/i.test(cleanName)) {
          item = {
            name: cleanName,
            qty: 1,
            unit_price: priceVal,
            line_total: priceVal,
            raw_line: line
          };
        }
      }
    }

    if (item) {
      items.push(item);
    }
  }

  console.log(`=== MIGROS ITEMS COMPLETE: Found ${items.length} items ===\n`);
  return items;
}

function parseDiscounts(lines: string[], format: string): any[] {
  const discounts: any[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.includes('TUTAR İND.') && line.includes('KOCAİLEM')) {
      for (let j = i - 3; j <= i + 1; j++) {
        if (j >= 0 && j < lines.length) {
          const discountLine = lines[j];
          const discountMatch = discountLine.match(/[\*\s]*(-\d+[.,]\d+)/);
          if (discountMatch) {
            const discountAmount = parseFloat(discountMatch[1].replace(',', '.'));
            discounts.push({
              description: 'KOCAILEM İNDİRİMİ',
              amount: discountAmount
            });
            break;
          }
        }
      }
    }
  }

  return discounts;
}

function extractTotals(text: string, format: string): { subtotal?: number; vat_total?: number; grand_total?: number } {
  const result: any = {};
  
  if (format === 'Migros') {
    const toplamDirectMatch = text.match(/TOPLAM\s*[*]\s*(\d{1,4}[.,]\d{2})/i);
    if (toplamDirectMatch) {
      result.grand_total = parseFloat(toplamDirectMatch[1].replace(',', '.'));
    }
  }

  return result;
}

function extractCardInfo(text: string): string | null {
  const cardPatterns = [
    /(\d{4,6})\*+(\d{4})/,
    /\*+(\d{4})/,
    /(\d{4})\s*\*+\s*(\d{4})/
  ];

  for (const pattern of cardPatterns) {
    const match = text.match(pattern);
    if (match) {
      const lastGroup = match[match.length - 1];
      if (lastGroup && /^\d{4}$/.test(lastGroup)) {
        return lastGroup;
      }
    }
  }

  return null;
}

function extractStoreLocation(text: string): string | null {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  let addressLines: string[] = [];

  for (const line of lines) {
    if (/\b(tarih|fis\s*no)\b/i.test(line)) break;
    if (/\b(tel|telefon|m[uü]steri|iletis[iı]m)\b/i.test(line)) continue;
    if (/https?:\/\//i.test(line) || /\bwww\./i.test(line)) continue;

    if (/\b(mah|mahalle|sok|sokak|cad|cadde|blv|bulvar|no|istanbul|ankara|izmir)\b/i.test(line)) {
      addressLines.push(line);
    }
  }

  if (addressLines.length > 0) {
    return addressLines.join(' ').trim();
  }

  return null;
}

/**
 * Main receipt parsing function with comprehensive enhancements
 */
function parseReceiptText(rawText: string): any {
  console.log('=== RECEIPT PARSING START ===');
  
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const formatDetection = detectFormat(rawText);
  
  console.log(`Detected format: ${formatDetection.format} (confidence: ${formatDetection.confidence})`);

  // Extract basic info - STRICT DATE/TIME FORMATTING
  console.log('\n=== DATE & TIME EXTRACTION ===');
  
  let purchaseDate = null;
  let purchaseTime = null;
  
  // Strategy 1: Look for combined date and time patterns
  const combinedMatch = rawText.match(/TAR[İI]H[:.]\s*(\d{1,2})[\/.:](\d{1,2})[\/.:](\d{4})[\s\S]*?SAAT[:.]\s*(\d{1,2})(?::(\d{2}))?/i);
  if (combinedMatch) {
    purchaseDate = `${combinedMatch[1].padStart(2, '0')}/${combinedMatch[2].padStart(2, '0')}/${combinedMatch[3]}`;
    purchaseTime = `${combinedMatch[4].padStart(2, '0')}:${(combinedMatch[5] ?? '00')}`;
    console.log(`Found combined date/time: ${purchaseDate} ${purchaseTime}`);
  }
  
  // Strategy 2: Separate date and time extraction
  if (!purchaseDate || !purchaseTime) {
    // Extract date
    const datePattern = /TAR[İI]H[:.]\s*(\d{1,2})[\/.:-](\d{1,2})[\/.:-](\d{2,4})/i;
    const dateMatch = rawText.match(datePattern);
    
    if (dateMatch) {
      let day = dateMatch[1].padStart(2, '0');
      let month = dateMatch[2].padStart(2, '0');
      let year = dateMatch[3];
      
      if (year.length === 2) {
        year = '20' + year;
      }
      
      purchaseDate = `${day}/${month}/${year}`;
      console.log(`Found date: ${purchaseDate}`);
    }
    
    // Extract time - ALWAYS in Turkish 24-hour format (HH:MM), handle PM conversion
    const timePattern = /SAAT[:.]\s*(\d{1,2})(?::(\d{2}))?\s*(PM|AM)?/i;
    const timeMatch = rawText.match(timePattern);
    if (timeMatch) {
      let hour = parseInt(timeMatch[1]);
      let minute = parseInt(timeMatch[2] || '0');
      const ampm = timeMatch[3];
      
      // Convert to 24-hour format if AM/PM is present
      if (ampm) {
        if (ampm.toUpperCase() === 'PM' && hour !== 12) {
          hour += 12;
        } else if (ampm.toUpperCase() === 'AM' && hour === 12) {
          hour = 0;
        }
      }
      
      // Ensure Turkish 24-hour format (HH:MM)
      purchaseTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      console.log(`Found time: ${purchaseTime} (converted from ${timeMatch[0]})`);
    }
  }

  // Format-specific parsing with enhanced validation
  let items: any[] = [];
  let discounts: any[] = [];
  let totals: any = {};
  let cardInfo: string | null = null;
  let storeLocation: string | null = null;

  if (formatDetection.format.includes('Şok')) {
    console.log('\n=== USING ŞOK-SPECIFIC PARSING ===');
    
    // Preprocess text for better Şok parsing
    const preprocessedText = preprocessŞokText(rawText);
    const preprocessedLines = preprocessedText.split('\n').map(l => l.trim()).filter(Boolean);
    
    items = parseŞokItems(preprocessedLines);
    discounts = parseŞokDiscounts(preprocessedLines);
    totals = extractŞokTotals(preprocessedText);
    cardInfo = extractŞokCardInfo(preprocessedText);
    storeLocation = extractŞokStoreLocation(preprocessedText);
  } else {
    console.log('\n=== USING GENERAL PARSING ===');
    
    items = parseItems(lines, formatDetection.format);
    discounts = parseDiscounts(lines, formatDetection.format);
    totals = extractTotals(rawText, formatDetection.format);
    cardInfo = extractCardInfo(rawText);
    storeLocation = extractStoreLocation(rawText);
  }

  // Enhanced total validation with precise calculation for Şok receipts
  const itemsSum = items.reduce((sum, item) => sum + (item.line_total || 0), 0);
  const discountsSum = discounts.reduce((sum, discount) => sum + (discount.amount || 0), 0);
  const calculatedTotal = itemsSum + discountsSum;
  
  console.log(`\n=== TOTAL VALIDATION ===`);
  console.log(`Items sum: ${itemsSum.toFixed(2)}`);
  console.log(`Discounts sum: ${discountsSum.toFixed(2)}`);
  console.log(`Calculated total: ${calculatedTotal.toFixed(2)}`);
  console.log(`Detected grand total: ${totals.grand_total}`);
  
  // Strict validation for Şok receipts (±0.05 tolerance)
  if (totals.grand_total) {
    const difference = Math.abs(totals.grand_total - calculatedTotal);
    console.log(`Total difference: ${difference.toFixed(2)}`);
    
    if (difference > 0.05) {
      console.log(`⚠️  TOTAL MISMATCH (${difference.toFixed(2)})! Checking if items were missed...`);
      
      // For Şok receipts, this suggests items were missed - use detected total and warn
      if (formatDetection.format.includes('Şok')) {
        console.log(`⚠️  Şok receipt: Using detected total ${totals.grand_total} but items may be incomplete`);
      } else {
        console.log(`⚠️  Using calculated total: ${calculatedTotal.toFixed(2)}`);
        totals.grand_total = calculatedTotal;
      }
    } else {
      console.log(`✅ Total validation passed (difference: ${difference.toFixed(2)})`);
    }
  } else if (calculatedTotal > 0) {
    console.log(`ℹ️  No detected total, using calculated: ${calculatedTotal.toFixed(2)}`);
    totals.grand_total = calculatedTotal;
  }

  // Format payment method with enhanced detection
  let formattedPaymentMethod = 'Unknown';
  if (cardInfo) {
    formattedPaymentMethod = `Credit Card (****${cardInfo})`;
    console.log(`✅ Payment method: Credit card ending in ${cardInfo}`);
  } else if (/nakit|cash/i.test(rawText)) {
    formattedPaymentMethod = 'Cash';
    console.log(`✅ Payment method: Cash`);
  } else if (/kart|pos/i.test(rawText)) {
    formattedPaymentMethod = 'Credit Card';
    console.log(`ℹ️  Payment method: Credit card (no digits found)`);
  }

  const result = {
    merchant_raw: formatDetection.format,
    merchant_brand: formatDetection.format,
    purchase_date: purchaseDate || '',
    purchase_time: purchaseTime,
    store_address: storeLocation,
    total: totals.grand_total || 0,
    items: items,
    payment_method: formattedPaymentMethod,
    receipt_unique_no: null,
    fis_no: null,
    barcode_numbers: [],
    raw_text: rawText
  };

  console.log('\n=== FINAL RESULT ===');
  console.log(`Merchant: ${result.merchant_brand}`);
  console.log(`Date: ${result.purchase_date}`);
  console.log(`Time: ${result.purchase_time}`);
  console.log(`Total: ${result.total}`);
  console.log(`Items: ${result.items.length}`);
  console.log(`Payment: ${result.payment_method}`);
  console.log('=== RECEIPT PARSING COMPLETE ===');

  return result;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrl } = await req.json();
    
    if (!imageUrl) {
      throw new Error('Image URL is required');
    }

    console.log('Processing OCR for image:', imageUrl);
    
    const rawText = await processOCR(imageUrl);
    const parsedResult = parseReceiptText(rawText);
    
    return new Response(JSON.stringify(parsedResult), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });

  } catch (error) {
    console.error('OCR function error:', error);
    
    return new Response(JSON.stringify({ 
      error: error.message,
      merchant_raw: 'Error',
      merchant_brand: 'Error',
      purchase_date: '',
      purchase_time: null,
      store_address: null,
      total: 0,
      items: [],
      payment_method: null,
      receipt_unique_no: null,
      fis_no: null,
      barcode_numbers: [],
      raw_text: ''
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }
});
