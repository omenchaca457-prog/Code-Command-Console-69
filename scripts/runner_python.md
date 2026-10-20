# Library 9 / Runner_python

The existing chart runner is retained, with a tested accounting/provider core.
It is a **synthetic simulation**, not a broker or a market-performance result.

## Run and test

```sh
python -m unittest discover -s scripts -p 'test_runner_python.py' -v
python scripts/runner_python.py --headless --cycles 2000 --ai-probe \
  --report generated-artifacts/runner-report.json \
  --analysis-output generated-artifacts/runner-analysis.json
```

NumPy, Matplotlib and statsmodels are the original runtime dependencies. On a
server without an interactive stdout or DISPLAY, the script defaults to a finite,
headless 2,000-cycle run (DISPLAY alone does not establish graphical capability).
On a graphical desktop the original continuous chart behavior is retained.
One AI probe is enabled at the end of a run, not on every trading bar. Use
`--no-ai-probe` for an offline run. Socket timeouts and a 30-second analysis
budget keep retries bounded; the existing Runner process limit remains in force.

`build_runner_snippet.py` combines the runner and core into a standalone snippet,
without a local-module import. Library must contain that bundle, not just the
chart file. The bundle is compiled before it can be used.

## The four patches

1. Gemini: bounded attempts, socket timeout, explicit HTTP 503/availability
   handling and backoff. Output budget increases on the second attempt.
2. Only complete, nonblank, sanitized answers are accepted. Invalid, empty or
   cut output is never stored. Saving a validated answer is atomic.
3. Commission 0.25% plus modeled slippage 0.15% is charged on gross notional
   of both legs, at entry and exit. Quantities are fixed on entry. PnL uses
   actual simulated leg-price changes. Principal is not counted twice. Final
   liquidation is included, and wins are counted after both sets of costs.
4. Gemini failure automatically invokes DeepSeek, preserving provider,
   attempt counts and fallback reasons. Both failing leaves an explicit error,
   not an empty successful result. Runtime keys come from the existing secrets;
   no credentials are saved in snippets or reports.

## Ω evidence and stability

The user's formula uses fractional net return and fractional cost rates:

`Ω = net_return * laminar_rate / (1 + (slippage_real + commission_effective) * residual_volatility)`

Residual volatility is the sample standard deviation of per-bar residual
returns (`return_y - hedge_ratio * return_x`), not annualized price volatility.
Costs here are simulated charges, not observed execution costs in a live market.

`--coherence-evidence path.json` accepts an explicit nonempty `criterion`, a
`laminar_operations` boolean array with one label per closed trade, and a
boolean `seal_s`. Do not manufacture labels from win rate: a winning operation
is not automatically turbulence-free. The report includes per-trade evidence
so a defined classifier can label the trades.

Missing labels or Sello S evidence produce `omega_nucleo: null` (N/D). The
conditional coefficient/range is algebra only, not an observed Ω.
The accounting-conservation check is **not** a physical Sello S or a proof of
incompressibility. No Ω stability threshold or measurement window has been
supplied; even a measured Ω is not automatically marked stable.

`execution_state: stable` only means finite execution, positive remaining
capital and conserved accounting, plus a successful AI probe if requested.
It does **not** mean a profitable strategy, a stable Ω, or live trading safety.
