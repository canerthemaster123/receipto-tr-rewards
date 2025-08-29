import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Database {
  public: {
    Tables: {
      challenges: {
        Row: {
          id: string;
          title_tr: string;
          title_en: string;
          goal_key: string;
          goal_target: number;
          starts_at: string;
          ends_at: string;
          reward_points: number;
          active: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          title_tr: string;
          title_en: string;
          goal_key: string;
          goal_target: number;
          starts_at: string;
          ends_at: string;
          reward_points: number;
          active?: boolean;
          created_by?: string | null;
        };
        Update: {
          active?: boolean;
        };
      };
    };
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient<Database>(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Calculate Monday of current week
    const mondayThisWeek = new Date(today);
    const dayOfWeek = today.getDay();
    const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Handle Sunday
    mondayThisWeek.setDate(today.getDate() - daysSinceMonday);
    
    // Calculate next Monday
    const nextMonday = new Date(mondayThisWeek);
    nextMonday.setDate(mondayThisWeek.getDate() + 7);

    console.log('Challenge manager running at:', now.toISOString());
    console.log('Today:', today.toISOString());
    console.log('Monday this week:', mondayThisWeek.toISOString());
    console.log('Next Monday:', nextMonday.toISOString());

    // 1. Deactivate expired challenges
    const { error: deactivateError } = await supabaseClient
      .from('challenges')
      .update({ active: false })
      .lt('ends_at', now.toISOString())
      .eq('active', true);

    if (deactivateError) {
      console.error('Error deactivating expired challenges:', deactivateError);
    } else {
      console.log('Expired challenges deactivated');
    }

    // 2. Create daily challenge if it doesn't exist for today
    const { data: existingDailyChallenge } = await supabaseClient
      .from('challenges')
      .select('id')
      .eq('goal_key', 'daily_upload')
      .eq('active', true)
      .gte('starts_at', today.toISOString())
      .lt('starts_at', new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString());

    if (!existingDailyChallenge || existingDailyChallenge.length === 0) {
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      const { error: dailyChallengeError } = await supabaseClient
        .from('challenges')
        .insert({
          title_tr: 'Günlük Fiş Yükle',
          title_en: 'Daily Receipt Upload',
          goal_key: 'daily_upload',
          goal_target: 1,
          starts_at: today.toISOString(),
          ends_at: tomorrow.toISOString(),
          reward_points: 10,
          active: true
        });

      if (dailyChallengeError) {
        console.error('Error creating daily challenge:', dailyChallengeError);
      } else {
        console.log('Daily challenge created for:', today.toISOString());
      }
    } else {
      console.log('Daily challenge already exists for today');
    }

    // 3. Create weekly challenges if it's Monday and they don't exist for this week
    if (today.getDay() === 1 || req.url.includes('force=true')) { // Monday or forced
      const weeklyGoals = [
        {
          title_tr: '10 Fiş Yükle',
          title_en: 'Upload 10 Receipts',
          goal_key: 'weekly_uploads',
          goal_target: 10,
          reward_points: 100
        },
        {
          title_tr: '5 Kullanıcı Davet Et',
          title_en: 'Invite 5 Users',
          goal_key: 'weekly_referrals',
          goal_target: 5,
          reward_points: 100
        },
        {
          title_tr: '5000 TL Harcama',
          title_en: 'Spend 5000 TL',
          goal_key: 'weekly_spend_5000',
          goal_target: 5000,
          reward_points: 100
        }
      ];

      for (const goal of weeklyGoals) {
        // Check if challenge already exists for this week
        const { data: existingWeeklyChallenge } = await supabaseClient
          .from('challenges')
          .select('id')
          .eq('goal_key', goal.goal_key)
          .eq('active', true)
          .gte('starts_at', mondayThisWeek.toISOString())
          .lt('starts_at', nextMonday.toISOString());

        if (!existingWeeklyChallenge || existingWeeklyChallenge.length === 0) {
          const { error: weeklyChallengeError } = await supabaseClient
            .from('challenges')
            .insert({
              title_tr: goal.title_tr,
              title_en: goal.title_en,
              goal_key: goal.goal_key,
              goal_target: goal.goal_target,
              starts_at: mondayThisWeek.toISOString(),
              ends_at: nextMonday.toISOString(),
              reward_points: goal.reward_points,
              active: true
            });

          if (weeklyChallengeError) {
            console.error(`Error creating weekly challenge ${goal.goal_key}:`, weeklyChallengeError);
          } else {
            console.log(`Weekly challenge ${goal.goal_key} created for week starting:`, mondayThisWeek.toISOString());
          }
        } else {
          console.log(`Weekly challenge ${goal.goal_key} already exists for this week`);
        }
      }
    } else {
      console.log('Not Monday, skipping weekly challenge creation');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Challenge manager completed successfully',
        timestamp: now.toISOString()
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Challenge manager error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});