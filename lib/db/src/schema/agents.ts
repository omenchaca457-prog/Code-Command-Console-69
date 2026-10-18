import {
  doublePrecision,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const agentsTable = pgTable("agents", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  xp: integer("xp").notNull().default(0),
  failedAnalyses: integer("failed_analyses").notNull().default(0),
  lastOmega: doublePrecision("last_omega"),
  lastFailure: text("last_failure"),
  status: text("status").notNull().default("idle"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
