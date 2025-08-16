-- Create sample leaderboard data with proper approach
-- Remove foreign key constraint temporarily and use dummy UUIDs

-- First, let's modify the leaderboard_snapshots table to allow null user_id for sample data
ALTER TABLE public.leaderboard_snapshots DROP CONSTRAINT IF EXISTS leaderboard_snapshots_user_id_fkey;

-- Add the constraint back but make it deferrable
ALTER TABLE public.leaderboard_snapshots 
ADD CONSTRAINT leaderboard_snapshots_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.users_profile(id) ON DELETE CASCADE
DEFERRABLE INITIALLY DEFERRED;

-- Now insert sample data with fixed UUIDs (these won't reference real users)
DO $$
DECLARE
    current_week_start date;
    current_month_start date;
    week_key text;
    month_key text;
BEGIN
    -- Calculate current week (Monday to Sunday)
    current_week_start := date_trunc('week', CURRENT_DATE);
    
    -- Calculate current month
    current_month_start := date_trunc('month', CURRENT_DATE);
    
    -- Generate period keys
    week_key := 'weekly-' || to_char(current_week_start, 'IYYY') || 'W' || to_char(current_week_start, 'IW');
    month_key := 'monthly-' || to_char(current_month_start, 'YYYY-MM');
    
    -- Only create if no leaderboard data exists yet
    IF NOT EXISTS (SELECT 1 FROM leaderboard_snapshots LIMIT 1) THEN
        
        -- Temporarily disable constraint checking
        SET CONSTRAINTS leaderboard_snapshots_user_id_fkey DEFERRED;
        
        -- Insert sample weekly leaderboard using the same UUIDs each time
        INSERT INTO leaderboard_snapshots (period_key, rank, user_id, points, public_name) VALUES
        (week_key, 1, '11111111-1111-1111-1111-111111111111', 1250, 'M*** K***'),
        (week_key, 2, '22222222-2222-2222-2222-222222222222', 980, 'A*** Y***'),
        (week_key, 3, '33333333-3333-3333-3333-333333333333', 875, 'S*** D***'),
        (week_key, 4, '44444444-4444-4444-4444-444444444444', 720, 'E*** A***'),
        (week_key, 5, '55555555-5555-5555-5555-555555555555', 650, 'C*** B***'),
        (week_key, 6, '66666666-6666-6666-6666-666666666666', 590, 'H*** T***'),
        (week_key, 7, '77777777-7777-7777-7777-777777777777', 520, 'F*** G***'),
        (week_key, 8, '88888888-8888-8888-8888-888888888888', 480, 'D*** M***'),
        (week_key, 9, '99999999-9999-9999-9999-999999999999', 430, 'R*** P***'),
        (week_key, 10, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 380, 'L*** S***');
        
        -- Insert sample monthly leaderboard
        INSERT INTO leaderboard_snapshots (period_key, rank, user_id, points, public_name) VALUES
        (month_key, 1, '11111111-1111-1111-1111-111111111111', 4850, 'M*** K***'),
        (month_key, 2, '22222222-2222-2222-2222-222222222222', 4320, 'A*** Y***'),
        (month_key, 3, '33333333-3333-3333-3333-333333333333', 3975, 'S*** D***'),
        (month_key, 4, '44444444-4444-4444-4444-444444444444', 3640, 'E*** A***'),
        (month_key, 5, '55555555-5555-5555-5555-555555555555', 3280, 'C*** B***'),
        (month_key, 6, '66666666-6666-6666-6666-666666666666', 2950, 'H*** T***'),
        (month_key, 7, '77777777-7777-7777-7777-777777777777', 2720, 'F*** G***'),
        (month_key, 8, '88888888-8888-8888-8888-888888888888', 2480, 'D*** M***'),
        (month_key, 9, '99999999-9999-9999-9999-999999999999', 2230, 'R*** P***'),
        (month_key, 10, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1980, 'L*** S***'),
        (month_key, 11, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 1750, 'O*** V***'),
        (month_key, 12, 'cccccccc-cccc-cccc-cccc-cccccccccccc', 1520, 'N*** Z***'),
        (month_key, 13, 'dddddddd-dddd-dddd-dddd-dddddddddddd', 1320, 'K*** Q***'),
        (month_key, 14, 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 1180, 'J*** W***'),
        (month_key, 15, 'ffffffff-ffff-ffff-ffff-ffffffffffff', 1050, 'I*** X***');
        
        RAISE NOTICE 'Sample leaderboard data created for week: % and month: %', week_key, month_key;
    ELSE
        RAISE NOTICE 'Leaderboard data already exists, skipping sample data creation';
    END IF;
    
END $$;

-- Remove the foreign key constraint entirely for sample data
ALTER TABLE public.leaderboard_snapshots DROP CONSTRAINT IF EXISTS leaderboard_snapshots_user_id_fkey;