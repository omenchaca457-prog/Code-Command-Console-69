import { relations } from "drizzle-orm";
import { agentsTable } from "./agents";
import { conversations } from "./conversations";
import { prompts } from "./prompts";

export const agentsRelations = relations(agentsTable, ({ many }) => ({
  prompts: many(prompts),
}));

export const conversationsRelations = relations(conversations, ({ many }) => ({
  prompts: many(prompts),
}));

export const promptsRelations = relations(prompts, ({ one }) => ({
  agent: one(agentsTable, {
    fields: [prompts.agentId],
    references: [agentsTable.id],
  }),
  conversation: one(conversations, {
    fields: [prompts.conversationId],
    references: [conversations.id],
  }),
}));
