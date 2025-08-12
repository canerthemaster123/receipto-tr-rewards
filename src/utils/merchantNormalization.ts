/**
 * Merchant normalization utilities for consistent grouping and analytics
 */

/**
 * Turkish character mapping for normalization
 */
const TURKISH_CHAR_MAP: Record<string, string> = {
  'İ': 'i', 'ı': 'i', 'I': 'i',
  'Ğ': 'g', 'ğ': 'g',
  'Ş': 's', 'ş': 's', 
  'Ç': 'c', 'ç': 'c',
  'Ö': 'o', 'ö': 'o',
  'Ü': 'u', 'ü': 'u'
};

/**
 * Normalize merchant name for consistent grouping using brand mapping
 * - First tries to map to curated brand
 * - Falls back to normalization for unknown brands
 */
export const normalizeMerchant = (merchantName: string): string => {
  if (!merchantName || typeof merchantName !== 'string') {
    return 'Diğer';
  }

  // First try brand normalization (most accurate)
  const brand = normalizeBrand(merchantName);
  if (brand !== 'Diğer') {
    return brand;
  }

  // Fallback to raw normalization for unknown brands
  let normalized = merchantName.toLowerCase();

  // Replace Turkish characters with base equivalents
  Object.entries(TURKISH_CHAR_MAP).forEach(([turkish, base]) => {
    normalized = normalized.replace(new RegExp(turkish, 'g'), base);
  });

  // Remove common company suffixes and legal entities
  const suffixesToRemove = [
    'a\\.?s\\.?',
    'a\\.?ş\\.?',
    'ltd\\.?',
    'şti\\.?',
    'ticaret',
    'gida',
    'gıda',
    'market',
    'mağazası',
    'mağazasi',
    'perakende',
    'satış',
    'satis'
  ];

  suffixesToRemove.forEach(suffix => {
    normalized = normalized.replace(new RegExp(`\\b${suffix}\\b`, 'g'), '');
  });

  // Remove all spaces, punctuation, and special characters
  normalized = normalized.replace(/[\s\.\-_,;:!@#$%^&*()+={}|\[\]\\\/?"'<>~`]/g, '');

  // Remove any remaining digits that might be store numbers
  normalized = normalized.replace(/\d+$/, '');

  return normalized.trim() || 'Diğer';
};

/**
 * Group receipts by normalized merchant name
 */
export const groupReceiptsByMerchant = (receipts: any[]) => {
  const groups: Record<string, any[]> = {};

  receipts.forEach(receipt => {
    const normalizedKey = normalizeMerchant(receipt.merchant);
    if (!groups[normalizedKey]) {
      groups[normalizedKey] = [];
    }
    groups[normalizedKey].push(receipt);
  });

  return groups;
};

/**
 * Get the most representative merchant name from a group
 * (usually the shortest clean version)
 */
export const getDisplayMerchantName = (receipts: any[]): string => {
  if (!receipts || receipts.length === 0) return '';

  // Get all unique merchant names
  const uniqueNames = [...new Set(receipts.map(r => r.merchant))];
  
  // Sort by length (shortest first) and return the first one
  // This tends to give us the cleanest version
  return uniqueNames.sort((a, b) => a.length - b.length)[0];
};

/**
 * Curated list of major Turkish retail chains
 */
export const CURATED_BRANDS = [
  'Migros',
  'ŞOK', 
  'A101',
  'BİM',
  'CarrefourSA',
  'File Market',
  'Metro',
  'Mopaş',
  'Happy Center',
  'Diğer'
];

/**
 * Normalize brand (fuzzy matching to curated list)
 */
export const normalizeBrand = (merchantRaw: string): string => {
  if (!merchantRaw || typeof merchantRaw !== 'string') {
    return 'Diğer';
  }

  let normalized = merchantRaw.toLowerCase();

  // Replace Turkish characters with base equivalents
  Object.entries(TURKISH_CHAR_MAP).forEach(([turkish, base]) => {
    normalized = normalized.replace(new RegExp(turkish, 'g'), base);
  });

  // Remove spaces and punctuation
  normalized = normalized.replace(/[\s\.\-_,;:!@#$%^&*()+={}|\[\]\\\/?"'<>~`]/g, '');

  // Brand dictionary with common variants and broken OCR forms
  const brandDictionary: Record<string, string> = {
    // Migros variants
    'migros': 'Migros',
    'mgros': 'Migros', 
    'mıgros': 'Migros',
    'mıgr0s': 'Migros',
    
    // BİM variants  
    'bim': 'BİM',
    'b1m': 'BİM',
    'bım': 'BİM',
    
    // A101 variants
    'a101': 'A101',
    'a1o1': 'A101',
    'a10l': 'A101',
    
    // ŞOK variants
    'sok': 'ŞOK',
    'şok': 'ŞOK',
    's0k': 'ŞOK',
    
    // CarrefourSA variants
    'carrefour': 'CarrefourSA',
    'carrefoursa': 'CarrefourSA',
    'carref0ur': 'CarrefourSA',
    
    // Other major chains
    'metro': 'Metro',
    'filemarket': 'File Market',
    'file': 'File Market',
    'mopas': 'Mopaş',
    'happycenter': 'Happy Center',
    'happy': 'Happy Center'
  };

  // Direct match
  if (brandDictionary[normalized]) {
    return brandDictionary[normalized];
  }

  // Fuzzy matching for broken OCR (simple includes)
  for (const [key, brand] of Object.entries(brandDictionary)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return brand;
    }
  }

  // Levenshtein distance ≤2 fallback (simplified version)
  for (const [key, brand] of Object.entries(brandDictionary)) {
    if (Math.abs(normalized.length - key.length) <= 2) {
      let distance = 0;
      const maxLen = Math.max(normalized.length, key.length);
      for (let i = 0; i < maxLen; i++) {
        if (normalized[i] !== key[i]) distance++;
      }
      if (distance <= 2) {
        return brand;
      }
    }
  }

  // Fallback to "Diğer"
  return 'Diğer';
};

/**
 * Get a clean display name for a single merchant string
 */
export const getCleanMerchantName = (merchantName: string): string => {
  if (!merchantName) return '';
  
  // Remove common suffixes while keeping the core name readable
  let clean = merchantName.trim();
  
  // Remove common company suffixes but keep readability
  const suffixesToRemove = [
    / A\.?Ş\.?$/i,
    / LTD\.?$/i,
    / ŞTİ\.?$/i,
    / TİCARET.*$/i,
    / GIDA.*$/i,
    / MARKET.*$/i,
    / MAĞAZA.*$/i,
    / PERAKENDE.*$/i
  ];
  
  suffixesToRemove.forEach(suffix => {
    clean = clean.replace(suffix, '');
  });
  
  return clean.trim() || merchantName; // Fallback to original if everything was removed
};

/**
 * Get merchant analytics data
 */
export const getMerchantAnalytics = (receipts: any[]) => {
  const groups = groupReceiptsByMerchant(receipts.filter(r => r.status === 'approved'));
  
  return Object.entries(groups).map(([normalizedName, receipts]) => {
    const totalSpent = receipts.reduce((sum, r) => sum + parseFloat(r.total.toString()), 0);
    const totalPoints = receipts.reduce((sum, r) => sum + r.points, 0);
    const dates = receipts.map(r => new Date(r.purchase_date)).sort();
    
    return {
      normalizedName,
      displayName: getDisplayMerchantName(receipts),
      receiptCount: receipts.length,
      totalSpent,
      totalPoints,
      firstPurchase: dates[0],
      lastPurchase: dates[dates.length - 1],
      receipts
    };
  }).sort((a, b) => b.totalSpent - a.totalSpent); // Sort by total spent descending
};

/**
 * Test cases for merchant normalization
 * Useful for debugging and ensuring consistency
 */
export const MERCHANT_TEST_CASES = [
  { input: 'MİGROS TİCARET A.Ş.', expected: 'migros' },
  { input: 'M GROS T CARET A.S.', expected: 'mgrost' },
  { input: 'Migros Market', expected: 'migros' },
  { input: 'CARREFOUR SA', expected: 'carrefour' },
  { input: 'BİM Birleşik Mağazalar A.Ş.', expected: 'bimbirlesik' },
  { input: 'ŞOK Marketler Ticaret A.Ş.', expected: 'sokmarketler' },
  { input: 'A101 Yeni Mağazacılık A.Ş.', expected: 'ayenimağazacilik' }
];

/**
 * Run tests to verify normalization works correctly
 */
export const testMerchantNormalization = (): boolean => {
  let allPassed = true;
  
  MERCHANT_TEST_CASES.forEach(({ input, expected }) => {
    const result = normalizeMerchant(input);
    if (result !== expected) {
      console.warn(`Merchant normalization test failed:`, {
        input,
        expected,
        actual: result
      });
      allPassed = false;
    }
  });
  
  return allPassed;
};