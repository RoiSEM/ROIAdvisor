alter table public.reports
add column if not exists channel_performance jsonb,
add column if not exists landing_page_performance jsonb,
add column if not exists device_performance jsonb;

alter table public.clients
add column if not exists technical_issues text,
add column if not exists design_concerns text,
add column if not exists ad_channel_notes text,
add column if not exists offer_message_concerns text,
add column if not exists tracking_notes text;
