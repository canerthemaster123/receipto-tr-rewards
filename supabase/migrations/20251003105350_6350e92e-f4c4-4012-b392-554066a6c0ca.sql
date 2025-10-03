-- Fix leaderboard privacy issue by removing user_id exposure
ALTER TABLE public.leaderboard_snapshots DROP COLUMN IF EXISTS user_id;

-- Add proper indexes for performance
CREATE INDEX IF NOT EXISTS idx_receipts_user_status_date ON public.receipts(user_id, status, purchase_date DESC);
CREATE INDEX IF NOT EXISTS idx_points_ledger_user_created ON public.points_ledger(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_challenge_progress_user_challenge ON public.challenge_progress(user_id, challenge_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_user_badge ON public.user_badges(user_id, badge_key);

-- Add rate limiting for critical operations
CREATE TABLE IF NOT EXISTS public.operation_throttle (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  operation_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT fk_operation_throttle_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_operation_throttle_user_op_created ON public.operation_throttle(user_id, operation_type, created_at DESC);

-- Cleanup function for throttle records
CREATE OR REPLACE FUNCTION public.cleanup_operation_throttle()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  DELETE FROM public.operation_throttle 
  WHERE created_at < now() - interval '24 hours';
END;
$function$;