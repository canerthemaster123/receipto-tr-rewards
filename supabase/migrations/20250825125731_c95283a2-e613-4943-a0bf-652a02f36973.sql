-- Compatibility overload: accept json and cast to jsonb for log_admin_action
CREATE OR REPLACE FUNCTION public.log_admin_action(
  _action text,
  _table_name text DEFAULT NULL::text,
  _record_id text DEFAULT NULL::text,
  _old_values json DEFAULT NULL::json,
  _new_values json DEFAULT NULL::json
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.log_admin_action(
    _action,
    _table_name,
    _record_id,
    CASE WHEN _old_values IS NULL THEN NULL ELSE _old_values::jsonb END,
    CASE WHEN _new_values IS NULL THEN NULL ELSE _new_values::jsonb END
  );
END;
$$;

-- Admin-only reject receipt function with logging
CREATE OR REPLACE FUNCTION public.reject_receipt(p_receipt_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Ensure admin
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN json_build_object('success', false, 'error', 'admin_required');
  END IF;

  -- Update only if pending
  UPDATE public.receipts
  SET status = 'rejected', updated_at = now()
  WHERE id = p_receipt_id AND status = 'pending'
  RETURNING user_id INTO v_user_id;

  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'receipt_not_found_or_not_pending');
  END IF;

  -- Log action (jsonb-safe)
  PERFORM public.log_admin_action(
    'reject_receipt', 'receipts', p_receipt_id::text,
    jsonb_build_object('old_status','pending'),
    jsonb_build_object('new_status','rejected')
  );

  RETURN json_build_object('success', true);
END;
$$;