from fastapi import APIRouter, HTTPException
from app.models.schemas import OptimizeRequest, OptimizeResponse
from app.services.data_fetcher import fetch_market_data
from app.engine.optimizer_grid import run_grid_search

router = APIRouter(prefix="/optimize", tags=["Optimizer"])

@router.post("", response_model=OptimizeResponse)
async def optimize_parameters(req: OptimizeRequest):
    """Run parameter grid search across specified threshold & allocation intervals."""
    try:
        df = fetch_market_data(symbol=req.symbol)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch market data: {str(e)}")

    if len(df) < 10:
        raise HTTPException(status_code=400, detail="Insufficient data to perform parameter optimization.")

    try:
        res = run_grid_search(
            df=df,
            buy_thresholds=req.buy_thresholds,
            sell_thresholds=req.sell_thresholds,
            alloc_pcts=req.alloc_pcts,
            initial_cash=req.initial_capital,
            fee_rate=req.fee_rate,
            signal_col="signal",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Grid search error: {str(e)}")

    return OptimizeResponse(
        success=True,
        symbol=req.symbol,
        total_trials=res["total_trials"],
        target_alloc_for_heatmap=res["target_alloc_for_heatmap"],
        buy_thresholds=res["buy_thresholds"],
        sell_thresholds=res["sell_thresholds"],
        heatmap_matrix=res["heatmap_matrix"],
        best_by_return=res["best_by_return"],
        best_by_sharpe=res["best_by_sharpe"],
        best_by_drawdown=res["best_by_drawdown"],
        top_trials=res["top_trials"],
    )
