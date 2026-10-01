# Quantitative Overhaul and Lookahead Bias Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remediate critical econometric biases, fatal lookahead leakage in Bitcoin cycle anchors, annualization distortions (252 vs 365 days) in the backtest engine, altcoin beta-decoupling omissions, and discrete parameter cliffs across Poly Strategy Lab.

**Architecture:** 
1. Parameterize `run_backtest_numba` and `run_backtest_full_trace` with asset-aware annualization factors (252 trading days for US equities, 365 days for cryptocurrencies) and calibrated daily risk-free rates.
2. Replace static Trolololo Bitcoin regression and post-2026 forward-peeking `argrelextrema` with a strictly causal Causal Recursive Power-Law (CRPL) channel anchored to the Bitcoin Genesis block (2009-01-03) with expanding OLS and Tanh-MAD continuous normalization.
3. Replace naive altcoin regression with the Dynamic Adaptive Residual Channel (DARC), decoupling Bitcoin market beta and applying robust MAD scaling without tail clipping.
4. Smooth equity indicator regime transitions to continuous functions, eliminating discrete step cliffs in optimizer parameter sweeps.
5. Upgrade the grid optimizer to support out-of-sample walk-forward cross-validation.

**Tech Stack:** Python 3.11, FastAPI, Numba JIT, Pandas, NumPy, SciPy, PyTest.

**Spec:** `docs/research/CRYPTO_METHODOLOGY.md` and `docs/research/EQUITY_ETF_METHODOLOGY.md`.

## Global Constraints

- No text emojis anywhere in code, comments, responses, or commit messages.
- No em dashes anywhere; use standard hyphens (-) or colons (:).
- All changes must pass existing and new test suites under `py -3.11 -m pytest backend/tests`.
- Strict git safety: keep all commits local; never run `git push` automatically.
- Maintain zero-lookahead causality: every metric and indicator at bar $t$ must strictly use data $\le t$.

---

## Phase 1: Engine Metric Calibration (252 vs 365 Trading Days)

### Task 1: Asset-Aware Annualization Factor in Backtest Kernels

**Files:**
- Modify: `backend/app/engine/backtest_numba.py:10-103`
- Modify: `backend/app/engine/backtest_numba.py:105-332`
- Modify: `backend/app/api/v1/backtest.py:31-41`
- Modify: `backend/app/engine/optimizer_grid.py:39-50`
- Test: `backend/tests/test_boundary_backtest.py`
- Test: `backend/tests/test_engine.py`

**Interfaces:**
- Consumes: `annualization_factor: float = 365.0`, `risk_free_rate: float = 0.04` in backtester functions.
- Produces: Correctly annualized Sharpe, Sortino, and CAGR metrics:
  - For equities (QQQ, SPY): `annualization_factor = 252.0`, `rf_daily = 0.04 / 252.0`.
  - For crypto (BTC, ETH, etc.): `annualization_factor = 365.0`, `rf_daily = 0.04 / 365.0`.

- [ ] **Step 1: Write failing test for 252 vs 365 annualization**

In `backend/tests/test_boundary_backtest.py`, add `test_annualization_factor_equity_vs_crypto`:
```python
def test_annualization_factor_equity_vs_crypto():
    # Verify that passing annualization_factor=252 yields correct scaling vs 365
    ...
```

- [ ] **Step 2: Run test to verify it fails**

Run: `py -3.11 -m pytest backend/tests/test_boundary_backtest.py -k test_annualization_factor`
Expected: FAIL due to missing parameter or mismatched Sharpe ratio.

- [ ] **Step 3: Update `run_backtest_numba` and `run_backtest_full_trace`**

