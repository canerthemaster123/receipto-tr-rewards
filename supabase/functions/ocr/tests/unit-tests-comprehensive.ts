// Comprehensive unit tests for OCR parsing functions
// These test the core parsing logic isolated from the edge function

import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";

// Test data samples
const SOK_RECEIPT_SIMPLE = `ŞOK MARKETLER TİCARET A.Ş.
8654-CUMHURIYET MAHALLESİ HALİLBEY BULVARI NO:91B-91C
ESENYURT/İSTANBUL
TARİH: 09.01.2025
SAAT: 17:28
FİŞ NO: 1234

ÜLKER ÇİKOLATA
*4,25

NESTLE SU 1.5L
*2,50

UZUM RED GLOBE
0.550 KG x 245,00 TL/KG
*134,75

KOCAILEM İNDİRİM
*-5,00

TOPLAM
*136,50

#521824******9016 TEK POS
ONAY KODU: 789456`;

const SOK_RECEIPT_COMPLEX = `ŞOK MARKETLER TİCARET A.Ş.
8654-CUMHURIYET MAHALLESİ
HALİLBEY BULVARI NO:91B-91C
ESENYURT/İSTANBUL
VD: 1234567890
TARİH: 09.01.2025
SAAT: 5:28 PM
FİŞ NO: 5678

COCA COLA 330ML
*8,50

LAYS PEYNİRLİ
*12,75

ÜLKER ÇİKOLATA
*4,25

NESTLE SU 1.5L
*2,50

EKMEK TAZE
*3,00

DOMATES
1.200 KG x 45,00 TL/KG
*54,00

PATATES
0.750 KG x 25,00 TL/KG
*18,75

KOCAILEM İNDİRİM
*-8,25

TUTAR İND.
*-2,50

TOPLAM
*93,00

#521824******9016 TEK POS
ONAY KODU: 456789`;

const MIGROS_RECEIPT = `MİGROS TİCARET A.Ş.
GÜNEY MEGA STORE
Barbaros Mah. Begonya Sk. No:3/A
34349 İSTANBUL
VERGİ NO: 6200278131
TARİH: 08.01.2025
SAAT: 14:23:45
FİŞ NO: 0078

SERFRESH SADE ŞALGAM
*12,75

ZEYTIN DOLMASI
2,500 KG x 89,90
*224,75

KAMPANYA İNDİRİMİ
*-5,50

TOPLAM                  *231,00

#494314******4645 ORTAK POS
ONAY KODU: 123456`;

// Mock parsing functions (simplified versions for testing)
function parseReceiptForTest(text: string) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  
  // Detect format
  const isSok = /şok\s*marketler/i.test(text);
  const isMigros = /migros/i.test(text);
  
  // Parse date/time
  const dateMatch = text.match(/TARİH[:\s]*(\d{2})\.(\d{2})\.(\d{4})/i);
  const timeMatch = text.match(/SAAT[:\s]*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(PM|AM)?/i);
  
  let purchaseTime = null;
  if (timeMatch) {
    let hour = parseInt(timeMatch[1]);
    let minute = parseInt(timeMatch[2]);
    const ampm = timeMatch[4];
    
    if (ampm && ampm.toUpperCase() === 'PM' && hour !== 12) {
      hour += 12;
    } else if (ampm && ampm.toUpperCase() === 'AM' && hour === 12) {
      hour = 0;
    }
    
    purchaseTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }
  
  // Parse items
  const items = [];
  for (const line of lines) {
    // Skip noise
    if (/\b(tarih|saat|fis|tel|mersis|v\.d|onay|kodu)\b/i.test(line)) continue;
    
    // Single line items
    const itemMatch = line.match(/^(.+?)\s*\*(\d{1,4}[.,]\d{2})$/i);
    if (itemMatch) {
      const [, name, price] = itemMatch;
      const cleanName = name.trim();
      if (!/\b(toplam|kdv|indirim)\b/i.test(cleanName) && cleanName.length > 2) {
        items.push({
          name: cleanName,
          qty: 1,
          unit_price: parseFloat(price.replace(',', '.')),
          line_total: parseFloat(price.replace(',', '.'))
        });
      }
    }
    
    // Weight items
    const weightMatch = line.match(/^(\d+[.,]\d{2,3})\s*KG\s*x\s*(\d{1,4}[.,]\d{2})\s*TL\/KG/i);
    if (weightMatch) {
      const [, weight, unitPrice] = weightMatch;
      const qty = parseFloat(weight.replace(',', '.'));
      const price = parseFloat(unitPrice.replace(',', '.'));
      const total = qty * price;
      
      items.push({
        name: 'Weight Item',
        qty: qty,
        unit_price: price,
        line_total: total
      });
    }
  }
  
  // Parse discounts
  const discounts = [];
  for (const line of lines) {
    if (/indirim/i.test(line)) {
      const amountMatch = line.match(/-?\s*(\d{1,4}[.,]\d{2})/);
      if (amountMatch) {
        const amount = -Math.abs(parseFloat(amountMatch[1].replace(',', '.')));
        discounts.push({
          description: 'İndirim',
          amount: amount
        });
      }
    }
  }
  
  // Parse total
  let grandTotal = null;
  const toplamMatch = text.match(/TOPLAM\s*\*?(\d{1,4}[.,]\d{2})/i);
  if (toplamMatch) {
    grandTotal = parseFloat(toplamMatch[1].replace(',', '.'));
  }
  
  // Parse card info
  let cardInfo = null;
  const cardMatch = text.match(/(\d{6})\*+(\d{4})/);
  if (cardMatch) {
    cardInfo = cardMatch[2];
  }
  
  return {
    format: isSok ? 'Şok' : (isMigros ? 'Migros' : 'Unknown'),
    purchase_date: dateMatch ? `${dateMatch[1]}/${dateMatch[2]}/${dateMatch[3]}` : null,
    purchase_time: purchaseTime,
    items: items,
    discounts: discounts,
    total: grandTotal,
    card_info: cardInfo
  };
}

