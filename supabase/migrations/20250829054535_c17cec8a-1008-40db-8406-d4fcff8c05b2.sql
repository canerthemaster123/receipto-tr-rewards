-- Update handle_new_user function to include new profile fields
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Insert profile with better defaults and new fields
  INSERT INTO public.users_profile (
    id, 
    display_name, 
    referral_code, 
    total_points,
    birth_date,
    gender,
    phone_number,
    city
  )
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    SUBSTRING(NEW.id::text, 1, 8),
    0,
    CASE 
      WHEN NEW.raw_user_meta_data->>'birth_date' IS NOT NULL 
      THEN (NEW.raw_user_meta_data->>'birth_date')::DATE 
      ELSE NULL 
    END,
    NEW.raw_user_meta_data->>'gender',
    NEW.raw_user_meta_data->>'phone_number',
    NEW.raw_user_meta_data->>'city'
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    referral_code = COALESCE(users_profile.referral_code, SUBSTRING(NEW.id::text, 1, 8)),
    birth_date = COALESCE(
      CASE 
        WHEN NEW.raw_user_meta_data->>'birth_date' IS NOT NULL 
        THEN (NEW.raw_user_meta_data->>'birth_date')::DATE 
        ELSE NULL 
      END, 
      users_profile.birth_date
    ),
    gender = COALESCE(NEW.raw_user_meta_data->>'gender', users_profile.gender),
    phone_number = COALESCE(NEW.raw_user_meta_data->>'phone_number', users_profile.phone_number),
    city = COALESCE(NEW.raw_user_meta_data->>'city', users_profile.city);
  
  -- Assign default user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$$;