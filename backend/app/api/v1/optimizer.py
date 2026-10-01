import asyncio
import logging
from fastapi import APIRouter, HTTPException
from app.models.schemas import OptimizeRequest, OptimizeResponse
from app.services.data_fetcher import fetch_market_data
from app.engine.optimizer_grid import run_grid_search
from app.indicators.dynamic_channel import classify_asset

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/optimize", tags=["Optimizer"])

@router.post("", response_model=OptimizeResponse)
async def optimize_parameters(req: OptimizeRequest):
    """Run parameter grid search asynchronously in a worker thread across specified thresholds."""
    try:
        df = await asyncio.to_thread(fetch_market_data, symbol=req.symbol)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception(f"Failed to fetch market data for {req.symbol}: {e}")
        raise HTTPException(status_code=400, detail=f"Market data fetch failed for {req.symbol}")

    if len(df) < 10:
        raise HTTPException(status_code=400, detail="Insufficient data to perform parameter optimization.")

    try:
        # Offload synchronous CPU-intensive grid search to a worker thread
        # to prevent blocking the FastAPI asyncio event loop (CWE-400)
        annualization_factor = 252.0 if classify_asset(req.symbol) == "equity" else 365.0
        res = await asyncio.to_thread(
            run_grid_search,
            df=df,
            buy_thresholds=req.buy_thresholds,
            sell_thresholds=req.sell_thresholds,
            alloc_pcts=req.alloc_pcts,
            initial_cash=req.initial_capital,
            fee_rate=req.fee_rate,
            signal_col="signal",
            annualization_factor=annualization_factor,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception(f"Grid search calculation failed for {req.symbol}: {e}")
        raise HTTPException(status_code=500, detail="Parameter optimization calculation encountered an internal error")

    return OptimizeResponse(
        success=True,
        symbol=req.symbol,
        asset_type=classify_asset(req.symbol),
        total_trials=res["total_trials"],
        target_alloc_for_heatmap=res["target_alloc_for_heatmap"],
        buy_thresholds=res["buy_thresholds"],
        sell_thresholds=res["sell_thresholds"],
        heatmap_matrix=res["heatmap_matrix"],
        best_by_return=res["best_by_return"],
        best_by_sharpe=res["best_by_sharpe"],
        best_by_drawdown=res["best_by_drawdown"],
        top_trials=res["top_trials"],
        walk_forward=res.get("walk_forward"),
    )
