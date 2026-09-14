-- Desactiva todos los productos de la categoría H. Eléctricas.
-- Se conservan los registros pero dejan de mostrarse en la tienda (activo = false).
update public.productos
set activo = false
where categoria = 'H. Eléctricas'
  and activo is distinct from false;