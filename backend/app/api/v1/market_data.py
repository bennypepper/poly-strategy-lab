import logging
from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from app.models.schemas import MarketDataResponse, MarketDataPoint, validate_ticker_symbol
from app.services.data_fetcher import fetch_market_data
from app.indicators.dynamic_channel import classify_asset

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/market-data", tags=["Market Data"])

@router.get("/{symbol}", response_model=MarketDataResponse)
async def get_market_data(
    symbol: str,
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
):
    """Retrieve historical candlestick data and calculated signal indicator."""
    try:
        symbol = validate_ticker_symbol(symbol)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    try:
        df = fetch_market_data(symbol=symbol, start_date=start_date, end_date=end_date)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception(f"Failed to fetch market data for {symbol}: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to retrieve market data for {symbol}")

    points = []
    for idx, row in df.iterrows():
        points.append(
            MarketDataPoint(
                date=str(idx.date()),
                open=round(float(row["open"]), 2),
                high=round(float(row["high"]), 2),
                low=round(float(row["low"]), 2),
                close=round(float(row["close"]), 2),
                volume=round(float(row["volume"]), 2),
                signal=round(float(row["signal"]), 2),
            )
        )

    return MarketDataResponse(
        symbol=symbol,
        asset_type=classify_asset(symbol),
        count=len(points),
        data=points,
    )
