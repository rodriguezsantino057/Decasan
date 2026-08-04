do $$
begin
  create type public.transportista as enum (
    'correo_argentino',
    'andreani',
    'cadete',
    'retiro_local'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.shipping_options (
  id uuid primary key default gen_random_uuid(),
  transportista public.transportista not null,
  provincia text,
  costo numeric not null default 0 check (costo >= 0),
  activo boolean not null default true,
  label text not null,
  dias_estimados_min int check (dias_estimados_min is null or dias_estimados_min >= 0),
  dias_estimados_max int check (dias_estimados_max is null or dias_estimados_max >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shipping_options_days_order check (
    dias_estimados_min is null
    or dias_estimados_max is null
    or dias_estimados_min <= dias_estimados_max
  ),
  constraint shipping_options_transportista_provincia_unique unique (transportista, provincia)
);

create unique index if not exists shipping_options_global_unique
  on public.shipping_options (transportista)
  where provincia is null;

alter table public.shipping_options enable row level security;

grant select on public.shipping_options to anon, authenticated;
grant insert, update, delete on public.shipping_options to authenticated;

drop policy if exists "public read active shipping" on public.shipping_options;
create policy "public read active shipping"
  on public.shipping_options for select
  using (activo = true);

drop policy if exists "admin manage shipping" on public.shipping_options;
create policy "admin manage shipping"
  on public.shipping_options for all
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

drop trigger if exists shipping_options_updated_at on public.shipping_options;
create trigger shipping_options_updated_at
  before update on public.shipping_options
  for each row execute function public.update_updated_at_column();

alter table public.pedidos
  add column if not exists shipping_option_id uuid references public.shipping_options(id) on delete set null,
  add column if not exists costo_envio numeric not null default 0,
  add column if not exists transportista text;

insert into public.shipping_options (transportista, provincia, costo, label, dias_estimados_min, dias_estimados_max) values
  ('retiro_local', null, 0, 'Retiro en local - La Falda', 0, 0),
  ('cadete', null, 2500, 'Envio local (cadete) - La Falda y alrededores', 1, 2),
  ('correo_argentino', 'Buenos Aires', 6500, 'Correo Argentino - Buenos Aires', 5, 10),
  ('correo_argentino', 'Ciudad Autonoma de Buenos Aires', 6500, 'Correo Argentino - CABA', 5, 10),
  ('correo_argentino', 'Cordoba', 3500, 'Correo Argentino - Cordoba', 3, 6),
  ('correo_argentino', 'Santa Fe', 5000, 'Correo Argentino - Santa Fe', 4, 8),
  ('correo_argentino', 'Mendoza', 6000, 'Correo Argentino - Mendoza', 5, 9),
  ('correo_argentino', 'Tucuman', 6000, 'Correo Argentino - Tucuman', 5, 9),
  ('correo_argentino', 'Entre Rios', 5500, 'Correo Argentino - Entre Rios', 4, 8),
  ('correo_argentino', 'Salta', 7000, 'Correo Argentino - Salta', 6, 10),
  ('correo_argentino', 'Misiones', 7500, 'Correo Argentino - Misiones', 7, 12),
  ('correo_argentino', 'San Luis', 5500, 'Correo Argentino - San Luis', 4, 8),
  ('correo_argentino', 'La Rioja', 6500, 'Correo Argentino - La Rioja', 5, 9),
  ('correo_argentino', 'Catamarca', 6500, 'Correo Argentino - Catamarca', 5, 9),
  ('correo_argentino', 'Jujuy', 7000, 'Correo Argentino - Jujuy', 6, 10),
  ('correo_argentino', 'Santiago del Estero', 6500, 'Correo Argentino - Santiago del Estero', 5, 9),
  ('correo_argentino', 'Chaco', 7000, 'Correo Argentino - Chaco', 6, 10),
  ('correo_argentino', 'Formosa', 7500, 'Correo Argentino - Formosa', 7, 12),
  ('correo_argentino', 'Corrientes', 7000, 'Correo Argentino - Corrientes', 6, 10),
  ('correo_argentino', 'Rio Negro', 7500, 'Correo Argentino - Rio Negro', 7, 12),
  ('correo_argentino', 'Neuquen', 7500, 'Correo Argentino - Neuquen', 7, 12),
  ('correo_argentino', 'Chubut', 8500, 'Correo Argentino - Chubut', 8, 14),
  ('correo_argentino', 'Santa Cruz', 9500, 'Correo Argentino - Santa Cruz', 9, 15),
  ('correo_argentino', 'Tierra del Fuego', 11000, 'Correo Argentino - Tierra del Fuego', 12, 18),
  ('correo_argentino', 'San Juan', 6000, 'Correo Argentino - San Juan', 5, 9),
  ('correo_argentino', 'La Pampa', 6500, 'Correo Argentino - La Pampa', 5, 9),
  ('andreani', 'Buenos Aires', 7500, 'Andreani - Buenos Aires', 3, 7),
  ('andreani', 'Ciudad Autonoma de Buenos Aires', 7500, 'Andreani - CABA', 3, 7),
  ('andreani', 'Cordoba', 4500, 'Andreani - Cordoba', 2, 4),
  ('andreani', 'Santa Fe', 6000, 'Andreani - Santa Fe', 3, 5),
  ('andreani', 'Mendoza', 7000, 'Andreani - Mendoza', 3, 6),
  ('andreani', 'Tucuman', 7000, 'Andreani - Tucuman', 3, 6),
  ('andreani', 'Entre Rios', 6500, 'Andreani - Entre Rios', 3, 5),
  ('andreani', 'Salta', 8000, 'Andreani - Salta', 4, 7),
  ('andreani', 'Misiones', 8500, 'Andreani - Misiones', 5, 9),
  ('andreani', 'San Luis', 6500, 'Andreani - San Luis', 3, 5),
  ('andreani', 'La Rioja', 7500, 'Andreani - La Rioja', 4, 7),
  ('andreani', 'Catamarca', 7500, 'Andreani - Catamarca', 4, 7),
  ('andreani', 'Jujuy', 8000, 'Andreani - Jujuy', 4, 7),
  ('andreani', 'Santiago del Estero', 7500, 'Andreani - Santiago del Estero', 4, 7),
  ('andreani', 'Chaco', 8000, 'Andreani - Chaco', 4, 7),
  ('andreani', 'Formosa', 8500, 'Andreani - Formosa', 5, 9),
  ('andreani', 'Corrientes', 8000, 'Andreani - Corrientes', 4, 7),
  ('andreani', 'Rio Negro', 8500, 'Andreani - Rio Negro', 5, 9),
  ('andreani', 'Neuquen', 8500, 'Andreani - Neuquen', 5, 9),
  ('andreani', 'Chubut', 9500, 'Andreani - Chubut', 6, 11),
  ('andreani', 'Santa Cruz', 10500, 'Andreani - Santa Cruz', 7, 12),
  ('andreani', 'Tierra del Fuego', 12500, 'Andreani - Tierra del Fuego', 10, 16),
  ('andreani', 'San Juan', 7000, 'Andreani - San Juan', 4, 7),
  ('andreani', 'La Pampa', 7500, 'Andreani - La Pampa', 4, 7)
on conflict do nothing;
