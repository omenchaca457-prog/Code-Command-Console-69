---
name: Agent Ω data quality
description: Interpret and display coherence scores when an agent lacks verifiable evidence.
---

An agent with no verifiable analysis has no measured Ω value. Store it as `NULL` and display it as N/D, rather than representing missing evidence as a measured zero. Keep historical failure counts and failure explanations intact.

**Why:** A numeric zero looks like an actual score and obscures the difference between a failed analysis and a measured low coherence.

**How to apply:** When changing agent evaluation, persistence, or UI, only persist/display Ω after it was computed from verifiable evidence; leave failure metrics separate.
