import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from app.main import app
from app.models.schemas import validate_ticker_symbol, OptimizeRequest, BacktestRequest
from app.services.data_fetcher import resolve_safe_cache_path, _FAILED_TICKER_COOLDOWN

client = TestClient(app)

def test_ticker_validation_rejects_path_traversal():
    """Verify ticker validation strictly rejects directory traversal characters."""
    bad_tickers = [
        "..\\master_dataset",
        "../../etc/passwd",
        "BTC/../USD",
        "ETH\\..\\cache",
        "SPY; rm -rf /",
        "<script>alert(1)</script>",
        "BTC USD",
        "TOOLONGTICKERNAMEEXCEEDINGTWENTYCHARS",
    ]
    for bad in bad_tickers:
        with pytest.raises(ValueError):
            validate_ticker_symbol(bad)

def test_ticker_validation_accepts_legitimate_symbols():
    """Verify valid crypto and equity symbols pass validation cleanly."""
    valid_tickers = ["BTC-USD", "ETH-USD", "SOL-USDT", "QQQ", "SPY", "BRK.B", "BRK-B"]
    for valid in valid_tickers:
        assert validate_ticker_symbol(valid) == valid.upper()

def test_resolve_safe_cache_path_traversal_detection():
    """Verify resolve_safe_cache_path prevents escaping the cache base directory."""
    base_dir = Path("data/cache").resolve()
    # Legitimate symbol
    safe_path = resolve_safe_cache_path(base_dir, "BTC-USD")
    assert safe_path.is_relative_to(base_dir)
    assert safe_path.name == "BTC-USD.parquet"

    # Directory traversal attempt
    with pytest.raises((PermissionError, ValueError)):
        resolve_safe_cache_path(base_dir, "..\\..\\evil")

def test_optimizer_combination_cap():
    """Verify optimizer rejects requests with more than 500 combinations to prevent CPU starvation."""
    # 10 x 10 x 6 = 600 combinations (exceeds 500)
    with pytest.raises(ValueError, match="exceeds the maximum allowable cap of 500"):
        OptimizeRequest(
            symbol="BTC-USD",
            buy_thresholds=[10, 15, 20, 25, 30, 35, 40, 45, 50, 55],
            sell_thresholds=[60, 65, 70, 75, 80, 85, 90, 95, 98, 99],
            alloc_pcts=[0.1, 0.2, 0.4, 0.6, 0.8, 1.0],
        )

def test_optimizer_array_length_bounds():
    """Verify individual threshold arrays cannot exceed 15 elements."""
    with pytest.raises(ValueError):
        OptimizeRequest(
            symbol="BTC-USD",
            buy_thresholds=list(range(16)),
        )

def test_optimizer_valid_combinations_pass():
    """Standard 144 combinations (6 x 6 x 4) must validate without error."""
    req = OptimizeRequest(
        symbol="BTC-USD",
        buy_thresholds=[15, 20, 25, 30, 35, 40],
        sell_thresholds=[60, 65, 70, 75, 80, 85],
        alloc_pcts=[0.4, 0.6, 0.8, 1.0],
    )
    assert len(req.buy_thresholds) == 6
    assert len(req.sell_thresholds) == 6
    assert len(req.alloc_pcts) == 4

def test_security_headers_present_in_responses():
    """Verify core HTTP security headers are injected into all HTTP responses."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.headers.get("X-Content-Type-Options") == "nosniff"
    assert response.headers.get("X-Frame-Options") == "DENY"
    assert response.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"
    assert "1; mode=block" in response.headers.get("X-XSS-Protection", "")

def test_payload_size_limit_middleware():
    """Verify requests with Content-Length exceeding 1MB are rejected with 413."""
    response = client.post(
        "/api/v1/backtest",
        headers={"Content-Length": "2000000", "Content-Type": "application/json"},
        content=b"{}",
    )
    assert response.status_code == 413
    assert "Payload too large" in response.json()["detail"]

def test_market_data_endpoint_rejects_path_traversal():
    """Verify GET /api/v1/market-data/{symbol} rejects directory traversal input with 422."""
    response = client.get("/api/v1/market-data/..%5C..%5Cmaster_dataset")
    # Ticker validation must fail
    assert response.status_code == 422
