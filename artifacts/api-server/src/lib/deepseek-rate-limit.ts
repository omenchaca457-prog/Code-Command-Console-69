type RateLimitRequest = {
  clientIdentifier: string;
  currentTime: number;
  limit: number;
  windowMs: number;
};

export type RateLimitResult = {
  count: number;
  resetAt: number;
  allowed: boolean;
};

export interface DeepseekRateLimitStore {
  consume(request: RateLimitRequest): Promise<RateLimitResult>;
}

type StoredRateLimitRow = {
  request_count: number;
  reset_at_ms: number | string;
};

type DatabasePool = typeof import("@workspace/db")["pool"];

export function createPostgresDeepseekRateLimitStore(): DeepseekRateLimitStore {
  let poolPromise: Promise<DatabasePool> | undefined;
  let schemaPromise: Promise<void> | undefined;

  function getPool(): Promise<DatabasePool> {
    poolPromise ??= import("@workspace/db")
      .then(({ pool }) => pool)
      .catch((error: unknown) => {
        poolPromise = undefined;
        throw error;
      });
    return poolPromise;
  }

  async function ensureSchema(pool: DatabasePool): Promise<void> {
    if (!schemaPromise) {
      schemaPromise = (async () => {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS deepseek_rate_limits (
            client_identifier text PRIMARY KEY,
            request_count integer NOT NULL,
            reset_at_ms bigint NOT NULL
          )
        `);
        await pool.query(`
          CREATE INDEX IF NOT EXISTS deepseek_rate_limits_reset_at_ms_idx
          ON deepseek_rate_limits (reset_at_ms)
        `);
      })().catch((error: unknown) => {
        schemaPromise = undefined;
        throw error;
      });
    }

    await schemaPromise;
  }

  return {
    async consume({
      clientIdentifier,
      currentTime,
      limit,
      windowMs,
    }): Promise<RateLimitResult> {
      const pool = await getPool();
      await ensureSchema(pool);

      await pool.query(
        `DELETE FROM deepseek_rate_limits WHERE reset_at_ms <= $1::bigint`,
        [currentTime],
      );

      const claim = await pool.query<StoredRateLimitRow>(
        `
          INSERT INTO deepseek_rate_limits (
            client_identifier,
            request_count,
            reset_at_ms
          )
          SELECT $1, 1, $2::bigint + $3::bigint
          WHERE $4::integer > 0
          ON CONFLICT (client_identifier) DO UPDATE
          SET
            request_count = CASE
              WHEN deepseek_rate_limits.reset_at_ms <= $2::bigint THEN 1
              ELSE deepseek_rate_limits.request_count + 1
            END,
            reset_at_ms = CASE
              WHEN deepseek_rate_limits.reset_at_ms <= $2::bigint
                THEN $2::bigint + $3::bigint
              ELSE deepseek_rate_limits.reset_at_ms
            END
          WHERE
            $4::integer > 0
            AND (
              deepseek_rate_limits.reset_at_ms <= $2::bigint
              OR deepseek_rate_limits.request_count < $4::integer
            )
          RETURNING request_count, reset_at_ms
        `,
        [clientIdentifier, currentTime, windowMs, limit],
      );

      const allowedRow = claim.rows[0];
      if (allowedRow) {
        return {
          count: Number(allowedRow.request_count),
          resetAt: Number(allowedRow.reset_at_ms),
          allowed: true,
        };
      }

      const current = await pool.query<StoredRateLimitRow>(
        `
          SELECT request_count, reset_at_ms
          FROM deepseek_rate_limits
          WHERE client_identifier = $1
        `,
        [clientIdentifier],
      );
      const currentRow = current.rows[0];

      return {
        count: currentRow ? Number(currentRow.request_count) : 0,
        resetAt: currentRow
          ? Number(currentRow.reset_at_ms)
          : currentTime + windowMs,
        allowed: false,
      };
    },
  };
}
