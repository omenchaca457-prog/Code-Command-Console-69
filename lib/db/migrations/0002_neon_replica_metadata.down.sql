DO $rollback$
DECLARE
  metadata jsonb := current_setting('ccc.rollback_metadata')::jsonb;
BEGIN
  IF EXISTS (SELECT 1 FROM public.replica_applied_events LIMIT 1)
     OR EXISTS (SELECT 1 FROM public.replica_tombstones LIMIT 1)
     OR EXISTS (SELECT 1 FROM public.replica_bootstrap_state LIMIT 1)
     OR EXISTS (
       SELECT 1 FROM public.replica_state WHERE initialized = true
     ) THEN
    RAISE EXCEPTION 'Rollback refused: Neon replica metadata contains synchronization state';
  END IF;

  IF NOT coalesce((metadata->'indexes') ? 'replica_applied_events_applied_at_idx', false) THEN
    DROP INDEX IF EXISTS public.replica_applied_events_applied_at_idx;
  END IF;
  IF NOT coalesce((metadata->'tables') ? 'replica_tombstones', false) THEN
    DROP TABLE IF EXISTS public.replica_tombstones;
  END IF;
  IF NOT coalesce((metadata->'tables') ? 'replica_applied_events', false) THEN
    DROP TABLE IF EXISTS public.replica_applied_events;
  END IF;
  IF NOT coalesce((metadata->'tables') ? 'replica_bootstrap_state', false) THEN
    DROP TABLE IF EXISTS public.replica_bootstrap_state;
  END IF;
  IF NOT coalesce((metadata->'tables') ? 'replica_state', false) THEN
    DROP TABLE IF EXISTS public.replica_state;
  END IF;
END
$rollback$;
