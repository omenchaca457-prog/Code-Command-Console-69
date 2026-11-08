-- Additive baseline for CCC persistence. The migration runner wraps this file
-- in a transaction and records its checksum before reporting success.
CREATE TABLE IF NOT EXISTS public.conversations (
  id serial PRIMARY KEY,
  title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.messages (
  id serial PRIMARY KEY,
  conversation_id integer NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.snippets (
  id serial PRIMARY KEY,
  title text NOT NULL,
  code text NOT NULL,
  language text NOT NULL,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  last_run_at timestamp without time zone
);

CREATE TABLE IF NOT EXISTS public.agents (
  id text PRIMARY KEY,
  name text NOT NULL,
  xp integer NOT NULL DEFAULT 0,
  failed_analyses integer NOT NULL DEFAULT 0,
  successful_tasks integer NOT NULL DEFAULT 0,
  failed_tasks integer NOT NULL DEFAULT 0,
  last_omega double precision,
  last_failure text,
  status text NOT NULL DEFAULT 'idle',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.prompts (
  id serial PRIMARY KEY,
  agent_id text,
  conversation_id integer,
  name text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.neural_events (
  id serial PRIMARY KEY,
  origin text NOT NULL,
  event_type text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.simulation_logs (
  id serial PRIMARY KEY,
  vector text NOT NULL,
  coherence double precision NOT NULL,
  turbulence text NOT NULL,
  vectors_processed integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- The supplied backup predates the idempotency key column. It is nullable so
-- all existing backup rows remain valid and unchanged.
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS idempotency_key text;

-- Recreate missing legacy sequences/defaults without resetting existing data.
CREATE SEQUENCE IF NOT EXISTS public.conversations_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.messages_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.snippets_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.prompts_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.neural_events_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.simulation_logs_id_seq;

DO $ownership$
DECLARE
  item record;
  sequence_oid oid;
  table_oid oid;
  id_attnum smallint;
BEGIN
  FOR item IN
    SELECT * FROM (VALUES
      ('conversations', 'conversations_id_seq'),
      ('messages', 'messages_id_seq'),
      ('snippets', 'snippets_id_seq'),
      ('prompts', 'prompts_id_seq'),
      ('neural_events', 'neural_events_id_seq'),
      ('simulation_logs', 'simulation_logs_id_seq')
    ) AS ids(table_name, sequence_name)
  LOOP
    sequence_oid := to_regclass(format('public.%I', item.sequence_name));
    table_oid := to_regclass(format('public.%I', item.table_name));
    SELECT attnum INTO id_attnum
    FROM pg_attribute
    WHERE attrelid = table_oid AND attname = 'id' AND NOT attisdropped;

    IF EXISTS (
      SELECT 1 FROM pg_depend
      WHERE classid = 'pg_class'::regclass
        AND objid = sequence_oid
        AND refclassid = 'pg_class'::regclass
        AND refobjid = table_oid
        AND refobjsubid = id_attnum
        AND deptype IN ('a', 'i')
    ) THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM pg_depend
      WHERE classid = 'pg_class'::regclass
        AND objid = sequence_oid
        AND deptype IN ('a', 'i')
    ) THEN
      RAISE EXCEPTION 'Migration refused: sequence ownership conflicts for %', item.sequence_name;
    END IF;

    EXECUTE format(
      'ALTER SEQUENCE public.%I OWNED BY public.%I.id',
      item.sequence_name, item.table_name
    );
  END LOOP;
END
$ownership$;

DO $defaults$
DECLARE
  item record;
  existing_default text;
BEGIN
  FOR item IN
    SELECT * FROM (VALUES
      ('conversations', 'conversations_id_seq'),
      ('messages', 'messages_id_seq'),
      ('snippets', 'snippets_id_seq'),
      ('prompts', 'prompts_id_seq'),
      ('neural_events', 'neural_events_id_seq'),
      ('simulation_logs', 'simulation_logs_id_seq')
    ) AS ids(table_name, sequence_name)
  LOOP
    SELECT column_default INTO existing_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = item.table_name
      AND column_name = 'id';
    IF existing_default IS NULL THEN
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN id SET DEFAULT nextval(%L::regclass)',
        item.table_name, 'public.' || item.sequence_name
      );
    END IF;
  END LOOP;
END
$defaults$;

DO $sequences$
DECLARE
  item record;
  max_id bigint;
  sequence_last_value bigint;
  sequence_called boolean;
BEGIN
  FOR item IN
    SELECT * FROM (VALUES
      ('conversations', 'conversations_id_seq'),
      ('messages', 'messages_id_seq'),
      ('snippets', 'snippets_id_seq'),
      ('prompts', 'prompts_id_seq'),
      ('neural_events', 'neural_events_id_seq'),
      ('simulation_logs', 'simulation_logs_id_seq')
    ) AS ids(table_name, sequence_name)
  LOOP
    EXECUTE format('SELECT MAX(id) FROM public.%I', item.table_name)
      INTO max_id;
    EXECUTE format(
      'SELECT last_value, is_called FROM public.%I',
      item.sequence_name
    ) INTO sequence_last_value, sequence_called;

    -- Never move a populated sequence backwards. Only advance a missing or
    -- stale sequence far enough to avoid reusing an existing primary key.
    IF max_id IS NOT NULL
       AND (sequence_last_value < max_id
         OR (sequence_last_value = max_id AND NOT sequence_called)) THEN
      PERFORM setval(
        format('public.%I', item.sequence_name)::regclass,
        GREATEST(max_id, 1),
        true
      );
    END IF;
  END LOOP;
END
$sequences$;

DO $migration$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'conversations', 'messages', 'snippets', 'agents', 'prompts',
    'neural_events', 'simulation_logs'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = format('public.%I', table_name)::regclass
        AND contype = 'p'
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I PRIMARY KEY (id)',
        table_name, table_name || '_pkey'
      );
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.messages'::regclass
      AND confrelid = 'public.conversations'::regclass
      AND contype = 'f'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM public.messages m
      LEFT JOIN public.conversations c ON c.id = m.conversation_id
      WHERE c.id IS NULL
    ) THEN
      RAISE EXCEPTION 'Migration refused: orphaned messages reference missing conversations';
    END IF;
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_conversation_id_fkey
      FOREIGN KEY (conversation_id) REFERENCES public.conversations(id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.prompts'::regclass
      AND confrelid = 'public.agents'::regclass
      AND contype = 'f'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM public.prompts p
      LEFT JOIN public.agents a ON a.id = p.agent_id
      WHERE p.agent_id IS NOT NULL AND a.id IS NULL
    ) THEN
      RAISE EXCEPTION 'Migration refused: orphaned prompts reference missing agents';
    END IF;
    ALTER TABLE public.prompts
      ADD CONSTRAINT prompts_agent_id_fkey
      FOREIGN KEY (agent_id) REFERENCES public.agents(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.prompts'::regclass
      AND confrelid = 'public.conversations'::regclass
      AND contype = 'f'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM public.prompts p
      LEFT JOIN public.conversations c ON c.id = p.conversation_id
      WHERE p.conversation_id IS NOT NULL AND c.id IS NULL
    ) THEN
      RAISE EXCEPTION 'Migration refused: orphaned prompts reference missing conversations';
    END IF;
    ALTER TABLE public.prompts
      ADD CONSTRAINT prompts_conversation_id_fkey
      FOREIGN KEY (conversation_id) REFERENCES public.conversations(id)
      ON DELETE SET NULL;
  END IF;
END
$migration$;

CREATE UNIQUE INDEX IF NOT EXISTS messages_idempotency_key_unique
  ON public.messages (idempotency_key);
CREATE INDEX IF NOT EXISTS messages_conversation_id_id_idx
  ON public.messages (conversation_id, id);
CREATE INDEX IF NOT EXISTS snippets_updated_at_id_idx
  ON public.snippets (updated_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS agents_status_updated_at_idx
  ON public.agents (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS prompts_agent_id_idx
  ON public.prompts (agent_id);
CREATE INDEX IF NOT EXISTS prompts_conversation_id_idx
  ON public.prompts (conversation_id);
CREATE INDEX IF NOT EXISTS neural_events_created_at_id_idx
  ON public.neural_events (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS simulation_logs_created_at_id_idx
  ON public.simulation_logs (created_at DESC, id DESC);

DO $function$
DECLARE
  existing_definition text;
BEGIN
  SELECT pg_get_functiondef(
    to_regprocedure('public.ccc_core_persistence_set_updated_at_0001()')
  ) INTO existing_definition;
  IF existing_definition IS NOT NULL THEN
    IF position('NEW.updated_at' IN existing_definition) = 0 THEN
      RAISE EXCEPTION 'Migration refused: updated_at function name is already used';
    END IF;
  ELSE
    EXECUTE $create$
      CREATE FUNCTION public.ccc_core_persistence_set_updated_at_0001()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $body$
      BEGIN
        IF current_setting('ccc_replication_apply', true) = '1' THEN
          RETURN NEW;
        END IF;
        NEW.updated_at := now();
        RETURN NEW;
      END
      $body$
    $create$;
  END IF;
END
$function$;

DO $triggers$
DECLARE
  trigger_function oid :=
    to_regprocedure('public.ccc_core_persistence_set_updated_at_0001()');
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.snippets'::regclass
      AND tgname = 'ccc_core_persistence_snippets_updated_at_0001'
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER ccc_core_persistence_snippets_updated_at_0001
      BEFORE UPDATE ON public.snippets
      FOR EACH ROW EXECUTE FUNCTION public.ccc_core_persistence_set_updated_at_0001();
  ELSIF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.snippets'::regclass
      AND tgname = 'ccc_core_persistence_snippets_updated_at_0001'
      AND tgfoid <> trigger_function
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'Migration refused: snippets updated_at trigger has a conflicting definition';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.agents'::regclass
      AND tgname = 'ccc_core_persistence_agents_updated_at_0001'
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER ccc_core_persistence_agents_updated_at_0001
      BEFORE UPDATE ON public.agents
      FOR EACH ROW EXECUTE FUNCTION public.ccc_core_persistence_set_updated_at_0001();
  ELSIF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.agents'::regclass
      AND tgname = 'ccc_core_persistence_agents_updated_at_0001'
      AND tgfoid <> trigger_function
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'Migration refused: agents updated_at trigger has a conflicting definition';
  END IF;
END
$triggers$;
