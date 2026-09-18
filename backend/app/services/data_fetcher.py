from __future__ import annotations

import os
import time
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional
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
    {
        "symbol": "XRP-USD",
        "name": "XRP",
        "category": "crypto",
        "base_currency": "USD",
        "first_available_date": "2017-11-09",
        "is_active": True,
    },
    {
        "symbol": "ADA-USD",
        "name": "Cardano",
        "category": "crypto",
        "base_currency": "USD",
        "first_available_date": "2017-11-09",
        "is_active": True,
    },
    {
        "symbol": "DOGE-USD",
        "name": "Dogecoin",
        "category": "crypto",
        "base_currency": "USD",
        "first_available_date": "2017-11-09",
        "is_active": True,
    },
    {
        "symbol": "AVAX-USD",
        "name": "Avalanche",
        "category": "crypto",
        "base_currency": "USD",
        "first_available_date": "2020-09-22",
        "is_active": True,
    },
    {
        "symbol": "LINK-USD",
        "name": "Chainlink",
        "category": "crypto",
        "base_currency": "USD",
        "first_available_date": "2017-11-09",
        "is_active": True,
    },
    {
        "symbol": "NEAR-USD",
        "name": "NEAR Protocol",
        "category": "crypto",
        "base_currency": "USD",
        "first_available_date": "2020-10-14",
        "is_active": True,
    },
    {
        "symbol": "QQQ",
        "name": "Invesco QQQ Trust (Nasdaq-100)",
        "category": "equity",
        "base_currency": "USD",
        "first_available_date": "1999-03-10",
        "is_active": True,
    },
    {
        "symbol": "SPY",
        "name": "SPDR S&P 500 ETF Trust",
        "category": "equity",
        "base_currency": "USD",
        "first_available_date": "1993-01-29",
        "is_active": True,
    },
]

# In-memory cooldown cache for failed/rate-limited tickers to prevent upstream exhaustion (CWE-20/918)
_FAILED_TICKER_COOLDOWN: Dict[str, float] = {}
COOLDOWN_SECONDS = 300.0  # 5 minutes cooldown

def resolve_safe_cache_path(base_dir: str | Path, symbol: str) -> Path:
    """
    Safely resolves cache file path within base_dir, strictly preventing
    CWE-22 path traversal and directory escape.
    """
    if ".." in symbol or "/" in symbol or "\\" in symbol or "%" in symbol:
        raise PermissionError(f"CWE-22 Path Traversal attempt detected for symbol: {symbol}")

    base_path = Path(base_dir).resolve()
    sanitized = symbol.strip().upper()
    if not sanitized:
        raise ValueError("Invalid empty ticker symbol for cache resolution")
    target_path = (base_path / f"{sanitized}.parquet").resolve()

    # Enforce directory boundary containment
    if not target_path.is_relative_to(base_path):
        raise PermissionError(f"CWE-22 Path Traversal attempt detected for symbol: {symbol}")

    return target_path

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
    Strictly sandboxed against directory traversal and rate-limit exhaustion.
    """
    cache_dir = Path(settings.DATA_CACHE_DIR)
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_file = resolve_safe_cache_path(cache_dir, symbol)

    # Check cooldown
    now = time.time()
    if symbol in _FAILED_TICKER_COOLDOWN:
        cooldown_elapsed = now - _FAILED_TICKER_COOLDOWN[symbol]
        if cooldown_elapsed < COOLDOWN_SECONDS and not cache_file.exists():
            raise ValueError(
                f"Ticker '{symbol}' is in rate-limit cooldown ({int(COOLDOWN_SECONDS - cooldown_elapsed)}s remaining). Please try again later."
            )

    df: Optional[pd.DataFrame] = None

    if use_cache and cache_file.exists():
        try:
            mtime = cache_file.stat().st_mtime
            # If cache is less than 1 hour old, use it
            if now - mtime < 3600:
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
                _FAILED_TICKER_COOLDOWN[symbol] = time.time()
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
            # Calculate signal without lookahead bfill
            df["signal"] = compute_normalized_signal(symbol, df["close"])
            df["signal"] = df["signal"].ffill().fillna(50.0).clip(0.0, 100.0)

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
                _FAILED_TICKER_COOLDOWN[symbol] = time.time()
                raise

    # Slice date range if requested
    if start_date:
        df = df[df.index >= pd.Timestamp(start_date)]
    if end_date:
        df = df[df.index <= pd.Timestamp(end_date)]

    return df
