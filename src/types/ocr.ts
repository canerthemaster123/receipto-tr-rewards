export interface OCRResult {
  merchant: string;
  purchase_date: string;
  total: number;
  items: { name: string; qty: number }[];
  payment_method: string | null;
  raw_text: string;
}