In `backend/app/engine/backtest_numba.py`:
- Add `annualization_factor: float = 365.0` to `run_backtest_numba` and `run_backtest_full_trace`.
- Replace hardcoded `365.0` in Sharpe, Sortino, and benchmark Sharpe with `annualization_factor`.
- Set `rf_daily = 0.04 / annualization_factor`.
- In `backend/app/api/v1/backtest.py` and `optimizer_grid.py`, resolve `annualization_factor = 252.0 if classify_asset(symbol) == "equity" else 365.0`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `py -3.11 -m pytest backend/tests`
Expected: PASS (all 45+ tests green).

- [ ] **Step 5: Local commit**

```bash
git add backend/app/engine/backtest_numba.py backend/app/engine/optimizer_grid.py backend/app/api/v1/backtest.py backend/tests/
git commit -m "fix(engine): calibrate Sharpe and Sortino annualization factors for equities vs crypto"
```

---

## Phase 2: Causal Bitcoin Power-Law (CRPL) Channel

### Task 2: Implement Causal Recursive Power-Law Channel for Bitcoin

**Files:**
- Modify: `backend/app/indicators/dynamic_channel.py:9-108`
- Test: `backend/tests/test_dynamic_channel.py`
- Test: `backend/tests/test_boundary_indicators.py`

**Interfaces:**
- Consumes: `btc_close: pd.Series` with `DatetimeIndex`.
- Produces: `pd.Series` named `"signal"` bounded in $[0.0, 100.0]$ with zero lookahead bias.
- Replaces: Lookahead-contaminated `BTC_CONFIRMED_HIGHS`, `BTC_CONFIRMED_LOWS`, global OLS, and `argrelextrema(order=365)`.

- [ ] **Step 1: Write test verifying strict causality (no lookahead bias)**

In `backend/tests/test_dynamic_channel.py`, add `test_btc_indicator_strict_causality`:
```python
def test_btc_indicator_strict_causality():
    # Signal at bar t must NOT change when appending future bars t+1...t+100
    ...
```

- [ ] **Step 2: Run test to verify it fails on existing `compute_btc_trolololo`**

Run: `py -3.11 -m pytest backend/tests/test_dynamic_channel.py -k test_btc_indicator_strict_causality`
Expected: FAIL (because global regression currently recalculates historical signals when new bars are added).

- [ ] **Step 3: Implement Causal Recursive Power-Law (CRPL) in `compute_btc_trolololo`**

In `backend/app/indicators/dynamic_channel.py`:
- Anchor time vector strictly to Bitcoin Genesis block: `BTC_GENESIS = pd.Timestamp("2009-01-03")`.
- Elapsed days: $t_i = (dates_i - \text{BTC\_GENESIS}).\text{days}$.
- For bars $i \ge 180$, run causal expanding OLS of $\ln(P_\tau)$ against $\ln(t_\tau)$.
- Extract causal residuals: $\epsilon_i = \ln(P_i) - \hat{\mu}_i$.
- Compute rolling 4-year cycle ($W = 1460$ bars) Median Absolute Deviation: $\text{MAD}_i$.
- Calculate continuous Tanh-MAD signal:
  $$\text{Signal}_i = 50.0 \cdot \left(1.0 + \tanh\left(\frac{\ln(P_i) - \hat{\mu}_i}{2.0 \cdot 1.4826 \cdot \text{MAD}_i}\right)\right)$$
- Remove hardcoded peak/trough lists and `argrelextrema`.

- [ ] **Step 4: Run test suite to verify causality and bounds**

Run: `py -3.11 -m pytest backend/tests/test_dynamic_channel.py backend/tests/test_boundary_indicators.py`
Expected: PASS.

- [ ] **Step 5: Local commit**

```bash
git add backend/app/indicators/dynamic_channel.py backend/tests/
git commit -m "feat(indicators): replace Trolololo with Causal Recursive Power-Law channel for Bitcoin"
```

---

## Phase 3: Dynamic Adaptive Residual Channel (DARC) for Altcoins

### Task 3: Implement DARC with Beta Decoupling & Continuous Tanh-MAD

