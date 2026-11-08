import { index, pgTable, serial, text, doublePrecision, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const simulationLogsTable = pgTable(
  "simulation_logs",
  {
    id: serial("id").primaryKey(),
    vector: text("vector").notNull(),
    coherence: doublePrecision("coherence").notNull(),
    turbulence: text("turbulence").notNull(),
    vectorsProcessed: integer("vectors_processed").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("simulation_logs_created_at_id_idx").on(table.createdAt.desc(), table.id.desc()),
  ],
);

export const insertSimulationLogSchema = createInsertSchema(simulationLogsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertSimulationLog = z.infer<typeof insertSimulationLogSchema>;
export type SimulationLog = typeof simulationLogsTable.$inferSelect;
