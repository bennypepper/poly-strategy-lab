from __future__ import annotations

import numpy as np
import pandas as pd
from scipy import stats
import scipy.special as sp
from scipy.signal import argrelextrema

def compute_btc_trolololo(btc_close: pd.Series, algo_window: int = 365) -> pd.Series:
    """Causal Recursive Power-Law Channel Normalization for Bitcoin."""
    if not isinstance(btc_close.index, pd.DatetimeIndex):
        raise TypeError("btc_close must have a DatetimeIndex.")

    n = len(btc_close)
    dates = btc_close.index
    prices = btc_close.values.astype(float)
    
    BTC_GENESIS_DATE = pd.Timestamp("2009-01-03")
    d_raw = (dates - BTC_GENESIS_DATE).days.values.astype(float)

    valid = (d_raw > 0) & (prices > 0) & np.isfinite(prices)
    if valid.sum() < 10:
        raise ValueError("Insufficient valid data points (need >= 10).")

    x = np.full(n, np.nan)
    y = np.full(n, np.nan)
    x[valid] = np.log(d_raw[valid])
    y[valid] = np.log(prices[valid])

    x_clean = np.where(valid, x, 0.0)
    y_clean = np.where(valid, y, 0.0)

    S_x = x_clean.cumsum()
    S_y = y_clean.cumsum()
    S_xx = (x_clean ** 2).cumsum()
    S_xy = (x_clean * y_clean).cumsum()

    N = np.arange(1, n + 1, dtype=float)

    Var_x = S_xx - (S_x ** 2) / N
    Cov_xy = S_xy - (S_x * S_y) / N

    beta = np.zeros(n)
    alpha = np.zeros(n)
    
    valid_var = Var_x > 1e-12
    beta[valid_var] = Cov_xy[valid_var] / Var_x[valid_var]
    alpha[valid_var] = (S_y[valid_var] - beta[valid_var] * S_x[valid_var]) / N[valid_var]

    hat_mu = alpha + beta * x
    epsilon = y - hat_mu

    eps_series = pd.Series(epsilon, index=dates)
    med = eps_series.rolling(window=1460, min_periods=60).median()
    mad = (eps_series - med).abs().rolling(window=1460, min_periods=60).median()

    sigma_mad = 1.4826 * mad.clip(lower=0.05)
    Z = (eps_series - med) / sigma_mad

    signal = 50.0 * (1.0 + np.tanh(Z / 2.0))
    signal = signal.clip(0.0, 100.0).fillna(50.0)

    return pd.Series(signal.values, index=dates, name="signal")


def compute_generic_channel(close_series: pd.Series, window: int = 180) -> pd.Series:
    """
    Generalized logarithmic regression channel for non-BTC assets (ETH, SOL, etc.).
    Fits a causal walk-forward power-law channel based on rolling logarithmic trend and quantile envelopes.
    Strictly eliminates lookahead bias: each bar t evaluates using ONLY observations <= t.
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
    trend_all = np.full(n, np.nan)

    # Causal rolling regression: bar i only uses historical data <= i
    for i in range(30, n):
        w_start = max(0, i - window + 1)
        sub_t = t[w_start : i + 1]
        sub_p = np.log(prices[w_start : i + 1])
        valid_sub = np.isfinite(sub_p)
        if valid_sub.sum() >= 15:
            sl, ic, _, _, _ = stats.linregress(np.log(sub_t[valid_sub] + 30.0), sub_p[valid_sub])
            trend_all[i] = sl * np.log(t[i] + 30.0) + ic

    residuals = np.full(n, np.nan)
    valid_trend = np.isfinite(trend_all) & valid
    residuals[valid_trend] = np.log(prices[valid_trend]) - trend_all[valid_trend]

    # Compute rolling quantile bands strictly causally (NO bfill - CWE-Lookahead remediation)
    res_series = pd.Series(residuals, index=dates)
    res_filled = res_series.ffill().fillna(0.0)
    roll_top = res_filled.rolling(window=window, min_periods=30).quantile(0.95).ffill().fillna(0.1).values
    roll_bottom = res_filled.rolling(window=window, min_periods=30).quantile(0.05).ffill().fillna(-0.1).values

    channel_top = trend_all + roll_top
    channel_bottom = trend_all + roll_bottom
    channel_range = channel_top - channel_bottom
    safe_range = np.where(channel_range > 1e-6, channel_range, 1.0)

    raw = np.where(valid_trend & (channel_range > 1e-6), (np.log(prices) - channel_bottom) / safe_range, np.nan)
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

    # Causal volatility calculation without backward fill (NO bfill)
    eps_series = pd.Series(eps, index=dates)
    roll_std = eps_series.rolling(window=vol_window, min_periods=20).std().ffill().fillna(0.05).values
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

