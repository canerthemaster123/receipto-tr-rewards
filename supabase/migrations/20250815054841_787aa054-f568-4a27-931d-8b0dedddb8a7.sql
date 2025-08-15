-- Create some sample data for testing leaderboard functionality
-- This will generate sample leaderboard entries for current week and month

DO $$
DECLARE
    current_week_start date;
    current_month_start date;
    current_week_end date;
    current_month_end date;
    week_key text;
    month_key text;
    sample_user_id uuid;
BEGIN
    -- Calculate current week (Monday to Sunday)
    current_week_start := date_trunc('week', CURRENT_DATE);
    current_week_end := current_week_start + interval '6 days';
    
    -- Calculate current month
    current_month_start := date_trunc('month', CURRENT_DATE);
    current_month_end := (date_trunc('month', CURRENT_DATE) + interval '1 month - 1 day')::date;
    
    -- Generate period keys
    week_key := 'weekly-' || to_char(current_week_start, 'IYYY') || 'W' || to_char(current_week_start, 'IW');
    month_key := 'monthly-' || to_char(current_month_start, 'YYYY-MM');
    
    -- Create sample users if they don't exist (for demo purposes)
    -- Only create if no leaderboard data exists yet
    IF NOT EXISTS (SELECT 1 FROM leaderboard_snapshots LIMIT 1) THEN
        
        -- Insert sample weekly leaderboard
        INSERT INTO leaderboard_snapshots (period_key, rank, user_id, points, public_name) VALUES
        (week_key, 1, gen_random_uuid(), 1250, 'M*** K***'),
        (week_key, 2, gen_random_uuid(), 980, 'A*** Y***'),
        (week_key, 3, gen_random_uuid(), 875, 'S*** D***'),
        (week_key, 4, gen_random_uuid(), 720, 'E*** A***'),
        (week_key, 5, gen_random_uuid(), 650, 'C*** B***'),
        (week_key, 6, gen_random_uuid(), 590, 'H*** T***'),
        (week_key, 7, gen_random_uuid(), 520, 'F*** G***'),
        (week_key, 8, gen_random_uuid(), 480, 'D*** M***'),
        (week_key, 9, gen_random_uuid(), 430, 'R*** P***'),
        (week_key, 10, gen_random_uuid(), 380, 'L*** S***');
        
        -- Insert sample monthly leaderboard
        INSERT INTO leaderboard_snapshots (period_key, rank, user_id, points, public_name) VALUES
        (month_key, 1, gen_random_uuid(), 4850, 'M*** K***'),
        (month_key, 2, gen_random_uuid(), 4320, 'A*** Y***'),
        (month_key, 3, gen_random_uuid(), 3975, 'S*** D***'),
        (month_key, 4, gen_random_uuid(), 3640, 'E*** A***'),
        (month_key, 5, gen_random_uuid(), 3280, 'C*** B***'),
        (month_key, 6, gen_random_uuid(), 2950, 'H*** T***'),
        (month_key, 7, gen_random_uuid(), 2720, 'F*** G***'),
        (month_key, 8, gen_random_uuid(), 2480, 'D*** M***'),
        (month_key, 9, gen_random_uuid(), 2230, 'R*** P***'),
        (month_key, 10, gen_random_uuid(), 1980, 'L*** S***'),
        (month_key, 11, gen_random_uuid(), 1750, 'O*** V***'),
        (month_key, 12, gen_random_uuid(), 1520, 'N*** Z***'),
        (month_key, 13, gen_random_uuid(), 1320, 'K*** Q***'),
        (month_key, 14, gen_random_uuid(), 1180, 'J*** W***'),
        (month_key, 15, gen_random_uuid(), 1050, 'I*** X***');
        
        RAISE NOTICE 'Sample leaderboard data created for week: % and month: %', week_key, month_key;
    ELSE
        RAISE NOTICE 'Leaderboard data already exists, skipping sample data creation';
    END IF;
    
END $$;