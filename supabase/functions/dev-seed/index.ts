import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check if dev seeding is allowed
    const allowDevSeed = Deno.env.get('ALLOW_DEV_SEED');
    if (allowDevSeed !== 'true') {
      return new Response(JSON.stringify({ error: 'Dev seeding not allowed' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate admin access
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check admin status
    const { data: isAdmin, error: adminError } = await supabase.rpc('has_admin');
    
    if (adminError || !isAdmin) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Starting dev seed process...');

    // 1. Seed merchant_map
    const merchantMappings = [
      { raw_merchant: 'Migros', chain_group: 'Migros', priority: 1 },
      { raw_merchant: 'Migros Jet', chain_group: 'Migros', priority: 2 },
      { raw_merchant: 'BİM', chain_group: 'BIM', priority: 1 },
      { raw_merchant: 'BIM', chain_group: 'BIM', priority: 1 },
      { raw_merchant: 'A101', chain_group: 'A101', priority: 1 },
      { raw_merchant: 'ŞOK', chain_group: 'SOK', priority: 1 },
      { raw_merchant: 'CarrefourSA', chain_group: 'CarrefourSA', priority: 1 },
    ];

    for (const mapping of merchantMappings) {
      await supabase
        .from('merchant_map')
        .upsert(mapping, { onConflict: 'raw_merchant,chain_group' });
    }

    // 2. Seed store_dim
    const stores = [
      { chain_group: 'Migros', city: 'İstanbul', district: 'Beşiktaş', neighborhood: 'Levent', lat: 41.082, lng: 29.021 },
      { chain_group: 'BIM', city: 'İstanbul', district: 'Beşiktaş', neighborhood: 'Levent', lat: 41.082, lng: 29.021 },
      { chain_group: 'Migros', city: 'İzmir', district: 'Karşıyaka', neighborhood: 'Bostanlı', lat: 38.463, lng: 27.092 },
      { chain_group: 'BIM', city: 'İzmir', district: 'Karşıyaka', neighborhood: 'Bostanlı', lat: 38.463, lng: 27.092 },
    ];

    const storeIds = new Map();
    for (const store of stores) {
      const { data, error } = await supabase
        .from('store_dim')
        .upsert(store, { onConflict: 'chain_group,city,district,neighborhood' })
        .select('id,chain_group,city,district,neighborhood')
        .single();
      
      if (data) {
        const key = `${data.chain_group}_${data.city}_${data.district}_${data.neighborhood}`;
        storeIds.set(key, data.id);
      }
    }

    // 3. Seed receipts for last 2 weeks (240 receipts)
    const now = new Date();
    const lastWeekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisWeekStart = new Date(now.getTime() - 0 * 24 * 60 * 60 * 1000);
    
    const merchants = ['Migros', 'BIM'];
    const receipts = [];

    // Generate receipts for each week
    for (let week = 0; week < 2; week++) {
      const weekStart = week === 0 ? lastWeekStart : thisWeekStart;
      const baseAmount = week === 0 ? 100 : 110;
      const variance = week === 0 ? 150 : 170;
      
      for (let i = 0; i < 120; i++) { // 120 receipts per week
        const merchant = merchants[Math.floor(Math.random() * merchants.length)];
        const city = Math.random() > 0.5 ? 'İstanbul' : 'İzmir';
        const district = city === 'İstanbul' ? 'Beşiktaş' : 'Karşıyaka';
        const neighborhood = city === 'İstanbul' ? 'Levent' : 'Bostanlı';
        
        const storeKey = `${merchant}_${city}_${district}_${neighborhood}`;
        const storeId = storeIds.get(storeKey);
        
        if (storeId) {
          const purchaseDate = new Date(weekStart.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000);
          const total = (baseAmount + Math.random() * variance).toFixed(2);
          
          receipts.push({
            user_id: user.id, // Use current user for all receipts
            merchant,
            merchant_brand: merchant,
            total: parseFloat(total),
            purchase_date: purchaseDate.toISOString().split('T')[0],
            status: 'approved',
            store_id: storeId,
            points: 100,
          });
        }
      }
    }

    // Insert receipts in batches
    const batchSize = 50;
    for (let i = 0; i < receipts.length; i += batchSize) {
      const batch = receipts.slice(i, i + batchSize);
      await supabase.from('receipts').insert(batch);
    }

    console.log(`Inserted ${receipts.length} receipts`);

    // 4. Run rollups
    console.log('Running rollups...');
    
    const startDate = new Date(now.getTime() - 56 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = new Date().toISOString().split('T')[0];
    
    await supabase.rpc('fn_fill_period_user_merchant_week', {
      p_start_date: startDate,
      p_end_date: endDate
    });

    await supabase.rpc('fn_fill_period_geo_merchant_week', {
      p_start_date: startDate,
      p_end_date: endDate
    });

    const currentWeek = new Date();
    currentWeek.setDate(currentWeek.getDate() - currentWeek.getDay()); // Start of current week
    
    await supabase.rpc('fn_detect_alerts_for_week', {
      p_week_start: currentWeek.toISOString().split('T')[0]
    });

    console.log('Dev seed completed successfully');

    return new Response(JSON.stringify({ ok: true, message: 'Dev seed completed successfully' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in dev-seed function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});