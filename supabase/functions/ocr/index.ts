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
  
  // Look for the final total amount - prioritize "TOPLAM" near end of receipt
  const lines = text.split('\n').reverse(); // Start from bottom
  
  // Look for the final TOPLAM line which should have the correct total
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const line = lines[i].trim();
    
    // Look for TOPLAM with amount after it
    if (line.includes('TOPLAM') && !line.includes('ARA')) {
      // Look for amount in the same line or next few lines
      const totalMatch = line.match(/TOPLAM\s*[*]?\s*(\d+[,.]\d{2})/i);
      if (totalMatch) {
        const amount = parseFloat(totalMatch[1].replace(',', '.'));
        console.log('Found TOPLAM amount:', amount);
        return amount;
      }
      
      // Look in next few lines for the amount
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        const nextLine = lines[j].trim();
        const amountMatch = nextLine.match(/^[*]?(\d+[,.]\d{2})$/);
        if (amountMatch) {
          const amount = parseFloat(amountMatch[1].replace(',', '.'));
          console.log('Found amount after TOPLAM:', amount);
          return amount;
        }
      }
    }
  }
  
  // Look for standalone amounts in reasonable range from the bottom
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const line = lines[i].trim();
    
    if (line.match(/^[*]?(\d+[,.]\d{2})$/) && !line.includes('%')) {
      const amount = parseFloat(line.replace(/[*,]/g, '').replace(',', '.'));
      
      // Should be reasonable receipt total (between 1 and 1000 for most receipts)
      if (amount >= 1 && amount <= 1000) {
        console.log('Found reasonable total from bottom:', amount);
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
    /GRIZON|THIS|SMA\d+|CARET|A\.S\.|030/i, // Company name fragments
    /PLASTIK\s+POSET|POSET/i, // Bag charges
    /IND\.|KOCAILEM|RAD|MIG$/i, // Discount and other non-product lines
    /^\d{6,}/ // Long number sequences
  ];
  
  // Find product lines - these typically don't have prices directly in them
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip lines matching skip patterns
    if (skipPatterns.some(pattern => pattern.test(line))) {
      continue;
    }
    
    // Skip very short lines
    if (line.length < 4) {
      continue;
    }
    
    // Skip lines that contain prices (product names typically don't have prices in the same line)
    if (pricePattern.test(line)) {
      continue;
    }
    
    // Look for lines that look like product names
    // Product names typically:
    // - Have letters
    // - Are not just numbers
    // - Are followed by price/quantity info within a few lines
    if (line.match(/[A-Za-zÇĞİÖŞÜçğıöşü]/) && !line.match(/^\d+$/)) {
      
      // Check if this looks like a product by looking ahead for price info
      let hasRelatedInfo = false;
      let price = '';
      
      // Look ahead for price info
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        const nextLine = lines[j].trim();
        
        // Check for price in next lines
        const priceMatch = nextLine.match(/^[*]?(\d+[,.]\d{2})$/);
        if (priceMatch && !skipPatterns.some(p => p.test(nextLine))) {
          price = priceMatch[1];
          hasRelatedInfo = true;
          break;
        }
        
        // Stop if we hit another potential product or skip pattern
        if (nextLine.length > 3 && !priceMatch && 
            (nextLine.match(/[A-Za-zÇĞİÖŞÜçğıöşü]/) || 
             skipPatterns.some(p => p.test(nextLine)))) {
          break;
        }
      }
      
      if (hasRelatedInfo) {
        // Clean up product name
        let cleanedName = line
          .replace(/^[#\d\s*]+/, '') // Remove leading numbers, hashes, asterisks
          .replace(/\s+/g, ' ') // Normalize spaces
          .replace(/[*]+$/, '') // Remove trailing asterisks
          .trim();
        
        if (cleanedName.length > 2 && !cleanedName.match(/^\d+$/)) {
          const item: { name: string; quantity?: string; price?: string } = {
            name: cleanedName
          };
          
          if (price) {
            item.price = price.replace(',', '.');
          }
          
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