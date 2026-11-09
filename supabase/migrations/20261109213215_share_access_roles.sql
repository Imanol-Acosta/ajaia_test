alter table public.document_shares
  add column access_role text not null default 'viewer'
  check (access_role in ('viewer', 'editor'));

grant insert (access_role), update (access_role) on public.document_shares to authenticated;

create policy "Owners can change shared access"
on public.document_shares for update to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy "Shared editors can edit documents"
on public.documents for update to authenticated
using (
  exists (
    select 1 from public.document_shares as share
    where share.document_id = documents.id
      and share.recipient_id = (select auth.uid())
      and share.access_role = 'editor'
  )
)
with check (
  exists (
    select 1 from public.document_shares as share
    where share.document_id = documents.id
      and share.recipient_id = (select auth.uid())
      and share.access_role = 'editor'
  )
);

-- Upsert just the role while the share's document, owner, and recipient stay fixed.
create function public.set_document_access(target_document_id uuid, target_recipient_id uuid, new_access_role text)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.document_shares (document_id, recipient_id, access_role)
  values (target_document_id, target_recipient_id, new_access_role)
  on conflict (document_id, recipient_id)
  do update set access_role = excluded.access_role;
$$;

revoke execute on function public.set_document_access(uuid, uuid, text) from public, anon;
grant execute on function public.set_document_access(uuid, uuid, text) to authenticated;
