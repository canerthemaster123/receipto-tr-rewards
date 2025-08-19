-- Add audit triggers to sensitive tables
DROP TRIGGER IF EXISTS trg_audit_receipts ON public.receipts;
CREATE TRIGGER trg_audit_receipts 
AFTER INSERT OR UPDATE OR DELETE ON public.receipts
FOR EACH ROW EXECUTE PROCEDURE public.audit_trigger();

DROP TRIGGER IF EXISTS trg_audit_points ON public.points_ledger;
CREATE TRIGGER trg_audit_points 
AFTER INSERT OR UPDATE OR DELETE ON public.points_ledger
FOR EACH ROW EXECUTE PROCEDURE public.audit_trigger();

DROP TRIGGER IF EXISTS trg_audit_users ON public.users_profile;
CREATE TRIGGER trg_audit_users 
AFTER INSERT OR UPDATE OR DELETE ON public.users_profile
FOR EACH ROW EXECUTE PROCEDURE public.audit_trigger();

DROP TRIGGER IF EXISTS trg_audit_user_roles ON public.user_roles;
CREATE TRIGGER trg_audit_user_roles 
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE PROCEDURE public.audit_trigger();

-- Secure upload throttling function
CREATE OR REPLACE FUNCTION public.secure_upload_check(p_file_size bigint DEFAULT NULL)
RETURNS json 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Must be authenticated
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- Rate limit uploads: max 5 per 10 seconds
  IF NOT public.allow_action('receipt_upload', 10, 5) THEN
    RETURN json_build_object('success', false, 'error', 'upload_rate_limited');
  END IF;

  -- File size check (5MB limit)
  IF p_file_size IS NOT NULL AND p_file_size > 5242880 THEN
    RETURN json_build_object('success', false, 'error', 'file_too_large');
  END IF;

  RETURN json_build_object('success', true, 'message', 'upload_allowed');
END $$;

-- Cleanup old throttle records (older than 1 hour)
CREATE OR REPLACE FUNCTION public.cleanup_throttle_records()
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.request_throttle 
  WHERE created_at < now() - interval '1 hour';
END $$;

-- Update existing functions to use proper search_path
CREATE OR REPLACE FUNCTION public.send_welcome_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  -- Send welcome email asynchronously, but handle errors gracefully
  BEGIN
    PERFORM extensions.net.http_post(
      url := 'https://mxrjsclpdwmrrvmzmqmo.supabase.co/functions/v1/send-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object(
        'type', 'welcome',
        'userId', NEW.id
      )
    );
  EXCEPTION
    WHEN OTHERS THEN
      -- Log the error but don't fail the trigger
      RAISE LOG 'send_welcome_email error: %', SQLERRM;
  END;
  
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.send_receipt_status_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  -- Only send email if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Call the send-email edge function asynchronously, but handle errors gracefully
    BEGIN
      PERFORM extensions.net.http_post(
        url := 'https://mxrjsclpdwmrrvmzmqmo.supabase.co/functions/v1/send-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body := jsonb_build_object(
          'type', CASE 
            WHEN NEW.status = 'approved' THEN 'receipt_approved'
            WHEN NEW.status = 'rejected' THEN 'receipt_rejected'
            ELSE null
          END,
          'userId', NEW.user_id,
          'receiptId', NEW.id
        )
      );
    EXCEPTION
      WHEN OTHERS THEN
        -- Log the error but don't fail the trigger
        RAISE LOG 'send_receipt_status_email error: %', SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END $$;