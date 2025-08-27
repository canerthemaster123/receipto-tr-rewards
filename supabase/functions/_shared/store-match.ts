/**
 * Store matching utilities for location resolution
 */

interface StoreLocation {
  id: string;
  chain_group: string;
  city?: string;
  district?: string;
  neighborhood?: string;
  lat?: number;
  lng?: number;
}

interface AddressComponents {
  city?: string;
  district?: string;
  neighborhood?: string;
  street?: string;
}

/**
 * Parse Turkish address components from raw text
 */
export function parseAddressComponents(addressRaw: string): AddressComponents {
  if (!addressRaw) return {};
  
  const normalized = addressRaw.toLowerCase().trim();
  const components: AddressComponents = {};
  
  // Extract city (look for common Turkish city names)
  const cities = [
    'istanbul', 'ankara', 'izmir', 'bursa', 'antalya', 'adana', 'konya', 'gaziantep',
    'mersin', 'diyarbakır', 'kayseri', 'eskişehir', 'urfa', 'malatya', 'erzurum',
    'trabzon', 'denizli', 'kocaeli', 'hatay', 'manisa', 'kahramanmaraş', 'van',
    'aydın', 'balıkesir', 'tokat', 'tekirdağ', 'sakarya', 'muğla', 'afyon'
  ];
  
  for (const city of cities) {
    if (normalized.includes(city)) {
      components.city = city.charAt(0).toUpperCase() + city.slice(1);
      break;
    }
  }
  
  // Extract district patterns (MAH., MAHALLE, etc.)
  const mahMatch = normalized.match(/([a-zçğıöşü\s]+)(?:\s+mah\.?|\s+mahalle)/i);
  if (mahMatch) {
    components.neighborhood = mahMatch[1].trim();
  }
  
  // Extract street patterns (CAD., CADDE, SOK., SOKAK)
  const streetMatch = normalized.match(/([a-zçğıöşü\s]+)(?:\s+cad\.?|\s+cadde|\s+sok\.?|\s+sokak)/i);
  if (streetMatch) {
    components.street = streetMatch[1].trim();
  }
  
  // Extract district from common patterns
  const districtPatterns = [
    /([a-zçğıöşü\s]+)\s+ilçe/i,
    /([a-zçğıöşü\s]+)\s+\//i, // Often city/district format
  ];
  
  for (const pattern of districtPatterns) {
    const match = normalized.match(pattern);
    if (match) {
      components.district = match[1].trim();
      break;
    }
  }
  
  return components;
}

/**
 * Match store by merchant and address
 */
export async function matchStore(
  supabase: any,
  chainGroup: string,
  addressRaw?: string
): Promise<StoreLocation | null> {
  try {
    let query = supabase
      .from('store_dim')
      .select('*')
      .eq('chain_group', chainGroup);
    
    // If we have address, try to match by location components
    if (addressRaw) {
      const components = parseAddressComponents(addressRaw);
      
      if (components.city) {
        query = query.ilike('city', `%${components.city}%`);
      }
      
      if (components.district) {
        query = query.ilike('district', `%${components.district}%`);
      }
      
      if (components.neighborhood) {
        query = query.ilike('neighborhood', `%${components.neighborhood}%`);
      }
    }
    
    const { data, error } = await query.limit(1);
    
    if (error || !data || data.length === 0) {
      // Fallback: find any store for this chain
      const { data: fallbackData } = await supabase
        .from('store_dim')
        .select('*')
        .eq('chain_group', chainGroup)
        .limit(1);
      
      return fallbackData && fallbackData.length > 0 ? fallbackData[0] : null;
    }
    
    return data[0];
  } catch (error) {
    console.error('Store matching error:', error);
    return null;
  }
}

/**
 * Upsert store with location components
 */
export async function upsertStore(
  supabase: any,
  chainGroup: string,
  addressRaw?: string,
  lat?: number,
  lng?: number
): Promise<string | null> {
  try {
    const components = addressRaw ? parseAddressComponents(addressRaw) : {};
    
    const { data, error } = await supabase.rpc('upsert_store_dim', {
      p_chain_group: chainGroup,
      p_city: components.city || null,
      p_district: components.district || null,
      p_neighborhood: components.neighborhood || null,
      p_address: addressRaw || null,
      p_lat: lat || null,
      p_lng: lng || null,
      p_h3_8: null // Could implement H3 geohashing later
    });
    
    if (error) {
      console.error('Store upsert error:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Store upsert error:', error);
    return null;
  }
}