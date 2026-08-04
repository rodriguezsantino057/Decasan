ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS codigo_fabricante text,
  ADD COLUMN IF NOT EXISTS precio_vta_sin_iva numeric,
  ADD COLUMN IF NOT EXISTS erp_updated_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS last_import_id uuid;

CREATE INDEX IF NOT EXISTS productos_codigo_fabricante_idx
  ON public.productos (codigo_fabricante);

CREATE INDEX IF NOT EXISTS productos_last_import_id_idx
  ON public.productos (last_import_id);
