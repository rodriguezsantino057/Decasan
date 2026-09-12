-- Quitar la categoría "Bateria" y agregar "Materiales Eléctricos"

insert into public.categorias (nombre, orden, activo)
values ('Materiales Eléctricos', 8, true)
on conflict (nombre) do update
set orden = excluded.orden,
    activo = true;

delete from public.categorias
where nombre = 'Bateria';