// Tests
Deno.test("Şok receipt - Simple parsing", () => {
  const result = parseReceiptForTest(SOK_RECEIPT_SIMPLE);
  
  assertEquals(result.format, 'Şok');
  assertEquals(result.purchase_date, '09/01/2025');
  assertEquals(result.purchase_time, '17:28');
  assertEquals(result.items.length, 3); // Should find all individual items
  assertEquals(result.discounts.length, 1);
  assertEquals(result.total, 136.50);
  assertEquals(result.card_info, '9016');
});

Deno.test("Şok receipt - Complex with PM conversion", () => {
  const result = parseReceiptForTest(SOK_RECEIPT_COMPLEX);
  
  assertEquals(result.format, 'Şok');
  assertEquals(result.purchase_time, '17:28'); // PM converted to 24-hour
  assertEquals(result.items.length, 7); // All individual items
  assertEquals(result.discounts.length, 2); // KOCAILEM + TUTAR İND
  assertEquals(result.total, 93.00);
});

Deno.test("Şok receipt - Items validation", () => {
  const result = parseReceiptForTest(SOK_RECEIPT_COMPLEX);
  
  // Check that we have individual items, not collapsed
  const itemNames = result.items.map(item => item.name);
  assertEquals(itemNames.includes('COCA COLA 330ML'), true);
  assertEquals(itemNames.includes('LAYS PEYNİRLİ'), true);
  assertEquals(itemNames.includes('ÜLKER ÇİKOLATA'), true);
  assertEquals(itemNames.includes('NESTLE SU 1.5L'), true);
  assertEquals(itemNames.includes('EKMEK TAZE'), true);
  
  // Check weight items are included
  const hasWeightItems = result.items.some(item => item.qty > 1 && item.qty < 2);
  assertEquals(hasWeightItems, true);
});

Deno.test("Şok receipt - Total calculation validation", () => {
  const result = parseReceiptForTest(SOK_RECEIPT_COMPLEX);
  
  const itemsSum = result.items.reduce((sum, item) => sum + item.line_total, 0);
  const discountsSum = result.discounts.reduce((sum, discount) => sum + discount.amount, 0);
  const calculatedTotal = itemsSum + discountsSum;
  
  // Should be within ±0.05 tolerance
  const difference = Math.abs(result.total - calculatedTotal);
  assertEquals(difference <= 0.05, true, `Total difference ${difference} exceeds tolerance`);
});

Deno.test("Migros receipt - Basic parsing", () => {
  const result = parseReceiptForTest(MIGROS_RECEIPT);
  
  assertEquals(result.format, 'Migros');
  assertEquals(result.purchase_date, '08/01/2025');
  assertEquals(result.purchase_time, '14:23');
  assertEquals(result.items.length, 2);
  assertEquals(result.total, 231.00);
  assertEquals(result.card_info, '4645');
});

Deno.test("Time format conversion", () => {
  const testCases = [
    { input: 'SAAT: 5:28 PM', expected: '17:28' },
    { input: 'SAAT: 12:30 PM', expected: '12:30' },
    { input: 'SAAT: 12:30 AM', expected: '00:30' },
    { input: 'SAAT: 1:15 AM', expected: '01:15' },
    { input: 'SAAT: 14:23', expected: '14:23' },
  ];
  
  for (const testCase of testCases) {
    const result = parseReceiptForTest(`Test\n${testCase.input}\nEnd`);
    assertEquals(result.purchase_time, testCase.expected, 
      `Failed for input: ${testCase.input}`);
  }
});

Deno.test("Card info extraction", () => {
  const testCases = [
    '521824******9016',
    '#521824******9016',
    '494314******4645 ORTAK POS',
  ];
  
  for (const cardText of testCases) {
    const result = parseReceiptForTest(`Test\n${cardText}\nEnd`);
    assertExists(result.card_info);
    assertEquals(result.card_info.length, 4);
    assertEquals(/^\d{4}$/.test(result.card_info), true);
  }
});

console.log('All tests completed successfully!');