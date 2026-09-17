import pytest
import numpy as np
import pandas as pd
from app.engine.backtest_numba import run_backtest_numba, run_backtest_full_trace

def test_numba_empty_arrays():
    """Empty arrays should return zeroed metrics without crashing or ZeroDivisionError."""
    empty = np.array([], dtype=float)
    res = run_backtest_numba(
        signals=empty,
        prices_open=empty,
        prices_close=empty,
        threshold_buy=30,
        threshold_sell=70,
        alloc_buy_pct=0.5,
    )
    assert res == (0.0, 0.0, 0.0, 0, 0, 0)

def test_numba_single_element_array():
    """Single-day array should not crash."""
    sig = np.array([50.0], dtype=float)
    po = np.array([100.0], dtype=float)
    pc = np.array([100.0], dtype=float)
    res = run_backtest_numba(
        signals=sig,
        prices_open=po,
        prices_close=pc,
        threshold_buy=30,
        threshold_sell=70,
        alloc_buy_pct=0.5,
    )
    assert res == (0.0, 0.0, 0.0, 0, 0, 0)

def test_numba_zero_or_negative_initial_cash():
    """Zero or negative initial cash should return safe defaults without division by zero."""
    sig = np.array([20.0, 80.0], dtype=float)
    po = np.array([100.0, 110.0], dtype=float)
    pc = np.array([100.0, 110.0], dtype=float)
    res = run_backtest_numba(
        signals=sig,
        prices_open=po,
        prices_close=pc,
        threshold_buy=30,
        threshold_sell=70,
        alloc_buy_pct=0.5,
        initial_cash=0.0,
    )
    assert res[0] == 0.0  # total_return should be 0.0

def test_full_trace_requires_datetime_index():
    """DataFrame with non-DatetimeIndex must raise TypeError."""
    df = pd.DataFrame({
        "open": [100.0, 105.0],
        "close": [102.0, 106.0],
        "signal": [20.0, 80.0],
    })  # Integer RangeIndex
    with pytest.raises(TypeError, match="DatetimeIndex"):
        run_backtest_full_trace(df, 30, 70, 0.5)

def test_full_trace_zero_initial_cash_raises():
    """initial_cash <= 0 must raise ValueError."""
    dates = pd.date_range("2023-01-01", periods=10, freq="D")
    df = pd.DataFrame({
        "open": np.linspace(100, 110, 10),
        "close": np.linspace(100, 110, 10),
        "signal": np.full(10, 50.0),
    }, index=dates)
    with pytest.raises(ValueError, match="initial_cash"):
        run_backtest_full_trace(df, 30, 70, 0.5, initial_cash=0.0)

def test_full_trace_flat_price_sharpe_zero():
    """When prices are flat, volatility is 0, Sharpe ratio must be safely 0.0."""
    dates = pd.date_range("2023-01-01", periods=20, freq="D")
    df = pd.DataFrame({
        "open": np.full(20, 100.0),
        "close": np.full(20, 100.0),
        "signal": np.full(20, 50.0),
    }, index=dates)
    res = run_backtest_full_trace(df, 30, 70, 0.5)
    assert res["metrics"]["sharpe_ratio"] == 0.0
    assert res["metrics"]["sortino_ratio"] == 0.0
    assert res["metrics"]["max_drawdown_pct"] == 0.0

def test_full_trace_profit_factor_economic_reality():
    """
    Test economic reality of Profit Factor:
    A strategy that makes 2 tiny winning trades ($1 profit each) and 1 massive losing trade ($90,000 loss)
    must NOT report a profit factor >= 1.0!
    """
    dates = pd.date_range("2023-01-01", periods=7, freq="D")
    # Day 0: Signal 10 (buy) -> executes day 1 at open $100
    # Day 1: Signal 90 (sell) -> executes day 2 at open $101 (win: ~$1k)
    # Day 2: Signal 10 (buy) -> executes day 3 at open $100
    # Day 3: Signal 90 (sell) -> executes day 4 at open $101 (win: ~$1k)
    # Day 4: Signal 10 (buy) -> executes day 5 at open $100
    # Day 5: Signal 90 (sell) -> executes day 6 at open $10 (massive loss: ~$90k)
    # Day 6: hold
    df = pd.DataFrame({
        "open": [100.0, 100.0, 101.0, 100.0, 101.0, 100.0, 10.0],
        "close": [100.0, 100.0, 101.0, 100.0, 101.0, 100.0, 10.0],
        "signal": [10.0, 90.0, 10.0, 90.0, 10.0, 90.0, 50.0],
    }, index=dates)

    res = run_backtest_full_trace(df, threshold_buy=20, threshold_sell=80, alloc_buy_pct=1.0, fee_rate=0.0)
    metrics = res["metrics"]
    assert metrics["profitable_trades"] == 2
    assert metrics["total_trades"] == 6  # 3 buys, 3 sells
    assert metrics["total_return_pct"] < -80.0  # Massive overall loss
    # The profit factor MUST be strictly less than 1.0 (gross profit / gross loss is around ~0.02)
    assert metrics["profit_factor"] < 0.1, f"Profit factor is {metrics['profit_factor']}, but strategy lost >80%!"

def test_full_trace_all_winning_trades_profit_factor():
    """When all sell trades are profitable (0 losses), profit factor should not crash."""
    dates = pd.date_range("2023-01-01", periods=5, freq="D")
    df = pd.DataFrame({
        "open": [100.0, 100.0, 110.0, 110.0, 120.0],
        "close": [100.0, 100.0, 110.0, 110.0, 120.0],
        "signal": [10.0, 90.0, 50.0, 50.0, 50.0],
    }, index=dates)
    res = run_backtest_full_trace(df, threshold_buy=20, threshold_sell=80, alloc_buy_pct=1.0)
    assert res["metrics"]["profitable_trades"] == 1
    assert res["metrics"]["profit_factor"] >= 1.0
