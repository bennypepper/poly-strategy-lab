from __future__ import annotations

import os
import logging
from pathlib import Path
from typing import Dict, List, Optional
import numpy as np
import pandas as pd
import yfinance as yf

from app.core.config import settings
from app.indicators.dynamic_channel import compute_normalized_signal

logger = logging.getLogger(__name__)

SUPPORTED_ASSETS = [
    {
        "symbol": "BTC-USD",
        "name": "Bitcoin",
        "category": "crypto",
        "base_currency": "USD",
        "first_available_date": "2014-09-17",
        "is_active": True,
    },
    {
        "symbol": "ETH-USD",
        "name": "Ethereum",
        "category": "crypto",
        "base_currency": "USD",
        "first_available_date": "2017-11-09",
        "is_active": True,
    },
    {
        "symbol": "SOL-USD",
        "name": "Solana",
        "category": "crypto",
        "base_currency": "USD",
        "first_available_date": "2020-04-10",
        "is_active": True,
    },
    {
        "symbol": "BNB-USD",
        "name": "BNB",
        "category": "crypto",
        "base_currency": "USD",
        "first_available_date": "2017-11-09",
        "is_active": True,
    },
]


def get_supported_assets() -> List[Dict[str, Any]]:
    return SUPPORTED_ASSETS


def fetch_market_data(
    symbol: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    use_cache: bool = True,
) -> pd.DataFrame:
    """
    Fetch OHLCV market data for symbol, compute normalized signal, and cache to Parquet.
    """
    cache_dir = Path(settings.DATA_CACHE_DIR)
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_file = cache_dir / f"{symbol.replace('/', '_')}.parquet"

    df: Optional[pd.DataFrame] = None

    if use_cache and cache_file.exists():
        try:
            mtime = cache_file.stat().st_mtime
            import time
            # If cache is less than 1 hour old, use it
            if time.time() - mtime < 3600:
                df = pd.read_parquet(cache_file)
                logger.info(f"Loaded {symbol} from cache ({len(df)} rows)")
        except Exception as e:
            logger.warning(f"Failed to read cache for {symbol}: {e}")

    if df is None:
        logger.info(f"Downloading {symbol} via yfinance...")
        try:
            raw = yf.download(
                tickers=symbol,
                period="max",
                interval="1d",
                progress=False,
                auto_adjust=False,
                timeout=settings.REQUEST_TIMEOUT_SECONDS,
            )
            if raw.empty:
                raise ValueError(f"No data returned for {symbol}")

            # Flatten MultiIndex if yfinance returns multi-level columns
            if isinstance(raw.columns, pd.MultiIndex):
                raw.columns = [col[0].lower() for col in raw.columns]
            else:
                raw.columns = [str(col).lower() for col in raw.columns]

            raw.index = pd.to_datetime(raw.index)
            raw.sort_index(inplace=True)

            required = ["open", "high", "low", "close", "volume"]
            for col in required:
                if col not in raw.columns:
                    raise KeyError(f"Missing required price column: {col}")

            df = raw[required].dropna().copy()
            # Calculate signal
            df["signal"] = compute_normalized_signal(symbol, df["close"])
            df["signal"] = df["signal"].ffill().bfill().clip(0.0, 100.0)

            # Write cache
            try:
                df.to_parquet(cache_file)
            except Exception as e:
                logger.warning(f"Failed to write cache for {symbol}: {e}")

        except Exception as e:
            logger.error(f"Error downloading {symbol}: {e}")
            if cache_file.exists():
                logger.info(f"Falling back to existing cache for {symbol}")
                df = pd.read_parquet(cache_file)
            else:
                raise

    # Slice date range if requested
    if start_date:
        df = df[df.index >= pd.Timestamp(start_date)]
    if end_date:
        df = df[df.index <= pd.Timestamp(end_date)]

    return df
