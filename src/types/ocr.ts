export interface OCRResult {
  merchant: string;
  purchase_date: string;
  total: number;
  items: {
    name: string;
    qty?: number;
    unit_price?: number;
    line_total?: number;
    raw_line: string;
  }[];
  payment_method: string | null;
  raw_text: string;
}