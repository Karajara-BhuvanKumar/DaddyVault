create table public.vault_owners (
 user_id uuid primary key references auth.users(id) on delete cascade,
 singleton boolean not null default true unique check(singleton)
);
alter table public.vault_owners enable row level security;
revoke all on public.vault_owners from anon,authenticated;
grant select on public.vault_owners to authenticated;
create policy owner_reads_membership on public.vault_owners for select to authenticated using(user_id=(select auth.uid()));
create table public.vault_workspaces (
 user_id uuid primary key references public.vault_owners(user_id) on delete cascade,
 payload jsonb not null check(jsonb_typeof(payload)='object' and payload->>'version'='2' and payload->>'demo'='false'),
 revision bigint not null default 1 check(revision>0),
 updated_at timestamptz not null default now()
);
alter table public.vault_workspaces enable row level security;
revoke all on public.vault_workspaces from anon,authenticated;
grant select,insert,update on public.vault_workspaces to authenticated;
create policy owner_reads_workspace on public.vault_workspaces for select to authenticated using(user_id=(select auth.uid()));
create policy owner_creates_workspace on public.vault_workspaces for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.vault_owners where user_id=(select auth.uid())));
create policy owner_updates_workspace on public.vault_workspaces for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create table public.vault_revisions (
 user_id uuid not null references public.vault_owners(user_id) on delete cascade,
 revision bigint not null,
 payload jsonb not null,
 saved_at timestamptz not null default now(),
 primary key(user_id,revision)
);
alter table public.vault_revisions enable row level security;
revoke all on public.vault_revisions from anon,authenticated;
grant select,insert,delete on public.vault_revisions to authenticated;
create policy owner_reads_revisions on public.vault_revisions for select to authenticated using(user_id=(select auth.uid()));
create policy owner_inserts_revisions on public.vault_revisions for insert to authenticated with check(user_id=(select auth.uid()));
create policy owner_prunes_revisions on public.vault_revisions for delete to authenticated using(user_id=(select auth.uid()));
create function public.save_vault(p_state jsonb,p_revision bigint) returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_user uuid:=auth.uid(); v_row public.vault_workspaces; 
begin
 if v_user is null or not exists(select 1 from public.vault_owners where user_id=v_user) then raise exception 'Owner access required' using errcode='42501'; end if;
 if p_revision is null or p_revision<0 or p_state is null or octet_length(p_state::text)>4000000 or p_state->>'version' is distinct from '2' or p_state->>'demo' is distinct from 'false' then raise exception 'Invalid workspace' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_user::text,0));
 select * into v_row from public.vault_workspaces where user_id=v_user for update;
 if coalesce(v_row.revision,0)<>p_revision then raise exception 'Another device saved newer records. Reload saved data before retrying.' using errcode='40001'; end if;
 insert into public.vault_workspaces(user_id,payload,revision) values(v_user,p_state,p_revision+1)
 on conflict(user_id) do update set payload=excluded.payload,revision=excluded.revision,updated_at=now() returning * into v_row;
 insert into public.vault_revisions(user_id,revision,payload) values(v_user,v_row.revision,p_state);
 delete from public.vault_revisions where user_id=v_user and revision<v_row.revision-29;
 return jsonb_build_object('state',v_row.payload,'revision',v_row.revision,'updatedAt',v_row.updated_at);
end $$;
revoke all on function public.save_vault(jsonb,bigint) from public,anon;
grant execute on function public.save_vault(jsonb,bigint) to authenticated;
