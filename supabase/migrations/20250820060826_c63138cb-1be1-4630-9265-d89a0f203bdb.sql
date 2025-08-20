-- Fix remaining security warnings

-- 1. Remove pg_trgm extension from public schema and reinstall in extensions schema
-- Note: This is the proper way to handle extensions according to Supabase security best practices

DROP EXTENSION IF EXISTS pg_trgm CASCADE;
CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA extensions;