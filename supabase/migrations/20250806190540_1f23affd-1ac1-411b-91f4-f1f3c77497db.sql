-- Enable RLS on all tables that might not have it
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redemptions ENABLE ROW LEVEL SECURITY; 
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users_profile ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them with better security
DROP POLICY IF EXISTS "Users can view their own receipts" ON public.receipts;
DROP POLICY IF EXISTS "Users can insert their own receipts" ON public.receipts;
DROP POLICY IF EXISTS "Users can update their own receipts" ON public.receipts;

DROP POLICY IF EXISTS "Users can view their own redemptions" ON public.redemptions;
DROP POLICY IF EXISTS "Users can insert their own redemptions" ON public.redemptions;

DROP POLICY IF EXISTS "Users can view referrals they are part of" ON public.referrals;
DROP POLICY IF EXISTS "Users can insert referrals when they are referred" ON public.referrals;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.users_profile;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users_profile;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users_profile;

-- Create secure RLS policies for receipts
CREATE POLICY "Users can view their own receipts" 
ON public.receipts 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own receipts" 
ON public.receipts 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own receipts" 
ON public.receipts 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create secure RLS policies for redemptions
CREATE POLICY "Users can view their own redemptions" 
ON public.redemptions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own redemptions" 
ON public.redemptions 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create secure RLS policies for referrals
CREATE POLICY "Users can view referrals they are part of" 
ON public.referrals 
FOR SELECT 
USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

CREATE POLICY "Users can insert referrals when they are referred" 
ON public.referrals 
FOR INSERT 
WITH CHECK (auth.uid() = referred_id);

-- Create secure RLS policies for user profiles
CREATE POLICY "Users can view their own profile" 
ON public.users_profile 
FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" 
ON public.users_profile 
FOR INSERT 
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
ON public.users_profile 
FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Add proper constraints to ensure data integrity
ALTER TABLE public.receipts 
ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.redemptions 
ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.referrals 
ALTER COLUMN referrer_id SET NOT NULL,
ALTER COLUMN referred_id SET NOT NULL;

ALTER TABLE public.users_profile 
ALTER COLUMN id SET NOT NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_receipts_user_id ON public.receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_receipts_status ON public.receipts(status);
CREATE INDEX IF NOT EXISTS idx_redemptions_user_id ON public.redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_id ON public.referrals(referred_id);
CREATE INDEX IF NOT EXISTS idx_users_profile_referral_code ON public.users_profile(referral_code);

-- Enable real-time subscriptions for better UX
ALTER PUBLICATION supabase_realtime ADD TABLE public.receipts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.redemptions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.users_profile;