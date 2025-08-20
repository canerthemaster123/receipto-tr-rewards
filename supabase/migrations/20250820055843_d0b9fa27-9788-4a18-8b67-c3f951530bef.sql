-- Security Fix: Enable RLS on audit_log table and restrict access to admins only
-- This prevents unauthorized access to sensitive system activity data

-- Enable Row Level Security on audit_log table
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Create policy to allow only admins to view audit logs
CREATE POLICY "Admin only audit log access" ON public.audit_log
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create policy to allow only admins to insert audit logs (for manual entries if needed)
CREATE POLICY "Admin only audit log insert" ON public.audit_log
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Note: UPDATE and DELETE are intentionally not allowed to preserve audit integrity