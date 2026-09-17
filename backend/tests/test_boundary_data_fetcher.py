import typing
import pytest
import pandas as pd
from unittest.mock import patch, MagicMock
from app.services.data_fetcher import get_supported_assets, fetch_market_data

def test_supported_assets_type_hints():
    """Ensure get_supported_assets typing is fully resolvable at runtime without NameError."""
    # This will raise NameError if 'Any' is not imported in data_fetcher
    hints = typing.get_type_hints(get_supported_assets)
    assert "return" in hints

def test_fetch_market_data_cache_fallback_on_network_error(tmp_path):
    """When network download fails, data_fetcher should fall back to existing cache if present."""
    symbol = "TEST-USD"
    cache_file = tmp_path / f"{symbol}.parquet"
    dates = pd.date_range("2023-01-01", periods=20, freq="D")
    sample_df = pd.DataFrame({
        "open": [100.0] * 20,
        "high": [105.0] * 20,
        "low": [95.0] * 20,
        "close": [102.0] * 20,
        "volume": [1000.0] * 20,
        "signal": [50.0] * 20,
    }, index=dates)
    sample_df.to_parquet(cache_file)

    with patch("app.services.data_fetcher.settings.DATA_CACHE_DIR", str(tmp_path)):
        with patch("app.services.data_fetcher.yf.download", side_effect=Exception("Network Timeout")):
            df = fetch_market_data(symbol, use_cache=False)
            assert len(df) == 20
            assert "signal" in df.columns

def test_fetch_market_data_network_error_without_cache_raises(tmp_path):
    """When network download fails and no cache exists, exception must propagate."""
    symbol = "NOCACHE-USD"
    with patch("app.services.data_fetcher.settings.DATA_CACHE_DIR", str(tmp_path)):
        with patch("app.services.data_fetcher.yf.download", side_effect=Exception("Connection refused")):
            with pytest.raises(Exception, match="Connection refused"):
                fetch_market_data(symbol, use_cache=False)

def test_fetch_market_data_date_slicing(tmp_path):
    """Date slicing start_date and end_date should accurately filter output."""
    symbol = "SLICE-USD"
    cache_file = tmp_path / f"{symbol}.parquet"
    dates = pd.date_range("2023-01-01", periods=30, freq="D")
    sample_df = pd.DataFrame({
        "open": [100.0] * 30,
        "high": [105.0] * 30,
        "low": [95.0] * 30,
        "close": [102.0] * 30,
        "volume": [1000.0] * 30,
        "signal": [50.0] * 30,
    }, index=dates)
    sample_df.to_parquet(cache_file)

    with patch("app.services.data_fetcher.settings.DATA_CACHE_DIR", str(tmp_path)):
        df = fetch_market_data(symbol, start_date="2023-01-10", end_date="2023-01-20")
        assert len(df) == 11
        assert str(df.index[0].date()) == "2023-01-10"
        assert str(df.index[-1].date()) == "2023-01-20"


def test_supported_assets_contains_top_ten_crypto():
    """Ensure SUPPORTED_ASSETS registers at least 10 major crypto assets with valid schema."""
    assets = get_supported_assets()
    assert len(assets) >= 10
    symbols = [a["symbol"] for a in assets]
    expected_top = ["BTC-USD", "ETH-USD", "SOL-USD", "BNB-USD", "XRP-USD", "ADA-USD", "DOGE-USD", "AVAX-USD", "LINK-USD", "NEAR-USD"]
    for expected in expected_top:
        assert expected in symbols

    # Unique check
    assert len(symbols) == len(set(symbols))

    # Schema integrity
    required_keys = {"symbol", "name", "category", "base_currency", "first_available_date", "is_active"}
    for a in assets:
        assert required_keys.issubset(a.keys())
        assert a["is_active"] is True

