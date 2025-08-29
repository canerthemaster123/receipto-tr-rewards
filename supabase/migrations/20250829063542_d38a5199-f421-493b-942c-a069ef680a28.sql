-- Fill missing weeks with actual receipt data
-- This will regenerate all weeks where we have receipt data

-- Get the date range based on actual receipts
DO $$
DECLARE
    min_date date;
    max_date date;
BEGIN
    -- Find actual date range from receipts
    SELECT 
        date_trunc('week', MIN(purchase_date))::date,
        date_trunc('week', MAX(purchase_date))::date
    INTO min_date, max_date
    FROM receipts 
    WHERE status = 'approved' AND purchase_date IS NOT NULL;
    
    RAISE NOTICE 'Filling rollups from % to %', min_date, max_date;
    
    -- Fill geo-merchant rollups for the actual data range
    PERFORM fn_fill_period_geo_merchant_week(min_date, max_date);
    
    -- Fill user-merchant rollups for the actual data range
    PERFORM fn_fill_period_user_merchant_week(min_date, max_date);
    
    -- Run alert detection for recent weeks only (last 8 weeks)
    DECLARE
        alert_start_date date := GREATEST(min_date, date_trunc('week', CURRENT_DATE - interval '8 weeks')::date);
        current_week date := alert_start_date;
    BEGIN
        WHILE current_week <= max_date LOOP
            PERFORM fn_detect_alerts_for_week(current_week);
            current_week := current_week + interval '7 days';
        END LOOP;
    END;
END $$;