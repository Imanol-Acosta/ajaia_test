grant delete on public.documents to authenticated;

create policy "Owners can delete their documents"
on public.documents for delete to authenticated
using (owner_id = (select auth.uid()));
