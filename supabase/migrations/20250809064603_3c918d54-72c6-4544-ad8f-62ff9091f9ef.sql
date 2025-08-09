-- Add purchase_time and store_address columns to receipts table
ALTER TABLE receipts 
ADD COLUMN IF NOT EXISTS purchase_time TEXT,
ADD COLUMN IF NOT EXISTS store_address TEXT;