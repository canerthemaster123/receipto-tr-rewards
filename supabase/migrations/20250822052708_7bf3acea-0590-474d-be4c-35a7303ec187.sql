-- Add barcode_numbers column to receipts table
ALTER TABLE public.receipts 
ADD COLUMN barcode_numbers text[] DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN public.receipts.barcode_numbers IS 'Array of numeric sequences found below barcodes on receipts';