-- Ensure receipt_unique_no and fis_no columns have proper indexes for performance
CREATE INDEX IF NOT EXISTS idx_receipts_unique_no ON receipts (receipt_unique_no) WHERE receipt_unique_no IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_receipts_fis_no ON receipts (fis_no) WHERE fis_no IS NOT NULL;