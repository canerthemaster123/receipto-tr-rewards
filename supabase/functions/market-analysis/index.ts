import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Supabase configuration is missing');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { chain_group } = await req.json();

    if (!chain_group) {
      throw new Error('chain_group is required');
    }

    // Get current week data for the selected chain
    const { data: selectedChainData, error: selectedChainError } = await supabase
      .from('period_geo_merchant_week')
      .select('*')
      .eq('chain_group', chain_group)
      .order('week_start', { ascending: false })
      .limit(4); // Last 4 weeks

    if (selectedChainError) {
      throw selectedChainError;
    }

    // Get competitor data (other chains in same districts)
    const districts = [...new Set(selectedChainData?.map(d => d.district) || [])];
    
    const { data: competitorData, error: competitorError } = await supabase
      .from('period_geo_merchant_week')
      .select('*')
      .neq('chain_group', chain_group)
      .in('district', districts)
      .order('week_start', { ascending: false })
      .limit(20); // Sample competitor data

    if (competitorError) {
      throw competitorError;
    }

    // Get alerts for this chain
    const { data: alertsData, error: alertsError } = await supabase
      .from('alerts')
      .select('*')
      .eq('chain_group', chain_group)
      .order('created_at', { ascending: false })
      .limit(5);

    if (alertsError) {
      throw alertsError;
    }

    // Prepare data for AI analysis
    const analysisData = {
      selectedChain: {
        name: chain_group,
        weeklyData: selectedChainData,
        totalUsers: selectedChainData?.reduce((sum, week) => sum + (week.unique_users || 0), 0) || 0,
        totalSpend: selectedChainData?.reduce((sum, week) => sum + (week.total_spend || 0), 0) || 0,
        avgBasketValue: selectedChainData?.reduce((sum, week) => sum + (week.avg_basket_value || 0), 0) / (selectedChainData?.length || 1) || 0
      },
      competitors: competitorData?.reduce((acc, curr) => {
        if (!acc[curr.chain_group]) {
          acc[curr.chain_group] = {
            name: curr.chain_group,
            weeklyData: [],
            totalUsers: 0,
            totalSpend: 0,
            avgBasketValue: 0
          };
        }
        acc[curr.chain_group].weeklyData.push(curr);
        acc[curr.chain_group].totalUsers += curr.unique_users || 0;
        acc[curr.chain_group].totalSpend += curr.total_spend || 0;
        return acc;
      }, {} as any) || {},
      alerts: alertsData || []
    };

    // Calculate competitor averages
    Object.keys(analysisData.competitors).forEach(competitor => {
      const comp = analysisData.competitors[competitor];
      comp.avgBasketValue = comp.weeklyData.reduce((sum: number, week: any) => sum + (week.avg_basket_value || 0), 0) / comp.weeklyData.length;
    });

    const prompt = `Sen bir perakende analiz uzmanısın. Aşağıdaki verilere dayanarak ${chain_group} marketi için detaylı bir analiz raporu hazırla:

SEÇLEN MARKET VERİLERİ:
${JSON.stringify(analysisData.selectedChain, null, 2)}

RAKIP MARKETLER VERİLERİ:
${JSON.stringify(analysisData.competitors, null, 2)}

UYARILAR VE ANORMALLER:
${JSON.stringify(analysisData.alerts, null, 2)}

Lütfen aşağıdaki konularda Türkçe bir analiz yap:

1. **Performans Özeti**: ${chain_group}'un genel performansı nasıl?
2. **Rakip Karşılaştırması**: Diğer marketlerle karşılaştırıldığında durumu nasıl?
3. **Güçlü Yanlar**: Hangi alanlarda başarılı?
4. **Zayıf Yanlar**: Hangi alanlarda gelişim gerekli?
5. **Fırsatlar**: Hangi bölgelerde/kategorilerde büyüme potansiyeli var?
6. **Tehditler**: Hangi riskler ve uyarılar dikkate alınmalı?
7. **Öneriler**: Somut aksiyon önerileri

Raporu iş dünyasına uygun, profesyonel bir dilde hazırla. Sayısal verileri destekleyici olarak kullan.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini-2025-04-14',
        messages: [
          { 
            role: 'system', 
            content: 'Sen bir perakende sektörü analiz uzmanısın. Market verilerini analiz ederek iş insanları için değerli öngörüler ve öneriler sunuyorsun.' 
          },
          { role: 'user', content: prompt }
        ],
        max_completion_tokens: 1200
      }),
    });

    const aiResponse = await response.json();

    if (!response.ok) {
      console.error('OpenAI API error:', aiResponse);
      throw new Error(`OpenAI API error: ${aiResponse.error?.message || 'Unknown error'}`);
    }

    const analysis = aiResponse.choices[0].message.content;

    return new Response(
      JSON.stringify({ 
        analysis,
        data: analysisData,
        chain_group 
      }), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in market-analysis function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Market analiz fonksiyonunda hata oluştu'
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});