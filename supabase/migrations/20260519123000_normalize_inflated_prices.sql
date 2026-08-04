UPDATE public.productos
SET
  precio = CASE WHEN precio IS NOT NULL THEN precio / 1000 ELSE precio END,
  precio_oferta = CASE WHEN precio_oferta IS NOT NULL THEN precio_oferta / 1000 ELSE precio_oferta END,
  precio_vta_sin_iva = CASE WHEN precio_vta_sin_iva IS NOT NULL THEN precio_vta_sin_iva / 1000 ELSE precio_vta_sin_iva END;

UPDATE public.variantes
SET precio = CASE WHEN precio IS NOT NULL THEN precio / 1000 ELSE precio END;
