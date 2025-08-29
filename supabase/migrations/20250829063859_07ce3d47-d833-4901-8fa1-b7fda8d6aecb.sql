-- Update rollup functions to canonicalize chain_group using merchant brand OR merchant via normalize_merchant_to_chain

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
        
        -- Insert aggregated data for this week with improved location handling and canonical chain grouping
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
            -- Always normalize the final chain using brand if present, else raw merchant
            normalize_merchant_to_chain(COALESCE(r.merchant_brand, r.merchant)) as chain_group,
            week_start_var,
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
                    AND normalize_merchant_to_chain(COALESCE(r2.merchant_brand, r2.merchant)) = normalize_merchant_to_chain(COALESCE(r.merchant_brand, r.merchant))
                    AND r2.purchase_date < week_start_var
                    AND r2.status = 'approved'
                ) THEN r.user_id 
            END) as new_users,
            COUNT(DISTINCT CASE 
                WHEN EXISTS (
                    SELECT 1 FROM receipts r2 
                    WHERE r2.user_id = r.user_id 
                    AND normalize_merchant_to_chain(COALESCE(r2.merchant_brand, r2.merchant)) = normalize_merchant_to_chain(COALESCE(r.merchant_brand, r.merchant))
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
            normalize_merchant_to_chain(COALESCE(r.merchant_brand, r.merchant)),
            COALESCE(r.city, sd.city, 'Unknown'),
            COALESCE(r.district, sd.district, 'Unknown'),
            COALESCE(r.neighborhood, sd.neighborhood, 'Unknown');
        
        week_start_var := week_start_var + interval '7 days';
    END LOOP;
END;
$function$;

-- Update period_user_merchant_week to canonicalize chain grouping consistently
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
                normalize_merchant_to_chain(COALESCE(r.merchant_brand, r.merchant)) AS chain_group,
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
                  AND normalize_merchant_to_chain(COALESCE(r2.merchant_brand, r2.merchant)) = b.chain_group
                  AND r2.purchase_date < week_start_var
                  AND r2.status = 'approved'
            ) as first_visit_week,
            -- Last visit logic: no future receipts for this user-merchant combo
            NOT EXISTS (
                SELECT 1 FROM public.receipts r2 
                WHERE r2.user_id = b.user_id 
                  AND normalize_merchant_to_chain(COALESCE(r2.merchant_brand, r2.merchant)) = b.chain_group
                  AND r2.purchase_date > week_start_var + interval '6 days'
                  AND r2.status = 'approved'
            ) as last_visit_week
        FROM base b
        GROUP BY b.user_id, b.chain_group;
        
        week_start_var := week_start_var + interval '7 days';
    END LOOP;
END;
$function$;

-- Rebuild rollups for full available approved receipt date range using purchase_date (OCR date)
DO $$
DECLARE
    min_date date;
    max_date date;
BEGIN
    SELECT 
        date_trunc('week', MIN(purchase_date))::date,
        date_trunc('week', MAX(purchase_date))::date
    INTO min_date, max_date
    FROM public.receipts 
    WHERE status = 'approved' AND purchase_date IS NOT NULL;

    IF min_date IS NOT NULL AND max_date IS NOT NULL THEN
      PERFORM public.fn_fill_period_geo_merchant_week(min_date, max_date);
      PERFORM public.fn_fill_period_user_merchant_week(min_date, max_date);
    END IF;
END $$;