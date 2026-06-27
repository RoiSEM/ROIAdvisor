alter table public.billing_accounts
enable row level security;

drop policy if exists "Users can view their own billing account"
on public.billing_accounts;

create policy "Users can view their own billing account"
on public.billing_accounts
for select
to authenticated
using (auth.uid() = user_id);

