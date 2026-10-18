---
name: Cortex agent orchestration
description: Product rule for how CORTEX MULTI-IA 4105 assigns work to its three AI agents.
---

In CORTEX MULTI-IA 4105, DeepSeek and Gemini analyze the same request in parallel. OpenAI is the orchestrator: it receives their outputs and database agent state, then returns the final coordination order and emits the OpenAI-Master neural event.

**Why:** The user specified that OpenAI should be responsible for coordinating the other agents, not act as a third competing analyst.

**How to apply:** Preserve the two-specialist-then-orchestrator sequence in CORTEX UI and API changes.
