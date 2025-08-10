-- Add merchant_brand column to receipts table for Prompt 3
ALTER TABLE public.receipts ADD COLUMN merchant_brand text;

-- Add columns for Prompt 4: receipt barcode/unique number
ALTER TABLE public.receipts ADD COLUMN receipt_unique_no text;
ALTER TABLE public.receipts ADD COLUMN fis_no text;

-- Add index on receipt_unique_no for duplicate detection
CREATE INDEX idx_receipts_unique_no ON public.receipts (receipt_unique_no) WHERE receipt_unique_no IS NOT NULL;