import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrl } = await req.json();
    
    // For now, return mock OCR data
    // In a real implementation, you would call Google Cloud Vision API or similar
    console.log('Processing OCR for image:', imageUrl);
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Mock extracted data - in real implementation this would come from OCR service
    const mockData = {
      merchant: 'Migros',
      total: Math.floor(Math.random() * 200) + 50, // Random amount between 50-250
      purchase_date: new Date().toISOString().split('T')[0],
      items: 'Süt, Ekmek, Peynir, Domates, Makarna'
    };
    
    return new Response(
      JSON.stringify({ success: true, data: mockData }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  } catch (error) {
    console.error('OCR processing error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Failed to process OCR' 
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
        status: 500 
      }
    );
  }
});