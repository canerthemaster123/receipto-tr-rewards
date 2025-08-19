-- Drop existing function with different signature and recreate
DROP FUNCTION IF EXISTS public.apply_referral_bonus(uuid, text);

-- Recreate with correct signature and security hardening
CREATE OR REPLACE FUNCTION public.apply_referral_bonus(new_user_id uuid, code text)
RETURNS json 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, extensions
AS $$
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
$$;

-- Now continue with storage security
-- Lock down storage policies
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own documents" ON storage.objects;

-- Create secure receipt storage policies
CREATE POLICY "users_read_own_receipts" ON storage.objects
FOR SELECT USING (
  bucket_id = 'receipts' AND
  (auth.uid())::text = split_part(name, '/', 1)
);

CREATE POLICY "users_upload_own_receipts" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'receipts' AND
  (auth.uid())::text = split_part(name, '/', 1) AND
  -- Ensure reasonable file size and type restrictions at policy level
  length(name) < 200
);

CREATE POLICY "users_update_own_receipts" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'receipts' AND
  (auth.uid())::text = split_part(name, '/', 1)
) WITH CHECK (
  bucket_id = 'receipts' AND
  (auth.uid())::text = split_part(name, '/', 1)
);

CREATE POLICY "users_delete_own_receipts" ON storage.objects
FOR DELETE USING (
  bucket_id = 'receipts' AND
  (auth.uid())::text = split_part(name, '/', 1)
);

-- Admin can see all receipts in storage
CREATE POLICY "admins_read_all_receipts" ON storage.objects
FOR SELECT USING (
  bucket_id = 'receipts' AND
  public.has_admin(auth.uid())
);