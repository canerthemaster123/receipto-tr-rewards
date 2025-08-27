import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { normalizeNumber, isMoney, fixOcrDigits, parseQuantityUnit } from '../_shared/numeric.ts';
import { extractDates, extractTimes, extractReceiptNumbers, extractVAT } from '../_shared/regex-tr.ts';
import { luhnValid, detectCardScheme, maskCardNumber } from '../_shared/luhn.ts';
import { normalizeMerchantToChain } from '../_shared/merchant-normalize.ts';

Deno.test("Numeric normalization tests", async (t) => {
  await t.step("OCR digit fixes", () => {
    assertEquals(fixOcrDigits("12O.5O"), "120.50");
    assertEquals(fixOcrDigits("1Il.23"), "111.23");
    assertEquals(fixOcrDigits("5S.BB"), "55.88");
    assertEquals(fixOcrDigits("normal text"), "normal text"); // Should not change non-numeric
  });

  await t.step("Turkish number normalization", () => {
    assertEquals(normalizeNumber("23,45"), 23.45);
    assertEquals(normalizeNumber("₺ 15,75"), 15.75);
    assertEquals(normalizeNumber("123,50 TL"), 123.50);
    assertEquals(normalizeNumber("1.234,56"), 1234.56); // Thousands separator
    assertEquals(normalizeNumber("invalid"), null);
  });

  await t.step("Money detection", () => {
    assertEquals(isMoney("23,45₺"), true);
    assertEquals(isMoney("15,75 TL"), true);
    assertEquals(isMoney("₺123,50"), true);
    assertEquals(isMoney("not money"), false);
    assertEquals(isMoney("123"), false); // No decimal places
  });

  await t.step("Quantity and unit parsing", () => {
    const result1 = parseQuantityUnit("2 adet");
    assertEquals(result1.qty, 2);
    assertEquals(result1.unit, "adet");

    const result2 = parseQuantityUnit("1,5 kg");
    assertEquals(result2.qty, 1.5);
    assertEquals(result2.unit, "kg");

    const result3 = parseQuantityUnit("just text");
    assertEquals(result3.qty, undefined);
    assertEquals(result3.unit, undefined);
  });
});

Deno.test("Turkish regex extraction tests", async (t) => {
  await t.step("Date extraction", () => {
    const dates = extractDates("21.11.2024 15:34");
    assertEquals(dates.length, 1);
    assertEquals(dates[0].day, 21);
    assertEquals(dates[0].month, 11);
    assertEquals(dates[0].year, 2024);
  });

  await t.step("Time extraction", () => {
    const times = extractTimes("21.11.2024 15:34");
    assertEquals(times.length, 1);
    assertEquals(times[0].hour, 15);
    assertEquals(times[0].minute, 34);
  });

  await t.step("Receipt number extraction", () => {
    const numbers = extractReceiptNumbers("Fiş No: MIG2024112123456");
    assertEquals(numbers.length, 1);
    assertEquals(numbers[0], "MIG2024112123456");
  });

  await t.step("VAT extraction", () => {
    const vat = extractVAT("KDV %18: 5,40");
    assertEquals(vat.length, 1);
    assertEquals(vat[0].rate, 18);
    assertEquals(vat[0].amount, 5.40);
  });
});

Deno.test("Luhn validation tests", async (t) => {
  await t.step("Valid card numbers", () => {
    assertEquals(luhnValid("4532015112830366"), true); // Valid Visa test number
    assertEquals(luhnValid("5555555555554444"), true); // Valid Mastercard test number
  });

  await t.step("Invalid card numbers", () => {
    assertEquals(luhnValid("4532015112830367"), false); // Invalid checksum
    assertEquals(luhnValid("123456789"), false); // Too short
    assertEquals(luhnValid(""), false); // Empty
  });

  await t.step("Card scheme detection", () => {
    assertEquals(detectCardScheme("4532015112830366"), "Visa");
    assertEquals(detectCardScheme("5555555555554444"), "Mastercard");
    assertEquals(detectCardScheme("378282246310005"), "American Express");
    assertEquals(detectCardScheme("123456789"), null);
  });

  await t.step("Card masking", () => {
    const masked = maskCardNumber("4532015112830366");
    assertExists(masked);
    assertEquals(masked?.includes("0366"), true);
    assertEquals(masked?.includes("4532"), false);
  });
});

Deno.test("Merchant normalization tests", async (t) => {
  await t.step("Turkish chain recognition", () => {
    assertEquals(normalizeMerchantToChain("MİGROS AVM"), "Migros");
    assertEquals(normalizeMerchantToChain("A101 MARKET"), "A101");
    assertEquals(normalizeMerchantToChain("BIM BIRLESIK"), "BIM");
    assertEquals(normalizeMerchantToChain("ŞOK MARKET"), "SOK");
    assertEquals(normalizeMerchantToChain("CARREFOUR SA"), "CarrefourSA");
    assertEquals(normalizeMerchantToChain("UNKNOWN STORE"), "UNKNOWN STORE");
  });
});

Deno.test("Items sum validation tests", async (t) => {
  await t.step("Tolerance check", () => {
    const items = [
      { line_total: 8.50 },
      { line_total: 12.75 },
      { line_total: 45.00 },
      { line_total: 5.25 },
      { line_total: 18.40 }
    ];
    
    const itemsSum = items.reduce((sum, item) => sum + item.line_total, 0);
    const total = 89.90; // Slight difference from 89.90
    const tolerance = 0.50;
    
    assertEquals(Math.abs(itemsSum - total) <= tolerance, true);
  });

  await t.step("Out of tolerance", () => {
    const itemsSum = 89.90;
    const total = 91.00; // More than 0.50 difference
    const tolerance = 0.50;
    
    assertEquals(Math.abs(itemsSum - total) <= tolerance, false);
  });
});

console.log("All unit tests completed!");
export {};