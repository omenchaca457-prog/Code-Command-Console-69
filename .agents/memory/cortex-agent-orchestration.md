---
name: Cortex agent orchestration
description: Product rule for how CORTEX MULTI-IA 4105 assigns work to its three AI agents.
---

In CORTEX MULTI-IA 4105, DeepSeek and Gemini analyze the same request in parallel. OpenAI is the orchestrator: it receives their outputs and database agent state, then returns the final coordination order and emits the OpenAI-Master neural event.

**Why:** The user specified that OpenAI should be responsible for coordinating the other agents, not act as a third competing analyst.

**How to apply:** Preserve the two-specialist-then-orchestrator sequence in CORTEX UI and API changes.

Weather probes should use an explicitly labeled Texas default until the user supplies a precise location. Never describe the default as the user's location.

**Why:** The user requested free Open-Meteo probing with a Texas default rather than waiting for an exact location.

**How to apply:** Preserve this default-location behavior when changing weather context; distinguish weather evidence from trading or Ω measurements.

ORQUESTADOR-OPENAI must represent current activity: idle while waiting, active only during an actual coordination. A completed decision is an event, not a permanent completed status for an otherwise inactive node.

**Why:** The user flagged the permanently completed orchestrator as a phantom node and explicitly requested truthful idle initialization.

**How to apply:** Preserve the distinction between node lifecycle and decision history when changing orchestration or telemetry.
