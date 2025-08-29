-- Fill missing weeks data from 2025-08-04 to 2025-08-29
-- This will create analytics data for all missing weeks

-- Run geo-merchant rollups for the missing period
SELECT fn_fill_period_geo_merchant_week('2025-08-04'::date, '2025-08-29'::date);

-- Run user-merchant rollups for the missing period  
SELECT fn_fill_period_user_merchant_week('2025-08-04'::date, '2025-08-29'::date);

-- Run alert detection for the period
DO $$
DECLARE
    current_week date := '2025-08-04'::date;
    end_date date := '2025-08-29'::date;
BEGIN
    WHILE current_week <= end_date LOOP
        PERFORM fn_detect_alerts_for_week(current_week);
        current_week := current_week + interval '7 days';
    END LOOP;
END $$;