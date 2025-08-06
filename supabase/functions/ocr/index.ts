import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OCRRequest {
  imageUrl: string;
}

interface OCRResponse {
  merchant: string;
  total: number;
  purchase_date: string;
  items: string[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrl }: OCRRequest = await req.json();
    
    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: 'Image URL is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // For now, we'll return mock OCR data
    // In production, you would integrate with Google Cloud Vision API:
    /*
    const visionApiKey = Deno.env.get('GOOGLE_CLOUD_VISION_API_KEY');
    if (!visionApiKey) {
      throw new Error('Vision API key not configured');
    }

    const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${visionApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [{
          image: { source: { imageUri: imageUrl } },
          features: [{ type: 'TEXT_DETECTION' }]
        }]
      })
    });

    const visionResult = await response.json();
    const text = visionResult.responses[0]?.textAnnotations[0]?.description || '';
    */

    // Mock OCR extraction - replace with actual OCR processing
    const mockMerchants = ['Migros', 'CarrefourSA', 'BIM', 'A101', 'ŞOK', 'Metro', 'Tesco'];
    const mockItems = [
      ['Süt', 'Ekmek', 'Peynir'],
      ['Çay', 'Şeker', 'Un'],
      ['Deterjan', 'Şampuan', 'Diş Macunu'],
      ['Et', 'Tavuk', 'Sebze'],
      ['Makarna', 'Domates', 'Soğan']
    ];

    const randomMerchant = mockMerchants[Math.floor(Math.random() * mockMerchants.length)];
    const randomItems = mockItems[Math.floor(Math.random() * mockItems.length)];
    const randomTotal = Math.floor(Math.random() * 200) + 20; // 20-220 TL
    const randomDate = new Date();
    randomDate.setDate(randomDate.getDate() - Math.floor(Math.random() * 7)); // Last 7 days

    const ocrResult: OCRResponse = {
      merchant: randomMerchant,
      total: randomTotal,
      purchase_date: randomDate.toISOString().split('T')[0],
      items: randomItems
    };

    console.log('OCR processing completed:', ocrResult);

    return new Response(
      JSON.stringify(ocrResult),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('OCR processing failed:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to process image',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});