# Engineering Standards Forensic Audit Report

**Target Platform:** Poly Strategy Lab (Backend & Frontend)  
**Audit Standard:** The Pragmatic Systems Handbook (`agent-engineering-handbook.md`)  
**Auditor:** Elite Software Engineering Standards Auditor  
**Date:** September 18, 2026  
**Status:** Audit Complete  

---

## 1. Executive Summary & Verification Scorecard

This audit report delivers a forensic review of the entire Poly Strategy Lab codebase against the standards established in *The Pragmatic Systems Handbook*. The audit systematically evaluates both the Python backend (`backend/`) and Next.js/TypeScript frontend (`frontend/`) across system architecture, code-level engineering standards, brittle anti-patterns, and autonomous agent guardrails.

### Verification Scorecard

| Domain | Assessment | Passing / Baseline | Status |
| :--- | :--- | :--- | :--- |
| **Backend Test Suite** | 36 boundary & integration tests | 36 / 36 Passed (15.55s) | Pass |
| **Frontend Production Build** | Next.js 14.2.5 static compilation | 9 / 9 routes compiled | Pass |
| **Architectural Separation (SoC)** | Backend API vs Engine vs Data vs Indicators | Well structured boundaries | Partial (untyped dicts cross boundaries) |
| **Resilience & Timeouts** | Explicit fetch timeouts in client | 15s / 30s / 60s abort signals | Pass |
| **Mathematical Correctness** | Quant indicators & backtesting loops | Critical lookahead bias detected | **Failed (§2.4, §3.1)** |
| **Resource & Lifecycle Safety** | Chart instances & event listeners | Memory leaks & double triggers | **Needs Remediation (§1.3, §3.1)** |
| **Schema Integrity** | Pydantic backend to TypeScript frontend | Untyped `dict` in schemas | **Needs Remediation (§2.5, §4.4)** |

---

## 2. Standards Reference Matrix

The codebase was inspected directly against each section of *The Pragmatic Systems Handbook*:

- **Section 1: System & Architectural Design Principles**
  - §1.1 Core System Philosophies: Separation of Concerns (SoC), High Cohesion & Low Coupling, Deep vs. Shallow Modules, Single Responsibility.
  - §1.2 Modularity & Boundary Enforcement: Depend on contracts, Anti-Corruption Layer, Contract Versioning, Call-site interface design.
  - §1.3 Resilience, Error Boundaries, Defensive Architecture: Fail fast at edges, explicit timeouts, idempotent retries, circuit breakers, never fail silently, structured observability.
- **Section 2: Code-Level Engineering Standards**
  - §2.1 SOLID Without Over-Engineering.
  - §2.2 DRY Without Duplication-Phobia (Rule of Three).
  - §2.3 KISS vs. Over-Engineering (Complexity budget, Boring code is a feature).
  - §2.4 Function Design: Idempotency, Pure core vs. Imperative shell, SLAP.
  - §2.5 Explicit vs. Implicit: Intention-revealing naming, Why-comments, Strict typing, Schema-driven development, Contract-first interfaces.
- **Section 3: The "It Just Works" Anti-Pattern (Agent Code Smells)**
  - §3.1 Brittle Patterns: Coincidental correctness, monkey-patching, shotgun surgery, god objects, silent exception swallowing, magic values, temporal coupling, hidden global mutable state, copy-paste development, stringly-typed data, feature envy.
- **Section 4: Guardrails for Agentic & Autonomous Code Generation**
  - §4.1 Pre-Generation Guardrails, §4.2 Test-Driven Guardrails, §4.3 Verification Before Emitting Code, §4.4 The Never-Do List (10 commandments).
- **Appendix: One-Page Diff Checklist**

---

## 3. Forensic Findings Catalog

### Finding 1 [Critical]: Lookahead Bias and Future Data Leakage in Dynamic Channel Indicators

- **Location:**
  - `backend/app/indicators/dynamic_channel.py`, lines 18-20, 57-66, 92-95 (`compute_btc_trolololo`)
  - `backend/app/indicators/dynamic_channel.py`, lines 126-134, 140-142 (`compute_generic_channel`)
  - `backend/app/indicators/dynamic_channel.py`, line 251 (`compute_equity_channel`)
- **Specific Handbook Principle Violated:**
  - §2.4 Function Design: Pure vs. Stateful - Functional Core, Mathematical Invariants & Non-Peeking
  - §3.1 Catalog of Brittle Patterns: Coincidental Correctness & Leaky Abstractions
  - §4.4 Never-Do List #10: "Claim a change is tested when only happy path exercised" / False Guarantees
