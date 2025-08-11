-- Fix referral bonus system with proper database structure
-- Drop existing function first to avoid parameter name conflict
DROP FUNCTION IF EXISTS public.apply_referral_bonus(uuid, text);

-- 1. Ensure users_profile has referral columns and proper constraints
ALTER TABLE public.users_profile 
ADD COLUMN IF NOT EXISTS referred_by TEXT;

-- Create index for faster referral lookups
CREATE INDEX IF NOT EXISTS idx_users_profile_referral_code ON public.users_profile(referral_code);

-- 2. Create points_ledger table for transaction history
CREATE TABLE IF NOT EXISTS public.points_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('receipt', 'redemption', 'referral', 'migration')),
  delta INTEGER NOT NULL,
  meta JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on points_ledger
ALTER TABLE public.points_ledger ENABLE ROW LEVEL SECURITY;

-- RLS policies for points_ledger
CREATE POLICY "Users can view their own ledger entries" 
ON public.points_ledger 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all ledger entries" 
ON public.points_ledger 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. Create the referral bonus function with proper logic
CREATE OR REPLACE FUNCTION public.apply_referral_bonus(new_user_id uuid, code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  referrer_user_id UUID;
  current_referred_by TEXT;
  normalized_code TEXT;
BEGIN
  -- Normalize the code
  normalized_code := LOWER(REGEXP_REPLACE(TRIM(code), '\s+', '', 'g'));
  
  -- Check if the new user has already used a referral code
  SELECT referred_by INTO current_referred_by
  FROM public.users_profile 
  WHERE id = new_user_id;
  
  IF current_referred_by IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'already_used');
  END IF;
  
  -- Find the referrer by their referral code
  SELECT id INTO referrer_user_id
  FROM public.users_profile 
  WHERE LOWER(TRIM(referral_code)) = normalized_code;
  
  -- Check if referrer exists
  IF referrer_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'invalid_code');
  END IF;
  
  -- Check if user is trying to refer themselves
  IF referrer_user_id = new_user_id THEN
    RETURN json_build_object('success', false, 'error', 'self_ref');
  END IF;
  
  -- Transaction: update points and record entries
  BEGIN
    -- Record the referral code used by the new user
    UPDATE public.users_profile 
    SET referred_by = normalized_code
    WHERE id = new_user_id;
    
    -- Create points ledger entries for both users
    INSERT INTO public.points_ledger (user_id, source, delta, meta)
    VALUES 
      (referrer_user_id, 'referral', 200, json_build_object('type', 'referrer', 'code', normalized_code, 'referred_user', new_user_id)),
      (new_user_id, 'referral', 200, json_build_object('type', 'referred', 'code', normalized_code, 'referrer_user', referrer_user_id));
    
    -- Update total points for both users
    UPDATE public.users_profile 
    SET total_points = total_points + 200
    WHERE id IN (referrer_user_id, new_user_id);
    
    RETURN json_build_object(
      'success', true, 
      'message', 'Referral bonus applied successfully',
      'referrer_id', referrer_user_id,
      'referred_id', new_user_id,
      'bonus_points', 200
    );
  EXCEPTION
    WHEN OTHERS THEN
      RETURN json_build_object('success', false, 'error', 'transaction_failed');
  END;
END;
$$;

-- 4. Create a function to properly handle receipt approvals with points ledger
CREATE OR REPLACE FUNCTION public.approve_receipt_with_points(receipt_id uuid, points_awarded integer DEFAULT 100)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  receipt_user_id UUID;
  receipt_merchant TEXT;
  receipt_total NUMERIC;
BEGIN
  -- Get receipt info
  SELECT user_id, merchant, total INTO receipt_user_id, receipt_merchant, receipt_total
  FROM public.receipts 
  WHERE id = receipt_id AND status = 'pending';
  
  IF receipt_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'receipt_not_found_or_not_pending');
  END IF;
  
  -- Transaction: approve receipt and award points
  BEGIN
    -- Update receipt status
    UPDATE public.receipts 
    SET status = 'approved', updated_at = NOW()
    WHERE id = receipt_id;
    
    -- Create points ledger entry
    INSERT INTO public.points_ledger (user_id, source, delta, meta)
    VALUES (receipt_user_id, 'receipt', points_awarded, json_build_object(
      'receipt_id', receipt_id,
      'merchant', receipt_merchant,
      'total', receipt_total,
      'approved_at', NOW()
    ));
    
    -- Update user total points
    UPDATE public.users_profile 
    SET total_points = total_points + points_awarded
    WHERE id = receipt_user_id;
    
    RETURN json_build_object('success', true, 'points_awarded', points_awarded);
  EXCEPTION
    WHEN OTHERS THEN
      RETURN json_build_object('success', false, 'error', 'approval_failed');
  END;
END;
$$;

-- 5. Add realtime for points_ledger
ALTER publication supabase_realtime ADD TABLE public.points_ledger;