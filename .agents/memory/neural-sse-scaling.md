---
name: Neural SSE delivery
description: Process-local live event delivery and the scaling constraint for neural activity SSE.
---

Live neural-event notifications are dispatched through an in-memory hub in the API process. The database is used to replay events after a client's last event ID, but it does not broadcast newly inserted events to other API processes. Every route that writes neural events must publish the returned row to the hub.

**Why:** This keeps the single-process API implementation immediate and reconnect-safe without polling, but it does not provide cross-process live fan-out.

**How to apply:** If the API is deployed with multiple instances, replace or extend the in-memory publisher with PostgreSQL `LISTEN`/`NOTIFY` or another shared pub/sub layer, and verify all event-writing paths publish through it.
