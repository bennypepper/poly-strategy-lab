from __future__ import annotations

import numpy as np
import pandas as pd
from scipy import stats
import scipy.special as sp
from scipy.signal import argrelextrema

# ── BTC Ground Truth Constants ───────────────────────────────────────────────
BTC_ORIGIN_DATE = pd.Timestamp("2012-01-01")
BTC_TOP_SLOPE: float = 2.900
BTC_TOP_OFFSET: int = 1400
BTC_BOTTOM_SLOPE: float = 2.788
BTC_BOTTOM_OFFSET: int = 1200
BTC_INTERCEPT: float = 19.463
BTC_FIRST_HIGH_CORRECTION: float = 0.6

BTC_CONFIRMED_HIGHS = ["2013-04-09", "2013-11-30", "2017-12-17", "2021-11-10"]
BTC_CONFIRMED_LOWS = ["2012-11-18", "2015-01-14", "2018-12-15", "2022-11-21"]
BTC_MARKS_CUTOFF_DATE = pd.Timestamp("2026-01-01")


def _nearest_index(dates: pd.DatetimeIndex, date_str: str) -> int:
    ts = pd.Timestamp(date_str)
    return int(dates.get_indexer([ts], method="nearest")[0])


def compute_btc_trolololo(btc_close: pd.Series, algo_window: int = 365) -> pd.Series:
    """Exact calibrated Trolololo Dynamic Channel Normalization for Bitcoin."""
    if not isinstance(btc_close.index, pd.DatetimeIndex):
        raise TypeError("btc_close must have a DatetimeIndex.")

    n = len(btc_close)
    dates = btc_close.index
    prices = btc_close.values.astype(float)
    d_raw = (dates - BTC_ORIGIN_DATE).days.values.astype(float)

    valid = (d_raw > 0) & (prices > 0) & np.isfinite(prices)
    if valid.sum() < 10:
        raise ValueError("Insufficient valid data points (need >= 10).")

    price_log = np.full(n, np.nan)
    price_log[valid] = np.log(prices[valid])

    LN10 = np.log(10.0)
    top_base = np.full(n, np.nan)
    bottom_base = np.full(n, np.nan)
    top_base[valid] = LN10 * (BTC_TOP_SLOPE * np.log(d_raw[valid] + BTC_TOP_OFFSET) - BTC_INTERCEPT)
    bottom_base[valid] = LN10 * (BTC_BOTTOM_SLOPE * np.log(d_raw[valid] + BTC_BOTTOM_OFFSET) - BTC_INTERCEPT)

    res_top = price_log - top_base
    res_bottom = price_log - bottom_base

    high_marks = np.zeros(n, dtype=bool)
    low_marks = np.zeros(n, dtype=bool)

    for d in BTC_CONFIRMED_HIGHS:
        ts = pd.Timestamp(d)
        if dates[0] <= ts <= dates[-1]:
            high_marks[_nearest_index(dates, d)] = True

    for d in BTC_CONFIRMED_LOWS:
        ts = pd.Timestamp(d)
        if dates[0] <= ts <= dates[-1]:
            low_marks[_nearest_index(dates, d)] = True

    if dates.max() > BTC_MARKS_CUTOFF_DATE:
        cutoff_pos = int(dates.searchsorted(BTC_MARKS_CUTOFF_DATE))
        log_prices_filled = pd.Series(price_log).ffill().values
        if algo_window < n:
            algo_highs = argrelextrema(log_prices_filled, np.greater, order=algo_window)[0]
            algo_lows = argrelextrema(log_prices_filled, np.less, order=algo_window)[0]
            for idx in algo_highs:
                if idx >= cutoff_pos:
                    high_marks[idx] = True
            for idx in algo_lows:
                if idx >= cutoff_pos:
                    low_marks[idx] = True

    hi_idx = np.where(high_marks)[0]
    lo_idx = np.where(low_marks)[0]
    hi_idx = hi_idx[np.isfinite(res_top[hi_idx])]
    lo_idx = lo_idx[np.isfinite(res_bottom[lo_idx])]
    all_pos = np.arange(n, dtype=float)

    if len(hi_idx) < 2 or len(lo_idx) < 2:
        channel_range = top_base - bottom_base
        safe_range_early = np.where(channel_range > 0, channel_range, 1.0)
        raw = np.where(valid & (channel_range > 0), (price_log - bottom_base) / safe_range_early, np.nan)
        return pd.Series(np.where(np.isfinite(raw), np.clip(raw, 0.0, 1.0) * 100.0, np.nan), index=dates, name="signal")

    hi_y = res_top[hi_idx].copy()
    hi_y[0] *= BTC_FIRST_HIGH_CORRECTION
    slope_top, intercept_top, _, _, _ = stats.linregress(hi_idx.astype(float), hi_y)
    top_drift = slope_top * all_pos + intercept_top

    lo_y = res_bottom[lo_idx].copy()
    slope_bot, intercept_bot, _, _, _ = stats.linregress(lo_idx.astype(float), lo_y)
    bottom_drift = slope_bot * all_pos + intercept_bot

    channel_top = top_base + top_drift
    channel_bottom = bottom_base + bottom_drift
    channel_range = channel_top - channel_bottom
    safe_range = np.where(channel_range > 1e-6, channel_range, 1.0)

    raw = np.where(valid & (channel_range > 1e-6), (price_log - channel_bottom) / safe_range, np.nan)
    return pd.Series(np.where(np.isfinite(raw), np.clip(raw, 0.0, 1.0) * 100.0, np.nan), index=dates, name="signal")


