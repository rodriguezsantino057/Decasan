
ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS image_webp text;

CREATE INDEX IF NOT EXISTS productos_precio_idx ON public.productos (precio);
CREATE INDEX IF NOT EXISTS productos_grupo_idx  ON public.productos (grupo);
CREATE INDEX IF NOT EXISTS productos_categoria_idx ON public.productos (categoria);

INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "product images public read" ON storage.objects;
CREATE POLICY "product images public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "admins upload product images" ON storage.objects;
CREATE POLICY "admins upload product images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins update product images" ON storage.objects;
CREATE POLICY "admins update product images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins delete product images" ON storage.objects;
CREATE POLICY "admins delete product images"
ON storage.objects FOR DELETE
USING (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'));
