import numpy as np
import pandas as pd
import pytest
from app.indicators.dynamic_channel import (
    compute_btc_trolololo,
    compute_generic_channel,
    compute_equity_channel,
    compute_normalized_signal,
    classify_asset,
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

def test_classify_asset_distinguishes_crypto_and_equity():
    """Asset classifier must accurately categorize crypto pairs vs standard equity tickers."""
    assert classify_asset("BTC-USD") == "crypto"
    assert classify_asset("ETH-USD") == "crypto"
    assert classify_asset("SOL-USDT") == "crypto"
    assert classify_asset("DOGE") == "crypto"
    assert classify_asset("AVAX") == "crypto"
    assert classify_asset("QQQ") == "equity"
    assert classify_asset("SPY") == "equity"
    assert classify_asset("AAPL") == "equity"
    assert classify_asset("NVDA") == "equity"
    assert classify_asset("MSFT") == "equity"

def test_compute_equity_channel_insufficient_data():
    """Less than 60 data points should gracefully return 50.0 without crashing."""
    dates = pd.date_range("2023-01-01", periods=30, freq="D")
    prices = pd.Series(np.linspace(100, 150, 30), index=dates)
    sig = compute_equity_channel(prices)
    assert len(sig) == 30
    assert (sig == 50.0).all()

def test_compute_equity_channel_non_datetime_index_raises():
    """Non-DatetimeIndex must raise TypeError explicitly."""
    s = pd.Series([100.0, 105.0, 110.0])
    with pytest.raises(TypeError, match="DatetimeIndex"):
        compute_equity_channel(s)

def test_compute_equity_channel_bounded_signal():
    """Equity channel must generate strictly bounded [0, 100] signals across long series."""
    dates = pd.date_range("2015-01-01", periods=400, freq="D")
    prices = pd.Series(np.exp(np.linspace(4.0, 6.0, 400)) + np.random.normal(0, 5, 400), index=dates)
    sig = compute_equity_channel(prices)
    assert len(sig) == 400
    assert not sig.isna().any()
    assert (sig >= 0.0).all()
    assert (sig <= 100.0).all()

def test_compute_normalized_signal_routes_equity_to_equity_channel():
    """Routing QQQ must activate equity channel without error."""
    dates = pd.date_range("2020-01-01", periods=300, freq="D")
    prices = pd.Series(np.linspace(200, 400, 300), index=dates)
    sig_qqq = compute_normalized_signal("QQQ", prices)
    assert isinstance(sig_qqq, pd.Series)
    assert len(sig_qqq) == 300
    assert not sig_qqq.isna().any()

