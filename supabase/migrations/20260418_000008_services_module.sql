-- Barber Zac ERP — Migration: Services Module
-- Created at: 2026-04-18

-- 1. Service Categories Table
CREATE TABLE IF NOT EXISTS public.service_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for category search
CREATE INDEX IF NOT EXISTS idx_service_categories_normalized ON public.service_categories(normalized_name);

-- 2. Services Table
CREATE TABLE IF NOT EXISTS public.services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    description TEXT,
    duration_minutes INTEGER DEFAULT 30,
    price NUMERIC(10,2) NOT NULL DEFAULT 0,
    commission_percent NUMERIC(5,2) DEFAULT 0,
    category_id UUID REFERENCES public.service_categories(id) NULL,
    price_type TEXT DEFAULT 'fixed',
    return_days INTEGER NULL,
    is_bookable BOOLEAN DEFAULT true,
    show_price BOOLEAN DEFAULT true,
    simultaneous_slots INTEGER DEFAULT 1,
    notes TEXT,
    image_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_by UUID NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance and deduplication
CREATE INDEX IF NOT EXISTS idx_services_normalized ON public.services(normalized_name);
CREATE INDEX IF NOT EXISTS idx_services_category ON public.services(category_id);

-- 3. Update sale_items to link to services
-- service_name remains the static snapshot
ALTER TABLE public.sale_items 
ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES public.services(id) NULL;

-- 4. Enable unaccent if not already
CREATE EXTENSION IF NOT EXISTS unaccent;
