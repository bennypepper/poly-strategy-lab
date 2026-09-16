import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_list_assets():
    response = client.get("/api/v1/assets")
    assert response.status_code == 200
    assets = response.json()
    assert len(assets) >= 3
    symbols = [a["symbol"] for a in assets]
    assert "BTC-USD" in symbols
    assert "ETH-USD" in symbols
    assert "SOL-USD" in symbols

def test_backtest_validation_error():
    # Buy threshold must be strictly less than sell threshold
    payload = {
        "symbol": "BTC-USD",
        "threshold_buy": 80,
        "threshold_sell": 40,
        "alloc_buy_pct": 0.8,
    }
    response = client.post("/api/v1/backtest", json=payload)
    assert response.status_code == 422
