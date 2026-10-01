from __future__ import annotations

import numpy as np
import pandas as pd
from numba import njit
from typing import Tuple, Dict, Any, List


@njit
def run_backtest_numba(
    signals: np.ndarray,
    prices_open: np.ndarray,
    prices_close: np.ndarray,
    threshold_buy: int,
    threshold_sell: int,
    alloc_buy_pct: float,
    alloc_sell_pct: float = 1.0,
    initial_cash: float = 100_000.0,
    fee_rate: float = 0.001,
    annualization_factor: float = 365.0,
) -> Tuple[float, float, float, int, int, int]:
    """
    Numba JIT-compiled backtest loop for arbitrary assets.
    Returns: (total_return, max_drawdown, sharpe_ratio, wins, sell_count, trade_count)
    """
    n_days = len(signals)
    if n_days < 2 or initial_cash <= 0.0:
        return 0.0, 0.0, 0.0, 0, 0, 0

    cash = initial_cash
    holdings = 0.0
    trade_count = 0
    wins = 0
    sell_count = 0

    portfolio_value = np.zeros(n_days, dtype=np.float64)
    daily_returns = np.zeros(n_days, dtype=np.float64)
    avg_entry_price = 0.0
    portfolio_value[0] = initial_cash

    for i in range(n_days - 1):
        sig = signals[i]
        p_exec = prices_open[i + 1]
        p_close = prices_close[i]

        curr_val = cash + (holdings * p_close)
        portfolio_value[i] = curr_val
        if i > 0:
            prev = portfolio_value[i - 1]
            daily_returns[i] = (curr_val - prev) / prev if prev > 0 else 0.0

        if sig <= threshold_buy:
            trade_amount = cash * alloc_buy_pct
            if trade_amount > 1.0:  # Minimum $1 guard
                fee = trade_amount * fee_rate
                net_usd = trade_amount - fee
                units_bought = net_usd / p_exec
                total_cost = (holdings * avg_entry_price) + trade_amount
                holdings += units_bought
                if holdings > 0:
                    avg_entry_price = total_cost / holdings
                cash -= trade_amount
                trade_count += 1

        elif sig >= threshold_sell:
            units_sold = holdings * alloc_sell_pct
            if units_sold > 0.000001:  # Dust guard
                gross_usd = units_sold * p_exec
                fee = gross_usd * fee_rate
                net_usd = gross_usd - fee
                cost_sold = units_sold * avg_entry_price
                cash += net_usd
                holdings -= units_sold
                trade_count += 1
                if net_usd > cost_sold:
                    wins += 1
                sell_count += 1

    # Final day valuation
    portfolio_value[n_days - 1] = cash + (holdings * prices_close[n_days - 1])
    prev = portfolio_value[n_days - 2] if n_days >= 2 else initial_cash
    daily_returns[n_days - 1] = (portfolio_value[n_days - 1] - prev) / prev if prev > 0 else 0.0

    total_return = (portfolio_value[-1] - initial_cash) / initial_cash

    max_drawdown = 0.0
    peak = portfolio_value[0]
    for i in range(n_days):
        if portfolio_value[i] > peak:
            peak = portfolio_value[i]
        dd = (peak - portfolio_value[i]) / peak if peak > 0 else 0.0
        if dd > max_drawdown:
            max_drawdown = dd

    returns_slice = daily_returns[1:] if n_days > 1 else daily_returns
    mean_ret = np.mean(returns_slice)
    std_ret = np.std(returns_slice)
    rf_daily = 0.04 / annualization_factor
    sharpe_ratio = 0.0
    if std_ret > 0:
        sharpe_ratio = ((mean_ret - rf_daily) / std_ret) * np.sqrt(annualization_factor)

    return total_return, max_drawdown, sharpe_ratio, wins, sell_count, trade_count


