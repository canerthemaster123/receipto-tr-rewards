-- Update challenge progress tracking functions to support new goal keys
CREATE OR REPLACE FUNCTION public.update_challenge_progress(p_user_id uuid, p_goal_key text, p_increment numeric DEFAULT 1)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  challenge_record challenges%ROWTYPE;
  progress_record challenge_progress%ROWTYPE;
BEGIN
  -- Loop through active challenges with matching goal_key
  FOR challenge_record IN 
    SELECT * FROM challenges 
    WHERE active = true 
    AND goal_key = p_goal_key
    AND now() BETWEEN starts_at AND ends_at
  LOOP
    -- Get or create progress record
    SELECT * INTO progress_record 
    FROM challenge_progress 
    WHERE challenge_id = challenge_record.id AND user_id = p_user_id;
    
    IF NOT FOUND THEN
      INSERT INTO challenge_progress (challenge_id, user_id, progress)
      VALUES (challenge_record.id, p_user_id, p_increment);
      
      SELECT * INTO progress_record 
      FROM challenge_progress 
      WHERE challenge_id = challenge_record.id AND user_id = p_user_id;
    ELSE
      UPDATE challenge_progress 
      SET progress = progress + p_increment
      WHERE challenge_id = challenge_record.id AND user_id = p_user_id;
      
      progress_record.progress := progress_record.progress + p_increment;
    END IF;
    
    -- Check if challenge is completed
    IF progress_record.progress >= challenge_record.goal_target AND NOT progress_record.completed THEN
      -- Mark as completed
      UPDATE challenge_progress 
      SET completed = true, completed_at = now()
      WHERE challenge_id = challenge_record.id AND user_id = p_user_id;
    END IF;
  END LOOP;
END;
$function$;

-- Update receipt approval function to track daily uploads
CREATE OR REPLACE FUNCTION public.approve_receipt_with_points(receipt_id uuid, points_awarded integer DEFAULT 100)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  receipt_user_id UUID;
  receipt_merchant TEXT;
  receipt_total NUMERIC;
BEGIN
  -- SECURITY: Check if user is admin
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN json_build_object('success', false, 'error', 'admin_required');
  END IF;

  -- Get receipt info
  SELECT user_id, merchant, total INTO receipt_user_id, receipt_merchant, receipt_total
  FROM public.receipts 
  WHERE id = receipt_id AND status = 'pending';
  
  IF receipt_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'receipt_not_found_or_not_pending');
  END IF;
  
  -- Log admin action with jsonb args to match function signature
  PERFORM log_admin_action(
    'approve_receipt', 
    'receipts', 
    receipt_id::text, 
    jsonb_build_object('old_status', 'pending'), 
    jsonb_build_object('new_status', 'approved', 'points_awarded', points_awarded)
  );
  
  -- Transaction: approve receipt and award points
  BEGIN
    -- Update receipt status
    UPDATE public.receipts 
    SET status = 'approved', updated_at = NOW()
    WHERE id = receipt_id;
    
    -- Create points ledger entry
    INSERT INTO public.points_ledger (user_id, source, delta, meta)
    VALUES (
      receipt_user_id, 
      'receipt', 
      points_awarded, 
      jsonb_build_object(
        'receipt_id', receipt_id,
        'merchant', receipt_merchant,
        'total', receipt_total,
        'approved_at', NOW(),
        'approved_by', auth.uid()
      )
    );
    
    -- Update user total points
    UPDATE public.users_profile 
    SET total_points = total_points + points_awarded 
    WHERE id = receipt_user_id;
    
    -- Update streak
    PERFORM update_user_streak(receipt_user_id);
    
    -- Award badges
    PERFORM award_badges_if_any(receipt_user_id);
    
    -- Update challenge progress for uploads and weekly uploads
    PERFORM update_challenge_progress(receipt_user_id, 'uploads', 1);
    PERFORM update_challenge_progress(receipt_user_id, 'weekly_uploads', 1);
    PERFORM update_challenge_progress(receipt_user_id, 'daily_upload', 1);
    PERFORM update_challenge_progress(receipt_user_id, 'approved_uploads', 1);
    PERFORM update_challenge_progress(receipt_user_id, 'spend_total_trl', receipt_total);
    PERFORM update_challenge_progress(receipt_user_id, 'weekly_spend_5000', receipt_total);
    
    RETURN json_build_object('success', true, 'points_awarded', points_awarded);
  EXCEPTION
    WHEN OTHERS THEN
      RETURN json_build_object('success', false, 'error', 'approval_failed');
  END;
END;
$function$;

-- Update referral bonus function to track weekly referrals  
CREATE OR REPLACE FUNCTION public.apply_referral_bonus(new_user_id uuid, code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  referrer_user_id uuid;
  current_referred_by text;
  normalized_code text;
  points_to_award integer := 200;
BEGIN
  -- Input validation
  IF new_user_id IS NULL OR new_user_id != auth.uid() THEN
    RETURN json_build_object('success', false, 'error', 'invalid_user');
  END IF;
  
  IF code IS NULL OR trim(code) = '' THEN
    RETURN json_build_object('success', false, 'error', 'invalid_code');
  END IF;

  -- Rate limit referral applications
  IF NOT public.allow_action('referral_apply', 60, 3) THEN
    RETURN json_build_object('success', false, 'error', 'rate_limited');
  END IF;

  -- Normalize the code (consistent with frontend)
  normalized_code := LOWER(REGEXP_REPLACE(TRIM(code), '\s+', '', 'g'));
  
  -- Check if the new user has already used a referral code
  SELECT referred_by INTO current_referred_by
  FROM public.users_profile 
  WHERE id = new_user_id;
  
  IF current_referred_by IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'already_used');
  END IF;
  
  -- Find the referrer by their referral code (case-insensitive match)
  SELECT id INTO referrer_user_id
  FROM public.users_profile 
  WHERE LOWER(TRIM(referral_code)) = normalized_code
  AND id != new_user_id; -- Prevent self-referral
  
  -- Check if referrer exists
  IF referrer_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'invalid_code');
  END IF;
  
  -- Transaction: update points and record entries atomically
  BEGIN
    -- Record the referral code used by the new user
    UPDATE public.users_profile 
    SET referred_by = normalized_code
    WHERE id = new_user_id;
    
    -- Create points ledger entries for both users
    INSERT INTO public.points_ledger (user_id, source, delta, meta)
    VALUES 
      (referrer_user_id, 'referral', points_to_award, json_build_object('type', 'referrer', 'code', normalized_code, 'referred_user', new_user_id)),
      (new_user_id, 'referral', points_to_award, json_build_object('type', 'referred', 'code', normalized_code, 'referrer_user', referrer_user_id));
    
    -- Update total points for both users
    UPDATE public.users_profile 
    SET total_points = total_points + points_to_award
    WHERE id IN (referrer_user_id, new_user_id);
    
    -- Update weekly referral challenge for referrer
    PERFORM update_challenge_progress(referrer_user_id, 'weekly_referrals', 1);
    
    RETURN json_build_object(
      'success', true, 
      'message', 'Referral bonus applied successfully',
      'referrer_id', referrer_user_id,
      'referred_id', new_user_id,
      'bonus_points', points_to_award
    );
  EXCEPTION
    WHEN OTHERS THEN
      -- Log the error for debugging
      RAISE LOG 'apply_referral_bonus error: %', SQLERRM;
      RETURN json_build_object('success', false, 'error', 'transaction_failed');
  END;
END;
$function$;