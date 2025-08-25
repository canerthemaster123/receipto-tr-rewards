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

    console.log('Running weekly rollups...');

    // Try to run the master rollup function first
    try {
      const { data, error } = await supabase.rpc('fn_run_weekly_rollups');
      
      if (error) {
        console.warn('Master rollup function failed, running individual functions:', error);
        
        // Fallback to individual functions
        const now = new Date();
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
        currentWeek.setDate(currentWeek.getDate() - currentWeek.getDay());
        
        await supabase.rpc('fn_detect_alerts_for_week', {
          p_week_start: currentWeek.toISOString().split('T')[0]
        });
      }
      
      console.log('Rollups completed successfully');
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Weekly rollups completed successfully',
        data: data 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
      
    } catch (rollupError) {
      console.error('Error running rollups:', rollupError);
      return new Response(JSON.stringify({ 
        error: 'Failed to run rollups', 
        details: rollupError.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('Error in run-rollups function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});