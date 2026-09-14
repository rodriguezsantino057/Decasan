-- Elimina las opciones de envío huérfanas (correo_argentino y andreani).
-- El checkout no las usa: cotiza contra la API de Zipnova y usa retiro local + cadete.
-- Se conservan únicamente: retiro_local y cadete.
delete from public.shipping_options
where transportista in ('correo_argentino', 'andreani');