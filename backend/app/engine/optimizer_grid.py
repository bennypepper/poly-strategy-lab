from __future__ import annotations

import numpy as np
import pandas as pd
from typing import Dict, List, Any
from app.engine.backtest_numba import run_backtest_numba


def run_grid_search(
    df: pd.DataFrame,
    buy_thresholds: List[int],
    sell_thresholds: List[int],
    alloc_pcts: List[float],
    initial_cash: float = 100_000.0,
    fee_rate: float = 0.001,
    signal_col: str = "signal",
) -> Dict[str, Any]:
    """
    Exhaustive grid search across threshold and allocation combinations using Numba.
    Returns optimal parameter rankings and 2D sensitivity matrix.
    """
    if not alloc_pcts:
        raise ValueError("alloc_pcts cannot be empty.")
    if not buy_thresholds or not sell_thresholds:
        raise ValueError("buy_thresholds and sell_thresholds cannot be empty.")

    signals = df[signal_col].values.astype(float)
    prices_open = df["open"].values.astype(float)
    prices_close = df["close"].values.astype(float)

    trials = []

    for alloc in alloc_pcts:
        for tb in buy_thresholds:
            for ts in sell_thresholds:
                if tb >= ts:
                    continue

                tot_ret, mdd, sharpe, wins, sells, trades = run_backtest_numba(
                    signals=signals,
                    prices_open=prices_open,
                    prices_close=prices_close,
                    threshold_buy=int(tb),
                    threshold_sell=int(ts),
                    alloc_buy_pct=float(alloc),
                    alloc_sell_pct=1.0,
                    initial_cash=initial_cash,
                    fee_rate=fee_rate,
                )

                win_rate = (wins / sells * 100.0) if sells > 0 else 0.0

                trials.append({
                    "threshold_buy": int(tb),
                    "threshold_sell": int(ts),
                    "alloc_buy_pct": round(float(alloc), 2),
                    "total_return_pct": round(float(tot_ret * 100.0), 2),
                    "max_drawdown_pct": round(float(mdd * 100.0), 2),
                    "sharpe_ratio": round(float(sharpe), 3),
                    "win_rate_pct": round(float(win_rate), 2),
                    "trade_count": int(trades),
                })

    if not trials:
        raise ValueError("No valid trial combinations evaluated.")

    # Sort rankings
    best_return = sorted(trials, key=lambda x: x["total_return_pct"], reverse=True)[0]
    best_sharpe = sorted(trials, key=lambda x: x["sharpe_ratio"], reverse=True)[0]
    best_mdd = sorted(trials, key=lambda x: x["max_drawdown_pct"])[0]

    # Generate 2D Heatmap Matrix for default/middle allocation
    target_alloc = alloc_pcts[len(alloc_pcts) // 2]
    matrix = []
    for tb in buy_thresholds:
        row = []
        for ts in sell_thresholds:
            match = next(
                (t for t in trials if t["threshold_buy"] == tb and t["threshold_sell"] == ts and abs(t["alloc_buy_pct"] - target_alloc) < 1e-4),
                None,
            )
            row.append(match["sharpe_ratio"] if match else None)
        matrix.append(row)

    return {
        "total_trials": len(trials),
        "target_alloc_for_heatmap": round(float(target_alloc), 2),
        "buy_thresholds": buy_thresholds,
        "sell_thresholds": sell_thresholds,
        "heatmap_matrix": matrix,
        "best_by_return": best_return,
        "best_by_sharpe": best_sharpe,
        "best_by_drawdown": best_mdd,
        "top_trials": sorted(trials, key=lambda x: x["sharpe_ratio"], reverse=True)[:15],
    }
