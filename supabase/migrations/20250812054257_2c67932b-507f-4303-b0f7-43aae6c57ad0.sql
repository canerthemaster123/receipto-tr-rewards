-- Step 1: Add database indexes for barcode/FİŞ NO performance and ensure apply_referral_bonus is robust

-- Add indexes for OCR barcode fields
CREATE INDEX IF NOT EXISTS idx_receipts_unique_no ON receipts (receipt_unique_no) WHERE receipt_unique_no IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_receipts_fis_no ON receipts (fis_no) WHERE fis_no IS NOT NULL;

-- Improve apply_referral_bonus function to be more robust with better error handling
CREATE OR REPLACE FUNCTION public.apply_referral_bonus(new_user_id uuid, code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  referrer_user_id UUID;
  current_referred_by TEXT;
  normalized_code TEXT;
  points_to_award INTEGER := 200;
BEGIN
  -- Input validation
  IF new_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'invalid_user');
  END IF;
  
  IF code IS NULL OR trim(code) = '' THEN
    RETURN json_build_object('success', false, 'error', 'invalid_code');
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
  
  -- Check if user is trying to refer themselves (double check)
  IF referrer_user_id = new_user_id THEN
    RETURN json_build_object('success', false, 'error', 'self_ref');
  END IF;
  
  -- Transaction: update points and record entries atomically
  BEGIN
    -- Record the referral code used by the new user
    UPDATE public.users_profile 
    SET referred_by = normalized_code
    WHERE id = new_user_id;
    
    -- Ensure both users exist in profiles table
    INSERT INTO public.users_profile (id, total_points, referral_code) 
    VALUES (new_user_id, 0, SUBSTRING(new_user_id::text, 1, 8))
    ON CONFLICT (id) DO NOTHING;
    
    INSERT INTO public.users_profile (id, total_points, referral_code) 
    VALUES (referrer_user_id, 0, SUBSTRING(referrer_user_id::text, 1, 8))
    ON CONFLICT (id) DO NOTHING;
    
    -- Create points ledger entries for both users
    INSERT INTO public.points_ledger (user_id, source, delta, meta)
    VALUES 
      (referrer_user_id, 'referral', points_to_award, json_build_object('type', 'referrer', 'code', normalized_code, 'referred_user', new_user_id)),
      (new_user_id, 'referral', points_to_award, json_build_object('type', 'referred', 'code', normalized_code, 'referrer_user', referrer_user_id));
    
    -- Update total points for both users
    UPDATE public.users_profile 
    SET total_points = total_points + points_to_award
    WHERE id IN (referrer_user_id, new_user_id);
    
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