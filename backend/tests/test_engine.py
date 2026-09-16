import numpy as np
import pandas as pd
import pytest
from app.engine.backtest_numba import run_backtest_numba, run_backtest_full_trace

def test_engine_numba_execution():
    n = 100
    signals = np.full(n, 50.0)
    signals[10:15] = 20.0  # Buy triggers
    signals[40:45] = 80.0  # Sell triggers
    open_prices = np.linspace(100.0, 150.0, n)
    close_prices = open_prices * 1.01

    tot_ret, mdd, sharpe, wins, sells, trades = run_backtest_numba(
        signals=signals,
        prices_open=open_prices,
        prices_close=close_prices,
        threshold_buy=30,
        threshold_sell=70,
        alloc_buy_pct=0.8,
        alloc_sell_pct=1.0,
        initial_cash=10_000.0,
        fee_rate=0.001,
    )

    assert trades > 0
    assert sells > 0
    assert np.isfinite(tot_ret)
    assert 0.0 <= mdd <= 1.0
    assert np.isfinite(sharpe)

def test_engine_full_trace_structure():
    dates = pd.date_range("2023-01-01", periods=150, freq="D")
    df = pd.DataFrame({
        "open": np.linspace(2000, 3000, 150),
        "high": np.linspace(2050, 3050, 150),
        "low": np.linspace(1950, 2950, 150),
        "close": np.linspace(2020, 3020, 150),
        "volume": np.full(150, 1000.0),
        "signal": np.random.uniform(10, 90, 150),
    }, index=dates)

    res = run_backtest_full_trace(
        df=df,
        threshold_buy=30,
        threshold_sell=70,
        alloc_buy_pct=0.5,
        initial_cash=50_000.0,
    )

    assert "metrics" in res
    assert "benchmark" in res
    assert "equity_curve" in res
    assert "trades" in res
    assert len(res["equity_curve"]) > 0
