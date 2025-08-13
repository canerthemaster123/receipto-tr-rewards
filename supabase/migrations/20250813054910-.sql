-- First, let's enable the net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS "http";

-- Fix the welcome email trigger function to handle errors gracefully
CREATE OR REPLACE FUNCTION public.send_welcome_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Send welcome email asynchronously, but handle errors gracefully
  BEGIN
    PERFORM net.http_post(
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
END;
$function$;

-- Also fix the receipt status email trigger to handle errors gracefully
CREATE OR REPLACE FUNCTION public.send_receipt_status_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only send email if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Call the send-email edge function asynchronously, but handle errors gracefully
    BEGIN
      PERFORM net.http_post(
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
END;
$function$;

-- Update the handle_new_user function to work properly with profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Insert profile with better defaults
  INSERT INTO public.users_profile (id, display_name, referral_code, total_points)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    SUBSTRING(NEW.id::text, 1, 8),
    0
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    referral_code = COALESCE(users_profile.referral_code, SUBSTRING(NEW.id::text, 1, 8));
  
  -- Assign default user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$function$;