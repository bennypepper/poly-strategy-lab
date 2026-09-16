from fastapi import APIRouter, HTTPException
from app.models.schemas import BacktestRequest, BacktestResponse
from app.services.data_fetcher import fetch_market_data
from app.engine.backtest_numba import run_backtest_full_trace

router = APIRouter(prefix="/backtest", tags=["Backtest"])

@router.post("", response_model=BacktestResponse)
async def execute_backtest(req: BacktestRequest):
    """Execute strategy backtest on historical market data for requested asset."""
    try:
        df = fetch_market_data(
            symbol=req.symbol,
            start_date=req.start_date,
            end_date=req.end_date,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Data fetch error: {str(e)}")

    if len(df) < 10:
        raise HTTPException(status_code=400, detail="Insufficient data points for the requested timeframe.")

    try:
        result = run_backtest_full_trace(
            df=df,
            threshold_buy=req.threshold_buy,
            threshold_sell=req.threshold_sell,
            alloc_buy_pct=req.alloc_buy_pct,
            alloc_sell_pct=1.0,
            initial_cash=req.initial_capital,
            fee_rate=req.fee_rate,
            signal_col="signal",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Simulation error: {str(e)}")

    return BacktestResponse(
        success=True,
        symbol=req.symbol,
        params=req.model_dump(),
        metrics=result["metrics"],
        benchmark=result["benchmark"],
        equity_curve=result["equity_curve"],
        trades=result["trades"],
    )
