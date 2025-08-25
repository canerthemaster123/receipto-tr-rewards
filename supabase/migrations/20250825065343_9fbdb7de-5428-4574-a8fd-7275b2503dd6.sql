-- Seed merchant mapping data
INSERT INTO public.merchant_map (raw_merchant, chain_group, priority, active) VALUES
('Migros', 'Migros', 1, true),
('MigroS', 'Migros', 2, true),
('MIGROS', 'Migros', 2, true),
('Migros Ticaret', 'Migros', 3, true),
('A101', 'A101', 1, true),
('A-101', 'A101', 2, true),
('BIM', 'BIM', 1, true),
('BİM', 'BIM', 2, true),
('BIM BIRLESIK MAGAZALAR', 'BIM', 3, true),
('SOK', 'SOK', 1, true),
('ŞOK', 'SOK', 2, true),
('ŞOK MARKETLERI', 'SOK', 3, true),
('CarrefourSA', 'CarrefourSA', 1, true),
('CARREFOURSA', 'CarrefourSA', 2, true),
('CARREFOUR', 'CarrefourSA', 3, true),
('CARREFOUR SABANCI', 'CarrefourSA', 4, true)
ON CONFLICT (raw_merchant) DO NOTHING;

-- Create periodic rollup functions
CREATE OR REPLACE FUNCTION public.fn_fill_period_user_merchant_week(
    p_start_date date,
    p_end_date date
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    week_start_var date;
BEGIN
    -- Iterate through each week in the date range
    week_start_var := date_trunc('week', p_start_date)::date;
    
    WHILE week_start_var <= p_end_date LOOP
        -- Clear existing data for this week
        DELETE FROM period_user_merchant_week WHERE week_start = week_start_var;
        
        -- Insert aggregated data for this week
        INSERT INTO period_user_merchant_week (
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
            r.user_id,
            COALESCE(r.merchant_brand, normalize_merchant_to_chain(r.merchant)) as chain_group,
            week_start_var,
            COUNT(*) as receipt_count,
            SUM(r.total) as total_spend,
            AVG(r.total) as avg_basket_value,
            -- First visit logic: no prior receipts for this user-merchant combo
            NOT EXISTS (
                SELECT 1 FROM receipts r2 
                WHERE r2.user_id = r.user_id 
                AND COALESCE(r2.merchant_brand, normalize_merchant_to_chain(r2.merchant)) = COALESCE(r.merchant_brand, normalize_merchant_to_chain(r.merchant))
                AND r2.purchase_date < week_start_var
                AND r2.status = 'approved'
            ) as first_visit_week,
            -- Last visit logic: no future receipts for this user-merchant combo
            NOT EXISTS (
                SELECT 1 FROM receipts r2 
                WHERE r2.user_id = r.user_id 
                AND COALESCE(r2.merchant_brand, normalize_merchant_to_chain(r2.merchant)) = COALESCE(r.merchant_brand, normalize_merchant_to_chain(r.merchant))
                AND r2.purchase_date > week_start_var + interval '6 days'
                AND r2.status = 'approved'
            ) as last_visit_week
        FROM receipts r
        WHERE r.purchase_date >= week_start_var
        AND r.purchase_date <= week_start_var + interval '6 days'
        AND r.status = 'approved'
        GROUP BY r.user_id, COALESCE(r.merchant_brand, normalize_merchant_to_chain(r.merchant));
        
        week_start_var := week_start_var + interval '7 days';
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_fill_period_geo_merchant_week(
    p_start_date date,
    p_end_date date
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    week_start_var date;
BEGIN
    -- Iterate through each week in the date range
    week_start_var := date_trunc('week', p_start_date)::date;
    
    WHILE week_start_var <= p_end_date LOOP
        -- Clear existing data for this week
        DELETE FROM period_geo_merchant_week WHERE week_start = week_start_var;
        
        -- Insert aggregated data for this week
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
            COALESCE(sd.city, 'Unknown') as city,
            COALESCE(sd.district, 'Unknown') as district,
            COALESCE(sd.neighborhood, 'Unknown') as neighborhood,
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
            COALESCE(sd.city, 'Unknown'),
            COALESCE(sd.district, 'Unknown'),
            COALESCE(sd.neighborhood, 'Unknown');
        
        week_start_var := week_start_var + interval '7 days';
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_detect_alerts_for_week(p_week_start date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    alert_record RECORD;
    prev_week_start date := p_week_start - interval '7 days';
    z_threshold numeric := 3.0;
    min_sample_size integer := 50;
BEGIN
    -- Clear existing alerts for this week
    DELETE FROM alerts WHERE week_start = p_week_start;
    
    -- Detect AOV (Average Order Value) anomalies by district
    FOR alert_record IN
        SELECT 
            current_week.chain_group,
            current_week.city,
            current_week.district,
            current_week.avg_basket_value as current_aov,
            prev_week.avg_basket_value as previous_aov,
            current_week.receipt_count as sample_size,
            -- Calculate z-score based on historical variance
            CASE 
                WHEN prev_week.avg_basket_value > 0 THEN
                    ABS((current_week.avg_basket_value - prev_week.avg_basket_value) / prev_week.avg_basket_value * 100)
                ELSE 0
            END as pct_change
        FROM period_geo_merchant_week current_week
        JOIN period_geo_merchant_week prev_week ON 
            current_week.chain_group = prev_week.chain_group
            AND current_week.city = prev_week.city
            AND current_week.district = prev_week.district
            AND current_week.neighborhood = prev_week.neighborhood
            AND current_week.week_start = p_week_start
            AND prev_week.week_start = prev_week_start
        WHERE current_week.receipt_count >= min_sample_size
        AND prev_week.receipt_count >= min_sample_size
        AND ABS(current_week.avg_basket_value - prev_week.avg_basket_value) > 0
    LOOP
        -- Calculate z-score (simplified version using percentage change)
        DECLARE
            z_score numeric;
            severity_level text;
        BEGIN
            z_score := alert_record.pct_change / 10; -- Simplified z-score calculation
            
            -- Determine severity
            IF z_score >= 5 THEN
                severity_level := 'critical';
            ELSIF z_score >= 3 THEN
                severity_level := 'high';
            ELSE
                severity_level := 'medium';
            END IF;
            
            -- Insert alert if z-score exceeds threshold
            IF z_score >= z_threshold THEN
                INSERT INTO alerts (
                    alert_type,
                    chain_group,
                    geo_level,
                    geo_value,
                    metric_name,
                    current_value,
                    previous_value,
                    z_score,
                    sample_size,
                    week_start,
                    severity
                ) VALUES (
                    'aov_anomaly',
                    alert_record.chain_group,
                    'district',
                    alert_record.city || '/' || alert_record.district,
                    'avg_basket_value',
                    alert_record.current_aov,
                    alert_record.previous_aov,
                    z_score,
                    alert_record.sample_size,
                    p_week_start,
                    severity_level
                );
            END IF;
        END;
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_run_weekly_rollups()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    start_date date;
    end_date date;
    current_week date;
BEGIN
    -- Calculate last 8 weeks
    end_date := date_trunc('week', CURRENT_DATE)::date;
    start_date := end_date - interval '8 weeks';
    
    BEGIN
        -- Run user-merchant rollups
        PERFORM fn_fill_period_user_merchant_week(start_date, end_date);
        
        -- Run geo-merchant rollups  
        PERFORM fn_fill_period_geo_merchant_week(start_date, end_date);
        
        -- Run alert detection for the last 4 weeks
        current_week := end_date - interval '4 weeks';
        WHILE current_week <= end_date LOOP
            PERFORM fn_detect_alerts_for_week(current_week);
            current_week := current_week + interval '7 days';
        END LOOP;
        
        RETURN json_build_object(
            'success', true,
            'message', 'Weekly rollups completed successfully',
            'start_date', start_date,
            'end_date', end_date
        );
        
    EXCEPTION
        WHEN OTHERS THEN
            RETURN json_build_object(
                'success', false,
                'error', SQLERRM,
                'start_date', start_date,
                'end_date', end_date
            );
    END;
END;
$$;

-- Schedule daily rollup at 02:00 (requires pg_cron extension)
-- This will run the rollups every day at 2 AM
-- Note: This requires pg_cron extension to be enabled in Supabase
-- SELECT cron.schedule(
--     'weekly-analytics-rollup',
--     '0 2 * * *',
--     'SELECT public.fn_run_weekly_rollups();'
-- );