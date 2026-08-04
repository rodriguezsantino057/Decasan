CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, nombre, dni, telefono)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', ''),
    nullif(new.raw_user_meta_data->>'dni', ''),
    nullif(new.raw_user_meta_data->>'telefono', '')
  );
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  return new;
end;
$function$;