def run_backtest_full_trace(
    df: pd.DataFrame,
    threshold_buy: int,
    threshold_sell: int,
    alloc_buy_pct: float,
    alloc_sell_pct: float = 1.0,
    initial_cash: float = 100_000.0,
    fee_rate: float = 0.001,
    signal_col: str = "signal",
    annualization_factor: float = 365.0,
) -> Dict[str, Any]:
    """Full trace simulation returning equity curve and execution logs."""
    if not isinstance(df.index, pd.DatetimeIndex):
        raise TypeError("DataFrame index must be a DatetimeIndex.")
    if initial_cash <= 0.0:
        raise ValueError("initial_cash must be strictly greater than 0.")

    n_days = len(df)
    if n_days < 2:
        raise ValueError("DataFrame must contain at least 2 rows for execution.")

    dates = df.index
    signals = df[signal_col].values.astype(float)
    prices_open = df["open"].values.astype(float)
    prices_close = df["close"].values.astype(float)

    cash = float(initial_cash)
    holdings = 0.0
    avg_entry_price = 0.0

    trade_log: List[Dict[str, Any]] = []
    pv = np.zeros(n_days, dtype=float)
    dr = np.zeros(n_days, dtype=float)
    cash_history = np.zeros(n_days, dtype=float)
    holdings_history = np.zeros(n_days, dtype=float)

    pv[0] = initial_cash
    cash_history[0] = cash
    holdings_history[0] = holdings

    trade_count = 0
    wins = 0
    sell_count = 0
    gross_profit = 0.0
    gross_loss = 0.0

    for i in range(n_days - 1):
        sig = signals[i]
        p_exec = prices_open[i + 1]
        p_close = prices_close[i]
        date_str = str(dates[i].date())

        curr_val = cash + (holdings * p_close)
        pv[i] = curr_val
        cash_history[i] = cash
        holdings_history[i] = holdings

        if i > 0:
            prev = pv[i - 1]
            dr[i] = (curr_val - prev) / prev if prev > 0 else 0.0

        if sig <= threshold_buy:
            trade_amount = cash * alloc_buy_pct
            if trade_amount > 1.0 and p_exec > 0.0:
                fee = trade_amount * fee_rate
                net_usd = trade_amount - fee
                units_bought = net_usd / p_exec
                total_cost = (holdings * avg_entry_price) + trade_amount
                holdings += units_bought
                if holdings > 0:
                    avg_entry_price = total_cost / holdings
                cash -= trade_amount
                trade_count += 1
                trade_log.append({
                    "date": str(dates[i + 1].date()),
                    "type": "BUY",
                    "price": float(p_exec),
                    "shares": float(units_bought),
                    "cost": float(trade_amount),
                    "cash_after": float(cash),
                    "port_value": float(cash + (holdings * p_exec)),
                    "pnl": 0.0,
                })

        elif sig >= threshold_sell:
            units_sold = holdings * alloc_sell_pct
            if units_sold > 0.000001 and p_exec > 0.0:
                gross_usd = units_sold * p_exec
                fee = gross_usd * fee_rate
                net_usd = gross_usd - fee
                cost_sold = units_sold * avg_entry_price
                trade_pnl = net_usd - cost_sold

                cash += net_usd
                holdings -= units_sold
                trade_count += 1
                sell_count += 1
                if trade_pnl > 0.0:
                    wins += 1
                    gross_profit += trade_pnl
                elif trade_pnl < 0.0:
                    gross_loss += abs(trade_pnl)

                trade_log.append({
                    "date": str(dates[i + 1].date()),
                    "type": "SELL",
                    "price": float(p_exec),
                    "shares": float(units_sold),
                    "cost": float(gross_usd),
                    "cash_after": float(cash),
                    "port_value": float(cash + (holdings * p_exec)),
                    "pnl": round(float(trade_pnl), 2),
                })

    final_close = prices_close[-1]
    pv[-1] = cash + (holdings * final_close)
    cash_history[-1] = cash
    holdings_history[-1] = holdings
    prev = pv[-2] if n_days >= 2 else initial_cash
    dr[-1] = (pv[-1] - prev) / prev if prev > 0 else 0.0

    # Benchmark: Buy & Hold
    bh_units = (initial_cash * (1.0 - fee_rate)) / prices_open[0] if prices_open[0] > 0 else 0.0
    bh_pv = bh_units * prices_close
    bh_return = (bh_pv[-1] - initial_cash) / initial_cash
    bh_daily_ret = np.diff(prices_close) / prices_close[:-1]

    bh_mdd = 0.0
    bh_peak = prices_close[0]
    for p in prices_close:
        if p > bh_peak:
            bh_peak = p
        dd = (bh_peak - p) / bh_peak if bh_peak > 0 else 0.0
        if dd > bh_mdd:
            bh_mdd = dd

    bh_std = float(np.std(bh_daily_ret))
    rf_daily = 0.04 / annualization_factor
    bh_sharpe = float(((np.mean(bh_daily_ret) - rf_daily) / bh_std) * np.sqrt(annualization_factor)) if bh_std > 1e-8 else 0.0

    # Strategy Metrics
    total_return = float((pv[-1] - initial_cash) / initial_cash)
    mdd = 0.0
    peak = pv[0]
    for v in pv:
        if v > peak:
            peak = v
        dd = (peak - v) / peak if peak > 0 else 0.0
        if dd > mdd:
            mdd = dd

    returns_slice = dr[1:] if len(dr) > 1 else dr
    std_ret = float(np.std(returns_slice))
    mean_ret = float(np.mean(returns_slice))

    sharpe = 0.0
    if std_ret > 1e-8:
        sharpe = float(((mean_ret - rf_daily) / std_ret) * np.sqrt(annualization_factor))

    # Sortino ratio (downside deviation)
    negative_returns = returns_slice[returns_slice < 0]
    downside_std = float(np.std(negative_returns)) if len(negative_returns) > 0 else 0.0
    sortino = 0.0
    if downside_std > 1e-8:
        sortino = float(((mean_ret - rf_daily) / downside_std) * np.sqrt(annualization_factor))

    # CAGR
    years = max((dates[-1] - dates[0]).days / 365.25, 0.1)
    cagr = float(((pv[-1] / initial_cash) ** (1.0 / years)) - 1.0) if pv[-1] > 0 else -1.0
    calmar = float(cagr / mdd) if mdd > 0 else 0.0

    win_rate = float(wins / sell_count) if sell_count > 0 else 0.0

    # True Profit Factor (Gross Profits / Gross Losses)
    if gross_loss > 1e-6:
        profit_factor = round(float(gross_profit / gross_loss), 2)
    elif gross_profit > 1e-6:
        profit_factor = 999.0
    else:
        profit_factor = 0.0

    # Equity points
    equity_curve = []
    step = max(1, n_days // 500)  # Downsample for network efficiency if very large
    for idx in range(0, n_days, step):
        equity_curve.append({
            "date": str(dates[idx].date()),
            "equity": round(float(pv[idx]), 2),
            "benchmark_equity": round(float(bh_pv[idx]), 2),
            "cash": round(float(cash_history[idx]), 2),
            "asset_holdings": round(float(holdings_history[idx]), 6),
            "signal_val": round(float(signals[idx]), 2) if np.isfinite(signals[idx]) else 0.0,
            "close_price": round(float(prices_close[idx]), 2),
        })

    # Ensure last day is always included
    if (n_days - 1) % step != 0:
        equity_curve.append({
            "date": str(dates[-1].date()),
            "equity": round(float(pv[-1]), 2),
            "benchmark_equity": round(float(bh_pv[-1]), 2),
            "cash": round(float(cash_history[-1]), 2),
            "asset_holdings": round(float(holdings_history[-1]), 6),
            "signal_val": round(float(signals[-1]), 2) if np.isfinite(signals[-1]) else 0.0,
            "close_price": round(float(prices_close[-1]), 2),
        })

    return {
        "metrics": {
            "final_equity": round(float(pv[-1]), 2),
            "total_return_pct": round(total_return * 100.0, 2),
            "cagr_pct": round(cagr * 100.0, 2),
            "max_drawdown_pct": round(mdd * 100.0, 2),
            "sharpe_ratio": round(sharpe, 3),
            "sortino_ratio": round(sortino, 3),
            "calmar_ratio": round(calmar, 3),
            "win_rate_pct": round(win_rate * 100.0, 2),
            "total_trades": int(trade_count),
            "profitable_trades": int(wins),
            "profit_factor": float(profit_factor),
        },
        "benchmark": {
            "buy_hold_return_pct": round(bh_return * 100.0, 2),
            "buy_hold_mdd_pct": round(bh_mdd * 100.0, 2),
            "buy_hold_sharpe": round(bh_sharpe, 3),
        },
        "equity_curve": equity_curve,
        "trades": trade_log,
    }
