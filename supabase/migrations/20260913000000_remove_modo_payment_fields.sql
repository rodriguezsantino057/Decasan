-- Elimina la integración MODO (removida del proyecto).
-- Conserva payment_method (usado por otros métodos de pago) y su índice.
alter table public.pedidos
  add column if not exists payment_method text,
  drop column if exists modo_intention_id,
  drop column if exists modo_payment_id;

create index if not exists pedidos_payment_method_idx on public.pedidos (payment_method);
drop index if exists pedidos_modo_intention_id_idx;