- **Empirical Description:**
  In `frontend/src/app/research/page.tsx` (lines 71-80), the system makes a prominent guarantee to users: *"Anti-Lookahead Bias Guarantees: To guarantee zero forward-looking bias, the simulation strictly enforces day T signal evaluation with day T+1 market open execution."*
  
  However, forensic inspection of `dynamic_channel.py` reveals that the indicator calculation itself leaks future data across the entire historical series:
  1. In `compute_btc_trolololo`, hardcoded historical cycle peaks (`BTC_CONFIRMED_HIGHS = ["2013-04-09", "2013-11-30", "2017-12-17", "2021-11-10"]`) and cycle troughs up to 2022 are fed into `stats.linregress(hi_idx.astype(float), hi_y)`. When the backtest simulates a bar in 2014, the channel top and bottom drift lines are fitted using peak prices from 2017 and 2021. The backtest has perfect foreknowledge of future cycle tops.
  2. In `compute_generic_channel`, line 132 fits a single log-linear regression `stats.linregress(log_t, log_p)` over the *entire series* (`log_p = np.log(prices[valid])`). In a backtest from 2020 to 2025, the trend slope at day 1 is fitted using the terminal price at day 1800.
  3. In `compute_generic_channel`, line 141 executes `.bfill()` on rolling quantile envelopes:
     `roll_top = res_filled.rolling(window=window, min_periods=30).quantile(0.95).bfill().ffill().values`
     The `.bfill()` backward-fills future quantile residuals to the beginning of the series, leaking volatility from months into the future back to early bars.
  4. In `compute_equity_channel`, line 251 executes `.bfill()` on rolling standard deviations:
     `roll_std = eps_series.rolling(window=vol_window, min_periods=20).std().bfill().ffill().values`
  
  This invalidates historical simulation claims, inflating backtested CAGR and Sharpe metrics while failing catastrophically in forward execution.

- **Remediation Pattern / Code Diff:**
  Replace whole-dataset regression with an expanding causal walk-forward window (as implemented in Stage 2 of `compute_equity_channel`), and eliminate all backward fill (`.bfill()`) operations:

```diff
--- a/backend/app/indicators/dynamic_channel.py
+++ b/backend/app/indicators/dynamic_channel.py
@@ -131,14 +131,23 @@ def compute_generic_channel(close_series: pd.Series, window: int = 180) -> pd.S
-    # Fit central log-linear trend: ln(P) = a * ln(t + 30) + b
-    log_t = np.log(t_valid + 30.0)
-    slope, intercept, _, _, _ = stats.linregress(log_t, log_p)
-    trend_all = slope * np.log(t + 30.0) + intercept
+    # Causal walk-forward rolling regression: bar t uses ONLY observations <= t
+    trend_all = np.full(n, np.nan)
+    for i in range(30, n):
+        sub_t = np.log(t[:i+1] + 30.0)
+        sub_p = log_p[:i+1]
+        sl, ic, _, _, _ = stats.linregress(sub_t, sub_p)
+        trend_all[i] = sl * np.log(t[i] + 30.0) + ic
 
     residuals = np.full(n, np.nan)
     residuals[valid] = np.log(prices[valid]) - trend_all[valid]
 
-    res_filled = res_series.ffill().bfill()
-    roll_top = res_filled.rolling(window=window, min_periods=30).quantile(0.95).bfill().ffill().values
-    roll_bottom = res_filled.rolling(window=window, min_periods=30).quantile(0.05).bfill().ffill().values
+    res_filled = res_series.ffill()
+    # Strictly causal: forward-fill only, never backward fill future quantiles
+    roll_top = res_filled.rolling(window=window, min_periods=30).quantile(0.95).ffill().values
+    roll_bottom = res_filled.rolling(window=window, min_periods=30).quantile(0.05).ffill().values
```

---

### Finding 2 [High]: Inconsistent Trade Execution Timing and Portfolio Valuation Mismatch in Trade Logs

- **Location:**
  - `backend/app/engine/backtest_numba.py`, lines 177-186, 207-216 (`run_backtest_full_trace`)
- **Specific Handbook Principle Violated:**
  - §1.1 Core System Philosophies: Separation of Concerns & Temporal Invariants
  - §2.4 Function Design: SLAP and Invariant Correctness
  - §3.1 Catalog of Brittle Patterns: Temporal Coupling
