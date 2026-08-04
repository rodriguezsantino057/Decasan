create table if not exists public.categorias (
  id bigserial primary key,
  nombre text not null unique,
  descripcion text,
  orden integer,
  activo boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

insert into public.categorias (nombre, orden, activo)
values
  ('Accesorios y Herramientas', 1, true),
  ('Automotor', 2, true),
  ('Bateria', 3, true),
  ('H. Eléctricas', 4, true),
  ('Sanitarios e instalaciones', 5, true),
  ('Jardín', 6, true),
  ('Materiales', 7, true)
on conflict (nombre) do update
set orden = excluded.orden,
    activo = true;

delete from public.categorias
where nombre = 'Otros';

update public.productos
set categoria = 'H. Eléctricas'
where lower(regexp_replace(translate(categoria, 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU'), '\s+', ' ', 'g')) in (
  'h. electricas',
  'h.electricas',
  'h electricas',
  'herramientas electricas'
)
or categoria in ('H. ElÃ©ctricas', 'H.Eléctricas', 'H.Electricas', 'H. Electricas');

update public.productos
set categoria = 'Jardín'
where lower(translate(categoria, 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU')) = 'jardin'
or categoria = 'JardÃ­n';

delete from public.categorias c
where c.nombre in ('H. ElÃ©ctricas', 'H.Eléctricas', 'H.Electricas', 'H. Electricas', 'H. Electricas');

delete from public.categorias c
where c.nombre = 'JardÃ­n'
  or (c.nombre <> 'Jardín' and lower(translate(c.nombre, 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU')) = 'jardin');

create index if not exists idx_categorias_nombre on public.categorias(nombre);
create index if not exists idx_categorias_activo on public.categorias(activo);
