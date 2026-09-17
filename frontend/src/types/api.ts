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

export interface BacktestParams {
  symbol?: string;
  threshold_buy?: number;
  threshold_sell?: number;
  alloc_buy_pct?: number;
  initial_capital?: number;
  fee_rate?: number;
  start_date?: string | null;
  end_date?: string | null;
  [key: string]: unknown;
}

export interface BacktestResponse {
  success: boolean;
  symbol: string;
  asset_type?: string;
  params: BacktestParams;
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
  asset_type?: string;
  count: number;
  data: MarketDataPoint[];
}

export interface OptimizeRequest {
  symbol: string;
  buy_thresholds?: number[];
  sell_thresholds?: number[];
  alloc_pcts?: number[];
  initial_capital?: number;
  fee_rate?: number;
}

export interface OptimizeTrial {
  threshold_buy: number;
  threshold_sell: number;
  alloc_buy_pct: number;
  total_return_pct: number;
  max_drawdown_pct: number;
  sharpe_ratio: number;
  win_rate_pct: number;
  trade_count: number;
}

export interface OptimizeResponse {
  success: boolean;
  symbol: string;
  asset_type?: string;
  total_trials: number;
  target_alloc_for_heatmap: number;
  buy_thresholds: number[];
  sell_thresholds: number[];
  heatmap_matrix: (number | null)[][];
  best_by_return: OptimizeTrial;
  best_by_sharpe: OptimizeTrial;
  best_by_drawdown: OptimizeTrial;
  top_trials: OptimizeTrial[];
}
