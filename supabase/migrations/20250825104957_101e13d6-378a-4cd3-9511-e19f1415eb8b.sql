-- 1) Create admin check RPC (no-arg wrapper)
CREATE OR REPLACE FUNCTION public.has_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN 
    RETURN false; 
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = uid AND role = 'admin'
  );
END;
$$;

-- Revoke from public; grant execute to authenticated
REVOKE ALL ON FUNCTION public.has_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_admin() TO authenticated;

-- 2) Fix the user×merchant weekly rollup bug with proper aliasing
CREATE OR REPLACE FUNCTION public.fn_fill_period_user_merchant_week(p_start_date date, p_end_date date)
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
        DELETE FROM period_user_merchant_week WHERE week_start = week_start_var;
        
        -- Insert aggregated data for this week using proper aliasing
        WITH base AS (
            SELECT
                r.user_id,
                date_trunc('week', r.purchase_date)::date AS week_start,
                COALESCE(r.merchant_brand, normalize_merchant_to_chain(r.merchant)) AS chain_group,
                r.total::numeric AS total,
                r.purchase_date
            FROM public.receipts r
            WHERE r.purchase_date >= week_start_var
              AND r.purchase_date <= week_start_var + interval '6 days'
              AND r.status = 'approved'
        )
        INSERT INTO public.period_user_merchant_week (
            user_id, 
            chain_group, 
            week_start,
            receipt_count,
            total_spend,
            avg_basket_value,
            first_visit_week,
            last_visit_week
        )
        SELECT
            b.user_id,
            b.chain_group,
            week_start_var,
            COUNT(*) as receipt_count,
            SUM(b.total) as total_spend,
            AVG(b.total) as avg_basket_value,
            -- First visit logic: no prior receipts for this user-merchant combo
            NOT EXISTS (
                SELECT 1 FROM public.receipts r2 
                WHERE r2.user_id = b.user_id 
                  AND COALESCE(r2.merchant_brand, normalize_merchant_to_chain(r2.merchant)) = b.chain_group
                  AND r2.purchase_date < week_start_var
                  AND r2.status = 'approved'
            ) as first_visit_week,
            -- Last visit logic: no future receipts for this user-merchant combo
            NOT EXISTS (
                SELECT 1 FROM public.receipts r2 
                WHERE r2.user_id = b.user_id 
                  AND COALESCE(r2.merchant_brand, normalize_merchant_to_chain(r2.merchant)) = b.chain_group
                  AND r2.purchase_date > week_start_var + interval '6 days'
                  AND r2.status = 'approved'
            ) as last_visit_week
        FROM base b
        GROUP BY b.user_id, b.chain_group;
        
        week_start_var := week_start_var + interval '7 days';
    END LOOP;
END;
$function$;