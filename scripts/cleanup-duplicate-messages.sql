\set ON_ERROR_STOP on
\if :{?execute}
\else
\set execute false
\endif

BEGIN;

CREATE TEMP TABLE duplicate_message_ids ON COMMIT DROP AS
WITH ordered AS (
  SELECT
    id,
    conversation_id,
    role,
    content,
    created_at,
    LAG(created_at) OVER (
      PARTITION BY conversation_id, role, content
      ORDER BY created_at, id
    ) AS previous_created_at
  FROM messages
  WHERE role = 'assistant'
),
clusters AS (
  SELECT *,
    SUM(
      CASE
        WHEN previous_created_at IS NULL
          OR created_at - previous_created_at > INTERVAL '1 second'
        THEN 1 ELSE 0
      END
    ) OVER (
      PARTITION BY conversation_id, role, content
      ORDER BY created_at, id
      ROWS UNBOUNDED PRECEDING
    ) AS cluster_id
  FROM ordered
),
ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY conversation_id, role, content, cluster_id
      ORDER BY created_at, id
    ) AS duplicate_rank
  FROM clusters
)
SELECT id FROM ranked WHERE duplicate_rank > 1;

\echo 'Candidatos a duplicado (se conserva el primer mensaje de cada repetición dentro de 1 segundo):'
SELECT m.id, m.conversation_id, m.role, LEFT(m.content, 140) AS content_preview, m.created_at
FROM messages AS m
JOIN duplicate_message_ids AS d USING (id)
ORDER BY m.conversation_id, m.created_at, m.id
LIMIT 50;

\if :execute
\echo 'Modo de ejecución: eliminando duplicados.'
DELETE FROM messages AS m
USING duplicate_message_ids AS d
WHERE m.id = d.id
RETURNING m.id, m.conversation_id;
\else
\echo 'Vista previa únicamente; no se eliminaron filas. Para borrar, agrega -v execute=true.'
\endif

COMMIT;
