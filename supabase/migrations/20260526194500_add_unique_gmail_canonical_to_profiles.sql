alter table public.profiles
  add column if not exists email_canonical text;

create or replace function public.canonical_gmail(email text)
returns text
language sql
immutable
as $$
  select case
    when email is null then null
    when lower(split_part(email, '@', 2)) <> 'gmail.com' then null
    else regexp_replace(split_part(lower(split_part(email, '@', 1)), '+', 1), '\.', '', 'g') || '@gmail.com'
  end
$$;

with ranked as (
  select
    u.id,
    public.canonical_gmail(u.email) as canonical,
    row_number() over (
      partition by public.canonical_gmail(u.email)
      order by u.created_at asc, u.id asc
    ) as rn
  from auth.users u
  where public.canonical_gmail(u.email) is not null
)
update public.profiles p
set email_canonical = case when ranked.rn = 1 then ranked.canonical else null end
from ranked
where ranked.id = p.id
  and p.email_canonical is distinct from case when ranked.rn = 1 then ranked.canonical else null end;

create unique index if not exists profiles_email_canonical_unique
  on public.profiles (email_canonical)
  where email_canonical is not null;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nombre, email_canonical)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', ''),
    public.canonical_gmail(new.email)
  );
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  return new;
end; $$;
