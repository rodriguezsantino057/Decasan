  -- Agregar columnas genéricas para transportista y número de seguimiento
  ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS carrier text;
  ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS tracking_number text;

  -- Asegurar que la columna andreani_tracking_number exista (puede no haberse creado antes)
  ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS andreani_tracking_number text;

  -- Migrar datos existentes desde andreani_tracking_number si existen
  DO $$
  BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'pedidos'
        AND column_name = 'andreani_tracking_number'
    ) THEN
      UPDATE public.pedidos
      SET 
        tracking_number = andreani_tracking_number,
        carrier = COALESCE(carrier, 'andreani')
      WHERE andreani_tracking_number IS NOT NULL AND tracking_number IS NULL;
    END IF;
  END $$;