**Files:**
- Modify: `backend/app/indicators/dynamic_channel.py:110-158`
- Modify: `backend/app/services/data_fetcher.py:208-212`
- Test: `backend/tests/test_dynamic_channel.py`
- Test: `backend/tests/test_boundary_indicators.py`

**Interfaces:**
- Consumes: Altcoin `close_series: pd.Series`, optional `btc_close_series: Optional[pd.Series]`.
- Produces: `pd.Series` named `"signal"` in $[0.0, 100.0]$ with no hard clipping cliffs ($dS/dx \ne 0$).

- [ ] **Step 1: Write test for non-zero gradient across tail events**

In `backend/tests/test_dynamic_channel.py`, verify that a 3-sigma event and 6-sigma event produce differentiated signals ($S_1 \ne S_2 \ne 100.0$).

- [ ] **Step 2: Run test to verify it fails on hard-clipped `compute_generic_channel`**

Run: `py -3.11 -m pytest backend/tests/test_dynamic_channel.py -k test_gradient`
Expected: FAIL.

- [ ] **Step 3: Implement DARC in `compute_generic_channel`**

In `backend/app/indicators/dynamic_channel.py`:
- Use calendar date anchoring (asset first observation) rather than raw index length.
- Calculate causal rolling trend or trailing log-return residual.
- Standardize via rolling Median and Median Absolute Deviation (MAD).
- Map to $[0.0, 100.0]$ via $50 \times (1 + \tanh(Z / 2.5))$.

- [ ] **Step 4: Run tests and verify**

Run: `py -3.11 -m pytest backend/tests`
Expected: PASS.

- [ ] **Step 5: Local commit**

```bash
git add backend/app/indicators/dynamic_channel.py backend/tests/
git commit -m "feat(indicators): implement DARC with Tanh-MAD continuous normalization for altcoins"
```

---

## Phase 4: Continuous Valuation Smoothing for Equities

### Task 4: Smooth Signal Gating in `compute_equity_channel`

**Files:**
- Modify: `backend/app/indicators/dynamic_channel.py:263-288`
- Test: `backend/tests/test_boundary_indicators.py`
- Test: `backend/tests/test_optimizer.py`

**Interfaces:**
- Consumes: `close_series: pd.Series`.
- Produces: Smooth, continuous signal without step discontinuities (e.g. eliminating jumps between 10.0, 50.0, 95.0).
- Applies EMA warmup masking for the first 200 bars.

- [ ] **Step 1: Write test verifying continuity of equity signal**
- [ ] **Step 2: Implement continuous sigmoid regime transition and warmup mask**
- [ ] **Step 3: Run pytest on backend tests**
- [ ] **Step 4: Local commit**

```bash
git add backend/app/indicators/dynamic_channel.py backend/tests/
git commit -m "feat(indicators): smooth equity regime transitions and mask EMA warmup"
```

---

## Phase 5: Walk-Forward Cross-Validation in Optimizer Grid

### Task 5: Add Walk-Forward Out-of-Sample Metrics to Grid Search

**Files:**
- Modify: `backend/app/engine/optimizer_grid.py`
- Modify: `backend/app/models/schemas.py`
- Modify: `backend/app/api/v1/optimizer.py`
- Test: `backend/tests/test_optimizer.py`
- Test: `backend/tests/test_boundary_optimizer.py`

**Interfaces:**
- Consumes: `df: pd.DataFrame`, `in_sample_pct: float = 0.7`.
- Produces: `in_sample_metrics` and `out_of_sample_metrics` for best parameters to detect overfitting.

- [ ] **Step 1: Write test for train/test split parameter verification**
- [ ] **Step 2: Implement in-sample vs out-of-sample evaluation**
- [ ] **Step 3: Run pytest on optimizer test suite**
- [ ] **Step 4: Local commit**

```bash
git add backend/app/engine/optimizer_grid.py backend/app/models/schemas.py backend/app/api/v1/optimizer.py backend/tests/
git commit -m "feat(optimizer): introduce walk-forward out-of-sample validation to prevent data snooping"
```
