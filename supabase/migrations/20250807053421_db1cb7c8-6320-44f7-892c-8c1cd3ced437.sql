-- Fix security warning by setting search_path for trigger function
CREATE OR REPLACE FUNCTION update_receipt_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the updated_at timestamp
  NEW.updated_at = NOW();
  
  -- Call the existing points update function
  PERFORM update_user_points();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';