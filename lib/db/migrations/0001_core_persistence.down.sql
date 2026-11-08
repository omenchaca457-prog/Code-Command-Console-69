-- Roll back only objects introduced by 0001. Never delete a populated table.
DO $rollback$
DECLARE
  metadata jsonb := current_setting('ccc.rollback_metadata')::jsonb;
  table_name text;
  table_existed boolean;
  has_rows boolean;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'conversations', 'messages', 'snippets', 'agents',
    'prompts', 'neural_events', 'simulation_logs'
  ] LOOP
    table_existed := coalesce((metadata->'tables') ? table_name, false);
    IF NOT table_existed AND to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I LIMIT 1)', table_name)
        INTO has_rows;
      IF has_rows THEN
        RAISE EXCEPTION 'Rollback refused: migration-created table % contains data; restore from a pre-migration backup instead', table_name;
      END IF;
    END IF;
  END LOOP;

  IF coalesce((metadata->'tables') ? 'snippets', false)
     AND NOT coalesce((metadata->'triggers') ? 'snippets:ccc_core_persistence_snippets_updated_at_0001', false) THEN
    DROP TRIGGER IF EXISTS ccc_core_persistence_snippets_updated_at_0001 ON public.snippets;
  END IF;
  IF coalesce((metadata->'tables') ? 'agents', false)
     AND NOT coalesce((metadata->'triggers') ? 'agents:ccc_core_persistence_agents_updated_at_0001', false) THEN
    DROP TRIGGER IF EXISTS ccc_core_persistence_agents_updated_at_0001 ON public.agents;
  END IF;

  IF NOT coalesce((metadata->'functions') ? 'ccc_core_persistence_set_updated_at_0001', false) THEN
    DROP FUNCTION IF EXISTS public.ccc_core_persistence_set_updated_at_0001();
  END IF;

  IF NOT coalesce((metadata->'indexes') ? 'messages_idempotency_key_unique', false) THEN
    DROP INDEX IF EXISTS public.messages_idempotency_key_unique;
  END IF;
  IF NOT coalesce((metadata->'indexes') ? 'messages_conversation_id_id_idx', false) THEN
    DROP INDEX IF EXISTS public.messages_conversation_id_id_idx;
  END IF;
  IF NOT coalesce((metadata->'indexes') ? 'snippets_updated_at_id_idx', false) THEN
    DROP INDEX IF EXISTS public.snippets_updated_at_id_idx;
  END IF;
  IF NOT coalesce((metadata->'indexes') ? 'agents_status_updated_at_idx', false) THEN
    DROP INDEX IF EXISTS public.agents_status_updated_at_idx;
  END IF;
  IF NOT coalesce((metadata->'indexes') ? 'prompts_agent_id_idx', false) THEN
    DROP INDEX IF EXISTS public.prompts_agent_id_idx;
  END IF;
  IF NOT coalesce((metadata->'indexes') ? 'prompts_conversation_id_idx', false) THEN
    DROP INDEX IF EXISTS public.prompts_conversation_id_idx;
  END IF;
  IF NOT coalesce((metadata->'indexes') ? 'neural_events_created_at_id_idx', false) THEN
    DROP INDEX IF EXISTS public.neural_events_created_at_id_idx;
  END IF;
  IF NOT coalesce((metadata->'indexes') ? 'simulation_logs_created_at_id_idx', false) THEN
    DROP INDEX IF EXISTS public.simulation_logs_created_at_id_idx;
  END IF;

  IF coalesce((metadata->'tables') ? 'messages', false)
     AND NOT coalesce((metadata->'constraints') ? 'messages:messages_conversation_id_fkey', false) THEN
    ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_conversation_id_fkey;
  END IF;
  IF coalesce((metadata->'tables') ? 'prompts', false)
     AND NOT coalesce((metadata->'constraints') ? 'prompts:prompts_agent_id_fkey', false) THEN
    ALTER TABLE public.prompts DROP CONSTRAINT IF EXISTS prompts_agent_id_fkey;
  END IF;
  IF coalesce((metadata->'tables') ? 'prompts', false)
     AND NOT coalesce((metadata->'constraints') ? 'prompts:prompts_conversation_id_fkey', false) THEN
    ALTER TABLE public.prompts DROP CONSTRAINT IF EXISTS prompts_conversation_id_fkey;
  END IF;

  IF coalesce((metadata->'tables') ? 'conversations', false)
     AND NOT coalesce((metadata->'constraints') ? 'conversations:conversations_pkey', false) THEN
    IF EXISTS (SELECT 1 FROM public.conversations LIMIT 1) THEN
      RAISE EXCEPTION 'Rollback refused: new primary key on populated conversations table';
    END IF;
    ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_pkey;
  END IF;
  IF coalesce((metadata->'tables') ? 'messages', false)
     AND NOT coalesce((metadata->'constraints') ? 'messages:messages_pkey', false) THEN
    IF EXISTS (SELECT 1 FROM public.messages LIMIT 1) THEN
      RAISE EXCEPTION 'Rollback refused: new primary key on populated messages table';
    END IF;
    ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_pkey;
  END IF;
  IF coalesce((metadata->'tables') ? 'agents', false)
     AND NOT coalesce((metadata->'constraints') ? 'agents:agents_pkey', false) THEN
    IF EXISTS (SELECT 1 FROM public.agents LIMIT 1) THEN
      RAISE EXCEPTION 'Rollback refused: new primary key on populated agents table';
    END IF;
    ALTER TABLE public.agents DROP CONSTRAINT IF EXISTS agents_pkey;
  END IF;
  IF coalesce((metadata->'tables') ? 'snippets', false)
     AND NOT coalesce((metadata->'constraints') ? 'snippets:snippets_pkey', false) THEN
    IF EXISTS (SELECT 1 FROM public.snippets LIMIT 1) THEN
      RAISE EXCEPTION 'Rollback refused: new primary key on populated snippets table';
    END IF;
    ALTER TABLE public.snippets DROP CONSTRAINT IF EXISTS snippets_pkey;
  END IF;
  IF coalesce((metadata->'tables') ? 'prompts', false)
     AND NOT coalesce((metadata->'constraints') ? 'prompts:prompts_pkey', false) THEN
    IF EXISTS (SELECT 1 FROM public.prompts LIMIT 1) THEN
      RAISE EXCEPTION 'Rollback refused: new primary key on populated prompts table';
    END IF;
    ALTER TABLE public.prompts DROP CONSTRAINT IF EXISTS prompts_pkey;
  END IF;
  IF coalesce((metadata->'tables') ? 'neural_events', false)
     AND NOT coalesce((metadata->'constraints') ? 'neural_events:neural_events_pkey', false) THEN
    IF EXISTS (SELECT 1 FROM public.neural_events LIMIT 1) THEN
      RAISE EXCEPTION 'Rollback refused: new primary key on populated neural_events table';
    END IF;
    ALTER TABLE public.neural_events DROP CONSTRAINT IF EXISTS neural_events_pkey;
  END IF;
  IF coalesce((metadata->'tables') ? 'simulation_logs', false)
     AND NOT coalesce((metadata->'constraints') ? 'simulation_logs:simulation_logs_pkey', false) THEN
    IF EXISTS (SELECT 1 FROM public.simulation_logs LIMIT 1) THEN
      RAISE EXCEPTION 'Rollback refused: new primary key on populated simulation_logs table';
    END IF;
    ALTER TABLE public.simulation_logs DROP CONSTRAINT IF EXISTS simulation_logs_pkey;
  END IF;

  IF coalesce((metadata->'tables') ? 'messages', false)
     AND NOT coalesce((metadata->'columns') ? 'messages.idempotency_key', false) THEN
    IF EXISTS (SELECT 1 FROM public.messages WHERE idempotency_key IS NOT NULL) THEN
      RAISE EXCEPTION 'Rollback refused: idempotency data exists in messages';
    END IF;
    ALTER TABLE public.messages DROP COLUMN IF EXISTS idempotency_key;
  END IF;

  IF coalesce((metadata->'tables') ? 'conversations', false)
     AND NOT coalesce((metadata->'defaults') ? 'conversations.id', false) THEN
    ALTER TABLE public.conversations ALTER COLUMN id DROP DEFAULT;
  END IF;
  IF coalesce((metadata->'tables') ? 'messages', false)
     AND NOT coalesce((metadata->'defaults') ? 'messages.id', false) THEN
    ALTER TABLE public.messages ALTER COLUMN id DROP DEFAULT;
  END IF;
  IF coalesce((metadata->'tables') ? 'snippets', false)
     AND NOT coalesce((metadata->'defaults') ? 'snippets.id', false) THEN
    ALTER TABLE public.snippets ALTER COLUMN id DROP DEFAULT;
  END IF;
  IF coalesce((metadata->'tables') ? 'prompts', false)
     AND NOT coalesce((metadata->'defaults') ? 'prompts.id', false) THEN
    ALTER TABLE public.prompts ALTER COLUMN id DROP DEFAULT;
  END IF;
  IF coalesce((metadata->'tables') ? 'neural_events', false)
     AND NOT coalesce((metadata->'defaults') ? 'neural_events.id', false) THEN
    ALTER TABLE public.neural_events ALTER COLUMN id DROP DEFAULT;
  END IF;
  IF coalesce((metadata->'tables') ? 'simulation_logs', false)
     AND NOT coalesce((metadata->'defaults') ? 'simulation_logs.id', false) THEN
    ALTER TABLE public.simulation_logs ALTER COLUMN id DROP DEFAULT;
  END IF;

  FOR table_name IN
    SELECT sequence_name FROM (VALUES
      ('conversations_id_seq'),
      ('messages_id_seq'),
      ('snippets_id_seq'),
      ('prompts_id_seq'),
      ('neural_events_id_seq'),
      ('simulation_logs_id_seq')
    ) AS sequences(sequence_name)
  LOOP
    IF coalesce((metadata->'sequences') ? table_name, false)
       AND coalesce((metadata->'sequence_ownership') ? (table_name || ':NONE'), false) THEN
      EXECUTE format('ALTER SEQUENCE public.%I OWNED BY NONE', table_name);
    END IF;
  END LOOP;

  IF coalesce((metadata->'tables') ? 'conversations', false)
     AND NOT coalesce((metadata->'sequences') ? 'conversations_id_seq', false) THEN
    IF EXISTS (SELECT 1 FROM public.conversations LIMIT 1) THEN
      RAISE EXCEPTION 'Rollback refused: newly-created conversation sequence is in use';
    END IF;
    DROP SEQUENCE IF EXISTS public.conversations_id_seq;
  END IF;
  IF coalesce((metadata->'tables') ? 'messages', false)
     AND NOT coalesce((metadata->'sequences') ? 'messages_id_seq', false) THEN
    IF EXISTS (SELECT 1 FROM public.messages LIMIT 1) THEN
      RAISE EXCEPTION 'Rollback refused: newly-created message sequence is in use';
    END IF;
    DROP SEQUENCE IF EXISTS public.messages_id_seq;
  END IF;
  IF coalesce((metadata->'tables') ? 'snippets', false)
     AND NOT coalesce((metadata->'sequences') ? 'snippets_id_seq', false) THEN
    IF EXISTS (SELECT 1 FROM public.snippets LIMIT 1) THEN
      RAISE EXCEPTION 'Rollback refused: newly-created snippet sequence is in use';
    END IF;
    DROP SEQUENCE IF EXISTS public.snippets_id_seq;
  END IF;
  IF coalesce((metadata->'tables') ? 'prompts', false)
     AND NOT coalesce((metadata->'sequences') ? 'prompts_id_seq', false) THEN
    IF EXISTS (SELECT 1 FROM public.prompts LIMIT 1) THEN
      RAISE EXCEPTION 'Rollback refused: newly-created prompt sequence is in use';
    END IF;
    DROP SEQUENCE IF EXISTS public.prompts_id_seq;
  END IF;
  IF coalesce((metadata->'tables') ? 'neural_events', false)
     AND NOT coalesce((metadata->'sequences') ? 'neural_events_id_seq', false) THEN
    IF EXISTS (SELECT 1 FROM public.neural_events LIMIT 1) THEN
      RAISE EXCEPTION 'Rollback refused: newly-created neural event sequence is in use';
    END IF;
    DROP SEQUENCE IF EXISTS public.neural_events_id_seq;
  END IF;
  IF coalesce((metadata->'tables') ? 'simulation_logs', false)
     AND NOT coalesce((metadata->'sequences') ? 'simulation_logs_id_seq', false) THEN
    IF EXISTS (SELECT 1 FROM public.simulation_logs LIMIT 1) THEN
      RAISE EXCEPTION 'Rollback refused: newly-created simulation sequence is in use';
    END IF;
    DROP SEQUENCE IF EXISTS public.simulation_logs_id_seq;
  END IF;

  IF NOT coalesce((metadata->'tables') ? 'prompts', false) THEN
    DROP TABLE IF EXISTS public.prompts;
  END IF;
  IF NOT coalesce((metadata->'tables') ? 'messages', false) THEN
    DROP TABLE IF EXISTS public.messages;
  END IF;
  IF NOT coalesce((metadata->'tables') ? 'simulation_logs', false) THEN
    DROP TABLE IF EXISTS public.simulation_logs;
  END IF;
  IF NOT coalesce((metadata->'tables') ? 'neural_events', false) THEN
    DROP TABLE IF EXISTS public.neural_events;
  END IF;
  IF NOT coalesce((metadata->'tables') ? 'snippets', false) THEN
    DROP TABLE IF EXISTS public.snippets;
  END IF;
  IF NOT coalesce((metadata->'tables') ? 'agents', false) THEN
    DROP TABLE IF EXISTS public.agents;
  END IF;
  IF NOT coalesce((metadata->'tables') ? 'conversations', false) THEN
    DROP TABLE IF EXISTS public.conversations;
  END IF;
END
$rollback$;
