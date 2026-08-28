-- MODO como método de pago (integración SDK / Botón de Pago)
alter table public.pedidos
  add column if not exists payment_method text,
  add column if not exists modo_intention_id text,
  add column if not exists modo_payment_id text;

create index if not exists pedidos_payment_method_idx on public.pedidos (payment_method);
create index if not exists pedidos_modo_intention_id_idx on public.pedidos (modo_intention_id);