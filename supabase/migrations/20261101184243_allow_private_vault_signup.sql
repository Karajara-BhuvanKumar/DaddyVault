alter table public.vault_owners drop constraint vault_owners_singleton_key;
grant insert on public.vault_owners to authenticated;
create policy users_create_own_vault on public.vault_owners for insert to authenticated
with check (user_id=(select auth.uid()) and coalesce((select auth.jwt()->>'is_anonymous'),'false')='false');
