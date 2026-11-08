CREATE TABLE IF NOT EXISTS public.replication_control (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  enabled boolean NOT NULL DEFAULT false,
  initialized_at timestamptz,
  last_success_at timestamptz,
  last_event_id bigint,
  last_error_code text,
  pending_count integer NOT NULL DEFAULT 0 CHECK (pending_count >= 0),
  needs_rebaseline boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.replication_control (singleton, enabled)
VALUES (true, false)
ON CONFLICT (singleton) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.replication_outbox (
  id bigserial PRIMARY KEY,
  event_id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  table_name text NOT NULL CHECK (table_name IN (
    'conversations', 'agents', 'messages', 'prompts',
    'snippets', 'neural_events', 'simulation_logs'
  )),
  record_key text NOT NULL,
  operation text NOT NULL CHECK (operation IN ('upsert', 'delete')),
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  last_error_code text
);

CREATE INDEX IF NOT EXISTS replication_outbox_pending_idx
  ON public.replication_outbox (next_attempt_at, id)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS replication_outbox_failed_idx
  ON public.replication_outbox (created_at, id)
  WHERE status = 'failed';

CREATE OR REPLACE FUNCTION public.ccc_capture_replication_event()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  old_payload jsonb;
  new_payload jsonb;
  old_key text;
  new_key text;
  required_events integer := 1;
  reserved_events integer;
BEGIN
  IF current_setting('ccc_replication_apply', true) = '1' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_OP <> 'INSERT' THEN
    old_payload := to_jsonb(OLD);
    old_key := old_payload->>'id';
  END IF;
  IF TG_OP <> 'DELETE' THEN
    new_payload := to_jsonb(NEW);
    new_key := new_payload->>'id';
  END IF;
  IF TG_OP = 'UPDATE' AND old_key IS DISTINCT FROM new_key THEN
    required_events := 2;
  END IF;

  UPDATE public.replication_control
  SET pending_count = pending_count + required_events, updated_at = now()
  WHERE singleton = true
    AND enabled = true
    AND pending_count + required_events <= 100000;
  GET DIAGNOSTICS reserved_events = ROW_COUNT;
  IF reserved_events = 0 THEN
    UPDATE public.replication_control
    SET enabled = false,
        needs_rebaseline = true,
        last_error_code = 'outbox_limit_reached',
        updated_at = now()
    WHERE singleton = true
      AND enabled = true
      AND pending_count + required_events > 100000;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE'
     OR (TG_OP = 'UPDATE' AND old_key IS DISTINCT FROM new_key) THEN
    INSERT INTO public.replication_outbox
      (table_name, record_key, operation, payload)
    VALUES (TG_TABLE_NAME, old_key, 'delete', old_payload);
  END IF;

  IF TG_OP <> 'DELETE' THEN
    INSERT INTO public.replication_outbox
      (table_name, record_key, operation, payload)
    VALUES (TG_TABLE_NAME, new_key, 'upsert', new_payload);
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION public.ccc_guard_replication_truncate()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.replication_control
    WHERE singleton = true AND enabled = true
  ) THEN
    RAISE EXCEPTION 'TRUNCATE is disabled for replicated tables; use DELETE to emit tombstones';
  END IF;
  RETURN NULL;
END
$function$;

DO $replication_triggers$
DECLARE
  item record;
BEGIN
  FOR item IN
    SELECT * FROM (VALUES
      ('conversations', 'conversations_replication_outbox_trg'),
      ('agents', 'agents_replication_outbox_trg'),
      ('messages', 'messages_replication_outbox_trg'),
      ('prompts', 'prompts_replication_outbox_trg'),
      ('snippets', 'snippets_replication_outbox_trg'),
      ('neural_events', 'neural_events_replication_outbox_trg'),
      ('simulation_logs', 'simulation_logs_replication_outbox_trg')
    ) AS triggers(table_name, trigger_name)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgrelid = format('public.%I', item.table_name)::regclass
        AND tgname = item.trigger_name
        AND NOT tgisinternal
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.ccc_capture_replication_event()',
        item.trigger_name, item.table_name
      );
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgrelid = format('public.%I', item.table_name)::regclass
        AND tgname = item.table_name || '_replication_truncate_guard_trg'
        AND NOT tgisinternal
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER %I BEFORE TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.ccc_guard_replication_truncate()',
        item.table_name || '_replication_truncate_guard_trg',
        item.table_name
      );
    END IF;
  END LOOP;
END
$replication_triggers$;
