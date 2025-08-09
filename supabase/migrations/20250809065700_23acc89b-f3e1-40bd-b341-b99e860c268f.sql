-- Add referred_by column to users_profile if it doesn't exist
ALTER TABLE public.users_profile 
ADD COLUMN IF NOT EXISTS referred_by TEXT;

-- Create function to apply referral bonus
CREATE OR REPLACE FUNCTION public.apply_referral_bonus(
  new_user_id UUID,
  referral_code TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  referrer_user_id UUID;
  current_referred_by TEXT;
BEGIN
  -- Clean up the referral code (remove whitespace, make lowercase)
  referral_code := LOWER(TRIM(referral_code));
  
  -- Check if the new user has already used a referral code
  SELECT referred_by INTO current_referred_by
  FROM public.users_profile 
  WHERE id = new_user_id;
  
  IF current_referred_by IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'User has already used a referral code');
  END IF;
  
  -- Find the referrer by their referral code
  SELECT id INTO referrer_user_id
  FROM public.users_profile 
  WHERE LOWER(TRIM(referral_code)) = referral_code;
  
  -- Check if referrer exists
  IF referrer_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid referral code');
  END IF;
  
  -- Check if user is trying to refer themselves
  IF referrer_user_id = new_user_id THEN
    RETURN json_build_object('success', false, 'error', 'Cannot refer yourself');
  END IF;
  
  -- Record the referral code used by the new user
  UPDATE public.users_profile 
  SET referred_by = referral_code
  WHERE id = new_user_id;
  
  -- Award 200 points to both users
  UPDATE public.users_profile 
  SET total_points = total_points + 200
  WHERE id IN (referrer_user_id, new_user_id);
  
  -- Create referral record for tracking
  INSERT INTO public.referrals (referrer_id, referred_id, points_awarded)
  VALUES (referrer_user_id, new_user_id, 200);
  
  RETURN json_build_object(
    'success', true, 
    'message', 'Referral bonus applied successfully',
    'referrer_id', referrer_user_id,
    'referred_id', new_user_id,
    'bonus_points', 200
  );
END;
$$;