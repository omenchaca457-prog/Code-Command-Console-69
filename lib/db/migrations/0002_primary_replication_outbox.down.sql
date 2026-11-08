DO $rollback$
DECLARE
  metadata jsonb := current_setting('ccc.rollback_metadata')::jsonb;
  item record;
BEGIN
  IF to_regclass('public.replication_outbox') IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.replication_outbox LIMIT 1) THEN
    RAISE EXCEPTION 'Rollback refused: replication outbox contains events';
  END IF;
  IF to_regclass('public.replication_control') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.replication_control
       WHERE enabled = true OR initialized_at IS NOT NULL
         OR pending_count > 0 OR needs_rebaseline = true
     ) THEN
    RAISE EXCEPTION 'Rollback refused: replication has been initialized or enabled';
  END IF;

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
    IF NOT coalesce(
      (metadata->'triggers') ? (item.table_name || ':' || item.trigger_name),
      false
    ) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I',
        item.trigger_name, item.table_name);
    END IF;
    IF NOT coalesce(
      (metadata->'triggers') ? (
        item.table_name || ':' || item.table_name || '_replication_truncate_guard_trg'
      ),
      false
    ) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I',
        item.table_name || '_replication_truncate_guard_trg', item.table_name);
    END IF;
  END LOOP;

  IF NOT coalesce((metadata->'functions') ? 'ccc_capture_replication_event', false) THEN
    DROP FUNCTION IF EXISTS public.ccc_capture_replication_event();
  END IF;
  IF NOT coalesce((metadata->'functions') ? 'ccc_guard_replication_truncate', false) THEN
    DROP FUNCTION IF EXISTS public.ccc_guard_replication_truncate();
  END IF;
  IF NOT coalesce((metadata->'indexes') ? 'replication_outbox_pending_idx', false) THEN
    DROP INDEX IF EXISTS public.replication_outbox_pending_idx;
  END IF;
  IF NOT coalesce((metadata->'indexes') ? 'replication_outbox_failed_idx', false) THEN
    DROP INDEX IF EXISTS public.replication_outbox_failed_idx;
  END IF;
  IF NOT coalesce((metadata->'tables') ? 'replication_outbox', false) THEN
    DROP TABLE IF EXISTS public.replication_outbox;
  END IF;
  IF NOT coalesce((metadata->'tables') ? 'replication_control', false) THEN
    DROP TABLE IF EXISTS public.replication_control;
  END IF;
END
$rollback$;
