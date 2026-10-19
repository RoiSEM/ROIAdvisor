BEGIN;
LOCK TABLE convert_staging.reports IN SHARE ROW EXCLUSIVE MODE;
CREATE TABLE IF NOT EXISTS convert_staging.report_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL UNIQUE,
  client_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  period_start timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

INSERT INTO convert_staging.report_ledger(report_id,client_id,owner_id,period_start,created_at)
SELECT r.id,r.client_id,c.user_id,date_trunc('month',COALESCE(r.created_at,now()) AT TIME ZONE 'UTC') AT TIME ZONE 'UTC',COALESCE(r.created_at,now())
FROM convert_staging.reports r JOIN convert_staging.clients c ON c.id=r.client_id
ON CONFLICT(report_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS convert_staging.operational_guards (
  actor_id text PRIMARY KEY,
  lease_id uuid,
  operation text,
  acquired_at timestamp with time zone,
  expires_at timestamp with time zone,
  window_start timestamp with time zone,
  request_count int DEFAULT 0
);

CREATE OR REPLACE FUNCTION convert_staging.acquire_operational_guard(p_actor_id text, p_operation text, p_now_ms bigint)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_lease_id uuid := gen_random_uuid();
  v_now timestamptz := clock_timestamp();
  v_window_start timestamptz;
  v_request_count int;
  v_expires_at timestamptz := v_now + interval '180 seconds';
  v_existing_lease uuid;
  v_existing_expires timestamptz;
BEGIN
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'USAGE_REQUIRES_READ_COMMITTED';
  END IF;
  IF p_actor_id IS NULL OR p_actor_id = '' OR p_operation IS NULL OR p_operation NOT IN ('report','ai','sync') THEN
    RAISE EXCEPTION 'INVALID_USAGE_OPERATION';
  END IF;
  INSERT INTO convert_staging.operational_guards(actor_id,request_count)
  VALUES(p_actor_id,0) ON CONFLICT(actor_id) DO NOTHING;
  SELECT window_start, request_count, lease_id, expires_at
  INTO v_window_start, v_request_count, v_existing_lease, v_existing_expires
  FROM convert_staging.operational_guards
  WHERE actor_id = p_actor_id
  FOR UPDATE;

  -- Refresh after waiting for the row lock. Admission and expiry use DB time,
  -- never p_now_ms (retained only as a legacy transport argument).
  v_now := clock_timestamp();
  v_expires_at := v_now + interval '180 seconds';

  IF v_existing_lease IS NOT NULL AND v_existing_expires > v_now THEN
    RETURN NULL;
  END IF;

  IF v_window_start IS NULL OR v_window_start + interval '60 seconds' <= v_now THEN
    v_window_start := v_now;
    v_request_count := 0;
  END IF;

  IF v_request_count >= 10 THEN
    RETURN NULL;
  END IF;

  UPDATE convert_staging.operational_guards
  SET lease_id = v_lease_id,
      operation = p_operation,
      acquired_at = v_now,
      expires_at = v_expires_at,
      window_start = v_window_start,
      request_count = v_request_count + 1
  WHERE actor_id = p_actor_id;

  RETURN v_lease_id;
END;
$$;

CREATE OR REPLACE FUNCTION convert_staging.release_operational_guard(p_actor_id text, p_lease_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  UPDATE convert_staging.operational_guards
  SET lease_id = NULL, operation = NULL, acquired_at = NULL, expires_at = NULL
  WHERE actor_id = p_actor_id AND lease_id = p_lease_id;
END;
$$;

CREATE OR REPLACE FUNCTION convert_staging.check_report_quota_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_client_id uuid := NEW.client_id;
  v_user_id uuid;
  v_plan text;
  v_status text;
  v_period_start timestamptz;
  v_used int;
  v_created_at timestamptz := clock_timestamp();
BEGIN
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'USAGE_REQUIRES_READ_COMMITTED';
  END IF;
  v_period_start := date_trunc('month', v_created_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';

  SELECT user_id INTO v_user_id
  FROM convert_staging.clients
  WHERE id = v_client_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Client not found' USING ERRCODE = 'P0001';
  END IF;

  SELECT plan, status INTO v_plan, v_status
  FROM convert_staging.billing_accounts
  WHERE user_id = v_user_id;

  v_plan := COALESCE(v_plan, 'free');
  v_status := COALESCE(v_status, 'inactive');

  IF NOT (
    (v_plan IN ('pro', 'agency')) AND
    (lower(v_status) = ANY(ARRAY['active', 'trialing', 'past_due']))
  ) THEN
    SELECT count(*) INTO v_used
    FROM convert_staging.report_ledger
    WHERE client_id = v_client_id AND period_start = v_period_start;

    IF v_used >= 3 THEN
      RAISE EXCEPTION 'REPORT_QUOTA_EXCEEDED' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  INSERT INTO convert_staging.report_ledger (report_id, client_id, owner_id, period_start, created_at)
  VALUES (NEW.id, v_client_id, v_user_id, v_period_start, v_created_at);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_report_quota ON convert_staging.reports;
CREATE TRIGGER trg_report_quota
  BEFORE INSERT ON convert_staging.reports
  FOR EACH ROW
  EXECUTE FUNCTION convert_staging.check_report_quota_trigger();

CREATE INDEX IF NOT EXISTS report_ledger_client_period_idx ON convert_staging.report_ledger(client_id,period_start);
CREATE OR REPLACE FUNCTION convert_staging.get_report_allowance(p_client_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog, pg_temp AS $allowance$
DECLARE v_owner uuid; v_plan text; v_status text; v_used integer; v_limit integer;
BEGIN
  SELECT user_id INTO v_owner FROM convert_staging.clients WHERE id=p_client_id;
  IF NOT FOUND OR v_owner IS NULL THEN RAISE EXCEPTION 'USAGE_CLIENT_UNAVAILABLE'; END IF;
  SELECT plan,status INTO v_plan,v_status FROM convert_staging.billing_accounts WHERE user_id=v_owner;
  v_limit := CASE WHEN COALESCE(v_plan,'free') IN ('pro','agency') AND lower(COALESCE(v_status,'')) IN ('active','trialing','past_due') THEN NULL ELSE 3 END;
  SELECT count(*)::integer INTO v_used FROM convert_staging.report_ledger
  WHERE client_id=p_client_id AND period_start=(date_trunc('month',clock_timestamp() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC');
  RETURN jsonb_build_object('used',v_used,'limit',v_limit,'remaining',CASE WHEN v_limit IS NULL THEN NULL ELSE greatest(v_limit-v_used,0) END);
END
$allowance$;

-- Revoke PUBLIC independently: missing optional roles must not cancel revocation.
ALTER TABLE convert_staging.report_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE convert_staging.operational_guards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON convert_staging.report_ledger, convert_staging.operational_guards FROM PUBLIC;
REVOKE ALL ON FUNCTION convert_staging.acquire_operational_guard(text,text,bigint), convert_staging.release_operational_guard(text,uuid), convert_staging.check_report_quota_trigger(),convert_staging.get_report_allowance(uuid) FROM PUBLIC;
DO $permissions$
DECLARE role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=role_name) THEN
      EXECUTE format('REVOKE ALL ON convert_staging.report_ledger,convert_staging.operational_guards FROM %I',role_name);
      EXECUTE format('REVOKE ALL ON FUNCTION convert_staging.acquire_operational_guard(text,text,bigint),convert_staging.release_operational_guard(text,uuid),convert_staging.check_report_quota_trigger(),convert_staging.get_report_allowance(uuid) FROM %I',role_name);
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='service_role') THEN
    GRANT USAGE ON SCHEMA convert_staging TO service_role;
    GRANT EXECUTE ON FUNCTION convert_staging.acquire_operational_guard(text,text,bigint),convert_staging.release_operational_guard(text,uuid),convert_staging.get_report_allowance(uuid) TO service_role;
  END IF;
END
$permissions$;
COMMIT;
