from __future__ import annotations
from typing import List, Optional
from pydantic import BaseModel, Field, model_validator

class AssetInfo(BaseModel):
    symbol: str = Field(..., description="Ticker symbol, e.g. BTC-USD, ETH-USD")
    name: str = Field(..., description="Full asset display name")
    category: str = Field(default="crypto", description="Asset category: crypto, equity, macro")
    base_currency: str = Field(default="USD")
    first_available_date: str
    is_active: bool = True

class BacktestRequest(BaseModel):
    symbol: str = Field(default="BTC-USD", description="Asset symbol to simulate")
    threshold_buy: int = Field(default=35, ge=0, le=100, description="Buy trigger threshold")
    threshold_sell: int = Field(default=70, ge=0, le=100, description="Sell trigger threshold")
    alloc_buy_pct: float = Field(default=0.8, gt=0.0, le=1.0, description="Fraction of cash to deploy on buy")
    initial_capital: float = Field(default=10_000.0, gt=0.0)
    fee_rate: float = Field(default=0.001, ge=0.0, le=0.05, description="Trading commission rate")
    start_date: Optional[str] = Field(default=None, description="Start date YYYY-MM-DD")
    end_date: Optional[str] = Field(default=None, description="End date YYYY-MM-DD")

    @model_validator(mode="after")
    def validate_thresholds(self) -> BacktestRequest:
        if self.threshold_buy >= self.threshold_sell:
            raise ValueError(
                f"threshold_buy ({self.threshold_buy}) must be strictly less than threshold_sell ({self.threshold_sell})"
            )
        return self

class StrategyMetrics(BaseModel):
    final_equity: float
    total_return_pct: float
    cagr_pct: float
    max_drawdown_pct: float
    sharpe_ratio: float
    sortino_ratio: float
    calmar_ratio: float
    win_rate_pct: float
    total_trades: int
    profitable_trades: int
    profit_factor: float

class BenchmarkMetrics(BaseModel):
    buy_hold_return_pct: float
    buy_hold_mdd_pct: float
    buy_hold_sharpe: float

class EquityPoint(BaseModel):
    date: str
    equity: float
    benchmark_equity: float
    cash: float
    asset_holdings: float
    signal_val: float
    close_price: float

class TradeLog(BaseModel):
    date: str
    type: str
    price: float
    shares: float
    cost: float
    cash_after: float
    port_value: float

class BacktestResponse(BaseModel):
    success: bool
    symbol: str
    params: dict
    metrics: StrategyMetrics
    benchmark: BenchmarkMetrics
    equity_curve: List[EquityPoint]
    trades: List[TradeLog]

class MarketDataPoint(BaseModel):
    date: str
    open: float
    high: float
    low: float
    close: float
    volume: float
    signal: float

class MarketDataResponse(BaseModel):
    symbol: str
    count: int
    data: List[MarketDataPoint]

class OptimizeRequest(BaseModel):
    symbol: str = Field(default="BTC-USD")
    buy_thresholds: List[int] = Field(default=[15, 20, 25, 30, 35, 40])
    sell_thresholds: List[int] = Field(default=[60, 65, 70, 75, 80, 85])
    alloc_pcts: List[float] = Field(default=[0.4, 0.6, 0.8, 1.0])
    initial_capital: float = Field(default=100_000.0)
    fee_rate: float = Field(default=0.001)

class OptimizeResponse(BaseModel):
    success: bool
    symbol: str
    total_trials: int
    target_alloc_for_heatmap: float
    buy_thresholds: List[int]
    sell_thresholds: List[int]
    heatmap_matrix: List[List[Optional[float]]]
    best_by_return: dict
    best_by_sharpe: dict
    best_by_drawdown: dict
    top_trials: List[dict]
