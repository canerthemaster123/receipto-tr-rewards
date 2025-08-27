# OCR Parsing & Validation

## Overview
Enhanced OCR pipeline for Turkish retail receipts with structured parsing, validation, and confidence scoring.

## Features
- **Modular Architecture**: Separate modules for numeric processing, regex patterns, Luhn validation, merchant normalization, and store matching
- **Turkish-Specific Parsing**: Handles Turkish currency formats, common OCR errors (O→0, I→1, S→5, B→8), and retail chain recognition
- **Structured Data Extraction**: Parses header info, line items, and totals with bounding box coordinates
- **Validation & Scoring**: Items sum validation (±0.50 TL tolerance), VAT consistency, Luhn card validation, duplicate detection
- **Confidence Scoring**: 0-1 score based on parsing quality, validation results, and data completeness

## Database Schema
### receipts table (new columns):
- `address_raw`, `purchase_time`, `masked_pan`, `card_scheme`
- `subtotal`, `discount_total`, `vat_total`
- `ocr_json` (raw OCR + parsed data), `ocr_engine`, `parse_confidence`

### receipt_items table (new columns):
- `line_no`, `bbox`, `item_name_raw`, `item_name_norm`, `unit`
- `vat_rate`, `vat_amount`, `ean13`

## Validation Tolerances
- **Items Sum**: ±0.50 TL tolerance vs total
- **VAT**: ±0.10 TL tolerance for VAT calculations
- **Card Numbers**: Luhn algorithm validation for detected PANs

## Warnings System
- `MISSING_TOTAL`: No total amount found
- `ITEMS_MISMATCH`: Items sum differs from total beyond tolerance
- `INVALID_LUHN`: Card number fails Luhn validation
- `DUP_RECEIPT_NO`: Receipt number already exists
- `VAT_INCONSISTENT`: VAT amounts don't match
- `LOW_CONFIDENCE`: Parse confidence < 0.7

## Usage
OCR endpoint processes images and returns:
```json
{
  "success": true,
  "receiptId": "uuid",
  "itemsCount": 5,
  "parseConfidence": 0.85,
  "warnings": ["VAT_INCONSISTENT"]
}
```

Admin preview endpoint: `/ocr-preview?id=receipt_id`

## Testing
Unit tests cover numeric normalization, regex extraction, Luhn validation, and tolerance checks.
Sample fixtures: `sample-migros.json`, `sample-a101.json`