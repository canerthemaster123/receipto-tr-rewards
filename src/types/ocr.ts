export interface OCRResult {
  merchant: string;
  purchase_date: string;
  total: number;
  items: string[];
  payment_method: string | null;
  raw_text: string;
}