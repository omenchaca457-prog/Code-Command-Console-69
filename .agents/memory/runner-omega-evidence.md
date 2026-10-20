---
name: Runner Omega evidence
description: User-defined financial Omega and the distinction between execution stability and measured coherence.
---

The user defines Ω_NÚCLEO as `(Retorno_Total_Neto * Tasa_Laminar_Éxito) / (1 + (Slippage_Real + Comisión_Efectiva) * Volatilidad_Residual)`, with a laminar ratio in [0,1] and Sello S evidence.

**Why:** The user supplied this financial formula and requested honest 0.25% commission plus 0.15% slippage. It is distinct from the bounded agent-evaluation Ω score; losses can make financial Ω negative.

**How to apply:** Use fractional rates consistently. Do not equate profitable trades with turbulence-free trades, accounting conservation with physical incompressibility, or stable execution with stable Ω. The user has not supplied a measurable turbulence classifier, Sello S verification procedure, or stability threshold/window; do not fabricate them.

The managed Python Runner may expose DISPLAY while Matplotlib still uses the noninteractive Agg backend.

**Why:** DISPLAY-only detection selected chart pauses inside an HTTP execution, consuming the process time limit instead of finishing the simulation.

**How to apply:** Treat piped/noninteractive stdout as headless by default, with bounded cycles; allow an explicit interactive override for desktop use.
