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
  items: { name: string; qty: number }[];
  payment_method: string | null;
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
  
  // Look for specific patterns in Turkish receipts
  const lines = text.split('\n').map(line => line.trim());
  
  // Pattern 1: Look for "TOPLAM" followed by amount
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('TOPLAM') && !line.includes('ARA')) {
      // Check same line for amount
      const sameLineMatch = line.match(/TOPLAM\s*[*]?\s*(\d+[,.]\d{2})/i);
      if (sameLineMatch) {
        const amount = parseFloat(sameLineMatch[1].replace(',', '.'));
        console.log('Found TOPLAM in same line:', amount);
        return amount;
      }
      
      // Check next few lines for amount
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const nextLine = lines[j].trim();
        const nextLineMatch = nextLine.match(/^[*]?(\d+[,.]\d{2})$/);
        if (nextLineMatch) {
          const amount = parseFloat(nextLineMatch[1].replace(',', '.'));
          console.log('Found amount after TOPLAM:', amount);
          if (amount > 10 && amount < 1000) { // Reasonable range
            return amount;
          }
        }
      }
    }
  }
  
  // Pattern 2: Look for specific receipt patterns like "*62,37" at the end
  const endPatterns = [
    /\*(\d{2},\d{2})$/, // *62,37 format
    /(\d{2},\d{2})$/, // 62,37 format
  ];
  
  for (let i = lines.length - 1; i >= Math.max(0, lines.length - 20); i--) {
    const line = lines[i];
    for (const pattern of endPatterns) {
      const match = line.match(pattern);
      if (match) {
        const amount = parseFloat(match[1].replace(',', '.'));
        if (amount > 10 && amount < 1000) {
          console.log('Found total with end pattern:', amount);
          return amount;
        }
      }
    }
  }
  
  // Pattern 3: Look for amounts near POS or payment info
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('POS') || line.includes('ORTAK')) {
      // Look for amount in nearby lines
      for (let j = Math.max(0, i - 3); j < Math.min(lines.length, i + 3); j++) {
        const nearLine = lines[j].trim();
        const amountMatch = nearLine.match(/^[*]?(\d+[,.]\d{2})$/);
        if (amountMatch) {
          const amount = parseFloat(amountMatch[1].replace(',', '.'));
          if (amount > 10 && amount < 1000) {
            console.log('Found amount near POS:', amount);
            return amount;
          }
        }
      }
    }
  }
  
  console.log('No total found, returning 0');
  return 0;
}

function parseItems(text: string): { name: string; qty: number }[] {
  console.log('Parsing items with quantities from text');
  
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const itemCounts = new Map<string, number>();
  
  // Find the product section boundaries
  let productStartIndex = -1;
  let productEndIndex = -1;
  
  // Look for first product line (after store info, before totals)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip header/store info lines
    if (line.match(/MIGROS\s+TICARET|KOÇ\s+UNIVERSITES|SARIYER|TEL:|TARIH:|SAAT:|FİŞ\s+NO/i)) {
      continue;
    }
    
    // Look for first product line (followed by %1 and price)
    if (i + 2 < lines.length && 
        lines[i + 1] === '%1' && 
        lines[i + 2].match(/^\*\d+[,.]?\d*$/)) {
      productStartIndex = i;
      break;
    }
  }
  
  // Find end of product section (before ARA TOPLAM or TOPLAM)
  for (let i = productStartIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.match(/^(ARA\s+)?TOPLAM$/i) || line.match(/^#\d+$/)) {
      productEndIndex = i;
      break;
    }
  }
  
  if (productStartIndex === -1 || productEndIndex === -1) {
    console.log('Could not find product section boundaries');
    return [];
  }
  
  console.log(`Product section: lines ${productStartIndex} to ${productEndIndex}`);
  
  // Extract products from the identified section
  for (let i = productStartIndex; i < productEndIndex; i += 3) {
    const productLine = lines[i];
    const percentLine = lines[i + 1];
    const priceLine = lines[i + 2];
    
    // Validate this is a product entry (product name, %1, *price)
    if (percentLine === '%1' && priceLine && priceLine.match(/^\*\d+[,.]?\d*$/)) {
      // Clean product name
      let cleanName = productLine
        .replace(/^[#\d\s*]+/, '') // Remove leading numbers/symbols
        .replace(/\s+/g, ' ') // Normalize spaces
        .trim();
      
      // Skip empty or very short names
      if (cleanName.length > 2) {
        // Count occurrences
        const currentCount = itemCounts.get(cleanName) || 0;
        itemCounts.set(cleanName, currentCount + 1);
        
        console.log(`Found product: "${cleanName}" (occurrence ${currentCount + 1})`);
      }
    }
  }
  
  // Convert to array format
  const result = Array.from(itemCounts.entries()).map(([name, qty]) => ({
    name,
    qty
  }));
  
  console.log(`Total unique products extracted: ${result.length}`);
  console.log('Items with quantities:', result);
  
  return result;
}

function extractPaymentMethod(text: string): string | null {
  console.log('Extracting payment method from text');
  
  // Turkish receipt masked card patterns
  const cardPatterns = [
    // Pattern: #494314******4645 ORTAK POS
    /#(\d{4,6}\*{4,6}\d{4})/i,
    // Pattern: 494314******4645 (standalone)
    /(\d{4,6}\*{4,6}\d{4})/,
    // Pattern: 1234 **** 7890 or 5310 **** **** 1234 (with spaces)
    /(\d{4}\s+\*{4}\s+\d{4})/,
    /(\d{4}\s+\*{4}\s+\*{4}\s+\d{4})/,
    // Pattern: 1234****7890 (no spaces)
    /(\d{4}\*{4}\d{4})/,
    // Pattern with X instead of *
    /(\d{4,6}X{4,6}\d{4})/i,
    /(\d{4}\s+X{4}\s+\d{4})/i
  ];
  
  const lines = text.split('\n').map(line => line.trim());
  
  // Look for card patterns in each line
  for (const line of lines) {
    for (const pattern of cardPatterns) {
      const match = line.match(pattern);
      if (match) {
        const cardNumber = match[1];
        console.log('Found payment method:', cardNumber);
        return cardNumber;
      }
    }
  }
  
  console.log('No payment method found');
  return null;
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
          payment_method: null,
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
      items: parseItems(fullText),
      payment_method: extractPaymentMethod(fullText),
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