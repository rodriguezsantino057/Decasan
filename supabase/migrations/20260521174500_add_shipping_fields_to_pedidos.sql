alter table public.pedidos
  add column if not exists subtotal_productos numeric not null default 0,
  add column if not exists envio_total numeric not null default 0,
  add column if not exists envio_metodo jsonb;

update public.pedidos
set subtotal_productos = total
where subtotal_productos = 0
  and envio_total = 0;
