-- Migration: Add B2B Analytics Tables and Columns
-- Up Migration

-- Add new columns to receipts table
ALTER TABLE public.receipts 
ADD COLUMN store_id uuid,
ADD COLUMN h3_8 text;

-- Create store_dim table for normalized store information
CREATE TABLE public.store_dim (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    chain_group text NOT NULL,
    city text,
    district text, 
    neighborhood text,
    address text,
    lat numeric,
    lng numeric,
    h3_8 text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Create merchant_map table for merchant normalization
CREATE TABLE public.merchant_map (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    raw_merchant text NOT NULL UNIQUE,
    chain_group text NOT NULL,
    priority integer DEFAULT 100,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);

-- Create receipt_items table for line item details
CREATE TABLE public.receipt_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id uuid NOT NULL REFERENCES public.receipts(id) ON DELETE CASCADE,
    item_name text NOT NULL,
    qty numeric,
    unit_price numeric,
    line_total numeric,
    product_code text,
    raw_line text,
    created_at timestamp with time zone DEFAULT now()
);

-- Create period_user_merchant_week table for user-level weekly aggregations
CREATE TABLE public.period_user_merchant_week (
    user_id uuid NOT NULL,
    chain_group text NOT NULL,
    week_start date NOT NULL,
    receipt_count integer DEFAULT 0,
    total_spend numeric DEFAULT 0,
    avg_basket_value numeric DEFAULT 0,
    first_visit_week boolean DEFAULT false,
    last_visit_week boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (user_id, chain_group, week_start)
);

-- Create period_geo_merchant_week table for geo-level weekly aggregations  
CREATE TABLE public.period_geo_merchant_week (
    chain_group text NOT NULL,
    week_start date NOT NULL,
    city text NOT NULL,
    district text NOT NULL,
    neighborhood text NOT NULL,
    unique_users integer DEFAULT 0,
    receipt_count integer DEFAULT 0,
    total_spend numeric DEFAULT 0,
    avg_basket_value numeric DEFAULT 0,
    new_users integer DEFAULT 0,
    returning_users integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (chain_group, week_start, city, district, neighborhood)
);

-- Create alerts table for anomaly detection
CREATE TABLE public.alerts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type text NOT NULL,
    chain_group text NOT NULL,
    geo_level text NOT NULL,
    geo_value text NOT NULL,
    metric_name text NOT NULL,
    current_value numeric NOT NULL,
    previous_value numeric NOT NULL,
    z_score numeric NOT NULL,
    sample_size integer NOT NULL,
    week_start date NOT NULL,
    severity text NOT NULL DEFAULT 'medium',
    created_at timestamp with time zone DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX idx_store_dim_chain_geo ON public.store_dim (chain_group, city, district, neighborhood);
CREATE INDEX idx_receipt_items_receipt ON public.receipt_items (receipt_id);
CREATE INDEX idx_period_user_merchant_week_chain_week ON public.period_user_merchant_week (chain_group, week_start);
CREATE INDEX idx_period_geo_merchant_week_chain_week ON public.period_geo_merchant_week (chain_group, week_start);
CREATE INDEX idx_alerts_week_chain ON public.alerts (week_start, chain_group);
CREATE INDEX idx_receipts_store_id ON public.receipts (store_id);
CREATE INDEX idx_receipts_h3_8 ON public.receipts (h3_8);

-- Enable RLS on new tables
ALTER TABLE public.store_dim ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.period_user_merchant_week ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.period_geo_merchant_week ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Analytics tables readable only by admins or service role
CREATE POLICY "Admins can manage store_dim" ON public.store_dim FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can manage merchant_map" ON public.merchant_map FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view receipt_items" ON public.receipt_items FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view their receipt items" ON public.receipt_items FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.receipts WHERE receipts.id = receipt_items.receipt_id AND receipts.user_id = auth.uid())
);

CREATE POLICY "Admins can view period_user_merchant_week" ON public.period_user_merchant_week FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can view period_geo_merchant_week" ON public.period_geo_merchant_week FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can view alerts" ON public.alerts FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Create security definer functions for data operations
CREATE OR REPLACE FUNCTION public.upsert_store_dim(
    p_chain_group text,
    p_city text DEFAULT NULL,
    p_district text DEFAULT NULL, 
    p_neighborhood text DEFAULT NULL,
    p_address text DEFAULT NULL,
    p_lat numeric DEFAULT NULL,
    p_lng numeric DEFAULT NULL,
    p_h3_8 text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    store_uuid uuid;
BEGIN
    -- Try to find existing store
    SELECT id INTO store_uuid
    FROM public.store_dim
    WHERE chain_group = p_chain_group
    AND COALESCE(city, '') = COALESCE(p_city, '')
    AND COALESCE(district, '') = COALESCE(p_district, '')
    AND COALESCE(neighborhood, '') = COALESCE(p_neighborhood, '')
    LIMIT 1;
    
    IF store_uuid IS NULL THEN
        -- Insert new store
        INSERT INTO public.store_dim (chain_group, city, district, neighborhood, address, lat, lng, h3_8)
        VALUES (p_chain_group, p_city, p_district, p_neighborhood, p_address, p_lat, p_lng, p_h3_8)
        RETURNING id INTO store_uuid;
    ELSE
        -- Update existing store with new info
        UPDATE public.store_dim
        SET address = COALESCE(p_address, address),
            lat = COALESCE(p_lat, lat),
            lng = COALESCE(p_lng, lng),
            h3_8 = COALESCE(p_h3_8, h3_8),
            updated_at = now()
        WHERE id = store_uuid;
    END IF;
    
    RETURN store_uuid;
END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_merchant_to_chain(p_raw_merchant text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    chain_result text;
BEGIN
    -- Look up merchant mapping by priority
    SELECT chain_group INTO chain_result
    FROM public.merchant_map
    WHERE active = true
    AND (
        LOWER(p_raw_merchant) = LOWER(raw_merchant)
        OR LOWER(p_raw_merchant) LIKE '%' || LOWER(raw_merchant) || '%'
    )
    ORDER BY priority ASC, char_length(raw_merchant) DESC
    LIMIT 1;
    
    -- Return normalized chain or original if no match
    RETURN COALESCE(chain_result, p_raw_merchant);
END;
$$;