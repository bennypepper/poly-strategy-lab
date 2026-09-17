import pytest
import numpy as np
import pandas as pd
from fastapi.testclient import TestClient
from app.main import app
from app.engine.optimizer_grid import run_grid_search
from app.models.schemas import OptimizeRequest

client = TestClient(app)

def test_grid_search_no_valid_combinations():
    """When buy_thresholds >= sell_thresholds, run_grid_search must raise ValueError."""
    dates = pd.date_range("2023-01-01", periods=50, freq="D")
    df = pd.DataFrame({
        "open": np.linspace(100, 200, 50),
        "close": np.linspace(101, 201, 50),
        "signal": np.full(50, 50.0),
    }, index=dates)

    with pytest.raises(ValueError, match="No valid trial combinations evaluated"):
        run_grid_search(
            df=df,
            buy_thresholds=[80, 90],
            sell_thresholds=[20, 30],
            alloc_pcts=[0.5],
        )

def test_grid_search_empty_alloc_pcts():
    """Empty alloc_pcts should be caught cleanly without IndexError."""
    dates = pd.date_range("2023-01-01", periods=50, freq="D")
    df = pd.DataFrame({
        "open": np.linspace(100, 200, 50),
        "close": np.linspace(101, 201, 50),
        "signal": np.full(50, 50.0),
    }, index=dates)

    with pytest.raises(ValueError):
        run_grid_search(
            df=df,
            buy_thresholds=[20],
            sell_thresholds=[80],
            alloc_pcts=[],
        )

def test_optimizer_api_incompatible_thresholds_status_code():
    """Optimizer API endpoint should return 400 or 422 for impossible combinations, not 500."""
    payload = {
        "symbol": "BTC-USD",
        "buy_thresholds": [85, 90],
        "sell_thresholds": [10, 20],
        "alloc_pcts": [0.5],
    }
    response = client.post("/api/v1/optimize", json=payload)
    # Handbook §1.3: Client errors must return 4xx (400 or 422), never 500 Internal Server Error
    assert response.status_code in (400, 422), f"Expected 400 or 422, got {response.status_code}: {response.text}"
