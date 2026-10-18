/**
 * Snapshot captured by Replit Agent from the Replit Integrations view.
 * Refresh this safe metadata snapshot when the user asks for an update.
 * Do not store connection IDs, tokens, or other credential material here.
 */
const REPLIT_INTEGRATIONS_SNAPSHOT = {
  status: "snapshot",
  source: "Replit Agent — Integrations",
  capturedAt: "2026-10-18T14:27:51Z",
  freshness: "manual",
  addedCount: 0,
  integrations: [
    { name: "GitHub", status: "authorized_not_added" },
  ],
  truncated: false,
} as const;

export function getReplitIntegrationStatus() {
  return REPLIT_INTEGRATIONS_SNAPSHOT;
}
