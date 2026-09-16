export interface AssetInfo {
  symbol: string;
  name: string;
  category: string;
  base_currency: string;
  first_available_date: string;
  is_active: boolean;
}

export interface BacktestRequest {
  symbol: string;
  threshold_buy: number;
  threshold_sell: number;
  alloc_buy_pct: number;
  initial_capital?: number;
  fee_rate?: number;
  start_date?: string | null;
  end_date?: string | null;
}

export interface StrategyMetrics {
  final_equity: number;
  total_return_pct: number;
  cagr_pct: number;
  max_drawdown_pct: number;
  sharpe_ratio: number;
  sortino_ratio: number;
  calmar_ratio: number;
  win_rate_pct: number;
  total_trades: number;
  profitable_trades: number;
  profit_factor: number;
}

export interface BenchmarkMetrics {
  buy_hold_return_pct: number;
  buy_hold_mdd_pct: number;
  buy_hold_sharpe: number;
}

export interface EquityPoint {
  date: string;
  equity: number;
  benchmark_equity: number;
  cash: number;
  asset_holdings: number;
  signal_val: number;
  close_price: number;
}

export interface TradeLog {
  date: string;
  type: string;
  price: number;
  shares: number;
  cost: number;
  cash_after: number;
  port_value: number;
}

export interface BacktestResponse {
  success: boolean;
  symbol: string;
  params: Record<string, any>;
  metrics: StrategyMetrics;
  benchmark: BenchmarkMetrics;
  equity_curve: EquityPoint[];
  trades: TradeLog[];
}

export interface MarketDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  signal: number;
}

export interface MarketDataResponse {
  symbol: string;
  count: number;
  data: MarketDataPoint[];
}
