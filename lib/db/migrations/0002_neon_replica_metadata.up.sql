CREATE TABLE IF NOT EXISTS public.replica_applied_events (
  event_id uuid PRIMARY KEY,
  table_name text NOT NULL,
  record_key text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.replica_tombstones (
  table_name text NOT NULL,
  record_key text NOT NULL,
  event_id uuid NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (table_name, record_key)
);

CREATE TABLE IF NOT EXISTS public.replica_bootstrap_state (
  table_name text PRIMARY KEY,
  row_count bigint NOT NULL CHECK (row_count >= 0),
  checksum text NOT NULL,
  source_event_id bigint,
  initialized_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.replica_state (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  initialized boolean NOT NULL DEFAULT false,
  initialized_at timestamptz,
  last_event_id bigint,
  last_success_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.replica_state (singleton, initialized)
VALUES (true, false)
ON CONFLICT (singleton) DO NOTHING;

CREATE INDEX IF NOT EXISTS replica_applied_events_applied_at_idx
  ON public.replica_applied_events (applied_at);
