create table public.demo_people (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80)
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  content jsonb not null check (
    content @> '{"type":"doc"}' and octet_length(content::text) <= 4194304
  ),
  revision integer not null default 1,
  updated_at timestamptz not null default now(),
  unique (id, owner_id)
);

create table public.document_shares (
  document_id uuid not null,
  owner_id uuid not null default auth.uid(),
  recipient_id uuid not null references public.demo_people (id) on delete cascade,
  primary key (document_id, recipient_id),
  -- Tie the grant to the real owner without querying back through document RLS.
  foreign key (document_id, owner_id) references public.documents (id, owner_id) on delete cascade,
  check (owner_id <> recipient_id)
);

create index documents_owner_id_idx on public.documents (owner_id);
create index document_shares_recipient_id_idx on public.document_shares (recipient_id, document_id);

create function public.folio_bump_document_revision() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.revision := old.revision + 1;
  new.updated_at := pg_catalog.clock_timestamp();
  return new;
end;
$$;

revoke execute on function public.folio_bump_document_revision() from public, anon, authenticated;

create trigger folio_document_revision
before update on public.documents
for each row execute function public.folio_bump_document_revision();

alter table public.demo_people enable row level security;
alter table public.documents enable row level security;
alter table public.document_shares enable row level security;

revoke all on public.demo_people, public.documents, public.document_shares from public, anon, authenticated;
grant select on public.demo_people, public.documents, public.document_shares to authenticated;
grant insert (id, title, content), update (title, content) on public.documents to authenticated;
grant insert (document_id, recipient_id) on public.document_shares to authenticated;
grant select, insert, update on public.demo_people to service_role;

create policy "Signed-in users can read the demo directory"
on public.demo_people for select to authenticated using (true);

create policy "Owners and recipients can read documents"
on public.documents for select to authenticated
using (
  owner_id = (select auth.uid())
  or exists (
    select 1 from public.document_shares as share
    where share.document_id = documents.id
      and share.recipient_id = (select auth.uid())
  )
);

create policy "Users can create their own documents"
on public.documents for insert to authenticated
with check (owner_id = (select auth.uid()));

create policy "Owners can edit their documents"
on public.documents for update to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy "Owners and recipients can read their grants"
on public.document_shares for select to authenticated
using (owner_id = (select auth.uid()) or recipient_id = (select auth.uid()));

create policy "Owners can share their documents"
on public.document_shares for insert to authenticated
with check (owner_id = (select auth.uid()));
