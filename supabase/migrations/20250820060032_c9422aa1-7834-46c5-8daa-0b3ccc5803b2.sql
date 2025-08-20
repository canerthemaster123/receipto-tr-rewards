-- Security Fix: Enable RLS on request_throttle table
-- This table tracks rate limiting data and should not be directly accessible to users

-- Enable Row Level Security on request_throttle table
ALTER TABLE public.request_throttle ENABLE ROW LEVEL SECURITY;

-- Create policy to allow only admins to view throttle records (for debugging)
CREATE POLICY "Admin only throttle access" ON public.request_throttle
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- No INSERT/UPDATE/DELETE policies for users - only system functions should modify this table
-- The allow_action() function uses SECURITY DEFINER to bypass RLS for legitimate system operations