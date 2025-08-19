-- 4) Enable RLS on new security tables
ALTER TABLE public.request_throttle ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can see throttle/audit data
CREATE POLICY "audit_admin_only" ON public.audit_log
FOR ALL USING (public.has_admin(auth.uid()));

CREATE POLICY "throttle_admin_only" ON public.request_throttle  
FOR SELECT USING (public.has_admin(auth.uid()));

-- 5) Hardened Security Definer RPCs
-- Replace existing apply_referral_bonus with secure version
CREATE OR REPLACE FUNCTION public.apply_referral_bonus(p_new_user uuid, p_code text)
RETURNS json 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_referrer uuid;
  v_code text;
  v_pts int := 200;
BEGIN
  -- Validate inputs
  IF p_new_user IS NULL OR p_new_user != auth.uid() THEN
    RETURN json_build_object('success', false, 'error', 'invalid_user');
  END IF;
  
  v_code := lower(regexp_replace(COALESCE(p_code,''), '\s+', '', 'g'));
  IF v_code = '' THEN
    RETURN json_build_object('success', false, 'error', 'invalid_code');
  END IF;

  -- Rate limit referral applications
  IF NOT public.allow_action('referral_apply', 60, 3) THEN
    RETURN json_build_object('success', false, 'error', 'rate_limited');
  END IF;

  -- Find referrer (cannot self-refer)
  SELECT id INTO v_referrer 
  FROM public.users_profile
  WHERE lower(trim(referral_code)) = v_code AND id != p_new_user;
  
  IF v_referrer IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'invalid_code');
  END IF;

  -- Check if already used
  IF EXISTS (SELECT 1 FROM public.users_profile WHERE id = p_new_user AND referred_by IS NOT NULL) THEN
    RETURN json_build_object('success', false, 'error', 'already_used');
  END IF;

  -- Atomic transaction
  BEGIN
    UPDATE public.users_profile SET referred_by = v_code WHERE id = p_new_user;

    INSERT INTO public.points_ledger(user_id, source, delta, meta)
    VALUES
      (v_referrer, 'referral', v_pts, json_build_object('type','referrer','code',v_code,'referred_user',p_new_user)),
      (p_new_user, 'referral', v_pts, json_build_object('type','referred','code',v_code,'referrer_user',v_referrer));

    UPDATE public.users_profile SET total_points = total_points + v_pts WHERE id IN (v_referrer, p_new_user);

    RETURN json_build_object('success', true, 'bonus_points', v_pts);
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'apply_referral_bonus error: %', SQLERRM;
    RETURN json_build_object('success', false, 'error', 'transaction_failed');
  END;
END $$;

-- Replace existing approve_receipt_with_points with secure version  
CREATE OR REPLACE FUNCTION public.approve_receipt_with_points(p_receipt uuid, p_points int DEFAULT 100)
RETURNS json 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_total numeric;
BEGIN
  -- Only admins can approve
  IF NOT public.has_admin(auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'forbidden');
  END IF;

  -- Rate limit approvals
  IF NOT public.allow_action('receipt_approve', 10, 20) THEN
    RETURN json_build_object('success', false, 'error', 'rate_limited');
  END IF;

  -- Validate receipt exists and is pending
  SELECT user_id, total INTO v_uid, v_total
  FROM public.receipts WHERE id = p_receipt AND status = 'pending';

  IF v_uid IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'not_pending');
  END IF;

  -- Validate points (reasonable range)
  IF p_points < 0 OR p_points > 10000 THEN
    RETURN json_build_object('success', false, 'error', 'invalid_points');
  END IF;

  -- Atomic approval
  BEGIN
    UPDATE public.receipts SET status = 'approved', updated_at = now() WHERE id = p_receipt;

    INSERT INTO public.points_ledger(user_id, source, delta, meta)
    VALUES (v_uid, 'receipt', p_points, json_build_object('receipt_id', p_receipt, 'total', v_total, 'approved_by', auth.uid()));

    UPDATE public.users_profile SET total_points = total_points + p_points WHERE id = v_uid;

    RETURN json_build_object('success', true, 'points_awarded', p_points);
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'approve_receipt_with_points error: %', SQLERRM;
    RETURN json_build_object('success', false, 'error', 'approval_failed');
  END;
END $$;

-- Create secure receipt rejection function
CREATE OR REPLACE FUNCTION public.reject_receipt_with_reason(p_receipt uuid, p_reason text DEFAULT 'Invalid receipt')
RETURNS json 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid;
BEGIN
  -- Only admins can reject
  IF NOT public.has_admin(auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'forbidden');
  END IF;

  -- Rate limit rejections
  IF NOT public.allow_action('receipt_reject', 10, 20) THEN
    RETURN json_build_object('success', false, 'error', 'rate_limited');
  END IF;

  -- Validate receipt exists and is pending
  SELECT user_id INTO v_uid
  FROM public.receipts WHERE id = p_receipt AND status = 'pending';

  IF v_uid IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'not_pending');
  END IF;

  -- Sanitize reason
  p_reason := COALESCE(trim(p_reason), 'Invalid receipt');
  IF length(p_reason) > 500 THEN
    p_reason := left(p_reason, 500);
  END IF;

  -- Atomic rejection
  BEGIN
    UPDATE public.receipts 
    SET status = 'rejected', 
        updated_at = now(),
        items = COALESCE(items, '') || E'\n\nRejection reason: ' || p_reason
    WHERE id = p_receipt;

    RETURN json_build_object('success', true, 'reason', p_reason);
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'reject_receipt_with_reason error: %', SQLERRM;
    RETURN json_build_object('success', false, 'error', 'rejection_failed');
  END;
END $$;