def compute_generic_channel(close_series: pd.Series, window: int = 180) -> pd.Series:
    """
    Generalized logarithmic regression channel for non-BTC assets (ETH, SOL, etc.).
    Fits an adaptive power-law channel based on logarithmic trend and quantile envelopes.
    """
    if not isinstance(close_series.index, pd.DatetimeIndex):
        raise TypeError("close_series must have a DatetimeIndex.")

    n = len(close_series)
    dates = close_series.index
    prices = close_series.values.astype(float)

    valid = (prices > 0) & np.isfinite(prices)
    if valid.sum() < 30:
        return pd.Series(np.full(n, 50.0), index=dates, name="signal")

    t = np.arange(n, dtype=float)
    t_valid = t[valid]
    log_p = np.log(prices[valid])

    # Fit central log-linear trend: ln(P) = a * ln(t + 30) + b
    log_t = np.log(t_valid + 30.0)
    slope, intercept, _, _, _ = stats.linregress(log_t, log_p)
    trend_all = slope * np.log(t + 30.0) + intercept

    residuals = np.full(n, np.nan)
    residuals[valid] = np.log(prices[valid]) - trend_all[valid]

    # Compute rolling quantile bands for upper/lower channel envelopes
    res_series = pd.Series(residuals, index=dates)
    res_filled = res_series.ffill().bfill()
    roll_top = res_filled.rolling(window=window, min_periods=30).quantile(0.95).bfill().ffill().values
    roll_bottom = res_filled.rolling(window=window, min_periods=30).quantile(0.05).bfill().ffill().values

    channel_top = trend_all + roll_top
    channel_bottom = trend_all + roll_bottom
    channel_range = channel_top - channel_bottom
    safe_range = np.where(channel_range > 1e-6, channel_range, 1.0)

    raw = np.where(valid & (channel_range > 1e-6), (np.log(prices) - channel_bottom) / safe_range, np.nan)
    return pd.Series(np.where(np.isfinite(raw), np.clip(raw, 0.0, 1.0) * 100.0, 50.0), index=dates, name="signal")


def classify_asset(symbol: str) -> str:
    """
    Classify an asset into 'crypto' or 'equity'.
    - 'crypto': pairs ending with -USD, -USDT, or recognized crypto symbols.
    - 'equity': traditional equity and stock index ETF tickers (e.g. QQQ, SPY, AAPL, NVDA, MSFT).
    """
    sym_upper = symbol.strip().upper()
    if (
        sym_upper.endswith("-USD")
        or sym_upper.endswith("-USDT")
        or sym_upper.endswith("/USD")
        or sym_upper.endswith("/USDT")
    ):
        return "crypto"

    known_cryptos = {
        "BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "DOGE", "AVAX", "LINK", "NEAR",
        "DOT", "MATIC", "LTC", "BCH", "UNI", "ATOM", "SHIB", "ICP", "FIL", "XLM",
        "SUI", "APT", "PEPE", "HBAR", "RENDER", "FET", "INJ", "TIA"
    }
    if sym_upper in known_cryptos:
        return "crypto"

    return "equity"


