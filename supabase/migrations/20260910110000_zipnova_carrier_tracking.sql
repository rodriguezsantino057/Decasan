-- Agregar columnas genéricas para transportista y número de seguimiento
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS carrier text;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS tracking_number text;

-- Migrar datos existentes desde andreani_tracking_number si existen
UPDATE public.pedidos
SET 
  tracking_number = andreani_tracking_number,
  carrier = COALESCE(carrier, 'andreani')
WHERE andreani_tracking_number IS NOT NULL AND tracking_number IS NULL;
