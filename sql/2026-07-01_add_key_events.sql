alter table public.clients
add column if not exists key_events text[];

alter table public.reports
add column if not exists key_event_performance jsonb;
