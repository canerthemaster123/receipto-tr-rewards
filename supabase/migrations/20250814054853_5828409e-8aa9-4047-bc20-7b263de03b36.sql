-- Gamification v1: badges, streaks, challenges, leaderboard

-- 1) User streaks
CREATE TABLE IF NOT EXISTS public.user_streaks (
  user_id uuid PRIMARY KEY REFERENCES public.users_profile(id) ON DELETE CASCADE,
  current_streak int NOT NULL DEFAULT 0,
  longest_streak int NOT NULL DEFAULT 0,
  last_activity_date date,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;

-- 2) Badges (catalog)
CREATE TABLE IF NOT EXISTS public.badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  name_tr text NOT NULL,
  name_en text NOT NULL,
  desc_tr text,
  desc_en text,
  icon text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort int NOT NULL DEFAULT 100
);

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

-- 3) User badges (awards)
CREATE TABLE IF NOT EXISTS public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users_profile(id) ON DELETE CASCADE,
  badge_key text NOT NULL REFERENCES public.badges(key),
  awarded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, badge_key)
);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- 4) Weekly challenges (admin defined)
CREATE TABLE IF NOT EXISTS public.challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_tr text NOT NULL,
  title_en text NOT NULL,
  goal_key text NOT NULL,
  goal_target numeric NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  reward_points int NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.users_profile(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

-- 5) Challenge progress (per user)
CREATE TABLE IF NOT EXISTS public.challenge_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users_profile(id) ON DELETE CASCADE,
  progress numeric NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  UNIQUE (challenge_id, user_id)
);

ALTER TABLE public.challenge_progress ENABLE ROW LEVEL SECURITY;

-- 6) Leaderboard snapshots (privacy-safe)
CREATE TABLE IF NOT EXISTS public.leaderboard_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_key text NOT NULL,
  rank int NOT NULL,
  user_id uuid NOT NULL REFERENCES public.users_profile(id) ON DELETE CASCADE,
  points int NOT NULL,
  public_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (period_key, rank)
);

ALTER TABLE public.leaderboard_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- user_streaks: users read own rows; admins read all
CREATE POLICY "Users can view their own streak" ON public.user_streaks
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all streaks" ON public.user_streaks
FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- user_badges: users read own rows; admins read all
CREATE POLICY "Users can view their own badges" ON public.user_badges
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all user badges" ON public.user_badges
FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- challenge_progress: users read own rows; admins read all
CREATE POLICY "Users can view their own challenge progress" ON public.challenge_progress
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all challenge progress" ON public.challenge_progress
FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- badges: readable by all; insert/update only admins
CREATE POLICY "Everyone can view badges" ON public.badges
FOR SELECT USING (true);

CREATE POLICY "Admins can manage badges" ON public.badges
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- challenges: readable by all; insert/update only admins
CREATE POLICY "Everyone can view challenges" ON public.challenges
FOR SELECT USING (true);

CREATE POLICY "Admins can manage challenges" ON public.challenges
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- leaderboard_snapshots: readable by all; insert/update only admins
CREATE POLICY "Everyone can view leaderboard" ON public.leaderboard_snapshots
FOR SELECT USING (true);

