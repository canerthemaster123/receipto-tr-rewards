import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InsightBundle {
  week_start: string;
  chain_group: string;
  kpis: {
    wab: number;
    aov: number;
    leakage_pct: number;
    winback_pct: number;
    net_flow: number;
  };
  top_geo_changes: Array<{
    city: string;
    district: string;
    neighborhood: string;
    metric: string;
    delta_pct: number;
    n: number;
  }>;
  top_categories: Array<any>;
  alerts: Array<{
    level: string;
    type: string;
    metric: string;
    city: string;
    district: string;
    neighborhood: string;
    delta_pct: number;
    n: number;
  }>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get chain_group from URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const chainGroup = pathParts[pathParts.length - 1];

    if (!chainGroup) {
      return new Response(JSON.stringify({ error: 'Chain group is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    // Get latest available week from period_geo_merchant_week
    const { data: latestWeekData, error: weekError } = await supabase
      .from('period_geo_merchant_week')
      .select('week_start')
      .eq('chain_group', chainGroup)
      .order('week_start', { ascending: false })
      .limit(1);

    if (weekError) {
      console.error('Error fetching latest week:', weekError);
      return new Response(JSON.stringify({ error: 'Failed to fetch data' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!latestWeekData || latestWeekData.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'No data available for this chain group',
        suggestion: 'Try seeding demo data first'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const latestWeek = latestWeekData[0].week_start;

    // Get KPIs for the latest week
    const { data: geoData, error: geoError } = await supabase
      .from('period_geo_merchant_week')
      .select('*')
      .eq('chain_group', chainGroup)
      .eq('week_start', latestWeek);

    if (geoError) {
      console.error('Error fetching geo data:', geoError);
      return new Response(JSON.stringify({ error: 'Failed to fetch geo data' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Calculate KPIs
    const totalUsers = geoData.reduce((sum, row) => sum + (row.unique_users || 0), 0);
    const totalReceipts = geoData.reduce((sum, row) => sum + (row.receipt_count || 0), 0);
    const totalSpend = geoData.reduce((sum, row) => sum + (parseFloat(row.total_spend) || 0), 0);
    const avgBasketValue = totalReceipts > 0 ? totalSpend / totalReceipts : 0;
    const newUsers = geoData.reduce((sum, row) => sum + (row.new_users || 0), 0);
    const returningUsers = geoData.reduce((sum, row) => sum + (row.returning_users || 0), 0);

    const kpis = {
      wab: totalUsers, // Weekly Active Buyers
      aov: avgBasketValue, // Average Order Value
      leakage_pct: totalUsers > 0 ? (newUsers / totalUsers) * 100 : 0,
      winback_pct: totalUsers > 0 ? (returningUsers / totalUsers) * 100 : 0,
      net_flow: newUsers - (totalUsers - newUsers - returningUsers)
    };

    // Get alerts for this week
    const { data: alertsData, error: alertsError } = await supabase
      .from('alerts')
      .select('*')
      .eq('chain_group', chainGroup)
      .eq('week_start', latestWeek)
      .order('z_score', { ascending: false });

    const alerts = alertsData?.map(alert => ({
      level: alert.severity,
      type: alert.alert_type,
      metric: alert.metric_name,
      city: alert.geo_value.split('/')[0] || '',
      district: alert.geo_value.split('/')[1] || '',
      neighborhood: '',
      delta_pct: Math.abs(((alert.current_value - alert.previous_value) / alert.previous_value) * 100),
      n: alert.sample_size
    })) || [];

    // Top geo changes (simplified - showing top performing districts)
    const topGeoChanges = geoData
      .sort((a, b) => (b.total_spend || 0) - (a.total_spend || 0))
      .slice(0, 5)
      .map(row => ({
        city: row.city,
        district: row.district,
        neighborhood: row.neighborhood,
        metric: 'total_spend',
        delta_pct: 0, // Would need historical comparison
        n: row.receipt_count || 0
      }));

    const result: InsightBundle = {
      week_start: latestWeek,
      chain_group: chainGroup,
      kpis,
      top_geo_changes: topGeoChanges,
      top_categories: [], // Empty for now
      alerts
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in reports function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});