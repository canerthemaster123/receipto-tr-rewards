-- Add location fields to receipts table for parsed address data
ALTER TABLE public.receipts 
ADD COLUMN city TEXT,
ADD COLUMN district TEXT, 
ADD COLUMN neighborhood TEXT,
ADD COLUMN street TEXT;

-- Update the geo rollup function to use parsed location data from receipts
CREATE OR REPLACE FUNCTION public.fn_fill_period_geo_merchant_week(p_start_date date, p_end_date date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    week_start_var date;
BEGIN
    -- Iterate through each week in the date range
    week_start_var := date_trunc('week', p_start_date)::date;
    
    WHILE week_start_var <= p_end_date LOOP
        -- Clear existing data for this week
        DELETE FROM period_geo_merchant_week WHERE week_start = week_start_var;
        
        -- Insert aggregated data for this week with improved location handling
        INSERT INTO period_geo_merchant_week (
            chain_group,
            week_start,
            city,
            district,
            neighborhood,
            unique_users,
            receipt_count,
            total_spend,
            avg_basket_value,
            new_users,
            returning_users
        )
        SELECT 
            COALESCE(r.merchant_brand, normalize_merchant_to_chain(r.merchant)) as chain_group,
            week_start_var,
            -- Use parsed location from receipts first, fallback to store_dim, then 'Unknown'
            COALESCE(r.city, sd.city, 'Unknown') as city,
            COALESCE(r.district, sd.district, 'Unknown') as district,
            COALESCE(r.neighborhood, sd.neighborhood, 'Unknown') as neighborhood,
            COUNT(DISTINCT r.user_id) as unique_users,
            COUNT(*) as receipt_count,
            SUM(r.total) as total_spend,
            AVG(r.total) as avg_basket_value,
            COUNT(DISTINCT CASE 
                WHEN NOT EXISTS (
                    SELECT 1 FROM receipts r2 
                    WHERE r2.user_id = r.user_id 
                    AND r2.purchase_date < week_start_var
                    AND r2.status = 'approved'
                ) THEN r.user_id 
            END) as new_users,
            COUNT(DISTINCT CASE 
                WHEN EXISTS (
                    SELECT 1 FROM receipts r2 
                    WHERE r2.user_id = r.user_id 
                    AND r2.purchase_date < week_start_var
                    AND r2.status = 'approved'
                ) THEN r.user_id 
            END) as returning_users
        FROM receipts r
        LEFT JOIN store_dim sd ON r.store_id = sd.id
        WHERE r.purchase_date >= week_start_var
        AND r.purchase_date <= week_start_var + interval '6 days'
        AND r.status = 'approved'
        GROUP BY 
            COALESCE(r.merchant_brand, normalize_merchant_to_chain(r.merchant)),
            COALESCE(r.city, sd.city, 'Unknown'),
            COALESCE(r.district, sd.district, 'Unknown'),
            COALESCE(r.neighborhood, sd.neighborhood, 'Unknown');
        
        week_start_var := week_start_var + interval '7 days';
    END LOOP;
END;
$function$;

-- Create admin function to approve all pending receipts for a specific merchant
CREATE OR REPLACE FUNCTION public.approve_all_pending_for_merchant(p_merchant TEXT)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  receipt_count INTEGER := 0;
  total_points INTEGER := 0;
BEGIN
  -- Check admin access
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN json_build_object('success', false, 'error', 'admin_required');
  END IF;

  -- Get count of pending receipts for the merchant
  SELECT COUNT(*), COALESCE(SUM(points), 0) 
  INTO receipt_count, total_points
  FROM public.receipts 
  WHERE status = 'pending' 
  AND (merchant_brand ILIKE p_merchant OR merchant ILIKE '%' || p_merchant || '%');

  IF receipt_count = 0 THEN
    RETURN json_build_object('success', false, 'error', 'no_pending_receipts', 'merchant', p_merchant);
  END IF;

  -- Approve all pending receipts
  UPDATE public.receipts 
  SET status = 'approved', updated_at = NOW()
  WHERE status = 'pending' 
  AND (merchant_brand ILIKE p_merchant OR merchant ILIKE '%' || p_merchant || '%');

  -- Award points to all affected users
  WITH affected_receipts AS (
    SELECT user_id, points, id as receipt_id
    FROM public.receipts 
    WHERE status = 'approved' 
    AND updated_at = NOW()
    AND (merchant_brand ILIKE p_merchant OR merchant ILIKE '%' || p_merchant || '%')
  )
  INSERT INTO public.points_ledger (user_id, source, delta, meta)
  SELECT 
    user_id, 
    'receipt', 
    points, 
    jsonb_build_object(
      'receipt_id', receipt_id,
      'merchant', p_merchant,
      'bulk_approved_at', NOW(),
      'approved_by', auth.uid()
    )
  FROM affected_receipts;

  -- Update user total points
  WITH affected_users AS (
    SELECT user_id, SUM(points) as total_awarded
    FROM public.receipts 
    WHERE status = 'approved' 
    AND updated_at = NOW()
    AND (merchant_brand ILIKE p_merchant OR merchant ILIKE '%' || p_merchant || '%')
    GROUP BY user_id
  )
  UPDATE public.users_profile 
  SET total_points = total_points + au.total_awarded
  FROM affected_users au
  WHERE users_profile.id = au.user_id;

  -- Log admin action
  PERFORM log_admin_action(
    'bulk_approve_receipts', 
    'receipts', 
    NULL,
    jsonb_build_object('merchant', p_merchant, 'receipt_count', receipt_count),
    jsonb_build_object('status', 'approved', 'points_awarded', total_points)
  );

  RETURN json_build_object(
    'success', true, 
    'receipts_approved', receipt_count,
    'total_points_awarded', total_points,
    'merchant', p_merchant
  );
END;
$function$;