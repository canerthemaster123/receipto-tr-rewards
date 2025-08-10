-- Fix search path security for email notification functions
CREATE OR REPLACE FUNCTION public.send_receipt_status_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Only send email if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Call the send-email edge function asynchronously
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
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public';

-- Fix search path security for welcome email function
CREATE OR REPLACE FUNCTION public.send_welcome_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Send welcome email asynchronously
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
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public';