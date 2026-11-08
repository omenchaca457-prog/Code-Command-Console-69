import { index, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const neuralEventsTable = pgTable(
  "neural_events",
  {
    id: serial("id").primaryKey(),
    origin: text("origin").notNull(),
    eventType: text("event_type").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("neural_events_created_at_id_idx").on(table.createdAt.desc(), table.id.desc()),
  ],
);

export const insertNeuralEventSchema = createInsertSchema(neuralEventsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertNeuralEvent = z.infer<typeof insertNeuralEventSchema>;
export type NeuralEvent = typeof neuralEventsTable.$inferSelect;
