alter table public.pedidos
  add column if not exists confirmation_email_sent_at timestamptz;
