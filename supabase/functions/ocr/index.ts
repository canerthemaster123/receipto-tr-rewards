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
  items: string[];
  raw_text: string;
}

// Parsing helpers
function extractMerchant(text: string): string {
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  return lines[0]?.trim() || '';
}

function extractDate(text: string): string {
  // Look for DD.MM.YYYY, DD/MM/YYYY, or YYYY-MM-DD patterns
  const datePatterns = [
    /\b(\d{2})\.(\d{2})\.(\d{4})\b/,
    /\b(\d{2})\/(\d{2})\/(\d{4})\b/,
    /\b(\d{4})-(\d{2})-(\d{2})\b/
  ];
  
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      if (pattern === datePatterns[2]) {
        // Already in YYYY-MM-DD format
        return match[0];
      } else {
        // Convert DD.MM.YYYY or DD/MM/YYYY to YYYY-MM-DD
        const day = match[1];
        const month = match[2];
        const year = match[3];
        return `${year}-${month}-${day}`;
      }
    }
  }
  
  // Fallback to today's date
  return new Date().toISOString().split('T')[0];
}

function extractTotal(text: string): number {
  // Look for total amount near "TOPLAM", "TOTAL", "ARA TOPLAM" keywords
  const totalPatterns = [
    /(?:TOPLAM|TOTAL)\s*[*]?(\d+[,.]\d+)/i,
    /(?:ARA\s+TOPLAM)\s*[*]?(\d+[,.]\d+)/i
  ];
  
  for (const pattern of totalPatterns) {
    const match = text.match(pattern);
    if (match) {
      const normalized = match[1].replace(',', '.');
      return parseFloat(normalized);
    }
  }
  
  // Fallback: look for numbers with decimal separators
  const numberPattern = /\b\d+[,.]?\d*\b/g;
  const matches = text.match(numberPattern);
  
  if (!matches) return 0;
  
  const numbers = matches.map(match => {
    const normalized = match.replace(',', '.');
    return parseFloat(normalized);
  }).filter(num => !isNaN(num) && num > 1); // Filter out small numbers like tax percentages
  
  return Math.max(...numbers, 0);
}

function extractItems(text: string): string[] {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const items: string[] = [];
  
  // Common product indicators and price patterns
  const pricePattern = /[*]?\d+[,.]\d+/;
  const skipPatterns = [
    /^%\d+$/, // Tax percentages like %1, %20
    /^[*]?\d+[,.]\d+$/, // Pure price lines
    /TOPLAM|TOTAL|ARA\s+TOPLAM|TUTAR|KDV|KASA|FİŞ|SAAT|TARİH|MERKEZ|ADRESİ/i,
    /^\d{2}[\/\-.]\d{2}[\/\-.]\d{4}$/, // Dates
    /MUKELLEF|BULVAR|POSET|KOCAILEM|JETKASA|ORTAK\s+POS/i,
    /^\d+$/, // Pure numbers
    /^[A-Z]{2,4}\d+$/, // Codes like SMA98
    /TEL:|TCKN:|V\.D\./i
  ];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip if matches skip patterns
    if (skipPatterns.some(pattern => pattern.test(line))) {
      continue;
    }
    
    // Look for product names - typically followed by price info
    if (line.length > 3 && !pricePattern.test(line)) {
      // Check if next few lines contain price info
      let hasPrice = false;
      for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
        if (pricePattern.test(lines[j])) {
          hasPrice = true;
          break;
        }
      }
      
      if (hasPrice) {
        // Clean up product name
        const cleanedName = line
          .replace(/^[#\d\s]+/, '') // Remove leading numbers/symbols
          .replace(/\s+/g, ' ') // Normalize spaces
          .trim();
          
        if (cleanedName.length > 2) {
          items.push(cleanedName);
        }
      }
    }
  }
  
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