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
