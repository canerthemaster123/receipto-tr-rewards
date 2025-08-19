-- 0) PREP: Fix Extensions in Public Schema
-- Create extensions schema and add it to search_path after public
CREATE SCHEMA IF NOT EXISTS extensions;

-- Drop any wrongly-installed extensions in public
DROP EXTENSION IF EXISTS http CASCADE;
DROP EXTENSION IF EXISTS pg_net CASCADE;

-- Install pg_net in the extensions schema (provides net.http_post)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Verify search path includes extensions
SELECT current_setting('search_path');

-- 1) Helper Functions for Security
CREATE OR REPLACE FUNCTION public.has_admin(p_user uuid)
RETURNS boolean 
LANGUAGE sql 
STABLE 
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = p_user AND ur.role = 'admin'
  )
$$;

-- 2) Request Throttling Infrastructure
CREATE TABLE IF NOT EXISTS public.request_throttle (
  user_id uuid NOT NULL,
  action text NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, action, created_at)
);

CREATE INDEX IF NOT EXISTS idx_throttle_cleanup ON public.request_throttle(created_at);

CREATE OR REPLACE FUNCTION public.allow_action(p_action text, p_window_seconds int, p_max int)
RETURNS boolean 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE 
  v_count int;
BEGIN
  -- Must be authenticated
  IF auth.uid() IS NULL THEN 
    RETURN false; 
  END IF;

  -- Count recent actions
  SELECT count(*) INTO v_count
  FROM public.request_throttle
  WHERE user_id = auth.uid()
    AND action = p_action
    AND created_at > now() - make_interval(secs => p_window_seconds);

  -- Block if over limit
  IF v_count >= p_max THEN
    RETURN false;
  END IF;

  -- Record this action
  INSERT INTO public.request_throttle(user_id, action) 
  VALUES (auth.uid(), p_action);
  
  RETURN true;
END $$;

-- 3) Audit Log Infrastructure
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  row_id uuid,
  actor uuid,
  action text NOT NULL, -- insert/update/delete
  before jsonb,
  after jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_table_time ON public.audit_log(table_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor_time ON public.audit_log(actor, created_at DESC);

CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_log(table_name, row_id, actor, action, before, after)
  VALUES (
    TG_TABLE_NAME,
    COALESCE((NEW).id, (OLD).id),
    auth.uid(),
    TG_OP,
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END $$;