def compute_equity_channel(
    close_series: pd.Series,
    trend_window: int = 252,
    vol_window: int = 63,
) -> pd.Series:
    """
    Integrated Equity Compounding Channel with Secular Regime Trend Filtering.
    - Causal rolling log-linear regression over trend_window (default 252 trading days).
    - Standardized Gaussian valuation oscillator: Omega_t = 100 * Phi(Z_t).
    - Dual-Regime Macro Trend Gate (50-EMA vs 200-EMA):
      * Secular Bear (EMA50 <= EMA200): Forces defensive risk-off signal (95.0), protecting
        against multi-year drawdowns (e.g. Dot-Com -83%, GFC -55%).
      * Secular Bull (EMA50 > EMA200): Accumulates pullbacks (Omega_t <= 30), holds through
        compounding runs, and trims parabolic extensions.
    """
    if not isinstance(close_series.index, pd.DatetimeIndex):
        raise TypeError("close_series must have a DatetimeIndex.")

    n = len(close_series)
    dates = close_series.index
    prices = close_series.values.astype(float)

    valid = (prices > 0) & np.isfinite(prices)
    if valid.sum() < 60:
        return pd.Series(np.full(n, 50.0), index=dates, name="signal")

    # Stage 1: Macro Secular Trend Regime
    s = pd.Series(prices, index=dates)
    ema_50 = s.ewm(span=50, adjust=False).mean().values
    ema_200 = s.ewm(span=200, adjust=False).mean().values
    regime = (ema_50 > ema_200).astype(int)

    # Stage 2: Walk-Forward Causal Rolling Log-Linear Regression
    log_p = np.full(n, np.nan)
    log_p[valid] = np.log(prices[valid])

    W = min(trend_window, int(valid.sum()))
    if W < 30:
        return pd.Series(np.full(n, 50.0), index=dates, name="signal")

    x = np.arange(W, dtype=float)
    x_bar = (W - 1) / 2.0
    var_x = np.sum((x - x_bar) ** 2)

    hat_y = np.full(n, np.nan)
    for i in range(W - 1, n):
        y_win = log_p[i - W + 1 : i + 1]
        if np.all(np.isfinite(y_win)):
            y_bar = np.mean(y_win)
            cov_xy = np.sum((x - x_bar) * (y_win - y_bar))
            slope = cov_xy / var_x
            hat_y[i] = y_bar + slope * x_bar

    # For earlier rows before W, use expanding window
    for i in range(30, min(W - 1, n)):
        y_win = log_p[: i + 1]
        if np.all(np.isfinite(y_win)):
            cur_w = i + 1
            cur_x = np.arange(cur_w, dtype=float)
            cur_x_bar = (cur_w - 1) / 2.0
            cur_var_x = np.sum((cur_x - cur_x_bar) ** 2)
            if cur_var_x > 1e-6:
                y_bar = np.mean(y_win)
                cov_xy = np.sum((cur_x - cur_x_bar) * (y_win - y_bar))
                hat_y[i] = y_bar + (cov_xy / cur_var_x) * cur_x_bar

    # Stage 3: Detrended Residuals & Z-Score
    eps = np.full(n, np.nan)
    valid_hat = np.isfinite(hat_y)
    eps[valid_hat] = log_p[valid_hat] - hat_y[valid_hat]

    eps_series = pd.Series(eps, index=dates)
    roll_std = eps_series.rolling(window=vol_window, min_periods=20).std().bfill().ffill().values
    safe_std = np.where((roll_std > 1e-4) & np.isfinite(roll_std), roll_std, 0.05)

    z = np.where(valid_hat, eps / safe_std, 0.0)

    # Stage 4: Gaussian Valuation Oscillator
    omega = 100.0 * 0.5 * (1.0 + sp.erf(z / np.sqrt(2.0)))

    # Stage 5: Gated Signal Synthesis
    signal = np.full(n, 50.0)
    for i in range(1, n):
        if not valid_hat[i]:
            signal[i] = 50.0
        elif regime[i] == 0:
            # Secular Bear: force defensive liquidation / prohibit buys
            signal[i] = 95.0
        elif regime[i] == 1 and regime[i - 1] == 0:
            # Bull Initiation: trigger long entry
            signal[i] = 10.0
        elif omega[i] <= 30.0:
            # Bull Pullback: accumulate value
            signal[i] = max(5.0, float(omega[i]))
        elif omega[i] >= 95.0:
            # Parabolic extension in bull market: tactical trim
            signal[i] = 95.0
        else:
            # Normal Bull Trend Compounding: Hold position
            signal[i] = 50.0

    return pd.Series(signal, index=dates, name="signal")


def compute_normalized_signal(symbol: str, close_series: pd.Series) -> pd.Series:
    """
    Entry point router: selects the mathematically appropriate quantitative engine
    based on the asset class:
    - Equities & Stock Index ETFs (QQQ, SPY, etc.): Integrated Equity Compounding Channel with Secular Regime Filter.
    - Bitcoin: Calibrated Macroeconomic Halving Adoption Model (Trolololo).
    - Altcoins & Crypto Pairs: Empirical Adaptive Logarithmic Channel.
    """
    asset_type = classify_asset(symbol)
    if asset_type == "equity":
        return compute_equity_channel(close_series)

    sym_clean = symbol.upper().replace("-USD", "").replace("-USDT", "").replace("/", "")
    if sym_clean in ("BTC", "BITCOIN"):
        return compute_btc_trolololo(close_series)
    return compute_generic_channel(close_series)

