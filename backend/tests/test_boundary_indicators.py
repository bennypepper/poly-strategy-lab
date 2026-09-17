import numpy as np
import pandas as pd
import pytest
from app.indicators.dynamic_channel import (
    compute_btc_trolololo,
    compute_generic_channel,
    compute_normalized_signal,
)

def test_generic_channel_insufficient_data():
    """Less than 30 data points should gracefully return 50.0 without crashing."""
    dates = pd.date_range("2023-01-01", periods=15, freq="D")
    prices = pd.Series(np.linspace(100, 110, 15), index=dates)
    sig = compute_generic_channel(prices)
    assert len(sig) == 15
    assert (sig == 50.0).all()

def test_generic_channel_flat_price():
    """Flat price (zero variance) should produce default 50.0 signals rather than NaN."""
    dates = pd.date_range("2023-01-01", periods=100, freq="D")
    prices = pd.Series(np.full(100, 150.0), index=dates)
    sig = compute_generic_channel(prices)
    assert len(sig) == 100
    assert not sig.isna().any()
    assert (sig == 50.0).all()

def test_generic_channel_non_datetime_index_raises():
    """Non-DatetimeIndex must raise TypeError explicitly."""
    s = pd.Series([100.0, 105.0, 110.0])
    with pytest.raises(TypeError, match="DatetimeIndex"):
        compute_generic_channel(s)

def test_btc_trolololo_non_datetime_index_raises():
    """Non-DatetimeIndex must raise TypeError explicitly."""
    s = pd.Series([100.0, 105.0, 110.0])
    with pytest.raises(TypeError, match="DatetimeIndex"):
        compute_btc_trolololo(s)

def test_btc_trolololo_insufficient_points_raises():
    """Fewer than 10 valid points should raise ValueError."""
    dates = pd.date_range("2023-01-01", periods=5, freq="D")
    prices = pd.Series([100.0, 105.0, 102.0, 108.0, 110.0], index=dates)
    with pytest.raises(ValueError, match="Insufficient valid data points"):
        compute_btc_trolololo(prices)

def test_compute_normalized_signal_routing():
    """Router must route BTC variants to Trolololo and other assets to generic."""
    dates = pd.date_range("2023-01-01", periods=50, freq="D")
    prices = pd.Series(np.linspace(100, 200, 50), index=dates)
    sig_btc = compute_normalized_signal("BTC-USD", prices)
    sig_sol = compute_normalized_signal("SOL-USD", prices)
    assert isinstance(sig_btc, pd.Series)
    assert isinstance(sig_sol, pd.Series)
