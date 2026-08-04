
-- 1. Add columns to productos
ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS precio_oferta numeric,
  ADD COLUMN IF NOT EXISTS oferta_hasta timestamptz;

CREATE INDEX IF NOT EXISTS idx_productos_activo ON public.productos(activo);

-- 2. Update RLS so public only sees active products; admins see all
DROP POLICY IF EXISTS "public read productos" ON public.productos;
CREATE POLICY "public read active productos"
  ON public.productos FOR SELECT
  USING (activo = true OR has_role(auth.uid(), 'admin'::app_role));

-- 3. Create product_images table
CREATE TABLE IF NOT EXISTS public.product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id bigint NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
  url text,
  url_webp text,
  alt text,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_images_producto_orden
  ON public.product_images(producto_id, orden);

ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read product_images"
  ON public.product_images FOR SELECT USING (true);

CREATE POLICY "admins manage product_images"
  ON public.product_images FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 4. Backfill from existing productos.image_url / image_webp
INSERT INTO public.product_images (producto_id, url, url_webp, orden)
SELECT id, image_url, image_webp, 0
FROM public.productos
WHERE (image_url IS NOT NULL OR image_webp IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1 FROM public.product_images pi WHERE pi.producto_id = productos.id
  );

-- 5. Trigger to keep productos.image_url / image_webp in sync with orden=0 image
CREATE OR REPLACE FUNCTION public.sync_producto_principal_image()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  pid bigint;
  main_url text;
  main_webp text;
BEGIN
  pid := COALESCE(NEW.producto_id, OLD.producto_id);
  SELECT url, url_webp INTO main_url, main_webp
  FROM public.product_images
  WHERE producto_id = pid
  ORDER BY orden ASC, created_at ASC
  LIMIT 1;
  UPDATE public.productos
  SET image_url = main_url, image_webp = main_webp
  WHERE id = pid;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_product_images_sync_main ON public.product_images;
CREATE TRIGGER trg_product_images_sync_main
AFTER INSERT OR UPDATE OR DELETE ON public.product_images
FOR EACH ROW EXECUTE FUNCTION public.sync_producto_principal_image();
