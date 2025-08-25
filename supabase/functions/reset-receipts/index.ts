// Supabase Edge Function: reset-receipts
// Purges receipts and related analytics tables. Admin-only.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
      return new Response(JSON.stringify({ error: 'Missing Supabase credentials' }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Auth check: verify requester is admin using their JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseAuth = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: isAdmin, error: roleErr } = await supabaseAuth.rpc('has_admin');
    if (roleErr || !isAdmin) {
      return new Response(JSON.stringify({ error: 'admin_required' }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Delete related analytics first to avoid FK issues
    await supabaseAdmin.from('receipt_items').delete().not('id', 'is', null);
    await supabaseAdmin.from('receipts').delete().not('id', 'is', null);

    await supabaseAdmin.from('period_user_merchant_week').delete().not('user_id', 'is', null);
    await supabaseAdmin.from('period_geo_merchant_week').delete().not('week_start', 'is', null);
    await supabaseAdmin.from('alerts').delete().not('id', 'is', null);
    await supabaseAdmin.from('leaderboard_snapshots').delete().not('id', 'is', null);

    // Optionally clear only receipt-sourced ledger entries (keep referrals/challenges intact)
    await supabaseAdmin.from('points_ledger').delete().eq('source', 'receipt');

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    console.error('reset-receipts error:', e);
    return new Response(JSON.stringify({ error: 'reset_failed', message: String(e) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
