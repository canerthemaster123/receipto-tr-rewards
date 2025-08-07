-- Create receipt status update trigger
CREATE OR REPLACE FUNCTION update_receipt_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the updated_at timestamp
  NEW.updated_at = NOW();
  
  -- Call the existing points update function
  PERFORM update_user_points();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for receipt updates
DROP TRIGGER IF EXISTS receipt_status_trigger ON public.receipts;
CREATE TRIGGER receipt_status_trigger
  BEFORE UPDATE ON public.receipts
  FOR EACH ROW
  EXECUTE FUNCTION update_receipt_trigger();