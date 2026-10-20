---
name: Agent Ω data quality
description: Interpret and display coherence scores when an agent lacks verifiable evidence.
---

An analysis without verifiable evidence has no measured analysis Ω value. Store unknown evidence as `NULL` and display it as N/D, rather than representing missing evidence as a measured zero. Keep historical failure counts and failure explanations intact.

**Why:** A numeric zero looks like an actual score and obscures the difference between a failed analysis and a measured low coherence.

**How to apply:** When changing agent evaluation, persistence, or UI, only persist/display Ω after it was computed from verifiable evidence; leave failure metrics separate.

Operational integrity checks (payload fidelity, successful execution, or recovery from a provider error) must not be described as proof of physical Sello S or financial Ω stability.

**Why:** The user's Ley 4105 supervision requirements refer to Sello S, but operational success alone supplies no measured incompressibility or trading evidence. Claiming equivalence would turn a software health signal into an unsupported domain assertion.

**How to apply:** Describe exactly which server-owned invariants were checked. Preserve unknown domain evidence instead of declaring Sello S certified when an agent recovers.

The user requires each agent's `last_omega` to reflect its own task success, not a copy of the Motor's global coherence. Operational task reliability and model-assessed code coherence are distinct metrics; equal reliability values may be legitimate when agents have equal outcomes.

**Why:** Copying the same Motor sample into every agent hid independent failures. Historical XP and model scores are not evidence of historical task success counts.

**How to apply:** Use measured per-agent outcomes without inventing different values or backfilling successes from XP. Keep operational, analysis and financial Ω definitions explicit.
