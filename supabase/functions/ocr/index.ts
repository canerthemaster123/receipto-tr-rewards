import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OCRResult {
  merchant: string;
  purchase_date: string;
  total: number;
  items: { name: string; quantity?: string; price?: string }[];
  raw_text: string;
}

// Parsing helpers
function extractMerchant(text: string): string {
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  
  // Look for common Turkish store names first
  const storePatterns = [
    /MİGROS|MIGROS/i,
    /BİM/i,
    /A101/i,
    /ŞOK/i,
    /CARREFOUR/i,
    /TEKNOSA/i,
    /REAL/i,
    /METRO/i
  ];
  
  for (const line of lines) {
    for (const pattern of storePatterns) {
      if (pattern.test(line)) {
        const match = line.match(pattern);
        return match ? match[0] : '';
      }
    }
  }
  
  // Fallback: look for company indicators
  for (const line of lines) {
    if (line.includes('A.Ş.') || line.includes('A.S.') || line.includes('LTD') || line.includes('ŞTİ')) {
      return line.trim();
    }
  }
  
  // Last resort: return first substantial line
  for (const line of lines) {
    if (line.trim().length > 3 && !line.match(/^\d+$/) && !line.includes('TEL:')) {
      return line.trim();
    }
  }
  
  return lines[0]?.trim() || '';
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
  console.log('Extracting total from text:', text);
  
  // Look for Turkish total patterns with more precision
  const totalPatterns = [
    /TOPLAM\s*[*]?\s*(\d+[,.]\d{2})/i,
    /TOPLAM\s*(\d+[,.]\d{2})/i,
    /(?:^|\n)\s*[*]?(\d+[,.]\d{2})\s*(?:\n|$)/m, // Standalone price at end
  ];
  
  for (const pattern of totalPatterns) {
    const match = text.match(pattern);
    if (match) {
      const normalized = match[1].replace(',', '.');
      const total = parseFloat(normalized);
      console.log('Found total with pattern:', pattern, 'value:', total);
      if (total > 0 && total < 10000) { // Reasonable range for most receipts
        return total;
      }
    }
  }
  
  // Look for the last reasonable price amount in the text
  const lines = text.split('\n');
  const pricePattern = /[*]?(\d+[,.]\d{2})/;
  
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    
    // Skip lines that are clearly not totals
    if (line.includes('%') || line.includes('KDV') || line.includes('KASA') || line.length < 3) {
      continue;
    }
    
    const match = line.match(pricePattern);
    if (match) {
      const normalized = match[1].replace(',', '.');
      const amount = parseFloat(normalized);
      
      // Return first reasonable amount found from the bottom
      if (amount > 0 && amount < 10000) {
        console.log('Found total from bottom scan:', amount);
        return amount;
      }
    }
  }
  
  console.log('No total found, returning 0');
  return 0;
}

function extractItems(text: string): { name: string; quantity?: string; price?: string }[] {
  console.log('Extracting items from text');
  
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const items: { name: string; quantity?: string; price?: string }[] = [];
  
  // Price pattern for Turkish format
  const pricePattern = /[*]?(\d+[,.]\d{2})/;
  const quantityPattern = /x?\s*(\d+)\s*(?:adet|ADET)?/i;
  
  // Skip patterns for non-product lines
  const skipPatterns = [
    /^%\d+$/, // Tax percentages
    /^[*]?\d+[,.]\d+$/, // Pure price lines
    /TOPLAM|TOTAL|ARA\s+TOPLAM|TUTAR|KDV|KASA|FİŞ|SAAT|TARİH|MERKEZ|ADRESİ/i,
    /^\d{2}[\/\-.]\d{2}[\/\-.]\d{4}$/, // Dates
    /MUKELLEF|BULVAR|V\.D\.|TEL:|TCKN:|ORTAK\s+POS|JETKASA/i,
    /^\d+$/, // Pure numbers
    /^[A-Z]{2,4}\d+$/, // Product codes at start of line
    /^#\d+/, // Barcode numbers
    /GRIZON|THIS|SMA\d+|CARET|A\.S\./i, // Company name fragments
    /POSET|PLASTIK/i // Bag charges
  ];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip lines matching skip patterns
    if (skipPatterns.some(pattern => pattern.test(line))) {
      continue;
    }
    
    // Skip very short lines or lines that are clearly not products
    if (line.length < 3) {
      continue;
    }
    
    // Look for product names - should not contain prices but should be followed by price info
    if (!pricePattern.test(line)) {
      // Check if this looks like a product name by looking ahead for price/quantity info
      let hasRelatedInfo = false;
      let quantity = '';
      let price = '';
      
      // Look ahead 1-3 lines for price/quantity info
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        const nextLine = lines[j];
        
        // Check for price
        const priceMatch = nextLine.match(pricePattern);
        if (priceMatch && !skipPatterns.some(p => p.test(nextLine))) {
          price = priceMatch[1];
          hasRelatedInfo = true;
        }
        
        // Check for quantity
        const qtyMatch = nextLine.match(quantityPattern);
        if (qtyMatch) {
          quantity = qtyMatch[1];
        }
        
        // Stop if we hit another product or skip pattern
        if (skipPatterns.some(p => p.test(nextLine)) && !priceMatch) {
          break;
        }
      }
      
      if (hasRelatedInfo) {
        // Clean up product name
        let cleanedName = line
          .replace(/^[#\d\s*]+/, '') // Remove leading numbers, hashes, asterisks
          .replace(/\s+/g, ' ') // Normalize spaces
          .trim();
        
        // Additional cleaning for Turkish receipts
        cleanedName = cleanedName
          .replace(/^[*]+/, '') // Remove leading asterisks
          .replace(/\d+$/, '') // Remove trailing numbers
          .trim();
        
        if (cleanedName.length > 2 && !cleanedName.match(/^\d+$/)) {
          const item: { name: string; quantity?: string; price?: string } = {
            name: cleanedName
          };
          
          if (quantity) item.quantity = quantity;
          if (price) item.price = price;
          
          items.push(item);
          console.log('Found item:', item);
        }
      }
    }
  }
  
  console.log('Total items extracted:', items.length);
  return items;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrl } = await req.json();
    
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
      const testResponse = await fetch(imageUrl, { method: 'HEAD' });
      console.log('Image accessibility test - Status:', testResponse.status);
      if (!testResponse.ok) {
        throw new Error(`Image not accessible: ${testResponse.status} ${testResponse.statusText}`);
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

    // Call Google Cloud Vision API
    console.log('Calling Google Vision API...');
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
                  type: 'TEXT_DETECTION'
                }
              ]
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

    // Extract text from the response
    const annotations = visionData.responses?.[0]?.textAnnotations;
    const fullText = annotations?.[0]?.description || '';

    if (!fullText) {
      return new Response(
        JSON.stringify({
          merchant: '',
          purchase_date: new Date().toISOString().split('T')[0],
          total: 0,
          items: [],
          raw_text: 'No text detected in image'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse the extracted text
    const result: OCRResult = {
      merchant: extractMerchant(fullText),
      purchase_date: extractDate(fullText),
      total: extractTotal(fullText),
      items: extractItems(fullText),
      raw_text: fullText
    };

    console.log('OCR result:', result);

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