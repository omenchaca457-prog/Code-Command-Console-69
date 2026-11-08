import { createInsertSchema } from "drizzle-zod";
import { index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { agentsTable } from "./agents";
import { conversations } from "./conversations";

export const prompts = pgTable(
  "prompts",
  {
    id: serial("id").primaryKey(),
    agentId: text("agent_id").references(() => agentsTable.id, {
      onDelete: "set null",
    }),
    conversationId: integer("conversation_id").references(() => conversations.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("prompts_agent_id_idx").on(table.agentId),
    index("prompts_conversation_id_idx").on(table.conversationId),
  ],
);

export const insertPromptSchema = createInsertSchema(prompts).omit({
  id: true,
  createdAt: true,
});

export type Prompt = typeof prompts.$inferSelect;
export type InsertPrompt = z.infer<typeof insertPromptSchema>;
