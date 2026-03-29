alter table public.clients
add column if not exists approval_status text,
add column if not exists approval_notes text,
add column if not exists approved_at timestamp with time zone,
add column if not exists approved_by_user_id uuid;

update public.clients
set
  approval_status = coalesce(approval_status, 'approved'),
  approved_at = case
    when coalesce(approval_status, 'approved') = 'approved'
      then coalesce(approved_at, now())
    else approved_at
  end
where approval_status is null;

alter table public.clients
alter column approval_status set default 'pending';

update public.clients
set approval_status = 'pending'
where approval_status not in ('pending', 'approved');

alter table public.clients
alter column approval_status set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'clients_approval_status_check'
  ) then
    alter table public.clients
    add constraint clients_approval_status_check
    check (approval_status in ('pending', 'approved'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'clients_approved_by_user_id_fkey'
  ) then
    alter table public.clients
    add constraint clients_approved_by_user_id_fkey
    foreign key (approved_by_user_id)
    references auth.users (id)
    on delete set null;
  end if;
end $$;
