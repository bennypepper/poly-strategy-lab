"use client";

import { useState, useEffect } from "react";
import { Activity, RefreshCw, Zap, Search, Plus } from "lucide-react";
import { runBacktest, fetchMarketData } from "@/lib/api-client";
import { BacktestResponse, MarketDataPoint } from "@/types/api";
import { TradingViewCandlestick } from "@/components/charts/TradingViewCandlestick";
import { TradingViewEquity } from "@/components/charts/TradingViewEquity";

const PRESET_ASSETS = [
  { symbol: "BTC-USD", name: "Bitcoin", icon: "₿" },
  { symbol: "ETH-USD", name: "Ethereum", icon: "Ξ" },
  { symbol: "SOL-USD", name: "Solana", icon: "◎" },
  { symbol: "BNB-USD", name: "BNB", icon: "⬡" },
];

export default function SimulatorPage() {
  const [symbol, setSymbol] = useState("BTC-USD");
  const [customTickerInput, setCustomTickerInput] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);

  const [buyThreshold, setBuyThreshold] = useState(35);
  const [sellThreshold, setSellThreshold] = useState(70);
  const [allocBuyPct, setAllocBuyPct] = useState(0.8);
  const [initialCapital, setInitialCapital] = useState(10000);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BacktestResponse | null>(null);
  const [candles, setCandles] = useState<MarketDataPoint[]>([]);

  const handleRunSimulation = async (targetSymbol = symbol) => {
    if (buyThreshold >= sellThreshold) {
      setError("Buy threshold must be strictly lower than sell threshold.");
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const [backtestRes, marketRes] = await Promise.all([
        runBacktest({
          symbol: targetSymbol,
          threshold_buy: buyThreshold,
          threshold_sell: sellThreshold,
          alloc_buy_pct: allocBuyPct,
          initial_capital: initialCapital,
        }),
        fetchMarketData(targetSymbol).catch(() => ({ data: [] })),
      ]);

      setResult(backtestRes);
      setCandles(marketRes.data || []);
    } catch (err: any) {
      setError(err.message || "Failed to execute backtest");
    } finally {
      setLoading(false);
    }
  };

  const handleCustomTickerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTickerInput.trim()) return;
    const formatted = customTickerInput.trim().toUpperCase();
    setSymbol(formatted);
    setShowCustomInput(false);
  };

  useEffect(() => {
    handleRunSimulation(symbol);
  }, [symbol]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Multi-Asset Strategy Simulator
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Execute quantitative backtests across Bitcoin, Ethereum, Solana, and custom tickers with dynamic channel normalization.
        </p>
      </div>

      {/* Asset Switcher with Custom Ticker Input */}
      <div className="flex flex-wrap items-center gap-2 mb-8">
        {PRESET_ASSETS.map((asset) => (
          <button
            key={asset.symbol}
            onClick={() => {
              setSymbol(asset.symbol);
              setShowCustomInput(false);
            }}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              symbol === asset.symbol && !showCustomInput
                ? "bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20 font-semibold"
                : "bg-zinc-900 border border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:text-white"
            }`}
          >
            <span className="font-bold">{asset.icon}</span>
            <span>{asset.name}</span>
            <span className="text-xs opacity-70">({asset.symbol})</span>
          </button>
        ))}

        {/* Custom Ticker Button & Form */}
        {!showCustomInput ? (
          <button
            onClick={() => setShowCustomInput(true)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium border transition-all ${
              !PRESET_ASSETS.some((a) => a.symbol === symbol)
                ? "bg-emerald-500 text-zinc-950 border-emerald-500 font-semibold"
                : "bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700"
            }`}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{!PRESET_ASSETS.some((a) => a.symbol === symbol) ? symbol : "Custom Asset"}</span>
          </button>
        ) : (
          <form onSubmit={handleCustomTickerSubmit} className="flex items-center gap-2">
            <div className="relative">
              <input
                type="text"
                placeholder="e.g. AVAX-USD, SPY"
                value={customTickerInput}
                onChange={(e) => setCustomTickerInput(e.target.value)}
                autoFocus
                className="rounded-lg border border-emerald-500/50 bg-zinc-900 px-3 py-1.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-400 w-44 uppercase"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 transition-colors"
            >
              Load
            </button>
            <button
              type="button"
              onClick={() => setShowCustomInput(false)}
              className="rounded-lg border border-zinc-700 px-2 py-1.5 text-xs text-zinc-400 hover:text-white"
            >
              Cancel
            </button>
          </form>
        )}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
        {/* Sidebar Parameters */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 lg:col-span-1 h-fit">
          <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-400" />
            Strategy Parameters
          </h2>

          <div className="space-y-5">
            <div>
              <div className="flex justify-between text-xs font-medium text-zinc-400 mb-1.5">
                <span>Buy Threshold</span>
                <span className="text-emerald-400 font-bold">{buyThreshold}</span>
              </div>
              <input
                type="range"
                min={5}
                max={50}
                value={buyThreshold}
                onChange={(e) => setBuyThreshold(Number(e.target.value))}
                className="w-full accent-emerald-400"
              />
              <span className="text-[11px] text-zinc-500">Buy when signal ≤ {buyThreshold}</span>
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium text-zinc-400 mb-1.5">
                <span>Sell Threshold</span>
                <span className="text-cyan-400 font-bold">{sellThreshold}</span>
              </div>
              <input
                type="range"
                min={55}
                max={95}
                value={sellThreshold}
                onChange={(e) => setSellThreshold(Number(e.target.value))}
                className="w-full accent-cyan-400"
              />
              <span className="text-[11px] text-zinc-500">Sell when signal ≥ {sellThreshold}</span>
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium text-zinc-400 mb-1.5">
                <span>Capital Allocation</span>
                <span className="text-zinc-200 font-bold">{Math.round(allocBuyPct * 100)}%</span>
              </div>
              <input
                type="range"
                min={10}
                max={100}
                step={5}
                value={Math.round(allocBuyPct * 100)}
                onChange={(e) => setAllocBuyPct(Number(e.target.value) / 100)}
                className="w-full accent-emerald-400"
              />
              <span className="text-[11px] text-zinc-500">Cash fraction deployed per trade</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Initial Capital ($)</label>
              <input
                type="number"
                value={initialCapital}
                onChange={(e) => setInitialCapital(Number(e.target.value))}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
                {error}
              </div>
            )}

            <button
              onClick={() => handleRunSimulation(symbol)}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Computing...</span>
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  <span>Execute Backtest</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Results Pane */}
        <div className="space-y-6 lg:col-span-3">
          {result && (
            <>
              {/* Metrics Summary Cards */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                  <span className="text-xs font-medium text-zinc-400">Strategy Return</span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-extrabold text-emerald-400">
                      +{result.metrics.total_return_pct}%
                    </span>
                  </div>
                  <span className="text-xs text-zinc-500">
                    Buy & Hold: +{result.benchmark.buy_hold_return_pct}%
                  </span>
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                  <span className="text-xs font-medium text-zinc-400">Max Drawdown</span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-extrabold text-red-400">
                      -{result.metrics.max_drawdown_pct}%
                    </span>
                  </div>
                  <span className="text-xs text-zinc-500">
                    Buy & Hold: -{result.benchmark.buy_hold_mdd_pct}%
                  </span>
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                  <span className="text-xs font-medium text-zinc-400">Sharpe Ratio</span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-extrabold text-cyan-400">
                      {result.metrics.sharpe_ratio.toFixed(2)}
                    </span>
                  </div>
                  <span className="text-xs text-zinc-500">
                    Buy & Hold: {result.benchmark.buy_hold_sharpe.toFixed(2)}
                  </span>
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                  <span className="text-xs font-medium text-zinc-400">Win Rate & Trades</span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-extrabold text-zinc-200">
                      {result.metrics.win_rate_pct}%
                    </span>
                  </div>
                  <span className="text-xs text-zinc-500">
                    {result.metrics.total_trades} trades ({result.metrics.profitable_trades} profitable)
                  </span>
                </div>
              </div>

              {/* TradingView Lightweight Candlestick Chart */}
              {candles.length > 0 && (
                <TradingViewCandlestick
                  data={candles}
                  symbol={symbol}
                  height={380}
                  buyThreshold={buyThreshold}
                  sellThreshold={sellThreshold}
                />
              )}

              {/* TradingView Equity Curve */}
              {result.equity_curve.length > 0 && (
                <TradingViewEquity data={result.equity_curve} height={280} />
              )}

              {/* Trade Execution Log */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
                <h3 className="font-semibold text-white mb-4">
                  Trade Execution Log ({result.trades.length} Executions)
                </h3>
                <div className="overflow-x-auto max-h-64">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-zinc-800 text-zinc-400 sticky top-0 bg-zinc-900">
                      <tr>
                        <th className="pb-2">Date</th>
                        <th className="pb-2">Action</th>
                        <th className="pb-2">Price</th>
                        <th className="pb-2">Units</th>
                        <th className="pb-2">Total Value</th>
                        <th className="pb-2">Remaining Cash</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50 text-zinc-300">
                      {result.trades.slice(-20).reverse().map((trade, idx) => (
                        <tr key={idx} className="hover:bg-zinc-800/30">
                          <td className="py-2 text-zinc-400">{trade.date}</td>
                          <td className="py-2">
                            <span
                              className={`rounded px-1.5 py-0.5 font-semibold text-[10px] ${
                                trade.type === "BUY"
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                  : "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                              }`}
                            >
                              {trade.type}
                            </span>
                          </td>
                          <td className="py-2 font-mono">${trade.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="py-2 font-mono">{trade.shares.toFixed(4)}</td>
                          <td className="py-2 font-mono">${trade.cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="py-2 font-mono text-zinc-400">${trade.cash_after.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