CREATE POLICY "Admins can manage leaderboard" ON public.leaderboard_snapshots
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_badges_user ON public.user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_challenge_progress_user ON public.challenge_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_challenges_active_window ON public.challenges(active, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_leaderboard_period ON public.leaderboard_snapshots(period_key);

-- Seed badges
INSERT INTO public.badges (key, name_tr, name_en, desc_tr, desc_en, icon, sort) VALUES
('first_upload', 'İlk Yükleme', 'First Upload', 'İlk fişinizi yüklediniz!', 'You uploaded your first receipt!', 'Award', 1),
('ten_receipts', '10 Fiş', '10 Receipts', '10 fiş yüklediniz!', 'You uploaded 10 receipts!', 'Star', 2),
('fifty_receipts', '50 Fiş', '50 Receipts', '50 fiş yüklediniz!', 'You uploaded 50 receipts!', 'Medal', 3),
('weekly_streak_7', '7 Gün Seri', '7-Day Streak', '7 gün üst üste fiş yüklediniz!', 'You uploaded receipts for 7 consecutive days!', 'Flame', 4),
('approved_1k_spend', '₺1.000 Onaylı Harcama', '₺1,000 Approved Spend', '₺1.000 değerinde onaylı harcamanız var!', 'You have ₺1,000 worth of approved spending!', 'Wallet', 5)
ON CONFLICT (key) DO NOTHING;

-- Functions

-- Helper function to mask names for privacy
CREATE OR REPLACE FUNCTION public.mask_name(display_name text)
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  IF display_name IS NULL OR length(display_name) <= 2 THEN
    RETURN 'Anonim User';
  END IF;
  
  -- For names with spaces, mask last name completely
  IF position(' ' in display_name) > 0 THEN
    RETURN substring(display_name, 1, 1) || '*** ' || substring(split_part(display_name, ' ', 2), 1, 1) || '***';
  END IF;
  
  -- For single names, show first and last character with stars
  IF length(display_name) <= 3 THEN
    RETURN substring(display_name, 1, 1) || '***';
  END IF;
  
  RETURN substring(display_name, 1, 1) || '***' || substring(display_name, length(display_name), 1);
END;
$$;

-- Update user streak function
CREATE OR REPLACE FUNCTION public.update_user_streak(p_user_id uuid, p_date date DEFAULT CURRENT_DATE)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  current_record user_streaks%ROWTYPE;
BEGIN
  -- Get or create streak record
  SELECT * INTO current_record FROM user_streaks WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    -- First time - create new streak
    INSERT INTO user_streaks (user_id, current_streak, longest_streak, last_activity_date, updated_at)
    VALUES (p_user_id, 1, 1, p_date, now());
    RETURN;
  END IF;
  
  -- If activity is today, keep current streak (idempotent)
  IF current_record.last_activity_date = p_date THEN
    RETURN;
  END IF;
  
  -- If activity was yesterday, increment streak
  IF current_record.last_activity_date = p_date - INTERVAL '1 day' THEN
    UPDATE user_streaks 
    SET current_streak = current_record.current_streak + 1,
        longest_streak = GREATEST(current_record.longest_streak, current_record.current_streak + 1),
        last_activity_date = p_date,
        updated_at = now()
    WHERE user_id = p_user_id;
  ELSE
    -- Reset streak
    UPDATE user_streaks 
    SET current_streak = 1,
        longest_streak = GREATEST(current_record.longest_streak, 1),
        last_activity_date = p_date,
        updated_at = now()
    WHERE user_id = p_user_id;
  END IF;
END;
$$;

-- Award badges function
CREATE OR REPLACE FUNCTION public.award_badges_if_any(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  receipt_count int;
  current_streak_val int;
  total_approved_spend numeric;
BEGIN
  -- Check first_upload badge
  SELECT COUNT(*) INTO receipt_count 
  FROM receipts 
  WHERE user_id = p_user_id AND status = 'approved';
  
  IF receipt_count >= 1 THEN
    INSERT INTO user_badges (user_id, badge_key) 
    VALUES (p_user_id, 'first_upload')
    ON CONFLICT (user_id, badge_key) DO NOTHING;
  END IF;
  
  -- Check ten_receipts badge
  IF receipt_count >= 10 THEN
    INSERT INTO user_badges (user_id, badge_key) 
    VALUES (p_user_id, 'ten_receipts')
    ON CONFLICT (user_id, badge_key) DO NOTHING;
  END IF;
  
  -- Check fifty_receipts badge
  IF receipt_count >= 50 THEN
    INSERT INTO user_badges (user_id, badge_key) 
    VALUES (p_user_id, 'fifty_receipts')
    ON CONFLICT (user_id, badge_key) DO NOTHING;
  END IF;
  
  -- Check weekly_streak_7 badge
  SELECT current_streak INTO current_streak_val 
  FROM user_streaks 
  WHERE user_id = p_user_id;
  
  IF current_streak_val >= 7 THEN
    INSERT INTO user_badges (user_id, badge_key) 
    VALUES (p_user_id, 'weekly_streak_7')
    ON CONFLICT (user_id, badge_key) DO NOTHING;
  END IF;
  
  -- Check approved_1k_spend badge
  SELECT COALESCE(SUM(total), 0) INTO total_approved_spend
  FROM receipts 
  WHERE user_id = p_user_id AND status = 'approved';
  
  IF total_approved_spend >= 1000 THEN
    INSERT INTO user_badges (user_id, badge_key) 
    VALUES (p_user_id, 'approved_1k_spend')
    ON CONFLICT (user_id, badge_key) DO NOTHING;
  END IF;
END;
$$;

-- Update challenge progress function
CREATE OR REPLACE FUNCTION public.update_challenge_progress(p_user_id uuid, p_goal_key text, p_increment numeric DEFAULT 1)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
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
      
      -- Award points
      INSERT INTO points_ledger (user_id, source, delta, meta)
      VALUES (p_user_id, 'challenge', challenge_record.reward_points, 
              json_build_object('challenge_id', challenge_record.id, 'challenge_title_en', challenge_record.title_en));
      
      -- Update total points
      UPDATE users_profile 
      SET total_points = total_points + challenge_record.reward_points
      WHERE id = p_user_id;
      
      -- Check for new badges
      PERFORM award_badges_if_any(p_user_id);
    END IF;
  END LOOP;
END;
$$;

-- Build leaderboard snapshot function
CREATE OR REPLACE FUNCTION public.build_leaderboard_snapshot(p_period_key text, p_start_date timestamptz, p_end_date timestamptz)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  user_record RECORD;
  current_rank int := 1;
BEGIN
  -- Delete existing snapshot for this period
  DELETE FROM leaderboard_snapshots WHERE period_key = p_period_key;
  
  -- Calculate and insert top users
  FOR user_record IN
    SELECT 
      pl.user_id,
      SUM(pl.delta) as total_points,
      up.display_name
    FROM points_ledger pl
    JOIN users_profile up ON pl.user_id = up.id
    WHERE pl.created_at BETWEEN p_start_date AND p_end_date
    GROUP BY pl.user_id, up.display_name
    ORDER BY total_points DESC
    LIMIT 100
  LOOP
    INSERT INTO leaderboard_snapshots (period_key, rank, user_id, points, public_name)
    VALUES (p_period_key, current_rank, user_record.user_id, user_record.total_points::int, 
            mask_name(user_record.display_name));
    
    current_rank := current_rank + 1;
  END LOOP;
END;
$$;

-- Update the existing approve_receipt_with_points function to include gamification
CREATE OR REPLACE FUNCTION public.approve_receipt_with_points(receipt_id uuid, points_awarded integer DEFAULT 100)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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
    
    -- Update streak
    PERFORM update_user_streak(receipt_user_id);
    
    -- Award badges
    PERFORM award_badges_if_any(receipt_user_id);
    
    -- Update challenge progress
    PERFORM update_challenge_progress(receipt_user_id, 'uploads', 1);
    PERFORM update_challenge_progress(receipt_user_id, 'approved_uploads', 1);
    PERFORM update_challenge_progress(receipt_user_id, 'spend_total_trl', receipt_total);
    
    RETURN json_build_object('success', true, 'points_awarded', points_awarded);
  EXCEPTION
    WHEN OTHERS THEN
      RETURN json_build_object('success', false, 'error', 'approval_failed');
  END;
END;
$$;