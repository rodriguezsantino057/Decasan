-- Agrega columna opcional de peso a la tabla productos
ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS peso_kg decimal(10, 2);

-- Comentario para documentar el campo
COMMENT ON COLUMN public.productos.peso_kg IS 'Peso físico del producto en kilogramos. Usado para excepciones en el cálculo de envíos.';
