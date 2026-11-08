import { index, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const snippetsTable = pgTable(
  "snippets",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    code: text("code").notNull(),
    language: text("language").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
    lastRunAt: timestamp("last_run_at"),
  },
  (table) => [
    index("snippets_updated_at_id_idx").on(table.updatedAt.desc(), table.id.desc()),
  ],
);

export const insertSnippetSchema = createInsertSchema(snippetsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastRunAt: true,
});

export type InsertSnippet = z.infer<typeof insertSnippetSchema>;
export type Snippet = typeof snippetsTable.$inferSelect;
