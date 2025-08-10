export interface OCRResult {
  merchant_raw: string;
  merchant_brand: string;
  purchase_date: string;
  purchase_time: string | null;
  store_address: string | null;
  total: number;
  items: {
    name: string;
    qty?: number;
    unit_price?: number;
    line_total?: number;
    raw_line: string;
    product_code?: string;
  }[];
  payment_method: string | null;
  receipt_unique_no: string | null;
  fis_no: string | null;
  raw_text: string;
}