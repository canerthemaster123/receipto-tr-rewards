-- Add payment_method column to receipts table
ALTER TABLE public.receipts 
ADD COLUMN payment_method TEXT;