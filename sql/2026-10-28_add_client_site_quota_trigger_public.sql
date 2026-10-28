BEGIN;

CREATE OR REPLACE FUNCTION public.check_client_site_limit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_plan text;
  v_status text;
  v_limit int;
  v_count int;
BEGIN
  v_user_id := NEW.user_id;
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Regular edit without owner change: return NEW early before isolation/locks so existing overlimit edits work
  IF TG_OP = 'UPDATE' AND NEW.user_id IS NOT DISTINCT FROM OLD.user_id THEN
    RETURN NEW;
  END IF;

  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'SITE_LIMIT_REQUIRES_READ_COMMITTED';
  END IF;

  -- Guaranteed per-owner advisory lock (works even if billing row doesn't exist)
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text, 20261028));

  SELECT plan, status INTO v_plan, v_status
  FROM public.billing_accounts
  WHERE user_id = v_user_id;

  v_plan := COALESCE(v_plan, 'free');
  IF v_plan NOT IN ('starter', 'pro', 'agency') THEN
    v_plan := 'free';
  END IF;
  v_status := lower(COALESCE(v_status, 'inactive'));

  IF v_status = ANY(ARRAY['active', 'trialing', 'past_due']) THEN
    IF v_plan = 'agency' THEN
      v_limit := 10;
    ELSIF v_plan IN ('pro', 'starter') THEN
      v_limit := 1;
    ELSE
      v_limit := 1;
    END IF;
  ELSE
    v_limit := 1;
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT count(*) INTO v_count
    FROM public.clients
    WHERE user_id = v_user_id;

    IF v_count >= v_limit THEN
      RAISE EXCEPTION 'SITE_QUOTA_EXCEEDED' USING ERRCODE = 'P0001';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      SELECT count(*) INTO v_count
      FROM public.clients
      WHERE user_id = NEW.user_id;

      IF v_count >= v_limit THEN
        RAISE EXCEPTION 'SITE_QUOTA_EXCEEDED' USING ERRCODE = 'P0001';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_client_site_limit ON public.clients;
CREATE TRIGGER trg_client_site_limit
  BEFORE INSERT OR UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.check_client_site_limit_trigger();

REVOKE ALL ON FUNCTION public.check_client_site_limit_trigger() FROM PUBLIC;
DO $$
DECLARE
  r text;
BEGIN
  FOR r IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.check_client_site_limit_trigger() FROM %I', r);
  END LOOP;
END $$;

COMMIT;
