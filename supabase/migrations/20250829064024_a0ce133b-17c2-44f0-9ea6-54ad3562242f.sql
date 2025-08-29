-- Improve normalization to handle OCR-spaced Turkish brand names
CREATE OR REPLACE FUNCTION public.normalize_merchant_to_chain(p_raw_merchant text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    chain_result text;
    src text;
BEGIN
    IF p_raw_merchant IS NULL OR trim(p_raw_merchant) = '' THEN
      RETURN NULL;
    END IF;

    -- First, look up merchant mapping by priority (existing behavior)
    SELECT chain_group INTO chain_result
    FROM public.merchant_map
    WHERE active = true
    AND (
        LOWER(p_raw_merchant) = LOWER(raw_merchant)
        OR LOWER(p_raw_merchant) LIKE '%' || LOWER(raw_merchant) || '%'
    )
    ORDER BY priority ASC, char_length(raw_merchant) DESC
    LIMIT 1;
    
    IF chain_result IS NOT NULL THEN
      RETURN chain_result;
    END IF;

    -- Fallback heuristics for common OCR variants (ignore spaces and punctuation, be case-insensitive)
    src := LOWER(p_raw_merchant);
    -- Quick replace of common punctuation to spaces for easier regex matching
    src := regexp_replace(src, '[\n\r\t\-_.]+', ' ', 'g');

    -- Migros: matches "migros" even if split like "m gros", "mi gros"
    IF src ~* 'm\s*gros' OR src ~* 'migros' THEN
      RETURN 'Migros';
    END IF;

    -- BIM: handle Turkish dotted I: match b ?i ?m (any spaces)
    IF src ~* 'b\s*i\s*m' OR src ~* 'bim' OR src ~* 'bı\s*m' OR src ~* 'bï\s*m' THEN
      RETURN 'BIM';
    END IF;

    -- SOK / ŞOK
    IF src ~* 'ş\s*ok' OR src ~* 's\s*ok' THEN
      RETURN 'SOK';
    END IF;

    -- Carrefour
    IF src ~* 'car\s*ref\s*our' OR src ~* 'carrefour' THEN
      RETURN 'CarrefourSA';
    END IF;

    -- Default: return original
    RETURN p_raw_merchant;
END;
$function$;

-- Rebuild rollups again to apply improved normalization
DO $$
DECLARE
  min_date date;
  max_date date;
BEGIN
  SELECT 
    date_trunc('week', MIN(purchase_date))::date,
    date_trunc('week', MAX(purchase_date))::date
  INTO min_date, max_date
  FROM public.receipts
  WHERE status = 'approved' AND purchase_date IS NOT NULL;

  IF min_date IS NOT NULL THEN
    PERFORM public.fn_fill_period_geo_merchant_week(min_date, max_date);
    PERFORM public.fn_fill_period_user_merchant_week(min_date, max_date);
  END IF;
END $$;