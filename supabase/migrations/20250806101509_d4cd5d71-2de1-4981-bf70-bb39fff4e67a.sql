-- Create user profiles table
CREATE TABLE public.users_profile (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  total_points INTEGER DEFAULT 0,
  referral_code TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create receipts table
CREATE TABLE public.receipts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url TEXT,
  merchant TEXT,
  total NUMERIC(10,2),
  purchase_date DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  points INTEGER DEFAULT 100,
  items TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create redemptions table  
CREATE TABLE public.redemptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_name TEXT NOT NULL,
  points_cost INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create referrals table
CREATE TABLE public.referrals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points_awarded INTEGER DEFAULT 200,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(referred_id)
);

-- Enable Row Level Security
ALTER TABLE public.users_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for users_profile
CREATE POLICY "Users can view their own profile" 
ON public.users_profile FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
ON public.users_profile FOR UPDATE 
USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" 
ON public.users_profile FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Create RLS policies for receipts
CREATE POLICY "Users can view their own receipts" 
ON public.receipts FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own receipts" 
ON public.receipts FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own receipts" 
ON public.receipts FOR UPDATE 
USING (auth.uid() = user_id);

-- Create RLS policies for redemptions  
CREATE POLICY "Users can view their own redemptions" 
ON public.redemptions FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own redemptions" 
ON public.redemptions FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for referrals
CREATE POLICY "Users can view referrals they are part of" 
ON public.referrals FOR SELECT 
USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

CREATE POLICY "Users can insert referrals when they are referred" 
ON public.referrals FOR INSERT 
WITH CHECK (auth.uid() = referred_id);

-- Create storage bucket for receipts
INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', true);

-- Create storage policies
CREATE POLICY "Users can upload their own receipt images" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own receipt images" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Receipt images are publicly accessible" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'receipts');

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users_profile (id, display_name, referral_code)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    SUBSTRING(NEW.id::text, 1, 8)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update points after receipt approval
CREATE OR REPLACE FUNCTION public.update_user_points()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for receipt status changes
CREATE TRIGGER on_receipt_status_change
  AFTER UPDATE ON public.receipts
  FOR EACH ROW EXECUTE FUNCTION public.update_user_points();

-- Create function to handle redemptions
CREATE OR REPLACE FUNCTION public.redeem_reward(
  reward_name TEXT,
  points_cost INTEGER
) RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to handle referrals
CREATE OR REPLACE FUNCTION public.process_referral(referral_code TEXT)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable realtime for tables
ALTER TABLE public.receipts REPLICA IDENTITY FULL;
ALTER TABLE public.users_profile REPLICA IDENTITY FULL;
ALTER TABLE public.redemptions REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.receipts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.users_profile;
ALTER PUBLICATION supabase_realtime ADD TABLE public.redemptions;