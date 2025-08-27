import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

/**
 * Admin-only endpoint to preview OCR parsing results
 */
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders() });
  }

  try {
    // Check authentication and admin status
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: getCorsHeaders() }
      );
    }

    // Extract token and verify admin role
    const token = authHeader.replace('Bearer ', '');
    const { data: user, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user.user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: getCorsHeaders() }
      );
    }

    // Check admin role
    const { data: adminCheck } = await supabase.rpc('has_admin', { p_user: user.user.id });
    if (!adminCheck) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: getCorsHeaders() }
      );
    }

    // Extract receipt ID from URL
    const url = new URL(req.url);
    const receiptId = url.searchParams.get('id');
    
    if (!receiptId) {
      return new Response(
        JSON.stringify({ error: 'Receipt ID required' }),
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // Fetch receipt data
    const { data: receipt, error: receiptError } = await supabase
      .from('receipts')
      .select('*')
      .eq('id', receiptId)
      .single();

    if (receiptError || !receipt) {
      return new Response(
        JSON.stringify({ error: 'Receipt not found' }),
        { status: 404, headers: getCorsHeaders() }
      );
    }

    // Fetch receipt items
    const { data: items } = await supabase
      .from('receipt_items')
      .select('*')
      .eq('receipt_id', receiptId)
      .order('line_no');

    // Extract parsed data from OCR JSON
    const ocrData = receipt.ocr_json || {};
    const parsedData = ocrData.parsed || {};

    const preview = {
      receipt: {
        id: receipt.id,
        status: receipt.status,
        created_at: receipt.created_at,
        parse_confidence: receipt.parse_confidence,
        ocr_engine: receipt.ocr_engine
      },
      header: {
        merchant_raw: receipt.merchant,
        merchant_brand: receipt.merchant_brand,
        chain_group: parsedData.header?.chain_group,
        purchase_date: receipt.purchase_date,
        purchase_time: receipt.purchase_time,
        payment_method: receipt.payment_method,
        masked_pan: receipt.masked_pan,
        card_scheme: receipt.card_scheme,
        address_raw: receipt.address_raw,
        city: receipt.city,
        district: receipt.district,
        neighborhood: receipt.neighborhood,
        receipt_unique_no: receipt.receipt_unique_no,
        fis_no: receipt.fis_no
      },
      totals: {
        subtotal: receipt.subtotal,
        discount_total: receipt.discount_total,
        vat_total: receipt.vat_total,
        total: receipt.total
      },
      items: items || [],
      validation: {
        parse_confidence: receipt.parse_confidence,
        warnings: ocrData.warnings || [],
        items_sum: items ? items.reduce((sum: number, item: any) => sum + (item.line_total || 0), 0) : 0,
        items_count: items ? items.length : 0
      },
      raw_ocr: {
        text_annotations_count: ocrData.raw?.textAnnotations?.length || 0,
        full_text_preview: ocrData.raw?.fullTextAnnotation?.text?.substring(0, 500) || null
      }
    };

    return new Response(
      JSON.stringify(preview, null, 2),
      { 
        headers: { 
          ...getCorsHeaders(), 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('OCR preview error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...getCorsHeaders(), 'Content-Type': 'application/json' }
      }
    );
  }
});