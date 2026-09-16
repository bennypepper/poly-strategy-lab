"use client";

import { useState, useEffect } from "react";
import { Sliders, RefreshCw, Zap, TrendingUp, ShieldCheck, Target, Award } from "lucide-react";
import { runOptimizer } from "@/lib/api-client";
import { OptimizeResponse } from "@/types/api";

const ASSETS = [
  { symbol: "BTC-USD", name: "Bitcoin", icon: "₿" },
  { symbol: "ETH-USD", name: "Ethereum", icon: "Ξ" },
  { symbol: "SOL-USD", name: "Solana", icon: "◎" },
  { symbol: "BNB-USD", name: "BNB", icon: "⬡" },
];

export default function OptimizerPage() {
  const [symbol, setSymbol] = useState("BTC-USD");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OptimizeResponse | null>(null);

  const handleRunOptimizer = async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await runOptimizer({
        symbol,
        buy_thresholds: [15, 20, 25, 30, 35, 40],
        sell_thresholds: [60, 65, 70, 75, 80, 85],
        alloc_pcts: [0.4, 0.6, 0.8, 1.0],
      });
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to execute parameter grid search");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleRunOptimizer();
  }, [symbol]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-400 mb-3">
          <Sliders className="h-3.5 w-3.5" />
          Grid Search Engine
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Multi-Asset Parameter Optimizer
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Exhaustive parameter optimization across buy/sell thresholds and capital allocations.
        </p>
      </div>

      {/* Asset Switcher Pills */}
      <div className="flex flex-wrap gap-2 mb-8">
        {ASSETS.map((asset) => (
          <button
            key={asset.symbol}
            onClick={() => setSymbol(asset.symbol)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              symbol === asset.symbol
                ? "bg-cyan-500 text-zinc-950 shadow-md shadow-cyan-500/20 font-semibold"
                : "bg-zinc-900 border border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:text-white"
            }`}
          >
            <span className="font-bold">{asset.icon}</span>
            <span>{asset.name}</span>
            <span className="text-xs opacity-70">({asset.symbol})</span>
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <RefreshCw className="h-8 w-8 text-cyan-400 animate-spin mb-4" />
          <p className="text-sm font-semibold text-white">Running Vectorized Grid Search...</p>
          <p className="text-xs text-zinc-500 mt-1">Evaluating 144 parameter combinations via Numba C-kernel</p>
        </div>
      )}

      {result && !loading && (
        <div className="space-y-8">
          {/* Optimal Configurations Overview */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/10 p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5" /> Best Total Return
                </span>
                <span className="text-xs text-zinc-400">Alloc: {Math.round(result.best_by_return.alloc_buy_pct * 100)}%</span>
              </div>
              <div className="text-2xl font-extrabold text-white">
                +{result.best_by_return.total_return_pct}%
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-zinc-400 border-t border-emerald-500/20 pt-2">
                <span>Buy ≤ <strong className="text-emerald-400">{result.best_by_return.threshold_buy}</strong></span>
                <span>Sell ≥ <strong className="text-cyan-400">{result.best_by_return.threshold_sell}</strong></span>
                <span>MDD: <strong>-{result.best_by_return.max_drawdown_pct}%</strong></span>
              </div>
            </div>

            <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/10 p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                  <Award className="h-3.5 w-3.5" /> Best Sharpe Ratio
                </span>
                <span className="text-xs text-zinc-400">Alloc: {Math.round(result.best_by_sharpe.alloc_buy_pct * 100)}%</span>
              </div>
              <div className="text-2xl font-extrabold text-white">
                {result.best_by_sharpe.sharpe_ratio.toFixed(2)}
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-zinc-400 border-t border-cyan-500/20 pt-2">
                <span>Buy ≤ <strong className="text-emerald-400">{result.best_by_sharpe.threshold_buy}</strong></span>
                <span>Sell ≥ <strong className="text-cyan-400">{result.best_by_sharpe.threshold_sell}</strong></span>
                <span>Return: <strong>+{result.best_by_sharpe.total_return_pct}%</strong></span>
              </div>
            </div>

            <div className="rounded-xl border border-purple-500/30 bg-purple-950/10 p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" /> Minimum Drawdown
                </span>
                <span className="text-xs text-zinc-400">Alloc: {Math.round(result.best_by_drawdown.alloc_buy_pct * 100)}%</span>
              </div>
              <div className="text-2xl font-extrabold text-white">
                -{result.best_by_drawdown.max_drawdown_pct}%
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-zinc-400 border-t border-purple-500/20 pt-2">
                <span>Buy ≤ <strong className="text-emerald-400">{result.best_by_drawdown.threshold_buy}</strong></span>
                <span>Sell ≥ <strong className="text-cyan-400">{result.best_by_drawdown.threshold_sell}</strong></span>
                <span>Sharpe: <strong>{result.best_by_drawdown.sharpe_ratio.toFixed(2)}</strong></span>
              </div>
            </div>
          </div>

          {/* 2D Sensitivity Heatmap */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-2">
              <div>
                <h3 className="font-semibold text-white">Parameter Sensitivity Heatmap (Sharpe Ratio)</h3>
                <p className="text-xs text-zinc-400">
                  Evaluated at {Math.round(result.target_alloc_for_heatmap * 100)}% cash allocation across Buy and Sell thresholds.
                </p>
              </div>
              <span className="text-xs text-zinc-500">Higher Sharpe = Greener cell</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-center text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400">
                    <th className="p-3 text-left">Buy \ Sell</th>
                    {result.sell_thresholds.map((ts) => (
                      <th key={ts} className="p-3">Sell ≥ {ts}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/40">
                  {result.buy_thresholds.map((tb, rowIdx) => (
                    <tr key={tb}>
                      <td className="p-3 text-left font-semibold text-zinc-300">Buy ≤ {tb}</td>
                      {result.sell_thresholds.map((ts, colIdx) => {
                        const val = result.heatmap_matrix[rowIdx]?.[colIdx];
                        if (val === null || val === undefined) {
                          return <td key={ts} className="p-3 text-zinc-600 bg-zinc-950/30">N/A</td>;
                        }
                        const isHigh = val > 1.2;
                        const isMid = val > 0.8;
                        const bgClass = isHigh
                          ? "bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30"
                          : isMid
                          ? "bg-cyan-500/10 text-cyan-300"
                          : "bg-zinc-800/40 text-zinc-400";
                        return (
                          <td key={ts} className={`p-3 font-mono ${bgClass}`}>
                            {val.toFixed(2)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top Trial Combinations Table */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
            <h3 className="font-semibold text-white mb-4">Top 15 Parameter Configurations</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-zinc-800 text-zinc-400">
                  <tr>
                    <th className="pb-2">Rank</th>
                    <th className="pb-2">Buy Threshold</th>
                    <th className="pb-2">Sell Threshold</th>
                    <th className="pb-2">Allocation</th>
                    <th className="pb-2">Total Return</th>
                    <th className="pb-2">Max Drawdown</th>
                    <th className="pb-2">Sharpe Ratio</th>
                    <th className="pb-2">Win Rate</th>
                    <th className="pb-2">Trades</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50 text-zinc-300">
                  {result.top_trials.map((t, idx) => (
                    <tr key={idx} className="hover:bg-zinc-800/30">
                      <td className="py-2.5 font-semibold text-zinc-500">#{idx + 1}</td>
                      <td className="py-2.5 font-mono text-emerald-400">≤ {t.threshold_buy}</td>
                      <td className="py-2.5 font-mono text-cyan-400">≥ {t.threshold_sell}</td>
                      <td className="py-2.5 font-mono">{Math.round(t.alloc_buy_pct * 100)}%</td>
                      <td className="py-2.5 font-mono text-emerald-400 font-bold">+{t.total_return_pct}%</td>
                      <td className="py-2.5 font-mono text-red-400">-{t.max_drawdown_pct}%</td>
                      <td className="py-2.5 font-mono text-cyan-400 font-bold">{t.sharpe_ratio.toFixed(2)}</td>
                      <td className="py-2.5 font-mono">{t.win_rate_pct}%</td>
                      <td className="py-2.5 font-mono">{t.trade_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
