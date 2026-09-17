from __future__ import annotations

import numpy as np
import pandas as pd
from scipy import stats
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


def compute_normalized_signal(symbol: str, close_series: pd.Series) -> pd.Series:
    """Entry point router: uses exact BTC calibration for BTC-USD, generic channel for others."""
    sym_clean = symbol.upper().replace("-USD", "").replace("/", "")
    if sym_clean in ("BTC", "BITCOIN"):
        return compute_btc_trolololo(close_series)
    return compute_generic_channel(close_series)
