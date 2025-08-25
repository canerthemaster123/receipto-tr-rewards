-- Fix update_receipt_trigger to avoid calling trigger functions directly
CREATE OR REPLACE FUNCTION public.update_receipt_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Always update timestamp
  NEW.updated_at = NOW();

  -- Safely handle points adjustments on status transitions without calling trigger functions
  IF TG_OP = 'UPDATE' THEN
    -- Pending -> Approved: add points
    IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
      UPDATE public.users_profile 
      SET total_points = total_points + COALESCE(NEW.points, 0)
      WHERE id = NEW.user_id;
    -- Approved -> Rejected: subtract points if previously awarded
    ELSIF NEW.status = 'rejected' AND OLD.status = 'approved' THEN
      UPDATE public.users_profile 
      SET total_points = GREATEST(0, total_points - COALESCE(OLD.points, 0))
      WHERE id = NEW.user_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;