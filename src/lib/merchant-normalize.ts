import { supabase } from '@/integrations/supabase/client';

/**
 * Normalizes a raw merchant string to a chain group using the merchant_map table
 * Falls back to the raw merchant name if no mapping is found
 */
export async function normalizeMerchantToChain(rawMerchant: string): Promise<string> {
  try {
    if (!rawMerchant || rawMerchant.trim() === '') {
      return 'Unknown';
    }

    const trimmedMerchant = rawMerchant.trim();

    // Call the database function for normalization
    const { data, error } = await supabase
      .rpc('normalize_merchant_to_chain', { p_raw_merchant: trimmedMerchant });

    if (error) {
      console.error('Error normalizing merchant:', error);
      return trimmedMerchant;
    }

    return data || trimmedMerchant;
  } catch (error) {
    console.error('Failed to normalize merchant:', error);
    return rawMerchant;
  }
}

/**
 * Local fallback normalization for edge functions or offline use
 * Uses basic pattern matching for common Turkish retailers
 */
export function normalizeMerchantLocal(rawMerchant: string): string {
  if (!rawMerchant || rawMerchant.trim() === '') {
    return 'Unknown';
  }

  const merchant = rawMerchant.trim().toLowerCase();

  // Migros patterns
  if (merchant.includes('migros')) {
    return 'Migros';
  }

  // A101 patterns  
  if (merchant.includes('a101') || merchant.includes('a-101')) {
    return 'A101';
  }

  // BIM patterns
  if (merchant.includes('bim') || merchant.includes('bİm')) {
    return 'BIM';
  }

  // SOK patterns
  if (merchant.includes('sok') || merchant.includes('şok')) {
    return 'SOK';
  }

  // CarrefourSA patterns
  if (merchant.includes('carrefour')) {
    return 'CarrefourSA';
  }

  // Return original if no match
  return rawMerchant.trim();
}

/**
 * Batch normalize multiple merchants at once
 */
export async function normalizeMerchantsBatch(merchants: string[]): Promise<Record<string, string>> {
  const results: Record<string, string> = {};
  
  // Use Promise.all for concurrent processing
  const promises = merchants.map(async (merchant) => {
    const normalized = await normalizeMerchantToChain(merchant);
    return { original: merchant, normalized };
  });

  const normalizedResults = await Promise.all(promises);
  
  normalizedResults.forEach(({ original, normalized }) => {
    results[original] = normalized;
  });

  return results;
}