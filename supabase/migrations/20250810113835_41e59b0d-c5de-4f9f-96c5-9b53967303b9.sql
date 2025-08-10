-- Enable realtime for users_profile table (receipts already enabled)
ALTER TABLE public.users_profile REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.users_profile;