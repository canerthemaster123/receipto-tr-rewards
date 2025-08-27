/**
 * Merchant normalization utilities for Turkish retail chains
 */

interface MerchantMapping {
  patterns: string[];
  chainGroup: string;
  priority: number;
}

// Turkish retail chain mappings
const MERCHANT_MAPPINGS: MerchantMapping[] = [
  // Migros chain
  {
    patterns: ['migros', 'mıgros'],
    chainGroup: 'Migros',
    priority: 10
  },
  
  // A101 chain
  {
    patterns: ['a101', 'a-101', 'a 101'],
    chainGroup: 'A101',
    priority: 10
  },
  
  // BIM chain
  {
    patterns: ['bim', 'bİm', 'b.i.m'],
    chainGroup: 'BIM',
    priority: 10
  },
  
  // SOK/ŞOK chain
  {
    patterns: ['sok', 'şok', 's.o.k'],
    chainGroup: 'SOK',
    priority: 10
  },
  
  // CarrefourSA chain
  {
    patterns: ['carrefour', 'carrefoursa', 'krefur'],
    chainGroup: 'CarrefourSA',
    priority: 10
  },
  
  // Metro chain
  {
    patterns: ['metro', 'metro market', 'metro gross'],
    chainGroup: 'Metro',
    priority: 10
  },
  
  // Real chain
  {
    patterns: ['real', 'real market'],
    chainGroup: 'Real',
    priority: 10
  },
  
  // Macrocenter chain
  {
    patterns: ['macro', 'macrocenter', 'macro center'],
    chainGroup: 'Macrocenter',
    priority: 10
  },
  
  // File chain
  {
    patterns: ['file', 'file market'],
    chainGroup: 'File',
    priority: 10
  },
  
  // Hakmar chain
  {
    patterns: ['hakmar', 'hak-mar'],
    chainGroup: 'Hakmar',
    priority: 10
  },
  
  // Teknosa
  {
    patterns: ['teknosa'],
    chainGroup: 'Teknosa',
    priority: 10
  },
  
  // MediaMarkt
  {
    patterns: ['mediamarkt', 'media markt', 'medya market'],
    chainGroup: 'MediaMarkt',
    priority: 10
  },
  
  // LC Waikiki
  {
    patterns: ['lc waikiki', 'lcw', 'lc waıkıkı'],
    chainGroup: 'LC Waikiki',
    priority: 10
  }
];

/**
 * Normalize merchant name to chain group
 */
export function normalizeMerchantToChain(merchantRaw: string): string {
  if (!merchantRaw || typeof merchantRaw !== 'string') {
    return 'Unknown';
  }
  
  const normalized = merchantRaw.toLowerCase().trim();
  
  // Find best match by priority and pattern length
  let bestMatch: MerchantMapping | null = null;
  let bestScore = 0;
  
  for (const mapping of MERCHANT_MAPPINGS) {
    for (const pattern of mapping.patterns) {
      if (normalized.includes(pattern)) {
        // Score based on pattern length and priority
        const score = pattern.length * mapping.priority;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = mapping;
        }
      }
    }
  }
  
  return bestMatch ? bestMatch.chainGroup : merchantRaw.trim();
}

/**
 * Extract merchant brand from raw text (more focused than chain group)
 */
export function extractMerchantBrand(text: string): string | null {
  if (!text) return null;
  
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  
  // Look for merchant info in first few lines
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i];
    
    // Skip lines that look like addresses or numbers
    if (/^\d+/.test(line) || /(?:CAD|SOK|MAH|NO)/i.test(line)) continue;
    
    // Look for lines that contain merchant patterns
    const normalized = normalizeMerchantToChain(line);
    if (normalized !== 'Unknown' && normalized !== line) {
      return normalized;
    }
    
    // If it's a substantial text line (not just numbers/symbols), consider it
    if (line.length > 3 && /[A-Za-zÇĞİÖŞÜçğıöşü]/.test(line)) {
      return line;
    }
  }
  
  return null;
}

/**
 * Clean and normalize merchant name for display
 */
export function cleanMerchantName(merchantName: string): string {
  if (!merchantName) return '';
  
  return merchantName
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\sÇĞİÖŞÜçğıöşü\-\.]/g, '')
    .replace(/\b(LTD|ŞTI|A\.Ş|AŞ|SAN|TIC)\b\.?/gi, '')
    .trim();
}