- **Empirical Description:**
  In `run_backtest_full_trace`:
  ```python
  # Bar i signal evaluated, execution scheduled for Bar i+1 open
  sig = signals[i]
  p_exec = prices_open[i + 1]
  p_close = prices_close[i]
  # ...
  cash -= trade_amount
  holdings += units_bought
  trade_log.append({
      "date": str(dates[i + 1].date()),
      "type": "BUY",
      "price": float(p_exec),
      "shares": float(units_bought),
      "cost": float(trade_amount),
      "cash_after": float(cash),
      "port_value": float(cash + (holdings * p_close)),
      "pnl": 0.0,
  })
  ```
  Notice line 184: `"port_value": float(cash + (holdings * p_close))`.
  The transaction is recorded as taking place on day $i+1$ (`dates[i+1]`) at execution price $P_{\text{open}}[i+1]$. `cash` has been decremented by `trade_amount`, and `holdings` contains the new `units_bought`.
  However, this combined portfolio is then valued using $P_{\text{close}}[i]$ (the previous day's close!).
  This is a temporal contradiction: cash is updated at $T+1$ execution, but shares are marked to $T$ close. On high-gap days where $P_{\text{open}}[i+1]$ differs by 10% from $P_{\text{close}}[i]$, the reported `port_value` in the trade ledger abruptly jumps or drops artificially.

- **Remediation Pattern / Code Diff:**
  Value the portfolio at execution open price or day $i+1$ close price consistently:

```diff
--- a/backend/app/engine/backtest_numba.py
+++ b/backend/app/engine/backtest_numba.py
@@ -181,7 +181,7 @@ def run_backtest_full_trace(...):
                     "shares": float(units_bought),
                     "cost": float(trade_amount),
                     "cash_after": float(cash),
-                    "port_value": float(cash + (holdings * p_close)),
+                    "port_value": float(cash + (holdings * p_exec)),
                     "pnl": 0.0,
                 })
@@ -211,7 +211,7 @@ def run_backtest_full_trace(...):
                     "shares": float(units_sold),
                     "cost": float(gross_usd),
                     "cash_after": float(cash),
-                    "port_value": float(cash + (holdings * p_close)),
+                    "port_value": float(cash + (holdings * p_exec)),
                     "pnl": round(float(trade_pnl), 2),
                 })
```

---

### Finding 3 [High]: Memory Leak in Frontend `api-client.ts` via Uncleaned Event Listener on AbortSignal

- **Location:**
  - `frontend/src/lib/api-client.ts`, lines 41-53 (`fetchWithTimeout`)
- **Specific Handbook Principle Violated:**
  - §1.3 Resilience, Error Boundaries: Resource Cleanliness
  - §3.1 Catalog of Brittle Patterns: Resource Leaks
  - §4.4 Never-Do List: Unhandled side-effects and resource allocation
- **Empirical Description:**
  `fetchWithTimeout` accepts an optional external `options.signal`.
  Lines 49-52 attach an event listener to `options.signal`:
  ```typescript
  options.signal.addEventListener("abort", () => {
    clearTimeout(timer);
    controller.abort();
  });
  ```
  However, in the `finally` block (lines 72-74), only `clearTimeout(timer)` is executed. The event listener attached to `options.signal` is never removed. If the caller component reuses an `AbortSignal` or passes a long-lived controller across user interactions, closures retaining `controller` and `timer` references permanently leak into the JavaScript heap.

- **Remediation Pattern / Code Diff:**

```diff
--- a/frontend/src/lib/api-client.ts
+++ b/frontend/src/lib/api-client.ts
@@ -41,17 +41,18 @@ async function fetchWithTimeout(
+  let onAbort: (() => void) | null = null;
   // Link external abort signal if provided
   if (options.signal) {
     if (options.signal.aborted) {
       clearTimeout(timer);
       const abortErr = new Error("The user aborted a request");
       abortErr.name = "AbortError";
       throw abortErr;
     }
-    options.signal.addEventListener("abort", () => {
+    onAbort = () => {
       clearTimeout(timer);
       controller.abort();
-    };
+    };
+    options.signal.addEventListener("abort", onAbort);
   }
 
   try {
@@ -72,6 +73,9 @@ async function fetchWithTimeout(
   } finally {
     clearTimeout(timer);
+    if (options.signal && onAbort) {
+      options.signal.removeEventListener("abort", onAbort);
+    }
   }
 }
```

---

### Finding 4 [High]: Client-Side Race Condition and Redundant Invocations on Asset Selection

- **Location:**
  - `frontend/src/app/simulator/page.tsx`, lines 148-152, 184-191
  - `frontend/src/app/optimizer/page.tsx`, lines 86-90, 116-123
- **Specific Handbook Principle Violated:**
  - §3.1 Catalog of Brittle Patterns: Temporal Coupling & Accidental State Machine
  - §4.1 Pre-Generation Guardrails: Failure Mode Enumeration under Concurrent Invocation
- **Empirical Description:**
  In `frontend/src/app/simulator/page.tsx`:
  ```typescript
  const handleAssetSelect = (newSymbol: string) => {
    setSymbol(newSymbol);
    setShowCustomInput(false);
    handleRunSimulation(newSymbol); // [Call 1]
  };
  ```
  And in the same component:
  ```typescript
  useEffect(() => {
    handleRunSimulation(symbol);    // [Call 2]
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [symbol, handleRunSimulation]);
  ```
  When the user clicks any asset pill:
  1. `handleAssetSelect` immediately dispatches `handleRunSimulation(newSymbol)`, instantiating a new `AbortController` and firing HTTP requests.
  2. `setSymbol(newSymbol)` triggers a React re-render.
  3. During re-render, React runs the previous `useEffect` cleanup function:
     `abortControllerRef.current.abort()`.
  4. This aborts the HTTP request that `handleAssetSelect` just dispatched milliseconds earlier!
  5. The new `useEffect` then fires, invoking `handleRunSimulation(symbol)` a second time.
  
  Every asset selection triggers a redundant network request and a discarded abort error. The exact duplicate defect exists in `optimizer/page.tsx`.

- **Remediation Pattern / Code Diff:**
  Eliminate manual execution inside `handleAssetSelect`, letting React state updates declaratively drive the simulation effect:

```diff
--- a/frontend/src/app/simulator/page.tsx
+++ b/frontend/src/app/simulator/page.tsx
@@ -148,7 +148,6 @@ function SimulatorContent() {
   const handleAssetSelect = (newSymbol: string) => {
     setSymbol(newSymbol);
     setShowCustomInput(false);
-    handleRunSimulation(newSymbol);
   };
```

---

### Finding 5 [High]: Asymmetric Schema Contracts and Untyped `dict` Payloads Across API Boundaries

- **Location:**
  - `backend/app/models/schemas.py`, lines 71, 109-112
  - `frontend/src/lib/api-client.ts`, line 90
- **Specific Handbook Principle Violated:**
  - §1.2 Modularity & Boundary Enforcement: Depend on contracts, not untyped payloads
  - §2.5 Explicit vs. Implicit: Schema-Driven Development & Strict Typing over Convenient Typing
  - §4.4 Never-Do List #4: "Cast to any/unknown/untyped dict across a module or service boundary without a validating schema."
- **Empirical Description:**
  In `backend/app/models/schemas.py`, the optimizer response schema declares:
  ```python
  class OptimizeResponse(BaseModel):
      # ...
      best_by_return: dict
      best_by_sharpe: dict
      best_by_drawdown: dict
      top_trials: List[dict]
  ```
  Similarly, `BacktestResponse.params: dict`.
  The backend permits completely arbitrary, unvalidated dictionary structures across network boundaries.
  Meanwhile, in `frontend/src/types/api.ts`, the frontend defines an `OptimizeTrial` interface with specific fields (`threshold_buy`, `threshold_sell`, etc.).
  In `frontend/src/lib/api-client.ts`, line 90 performs an unvalidated type assertion:
  `return res.json() as Promise<T>;`
  No runtime validation (such as Zod) verifies that the payload returned by FastAPI satisfies the interface expected by Next.js. Any typo or key rename on the backend will silently pass serialization, crashing the frontend at runtime during property access (`Cannot read properties of undefined`).

- **Remediation Pattern / Code Diff:**
  Define concrete Pydantic schemas on the backend and implement runtime validation on the frontend:

```diff
--- a/backend/app/models/schemas.py
+++ b/backend/app/models/schemas.py
@@ -100,14 +100,24 @@ class OptimizeRequest(BaseModel):
     initial_capital: float = Field(default=100_000.0)
     fee_rate: float = Field(default=0.001)
 
+class OptimizeTrial(BaseModel):
+    threshold_buy: int
+    threshold_sell: int
+    alloc_buy_pct: float
+    total_return_pct: float
+    max_drawdown_pct: float
+    sharpe_ratio: float
+    win_rate_pct: float
+    trade_count: int
+
 class OptimizeResponse(BaseModel):
     success: bool
     symbol: str
     asset_type: str = "crypto"
     total_trials: int
     target_alloc_for_heatmap: float
     buy_thresholds: List[int]
     sell_thresholds: List[int]
     heatmap_matrix: List[List[Optional[float]]]
-    best_by_return: dict
-    best_by_sharpe: dict
-    best_by_drawdown: dict
-    top_trials: List[dict]
+    best_by_return: OptimizeTrial
+    best_by_sharpe: OptimizeTrial
+    best_by_drawdown: OptimizeTrial
+    top_trials: List[OptimizeTrial]
```

---

### Finding 6 [Medium]: Silent Indicator Signal Fallbacks Masking Missing or Corrupted Data

- **Location:**
  - `backend/app/indicators/dynamic_channel.py`, lines 123-125 (`compute_generic_channel`), lines 202-204, 216-218 (`compute_equity_channel`)
  - `frontend/src/app/simulator/page.tsx`, lines 127-130
- **Specific Handbook Principle Violated:**
  - §1.3 Resilience, Error Boundaries: "Never fail silently"
  - §3.1 Catalog of Brittle Patterns: Silent exception swallowing & Coincidental correctness
  - §4.4 Never-Do List #1: "Leave a catch block empty or logging-only with no propagation, compensation, or explicit documented justification."
- **Empirical Description:**
  1. In `compute_generic_channel`, if `valid.sum() < 30`:
     `return pd.Series(np.full(n, 50.0), index=dates, name="signal")`
     If an asset has corrupt or insufficient historical data, the indicator silently returns a flat series of `50.0`. The simulation engine executes as if this were normal market behavior, producing meaningless zero-trade simulations without notifying the caller.
  2. In `compute_equity_channel`, lines 203 and 217 similarly return flat `50.0` series silently when data is sparse.
  3. In `frontend/src/app/simulator/page.tsx` lines 127-130:
     ```typescript
     fetchMarketData(sym, undefined, undefined, controller.signal).catch((err: unknown) => {
       console.warn(`Market data fetch failed for ${sym}:`, err);
       return { symbol: sym, count: 0, data: [] };
     })
     ```
     If candlestick data retrieval fails, the error is swallowed and converted to an empty array. The UI renders the simulation metrics and equity curve, but the candlestick chart silently disappears with no notification to the user.

- **Remediation Pattern / Code Diff:**
  Raise explicit exceptions when data preconditions are violated, and surface warnings in the UI state:

```diff
--- a/backend/app/indicators/dynamic_channel.py
+++ b/backend/app/indicators/dynamic_channel.py
@@ -122,3 +122,3 @@ def compute_generic_channel(close_series: pd.Series, window: int = 180) -> pd.S
     valid = (prices > 0) & np.isfinite(prices)
     if valid.sum() < 30:
-        return pd.Series(np.full(n, 50.0), index=dates, name="signal")
+        raise ValueError(f"Insufficient valid price points for generic channel: got {valid.sum()}, need >= 30")
```

---

### Finding 7 [Medium]: Dual Asset Universe Catalogs and Lack of Dynamic Synchronization

- **Location:**
  - `backend/app/services/data_fetcher.py`, lines 17-98 (`SUPPORTED_ASSETS`)
  - `frontend/src/lib/asset-store.ts`, lines 8-19 (`DEFAULT_CRYPTO_ASSETS`)
  - `backend/app/indicators/dynamic_channel.py`, lines 168-176 (`classify_asset`)
- **Specific Handbook Principle Violated:**
  - §1.1 Core System Philosophies: Separation of Concerns & Single Source of Truth
  - §2.2 DRY Without Duplication-Phobia: Duplicated Knowledge
  - §3.1 Catalog of Brittle Patterns: Magic Values & Shotgun Surgery
- **Empirical Description:**
  The list of supported assets is hardcoded independently in three separate files:
  1. `data_fetcher.py` defines 10 cryptocurrency assets in `SUPPORTED_ASSETS`.
  2. `asset-store.ts` defines 10 cryptocurrency assets in `DEFAULT_CRYPTO_ASSETS`.
  3. `dynamic_channel.py` hardcodes a third list of crypto strings in `known_cryptos`.
  
  Neither catalog includes traditional equities (e.g., `QQQ`, `SPY`), despite `dynamic_channel.py` having dedicated equity channel algorithms and `data/cache/QQQ.parquet` existing in the repository. Furthermore, the backend exposes `GET /api/v1/assets`, but the frontend completely ignores this endpoint on startup, instead rendering its own static TypeScript array. Adding or updating an asset requires shotgun surgery across both backend and frontend codebases.

- **Remediation Pattern / Code Diff:**
  Have the frontend initialize asset listings dynamically from `GET /api/v1/assets`:

```diff
--- a/frontend/src/app/simulator/page.tsx
+++ b/frontend/src/app/simulator/page.tsx
@@ -20,2 +20,3 @@ import { runBacktest, fetchMarketData } from "@/lib/api-client";
+import { fetchAssets } from "@/lib/api-client";
@@ -58,2 +59,3 @@ function SimulatorContent() {
   const [copiedLink, setCopiedLink] = useState(false);
+  const [serverAssets, setServerAssets] = useState<Asset[]>([]);
   const [customAssets, setCustomAssets] = useState<Asset[]>([]);
 
   useEffect(() => {
+    fetchAssets().then(assets => {
+      setServerAssets(assets.map(a => ({ symbol: a.symbol, name: a.name, icon: "◈" })));
+    }).catch(err => console.warn("Using fallback assets:", err));
     setCustomAssets(getCustomAssets());
```

---

### Finding 8 [Medium]: Synchronous Blocking I/O and File Write Race Conditions in Data Fetcher Cache

- **Location:**
  - `backend/app/services/data_fetcher.py`, lines 120-130, 134-141, 165-169
- **Specific Handbook Principle Violated:**
  - §1.3 Resilience, Error Boundaries: Standard Resilience Patterns (Timeouts, Circuit Breakers)
  - §2.4 Function Design: Pure Core vs. Imperative Shell
  - §3.1 Catalog of Brittle Patterns: Hidden Global Mutable State & File Race Conditions
- **Empirical Description:**
  In `fetch_market_data`:
  When a cache file is older than 1 hour (`time.time() - mtime >= 3600`), the function triggers `yf.download()` synchronously inside the request path.
  Under concurrent traffic (e.g. multiple clients requesting `/backtest` or `/market-data` simultaneously for an expired asset):
  1. Multiple worker threads simultaneously initiate redundant network downloads to Yahoo Finance.
  2. Multiple worker threads simultaneously write to the same Parquet cache file (`df.to_parquet(cache_file)`).
  On Windows systems, concurrent file write access triggers `PermissionError: [WinError 32] The process cannot access the file because it is being used by another process`, crashing worker threads.

- **Remediation Pattern / Code Diff:**
  Implement atomic write semantics (writing to a unique temporary file and replacing) and in-process concurrency locking per symbol:

```diff
--- a/backend/app/services/data_fetcher.py
+++ b/backend/app/services/data_fetcher.py
@@ -3,2 +3,3 @@
 import os
+import tempfile
 import time
@@ -165,3 +166,7 @@ def fetch_market_data(...):
-            try:
-                df.to_parquet(cache_file)
-            except Exception as e:
+            try:
+                # Atomic file replacement prevents concurrent file write collisions
+                with tempfile.NamedTemporaryFile(dir=cache_dir, delete=False, suffix=".tmp") as tf:
                     df.to_parquet(tf.name)
                     temp_path = tf.name
                 os.replace(temp_path, cache_file)
             except Exception as e:
```

---

### Finding 9 [Medium]: Inactive Strategy Selection Flaw in "Best by Drawdown" Optimization

- **Location:**
  - `backend/app/engine/optimizer_grid.py`, line 70
- **Specific Handbook Principle Violated:**
  - §2.4 Function Design: Mathematical Correctness & Domain Invariants
  - §3.1 Catalog of Brittle Patterns: Coincidental Correctness
- **Empirical Description:**
  In `run_grid_search`:
  ```python
  best_mdd = sorted(trials, key=lambda x: x["max_drawdown_pct"])[0]
  ```
  If any parameter combination sets buy thresholds so low that the strategy never triggers a buy (`trade_count == 0`), the portfolio remains 100% in cash. Its total return is 0.0%, and its maximum drawdown is `0.0%`.
  Because `0.0%` is mathematically the minimum possible drawdown, `best_by_drawdown` picks this non-participating strategy as the optimal configuration. The UI displays "Minimum Drawdown: -0.0%" for a strategy that executed 0 trades.

- **Remediation Pattern / Code Diff:**
  Filter for active strategies (`trade_count > 0`) before sorting by drawdown:

```diff
--- a/backend/app/engine/optimizer_grid.py
+++ b/backend/app/engine/optimizer_grid.py
@@ -69,3 +69,5 @@ def run_grid_search(...):
     best_sharpe = sorted(trials, key=lambda x: x["sharpe_ratio"], reverse=True)[0]
-    best_mdd = sorted(trials, key=lambda x: x["max_drawdown_pct"])[0]
+    active_trials = [t for t in trials if t["trade_count"] > 0]
+    best_mdd = sorted(active_trials if active_trials else trials, key=lambda x: x["max_drawdown_pct"])[0]
```

---

### Finding 10 [Low]: Shallow Health Probe Violating Architectural Observability Standards

- **Location:**
  - `backend/app/main.py`, lines 26-29
- **Specific Handbook Principle Violated:**
  - §1.3 Resilience: Observability as an Architectural Requirement ("Every service exposes a health check that verifies its actual dependencies, not just 'process is running.'")
- **Empirical Description:**
  ```python
  @app.get("/health", tags=["Health"])
  async def health_check():
      """Liveness probe."""
      return {"status": "ok", "version": settings.VERSION}
  ```
  The endpoint returns a static JSON payload without verifying that the storage cache directory is accessible, that files are readable, or that core calculation kernels can execute. If the filesystem becomes read-only or corrupted, the health check continues to report healthy.

- **Remediation Pattern / Code Diff:**
  Verify cache directory write access and basic runtime state within the health check:

```diff
--- a/backend/app/main.py
+++ b/backend/app/main.py
@@ -1,3 +1,4 @@
+import os
 from fastapi import FastAPI
 from fastapi.middleware.cors import CORSMiddleware
@@ -27,3 +28,8 @@ app.include_router(api_v1_router, prefix=settings.API_V1_STR)
 async def health_check():
-    """Liveness probe."""
-    return {"status": "ok", "version": settings.VERSION}
+    """Health check verifying cache storage availability."""
+    cache_ok = os.path.exists(settings.DATA_CACHE_DIR) and os.access(settings.DATA_CACHE_DIR, os.W_OK)
+    return {
+        "status": "healthy" if cache_ok else "degraded",
+        "cache_writable": cache_ok,
+        "version": settings.VERSION,
+    }
```

---

### Finding 11 [Low / Architectural Smell]: DOM Canvas Thrashing via Full Chart Re-Instantiation

- **Location:**
  - `frontend/src/components/charts/TradingViewCandlestick.tsx`, lines 53-65, 194
  - `frontend/src/components/charts/TradingViewEquity.tsx`, lines 37-47, 146
- **Specific Handbook Principle Violated:**
  - §1.1 Core System Philosophies: Deep vs. Shallow Modules & Lifecycle Management
  - §2.3 KISS: Efficient Resource Use vs. Rebuilding Pipelines
- **Empirical Description:**
  In both charting components, the main `useEffect` includes `data`, `scaleMode`, and `showBenchmark` in its dependency array. Whenever data updates or display controls are clicked, the entire chart instance is destroyed (`chartRef.current.remove()`), destroying the Canvas element and re-instantiating the entire Lightweight Charts pipeline.
  Lightweight Charts is designed to maintain a persistent chart instance and update data via `series.setData()` and options via `chart.applyOptions()`. Destroying and recreating the chart on every state update causes visible canvas flicker and wasted DOM work.

- **Remediation Pattern / Code Diff:**
  Split chart lifecycle into mounting/cleanup and data/options updating:

```diff
--- a/frontend/src/components/charts/TradingViewEquity.tsx
+++ b/frontend/src/components/charts/TradingViewEquity.tsx
@@ -42,6 +42,9 @@ export function TradingViewEquity({ data, height = 280 }: Props) {
+  // Persistent series refs
+  const stratSeriesRef = useRef<any>(null);
+  const benchSeriesRef = useRef<any>(null);
+
+  // Effect 1: Initialize chart once on mount
+  // Effect 2: Call series.setData() when data changes without destroying chart
```

---

### Finding 12 [Low]: Hardcoded Magic Numbers and Asset-Class Inappropriate Annualization Factors

- **Location:**
  - `backend/app/engine/backtest_numba.py`, lines 53, 66, 97, 100, 167, 189, 242, 261, 271, 281
- **Specific Handbook Principle Violated:**
  - §2.5 Explicit vs. Implicit: Intention-revealing naming & Constants
  - §3.1 Catalog of Brittle Patterns: Magic values
- **Empirical Description:**
  Multiple unexplained magic numbers govern core financial calculations:
  - `rf_daily = 0.04 / 365.0`: Hardcoded 4% annual risk-free rate assumed for all assets.
  - `np.sqrt(365.0)`: Annualization factor applied unconditionally to both crypto and equities. Traditional equities trade 252 days per year; annualizing equity Sharpe ratios using 365 days distorts comparisons against standard financial benchmarks.
  - `trade_amount > 1.0`: Minimum order threshold hardcoded as `$1.00`.
  - `units_sold > 0.000001`: Minimum dust threshold hardcoded as a literal float.
  - `profit_factor = 999.0`: Arbitrary magic float representing infinite profit factor when gross loss is zero.

- **Remediation Pattern / Code Diff:**
  Extract financial parameters into configurable domain constants with asset-class awareness:

```diff
--- a/backend/app/engine/backtest_numba.py
+++ b/backend/app/engine/backtest_numba.py
@@ -8,2 +8,5 @@
+ANNUAL_DAYS_CRYPTO = 365.0
+ANNUAL_DAYS_EQUITY = 252.0
+DEFAULT_RISK_FREE_RATE = 0.04
+MIN_TRADE_USD = 1.0
+DUST_THRESHOLD_UNITS = 1e-6
```

---

### Finding 13 [Low]: Copy-Paste Duplication Across Chart and Export Utilities

- **Location:**
  - `frontend/src/components/charts/TradingViewCandlestick.tsx`, lines 34-41 & `TradingViewEquity.tsx`, lines 21-28 (`normalizeDate`)
  - `frontend/src/lib/export-utils.ts`, lines 96-99 & lines 131-134 (CSV serialization)
- **Specific Handbook Principle Violated:**
  - §2.2 DRY Without Duplication-Phobia: Rule of Three
  - §3.1 Catalog of Brittle Patterns: Copy-paste-driven development
- **Empirical Description:**
  The `normalizeDate` function is duplicated line-for-line across `TradingViewCandlestick.tsx` and `TradingViewEquity.tsx`.
  Similarly, the CSV header escaping and row joining logic in `export-utils.ts` is copy-pasted across `exportTradesToCsv` and `exportEquityToCsv`.

- **Remediation Pattern / Code Diff:**
  Extract `normalizeDate` into a shared `frontend/src/lib/date-utils.ts` and unify CSV table formatting into a single helper function `formatCsv(headers, rows)`.

---

## 4. Evaluation of §4 Guardrails & Never-Do List Compliance

| # | Never-Do Rule | Codebase Status | Findings / Violations |
|---|---|---|---|
| 1 | Leave a `catch` block empty or logging-only with no propagation or compensation | **Violated** | `frontend/src/app/simulator/page.tsx:127-130` swalllows `fetchMarketData` error into empty array without propagating to user UI. |
| 2 | Introduce module-level mutable state as substitute for passing state | **Pass** | No module-level `let` or shared mutable global singletons detected; parameters passed via props and requests. |
| 3 | Retry non-idempotent operation without deduplication mechanism | **Pass** | Backtests and optimizations are pure read-only simulations; retry handlers in UI are idempotent. |
| 4 | Cast to `any`/`unknown`/untyped `dict` across module or service boundary without schema | **Violated** | `backend/app/models/schemas.py:109-112` declares `dict` for trial results; `frontend/src/lib/api-client.ts:90` casts raw JSON without schema validation. |
| 5 | Reach into another module's internal/private files or unexported symbols | **Pass** | Clean module imports through top-level package names (`app.engine`, `app.models`, `@/lib`). |
| 6 | Hardcode a secret, credential, connection string, or environment-specific value | **Pass** | API base URLs, CORS origins, and paths configured via `Settings` and `process.env`. |
| 7 | Make a breaking change to shared contract in place without versioning | **Pass** | API routed under explicit `/api/v1` namespace. |
| 8 | Copy-paste a block of business logic a third time without extracting it | **Near Limit** | `normalizeDate` duplicated twice; CSV formatting duplicated twice; indicator safe division pattern repeated 3 times. |
| 9 | Ship a function with a side effect not visible from its name or signature | **Violated** | `compute_generic_channel` and `compute_btc_trolololo` have hidden lookahead dependencies on future data points across the series. |
| 10 | Claim a change is "tested" when only the happy path was exercised | **Pass** | Boundary tests cover empty arrays, flat prices, division-by-zero, and profit factor edge cases. |

---

## 5. Appendix: Pragmatic Systems One-Page Diff Checklist Assessment

- **Architecture:**
  - Respects module boundaries: **Yes**
  - External calls have timeouts: **Yes** (15s, 30s, 60s configured on frontend; 10s on backend `yfinance`)
  - Explicit failure behavior: **Partial** (Silent fallback to 50.0 indicator signals)
- **Code Quality:**
  - Functions are single-level-of-abstraction (SLAP): **Yes**
  - No `any`/untyped payloads cross boundary: **No** (`dict` in Pydantic schemas, unchecked client casts)
  - No premature abstraction: **Yes**
- **Smells:**
  - No empty/silent catch blocks: **No** (`fetchMarketData.catch` silent fallback in simulator page)
  - No magic strings/numbers encoding rules: **No** (365 annualization on equities, 999.0 profit factor)
  - No god objects: **Yes** (Clear division between engine, indicators, services, and API controllers)
- **Verification:**
  - Linter and type-checker clean: **Yes** (Both Python and TypeScript build cleanly)
  - Boundary and edge case test coverage: **Yes** (36 tests verifying boundary limits)
  - No hardcoded secrets: **Yes**

---

## 6. Prioritized Remediation Roadmap

1. **Phase 1: Critical Correctness (Immediate)**
   - Remove lookahead bias from `compute_btc_trolololo` and `compute_generic_channel` by converting whole-series regressions into expanding causal rolling windows.
   - Remove `.bfill()` operations from indicator quantile and standard deviation calculations.
   - Fix trade execution portfolio valuation in `run_backtest_full_trace` to align pricing with execution timing ($T+1$ open).

2. **Phase 2: Lifecycle & Resource Stability**
   - Clean up event listeners on external `AbortSignal` in `fetchWithTimeout`.
   - Remove redundant simulation triggers on asset selection in `simulator/page.tsx` and `optimizer/page.tsx`.
   - Implement atomic temporary file replacement in `data_fetcher.py` to eliminate concurrent write collisions.

3. **Phase 3: Strict Contracts & Schema Safety**
   - Replace untyped `dict` fields in `schemas.py` with strongly typed `OptimizeTrial` and `BacktestParams` models.
   - Introduce runtime schema validation (Zod) on the frontend API boundary.
   - Synchronize asset catalogs dynamically through the `GET /api/v1/assets` endpoint.
