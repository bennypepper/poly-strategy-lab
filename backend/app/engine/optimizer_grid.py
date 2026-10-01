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
    annualization_factor: float = 365.0,
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
                    annualization_factor=annualization_factor,
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

    # Generate 2D Heatmap Matrix for default/middle allocation with O(1) lookup
    target_alloc = alloc_pcts[len(alloc_pcts) // 2]
    lookup = {
        (t["threshold_buy"], t["threshold_sell"]): t["sharpe_ratio"]
        for t in trials
        if abs(t["alloc_buy_pct"] - target_alloc) < 1e-4
    }
    matrix = [
        [lookup.get((tb, ts)) for ts in sell_thresholds]
        for tb in buy_thresholds
    ]

    walk_forward = None
    if len(df) >= 100:
        split_idx = int(len(df) * 0.7)
        train_df = df.iloc[:split_idx]
        test_df = df.iloc[split_idx:]
        
        train_signals = train_df[signal_col].values.astype(float)
        train_open = train_df["open"].values.astype(float)
        train_close = train_df["close"].values.astype(float)
        
        best_train_sharpe = -999.0
        best_train_params = None
        best_train_ret = 0.0
        
        for alloc in alloc_pcts:
            for tb in buy_thresholds:
                for ts in sell_thresholds:
                    if tb >= ts:
                        continue
                    tot_ret, mdd, sharpe, wins, sells, trades = run_backtest_numba(
                        signals=train_signals,
                        prices_open=train_open,
                        prices_close=train_close,
                        threshold_buy=int(tb),
                        threshold_sell=int(ts),
                        alloc_buy_pct=float(alloc),
                        alloc_sell_pct=1.0,
                        initial_cash=initial_cash,
                        fee_rate=fee_rate,
                        annualization_factor=annualization_factor,
                    )
                    if sharpe > best_train_sharpe:
                        best_train_sharpe = sharpe
                        best_train_params = (int(tb), int(ts), float(alloc))
                        best_train_ret = tot_ret
        
        if best_train_params:
            tb_opt, ts_opt, alloc_opt = best_train_params
            
            test_signals = test_df[signal_col].values.astype(float)
            test_open = test_df["open"].values.astype(float)
            test_close = test_df["close"].values.astype(float)
            
            oos_ret, oos_mdd, oos_sharpe, _, _, _ = run_backtest_numba(
                signals=test_signals,
                prices_open=test_open,
                prices_close=test_close,
                threshold_buy=tb_opt,
                threshold_sell=ts_opt,
                alloc_buy_pct=alloc_opt,
                alloc_sell_pct=1.0,
                initial_cash=initial_cash,
                fee_rate=fee_rate,
                annualization_factor=annualization_factor,
            )
            
            eff_ratio = oos_sharpe / max(best_train_sharpe, 0.01)
            if eff_ratio >= 0.7 and oos_sharpe > 0.5:
                status = "Robust"
            elif eff_ratio >= 0.4:
                status = "Moderate"
            else:
                status = "Overfit"
                
            def _format_date(idx_val):
                if hasattr(idx_val, "date"):
                    return str(idx_val.date())
                return str(idx_val).split(" ")[0]
                
            walk_forward = {
                "in_sample_period": f"{_format_date(train_df.index[0])} to {_format_date(train_df.index[-1])}",
                "out_of_sample_period": f"{_format_date(test_df.index[0])} to {_format_date(test_df.index[-1])}",
                "in_sample_sharpe": round(float(best_train_sharpe), 3),
                "out_of_sample_sharpe": round(float(oos_sharpe), 3),
                "in_sample_return_pct": round(float(best_train_ret * 100.0), 2),
                "out_of_sample_return_pct": round(float(oos_ret * 100.0), 2),
                "out_of_sample_mdd_pct": round(float(oos_mdd * 100.0), 2),
                "efficiency_ratio": round(float(eff_ratio), 2),
                "status": status
            }

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
        "walk_forward": walk_forward,
    }
