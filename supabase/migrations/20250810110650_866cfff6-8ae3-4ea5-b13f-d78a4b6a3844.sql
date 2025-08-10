-- Add text search capabilities to receipts table
CREATE INDEX IF NOT EXISTS idx_receipts_merchant_text ON receipts USING gin(to_tsvector('english', merchant));
CREATE INDEX IF NOT EXISTS idx_receipts_items_text ON receipts USING gin(to_tsvector('english', items));

-- Add trigram extension for fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add trigram indexes for better text search
CREATE INDEX IF NOT EXISTS idx_receipts_merchant_trgm ON receipts USING gin(merchant gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_receipts_items_trgm ON receipts USING gin(items gin_trgm_ops);

-- Add composite index for common filter combinations
CREATE INDEX IF NOT EXISTS idx_receipts_user_date_status ON receipts(user_id, purchase_date DESC, status);
CREATE INDEX IF NOT EXISTS idx_receipts_user_total ON receipts(user_id, total DESC);
CREATE INDEX IF NOT EXISTS idx_receipts_user_merchant ON receipts(user_id, merchant);