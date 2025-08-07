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
  // Look for numbers with decimal separators (both . and ,)
  const numberPattern = /\b\d+[,.]?\d*\b/g;
  const matches = text.match(numberPattern);
  
  if (!matches) return 0;
  
  // Convert to numbers and find the biggest one
  const numbers = matches.map(match => {
    const normalized = match.replace(',', '.');
    return parseFloat(normalized);
  }).filter(num => !isNaN(num));
  
  return Math.max(...numbers, 0);
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
      return new Response(
        JSON.stringify({ error: 'Google Vision API key not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Processing OCR for image:', imageUrl);

    // Call Google Cloud Vision API
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

    if (!visionResponse.ok) {
      throw new Error(`Vision API error: ${visionResponse.status} ${visionResponse.statusText}`);
    }

    const visionData = await visionResponse.json();
    console.log('Vision API response:', JSON.stringify(visionData, null, 2));

    // Extract text from the response
    const annotations = visionData.responses?.[0]?.textAnnotations;
    const fullText = annotations?.[0]?.description || '';

    if (!fullText) {
      return new Response(
        JSON.stringify({
          merchant: '',
          purchase_date: new Date().toISOString().split('T')[0],
          total: 0,
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