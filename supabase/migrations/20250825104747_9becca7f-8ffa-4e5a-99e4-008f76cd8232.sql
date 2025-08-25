-- Fix type mismatch: use jsonb_build_object when calling log_admin_action and for meta payloads
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
  
  -- Log admin action with jsonb args to match function signature
  PERFORM log_admin_action(
    'approve_receipt', 
    'receipts', 
    receipt_id::text, 
    jsonb_build_object('old_status', 'pending'), 
    jsonb_build_object('new_status', 'approved', 'points_awarded', points_awarded)
  );
  
  -- Transaction: approve receipt and award points
  BEGIN
    -- Update receipt status
    UPDATE public.receipts 
    SET status = 'approved', updated_at = NOW()
    WHERE id = receipt_id;
    
    -- Create points ledger entry
    INSERT INTO public.points_ledger (user_id, source, delta, meta)
    VALUES (
      receipt_user_id, 
      'receipt', 
      points_awarded, 
      jsonb_build_object(
        'receipt_id', receipt_id,
        'merchant', receipt_merchant,
        'total', receipt_total,
        'approved_at', NOW(),
        'approved_by', auth.uid()
      )
    );
    
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