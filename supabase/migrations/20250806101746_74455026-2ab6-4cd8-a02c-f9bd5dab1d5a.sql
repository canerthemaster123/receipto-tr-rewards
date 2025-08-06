-- Fix search path security issues for all functions

-- Drop and recreate handle_new_user function with proper search path
DROP FUNCTION IF EXISTS public.handle_new_user();
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.users_profile (id, display_name, referral_code)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    SUBSTRING(NEW.id::text, 1, 8)
  );
  RETURN NEW;
END;
$$;

-- Drop and recreate update_user_points function with proper search path
DROP FUNCTION IF EXISTS public.update_user_points();
CREATE OR REPLACE FUNCTION public.update_user_points()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- If receipt was approved, add points
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    UPDATE public.users_profile 
    SET total_points = total_points + NEW.points 
    WHERE id = NEW.user_id;
  -- If receipt was rejected, subtract points if they were already added
  ELSIF NEW.status = 'rejected' AND OLD.status = 'approved' THEN
    UPDATE public.users_profile 
    SET total_points = GREATEST(0, total_points - NEW.points) 
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Drop and recreate redeem_reward function with proper search path
DROP FUNCTION IF EXISTS public.redeem_reward(TEXT, INTEGER);
CREATE OR REPLACE FUNCTION public.redeem_reward(
  reward_name TEXT,
  points_cost INTEGER
) 
RETURNS JSON 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  user_points INTEGER;
  redemption_id UUID;
BEGIN
  -- Get current user points
  SELECT total_points INTO user_points 
  FROM public.users_profile 
  WHERE id = auth.uid();
  
  -- Check if user has enough points
  IF user_points < points_cost THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient points');
  END IF;
  
  -- Create redemption record
  INSERT INTO public.redemptions (user_id, reward_name, points_cost)
  VALUES (auth.uid(), reward_name, points_cost)
  RETURNING id INTO redemption_id;
  
  -- Deduct points from user
  UPDATE public.users_profile 
  SET total_points = total_points - points_cost 
  WHERE id = auth.uid();
  
  RETURN json_build_object('success', true, 'redemption_id', redemption_id);
END;
$$;

-- Drop and recreate process_referral function with proper search path
DROP FUNCTION IF EXISTS public.process_referral(TEXT);
CREATE OR REPLACE FUNCTION public.process_referral(referral_code TEXT)
RETURNS JSON 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  referrer_user_id UUID;
  current_user_id UUID;
BEGIN
  -- Get current user
  SELECT auth.uid() INTO current_user_id;
  
  -- Find referrer by code
  SELECT id INTO referrer_user_id 
  FROM public.users_profile 
  WHERE referral_code = process_referral.referral_code;
  
  -- Check if referrer exists
  IF referrer_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid referral code');
  END IF;
  
  -- Check if user is trying to refer themselves
  IF referrer_user_id = current_user_id THEN
    RETURN json_build_object('success', false, 'error', 'Cannot refer yourself');
  END IF;
  
  -- Check if user was already referred
  IF EXISTS (SELECT 1 FROM public.referrals WHERE referred_id = current_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'User already referred');
  END IF;
  
  -- Create referral record
  INSERT INTO public.referrals (referrer_id, referred_id)
  VALUES (referrer_user_id, current_user_id);
  
  -- Award points to both users
  UPDATE public.users_profile 
  SET total_points = total_points + 200 
  WHERE id IN (referrer_user_id, current_user_id);
  
  RETURN json_build_object('success', true, 'message', 'Referral processed successfully');
END;
$$;