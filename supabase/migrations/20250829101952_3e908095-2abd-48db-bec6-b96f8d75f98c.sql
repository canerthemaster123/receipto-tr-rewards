-- Insert weekly challenges (renew every Monday)
INSERT INTO challenges (
    title_tr, 
    title_en, 
    goal_key, 
    goal_target, 
    starts_at, 
    ends_at, 
    reward_points, 
    active
) VALUES
(
    '10 Fiş Yükle', 
    'Upload 10 Receipts', 
    'weekly_uploads', 
    10, 
    date_trunc('week', NOW()) + INTERVAL '1 day', -- Monday this week
    date_trunc('week', NOW()) + INTERVAL '8 days', -- Next Monday
    100, 
    true
),
(
    '5 Kullanıcı Davet Et', 
    'Invite 5 Users', 
    'weekly_referrals', 
    5, 
    date_trunc('week', NOW()) + INTERVAL '1 day', 
    date_trunc('week', NOW()) + INTERVAL '8 days', 
    100, 
    true
),
(
    '5000 TL Harcama', 
    'Spend 5000 TL', 
    'weekly_spend_5000', 
    5000, 
    date_trunc('week', NOW()) + INTERVAL '1 day', 
    date_trunc('week', NOW()) + INTERVAL '8 days', 
    100, 
    true
);

-- Insert daily challenge (renew every day)
INSERT INTO challenges (
    title_tr, 
    title_en, 
    goal_key, 
    goal_target, 
    starts_at, 
    ends_at, 
    reward_points, 
    active
) VALUES
(
    'Günlük Fiş Yükle', 
    'Daily Receipt Upload', 
    'daily_upload', 
    1, 
    CURRENT_DATE, 
    CURRENT_DATE + INTERVAL '1 day', 
    10, 
    true
);

-- Create function to claim challenge reward
CREATE OR REPLACE FUNCTION public.claim_challenge_reward(p_challenge_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_challenge challenges%ROWTYPE;
  v_progress challenge_progress%ROWTYPE;
BEGIN
  -- Get current user
  SELECT auth.uid() INTO v_user_id;
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'not_authenticated');
  END IF;
  
  -- Get challenge details
  SELECT * INTO v_challenge FROM challenges WHERE id = p_challenge_id AND active = true;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'challenge_not_found');
  END IF;
  
  -- Get user progress
  SELECT * INTO v_progress 
  FROM challenge_progress 
  WHERE challenge_id = p_challenge_id AND user_id = v_user_id AND completed = true;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'challenge_not_completed');
  END IF;
  
  -- Check if already claimed (using meta field)
  IF v_progress.meta IS NOT NULL AND (v_progress.meta->>'claimed')::boolean = true THEN
    RETURN json_build_object('success', false, 'error', 'already_claimed');
  END IF;
  
  -- Claim the reward
  BEGIN
    -- Mark as claimed
    UPDATE challenge_progress 
    SET meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object('claimed', true, 'claimed_at', now())
    WHERE challenge_id = p_challenge_id AND user_id = v_user_id;
    
    -- Award points
    INSERT INTO points_ledger (user_id, source, delta, meta)
    VALUES (v_user_id, 'challenge', v_challenge.reward_points, 
            json_build_object('challenge_id', p_challenge_id, 'challenge_title_tr', v_challenge.title_tr));
    
    -- Update total points
    UPDATE users_profile 
    SET total_points = total_points + v_challenge.reward_points
    WHERE id = v_user_id;
    
    RETURN json_build_object(
      'success', true, 
      'points_awarded', v_challenge.reward_points,
      'challenge_title', v_challenge.title_tr
    );
  EXCEPTION
    WHEN OTHERS THEN
      RETURN json_build_object('success', false, 'error', 'claim_failed');
  END;
END;
$function$;

-- Add meta column to challenge_progress for tracking claimed status
ALTER TABLE challenge_progress ADD COLUMN IF NOT EXISTS meta jsonb DEFAULT NULL;