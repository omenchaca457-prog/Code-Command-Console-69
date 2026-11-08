-- Additive migration. No historical success/failure outcomes are inferred.
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS successful_tasks integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failed_tasks integer NOT NULL DEFAULT 0;
