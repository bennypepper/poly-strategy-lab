import numpy as np
import pandas as pd
import pytest
from app.indicators.dynamic_channel import (
    compute_btc_trolololo,
    compute_generic_channel,
    compute_normalized_signal,
)

def test_generic_channel_output_bounds():
    dates = pd.date_range("2021-01-01", periods=200, freq="D")
    prices = 100.0 * np.exp(np.linspace(0, 1.5, 200) + np.random.normal(0, 0.05, 200))
    s = pd.Series(prices, index=dates)

    sig = compute_generic_channel(s)
    assert len(sig) == 200
    assert (sig >= 0.0).all()
    assert (sig <= 100.0).all()
    assert not sig.isna().any()

def test_btc_trolololo_parity_bounds():
    dates = pd.date_range("2015-01-01", periods=1000, freq="D")
    prices = 300.0 * np.exp(np.linspace(0, 3.0, 1000))
    s = pd.Series(prices, index=dates)

    sig = compute_btc_trolololo(s)
    assert len(sig) == 1000
    valid = sig.dropna()
    assert len(valid) > 0
    assert (valid >= 0.0).all()
    assert (valid <= 100.0).all()

def test_router_selection():
    dates = pd.date_range("2022-01-01", periods=100, freq="D")
    s = pd.Series(np.linspace(100, 200, 100), index=dates)

    sig_eth = compute_normalized_signal("ETH-USD", s)
    assert len(sig_eth) == 100
    assert (sig_eth >= 0.0).all() and (sig_eth <= 100.0).all()

def test_btc_indicator_strict_causality():
    dates = pd.date_range("2015-01-01", periods=1000, freq="D")
    prices = 300.0 * np.exp(np.linspace(0, 3.0, 1000)) + np.random.normal(0, 10, 1000)
    prices = np.maximum(prices, 1.0)
    s = pd.Series(prices, index=dates)

    T = 800
    s_slice = s.iloc[:T]
    sig_slice = compute_btc_trolololo(s_slice)
    sig_full = compute_btc_trolololo(s)

    assert np.isclose(sig_slice.iloc[-1], sig_full.iloc[T-1])

def test_generic_channel_gradient_continuity():
    dates = pd.date_range("2021-01-01", periods=200, freq="D")
    prices = 100.0 * np.exp(np.linspace(0, 1.5, 200))
    s1 = pd.Series(prices, index=dates)
    
    prices2 = prices.copy()
    prices2[-1] *= 1.1 # Extreme move up
    s2 = pd.Series(prices2, index=dates)
    
    sig1 = compute_generic_channel(s1)
    sig2 = compute_generic_channel(s2)
    
    assert sig1.iloc[-1] != sig2.iloc[-1]
    assert 0 < sig1.iloc[-1] < 100
    assert 0 < sig2.iloc[-1] < 100

def test_equity_channel_smooth_continuity():
    from app.indicators.dynamic_channel import compute_equity_channel
    dates = pd.date_range("2021-01-01", periods=300, freq="D")
    prices = 100.0 * np.exp(np.linspace(0, 1.0, 300))
    s = pd.Series(prices, index=dates)
    
    sig = compute_equity_channel(s)
    
    assert not sig.isna().any()
    # Check that warmup is set to 50
    assert (sig.iloc[:200] == 50.0).all()
    # Check that after 200, it's smooth and there's no discrete jumps
    diffs = np.abs(np.diff(sig.iloc[200:]))
    assert (diffs < 10.0).all() # No massive jumps
