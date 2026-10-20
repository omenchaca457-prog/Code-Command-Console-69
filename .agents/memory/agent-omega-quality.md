---
name: Agent Ω data quality
description: Interpret and display coherence scores when an agent lacks verifiable evidence.
---

An agent with no verifiable analysis has no measured Ω value. Store it as `NULL` and display it as N/D, rather than representing missing evidence as a measured zero. Keep historical failure counts and failure explanations intact.

**Why:** A numeric zero looks like an actual score and obscures the difference between a failed analysis and a measured low coherence.

**How to apply:** When changing agent evaluation, persistence, or UI, only persist/display Ω after it was computed from verifiable evidence; leave failure metrics separate.

Operational integrity checks (payload fidelity, successful execution, or recovery from a provider error) must not be described as proof of physical Sello S or financial Ω stability.

**Why:** The user's Ley 4105 supervision requirements refer to Sello S, but operational success alone supplies no measured incompressibility or trading evidence. Claiming equivalence would turn a software health signal into an unsupported domain assertion.

**How to apply:** Describe exactly which server-owned invariants were checked. Preserve unknown domain evidence instead of declaring Sello S certified when an agent recovers.
