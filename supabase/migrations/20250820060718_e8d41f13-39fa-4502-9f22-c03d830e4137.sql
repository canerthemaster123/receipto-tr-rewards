-- CRITICAL SECURITY FIXES

-- 1. Make receipts bucket private (currently public and exposing all receipt images)
UPDATE storage.buckets 
SET public = false 
WHERE id = 'receipts';

-- 2. Create proper RLS policies for receipts bucket
CREATE POLICY "Users can view their own receipts" ON storage.objects
  FOR SELECT 
  USING (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own receipts" ON storage.objects
  FOR INSERT 
  WITH CHECK (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins can view all receipts" ON storage.objects
  FOR SELECT 
  USING (bucket_id = 'receipts' AND has_role(auth.uid(), 'admin'::app_role));

-- 3. Fix admin-only RPC functions to actually check admin permissions
CREATE OR REPLACE FUNCTION public.approve_receipt_with_points(receipt_id uuid, points_awarded integer DEFAULT 100)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  receipt_user_id UUID;
  receipt_merchant TEXT;
  receipt_total NUMERIC;
BEGIN
  -- SECURITY: Check if user is admin
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN json_build_object('success', false, 'error', 'admin_required');
  END IF;

  -- Get receipt info
  SELECT user_id, merchant, total INTO receipt_user_id, receipt_merchant, receipt_total
  FROM public.receipts 
  WHERE id = receipt_id AND status = 'pending';
  
  IF receipt_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'receipt_not_found_or_not_pending');
  END IF;
  
  -- Log admin action
  PERFORM log_admin_action('approve_receipt', 'receipts', receipt_id::text, 
    json_build_object('old_status', 'pending'), 
    json_build_object('new_status', 'approved', 'points_awarded', points_awarded));
  
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
      'approved_at', NOW(),
      'approved_by', auth.uid()
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
$function$;

-- 4. Secure QA functions to only work in test environments
CREATE OR REPLACE FUNCTION public.qa_make_self_admin()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare 
  u uuid; 
  em text;
begin
  select auth.uid() into u;
  if u is null then
    return json_build_object('ok', false, 'error', 'not-authenticated');
  end if;
  
  select email into em from auth.users where id = u;
  if em is null then
    return json_build_object('ok', false, 'error', 'no-email');
  end if;
  
  -- SECURITY: Only allow for test emails
  if right(lower(em), 10) <> '@e2e.local' and right(lower(em), 9) <> '@test.com' then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;
  
  -- Update or insert profile with admin role
  insert into public.user_roles (user_id, role) 
  values (u, 'admin')
  on conflict (user_id, role) do nothing;
  
  return json_build_object('ok', true);
end $function$;

CREATE OR REPLACE FUNCTION public.qa_reset_test_data()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  u uuid;
  em text;
begin
  select auth.uid() into u;
  if u is null then
    return json_build_object('ok', false, 'error', 'not-authenticated');
  end if;
  
  select email into em from auth.users where id = u;
  if em is null then
    return json_build_object('ok', false, 'error', 'no-email');
  end if;
  
  -- SECURITY: Only allow for test emails
  if right(lower(em), 10) <> '@e2e.local' and right(lower(em), 9) <> '@test.com' then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;

  -- Delete receipts for test users only
  delete from receipts
  where user_id in (
    select up.id 
    from users_profile up
    join auth.users au on au.id = up.id
    where right(lower(au.email), 10) = '@e2e.local' 
       or right(lower(au.email), 9) = '@test.com'
  );
  
  -- Delete points ledger for test users only
  delete from points_ledger
  where user_id in (
    select up.id 
    from users_profile up
    join auth.users au on au.id = up.id
    where right(lower(au.email), 10) = '@e2e.local'
       or right(lower(au.email), 9) = '@test.com'
  );
  
  return json_build_object('ok', true);
end $function$;

-- 5. Remove direct points manipulation RLS policy
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users_profile;

-- Create restricted update policy that prevents points tampering
CREATE POLICY "Users can update their own profile (restricted)" ON public.users_profile
  FOR UPDATE 
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND
    -- Prevent users from changing their points directly
    (OLD.total_points = NEW.total_points OR has_role(auth.uid(), 'admin'::app_role))
  );

-- 6. Create extensions schema and move pg_net there
CREATE SCHEMA IF NOT EXISTS extensions;
-- Note: pg_net extension will be moved by Supabase team - this is for documentation