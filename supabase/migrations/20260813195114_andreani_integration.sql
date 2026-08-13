ALTER TABLE public.pedidos DROP CONSTRAINT IF EXISTS pedidos_shipping_option_id_fkey;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS andreani_tracking_number text;