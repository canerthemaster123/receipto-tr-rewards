-- Fix security linter warnings - update function search paths

-- Update mask_name function
CREATE OR REPLACE FUNCTION public.mask_name(display_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF display_name IS NULL OR length(display_name) <= 2 THEN
    RETURN 'Anonim User';
  END IF;
  
  -- For names with spaces, mask last name completely
  IF position(' ' in display_name) > 0 THEN
    RETURN substring(display_name, 1, 1) || '*** ' || substring(split_part(display_name, ' ', 2), 1, 1) || '***';
  END IF;
  
  -- For single names, show first and last character with stars
  IF length(display_name) <= 3 THEN
    RETURN substring(display_name, 1, 1) || '***';
  END IF;
  
  RETURN substring(display_name, 1, 1) || '***' || substring(display_name, length(display_name), 1);
END;
$$;