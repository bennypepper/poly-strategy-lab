import numpy as np
import pandas as pd
import pytest
from app.engine.optimizer_grid import run_grid_search

def test_grid_search_execution():
    dates = pd.date_range("2023-01-01", periods=100, freq="D")
    df = pd.DataFrame({
        "open": np.linspace(2000, 3000, 100),
        "close": np.linspace(2010, 3010, 100),
        "signal": np.random.uniform(10, 90, 100),
    }, index=dates)

    res = run_grid_search(
        df=df,
        buy_thresholds=[20, 30],
        sell_thresholds=[70, 80],
        alloc_pcts=[0.5, 1.0],
        initial_cash=10_000.0,
    )

    assert "total_trials" in res
    assert res["total_trials"] == 8  # 2 allocs * 2 buys * 2 sells
    assert "best_by_return" in res
    assert "best_by_sharpe" in res
    assert "best_by_drawdown" in res
    assert "heatmap_matrix" in res
    assert len(res["heatmap_matrix"]) == 2
