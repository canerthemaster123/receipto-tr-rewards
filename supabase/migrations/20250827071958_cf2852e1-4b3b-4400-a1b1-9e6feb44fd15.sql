-- Add new columns to receipts table for enhanced OCR parsing
DO $$ 
BEGIN
  -- Add address and location parsing columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipts' AND column_name = 'address_raw') THEN
    ALTER TABLE public.receipts ADD COLUMN address_raw text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipts' AND column_name = 'purchase_time') THEN
    ALTER TABLE public.receipts ADD COLUMN purchase_time time;
  END IF;

  -- Add payment method columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipts' AND column_name = 'masked_pan') THEN
    ALTER TABLE public.receipts ADD COLUMN masked_pan text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipts' AND column_name = 'card_scheme') THEN
    ALTER TABLE public.receipts ADD COLUMN card_scheme text;
  END IF;

  -- Add financial breakdown columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipts' AND column_name = 'subtotal') THEN
    ALTER TABLE public.receipts ADD COLUMN subtotal numeric;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipts' AND column_name = 'discount_total') THEN
    ALTER TABLE public.receipts ADD COLUMN discount_total numeric;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipts' AND column_name = 'vat_total') THEN
    ALTER TABLE public.receipts ADD COLUMN vat_total numeric;
  END IF;

  -- Add OCR metadata columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipts' AND column_name = 'ocr_json') THEN
    ALTER TABLE public.receipts ADD COLUMN ocr_json jsonb;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipts' AND column_name = 'ocr_engine') THEN
    ALTER TABLE public.receipts ADD COLUMN ocr_engine text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipts' AND column_name = 'parse_confidence') THEN
    ALTER TABLE public.receipts ADD COLUMN parse_confidence numeric;
  END IF;
END $$;

-- Add enhanced columns to receipt_items table
DO $$
BEGIN
  -- Add line positioning and metadata
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipt_items' AND column_name = 'line_no') THEN
    ALTER TABLE public.receipt_items ADD COLUMN line_no integer;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipt_items' AND column_name = 'bbox') THEN
    ALTER TABLE public.receipt_items ADD COLUMN bbox jsonb;
  END IF;

  -- Add raw and normalized item names
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipt_items' AND column_name = 'item_name_raw') THEN
    ALTER TABLE public.receipt_items ADD COLUMN item_name_raw text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipt_items' AND column_name = 'item_name_norm') THEN
    ALTER TABLE public.receipt_items ADD COLUMN item_name_norm text;
  END IF;

  -- Add enhanced quantity and pricing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipt_items' AND column_name = 'unit') THEN
    ALTER TABLE public.receipt_items ADD COLUMN unit text;
  END IF;
  
  -- Add VAT information
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipt_items' AND column_name = 'vat_rate') THEN
    ALTER TABLE public.receipt_items ADD COLUMN vat_rate numeric;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipt_items' AND column_name = 'vat_amount') THEN
    ALTER TABLE public.receipt_items ADD COLUMN vat_amount numeric;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipt_items' AND column_name = 'ean13') THEN
    ALTER TABLE public.receipt_items ADD COLUMN ean13 text;
  END IF;
END $$;

-- Create unique index for receipt unique numbers (nullable-safe)
CREATE UNIQUE INDEX IF NOT EXISTS uq_receipts_unique_no 
ON public.receipts(receipt_unique_no) 
WHERE receipt_unique_no IS NOT NULL;