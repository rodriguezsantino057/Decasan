-- Roles
create type public.app_role as enum ('admin', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "users view own roles" on public.user_roles for select using (auth.uid() = user_id);
create policy "admins view all roles" on public.user_roles for select using (public.has_role(auth.uid(), 'admin'));
create policy "admins insert roles" on public.user_roles for insert with check (public.has_role(auth.uid(), 'admin'));
create policy "admins delete roles" on public.user_roles for delete using (public.has_role(auth.uid(), 'admin'));

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text,
  telefono text,
  dni text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "users view own profile" on public.profiles for select using (auth.uid() = id);
create policy "users update own profile" on public.profiles for update using (auth.uid() = id);
create policy "users insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "admins view all profiles" on public.profiles for select using (public.has_role(auth.uid(),'admin'));

-- Direcciones
create table public.direcciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  etiqueta text,
  calle text not null,
  numero text,
  piso text,
  ciudad text not null,
  provincia text not null,
  codigo_postal text not null,
  telefono text,
  predeterminada boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.direcciones enable row level security;
create policy "own direcciones all" on public.direcciones for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Pedidos
create type public.pedido_estado as enum ('pendiente','pagado','enviado','entregado','cancelado');

create table public.pedidos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  estado pedido_estado not null default 'pendiente',
  total numeric not null default 0,
  email text,
  nombre text,
  telefono text,
  direccion jsonb,
  mp_preference_id text,
  mp_payment_id text,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.pedidos enable row level security;
create policy "own pedidos select" on public.pedidos for select using (auth.uid() = user_id);
create policy "own pedidos insert" on public.pedidos for insert with check (auth.uid() = user_id);
create policy "admins manage pedidos" on public.pedidos for all using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.pedido_items (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  producto_id bigint references public.productos(id) on delete set null,
  variante_id bigint references public.variantes(id) on delete set null,
  nombre text not null,
  sku text,
  precio_unitario numeric not null,
  cantidad integer not null,
  subtotal numeric not null
);
alter table public.pedido_items enable row level security;
create policy "items via pedido owner" on public.pedido_items for select using (
  exists (select 1 from public.pedidos p where p.id = pedido_id and p.user_id = auth.uid())
);
create policy "items insert own" on public.pedido_items for insert with check (
  exists (select 1 from public.pedidos p where p.id = pedido_id and p.user_id = auth.uid())
);
create policy "admins manage items" on public.pedido_items for all using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- Productos & variantes: admin write + public read on variantes
create policy "admins manage productos" on public.productos for all using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
alter table public.variantes enable row level security;
create policy "public read variantes" on public.variantes for select using (true);
create policy "admins manage variantes" on public.variantes for all using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- updated_at trigger
create or replace function public.update_updated_at_column()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

create trigger profiles_updated_at before update on public.profiles for each row execute function public.update_updated_at_column();
create trigger pedidos_updated_at before update on public.pedidos for each row execute function public.update_updated_at_column();

-- Auto-create profile + default role
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nombre) values (new.id, coalesce(new.raw_user_meta_data->>'nombre', ''));
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  return new;
end; $$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();