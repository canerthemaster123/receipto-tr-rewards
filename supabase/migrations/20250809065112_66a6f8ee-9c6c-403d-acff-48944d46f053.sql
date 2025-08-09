-- Enable realtime for receipts table
ALTER TABLE public.receipts REPLICA IDENTITY FULL;

-- Add table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.receipts;

-- Enable realtime for users_profile table too
ALTER TABLE public.users_profile REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.users_profile;