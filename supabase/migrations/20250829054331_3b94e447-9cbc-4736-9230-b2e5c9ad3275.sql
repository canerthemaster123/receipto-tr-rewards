-- Add user profile fields for registration
ALTER TABLE public.users_profile 
ADD COLUMN birth_date DATE,
ADD COLUMN gender TEXT CHECK (gender IN ('male', 'female', 'other')),
ADD COLUMN phone_number TEXT,
ADD COLUMN city TEXT;