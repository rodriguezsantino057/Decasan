alter table public.productos enable row level security;

-- update_updated_at_column doesn't need SECURITY DEFINER (runs in trigger context)
create or replace function public.update_updated_at_column()
returns trigger language plpgsql security invoker set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;