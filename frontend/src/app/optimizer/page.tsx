"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Sliders,
  RefreshCw,
  Zap,
  TrendingUp,
  ShieldCheck,
  Target,
  Award,
  AlertCircle,
  Plus,
  X,
  Play,
  ArrowRight,
} from "lucide-react";
import { runOptimizer } from "@/lib/api-client";
import { OptimizeResponse } from "@/types/api";
import {
  Asset,
  DEFAULT_CRYPTO_ASSETS,
  getCustomAssets,
  saveCustomAsset,
  removeCustomAsset,
  subscribeToCustomAssets,
} from "@/lib/asset-store";

const DEFAULT_BUY_THRESHOLDS = [15, 20, 25, 30, 35, 40];
const DEFAULT_SELL_THRESHOLDS = [60, 65, 70, 75, 80, 85];
const DEFAULT_ALLOC_PCTS = [0.4, 0.6, 0.8, 1.0];

export default function OptimizerPage() {
  const router = useRouter();
  const [symbol, setSymbol] = useState("BTC-USD");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OptimizeResponse | null>(null);
  const [customAssets, setCustomAssets] = useState<Asset[]>([]);
  const [customTickerInput, setCustomTickerInput] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setCustomAssets(getCustomAssets());
    const unsubscribe = subscribeToCustomAssets((updated) => {
      setCustomAssets(updated);
    });
    return () => unsubscribe();
  }, []);

  const handleRunOptimizer = useCallback(async (targetSymbol: string) => {
    setError(null);
    setLoading(true);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const data = await runOptimizer(
        {
          symbol: targetSymbol,
          buy_thresholds: DEFAULT_BUY_THRESHOLDS,
          sell_thresholds: DEFAULT_SELL_THRESHOLDS,
          alloc_pcts: DEFAULT_ALLOC_PCTS,
        },
        controller.signal
      );
      setResult(data);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      const message = err instanceof Error ? err.message : "Failed to execute parameter grid search";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleAssetSelect = (newSymbol: string) => {
    setShowCustomInput(false);
    if (newSymbol === symbol) {
      handleRunOptimizer(newSymbol);
    } else {
      setSymbol(newSymbol);
    }
  };

  const handleCustomTickerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTickerInput.trim()) return;
    const formatted = customTickerInput.trim().toUpperCase();
    saveCustomAsset(formatted);
    setCustomTickerInput("");
    setShowCustomInput(false);
    handleAssetSelect(formatted);
  };

  const handleRemoveCustomAsset = (e: React.MouseEvent, assetSymbol: string) => {
    e.stopPropagation();
    removeCustomAsset(assetSymbol);
    if (symbol === assetSymbol) {
      handleAssetSelect("BTC-USD");
    }
  };

  const handleApplyToSimulator = (buy: number, sell: number, alloc: number) => {
    router.push(
      `/simulator?symbol=${encodeURIComponent(symbol)}&buy=${buy}&sell=${sell}&alloc=${alloc}`
    );
  };

  useEffect(() => {
    handleRunOptimizer(symbol);
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [symbol, handleRunOptimizer]);

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
      <div className="flex flex-wrap items-center gap-2 mb-8">
        {[...DEFAULT_CRYPTO_ASSETS, ...customAssets].map((asset) => {
          const isSelected = symbol === asset.symbol && !showCustomInput;
          return (
            <div
              key={asset.symbol}
              onClick={() => handleAssetSelect(asset.symbol)}
              role="button"
              tabIndex={0}
              className={`group flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-all cursor-pointer ${
                isSelected
                  ? "bg-cyan-500 text-zinc-950 shadow-md shadow-cyan-500/20 font-semibold"
                  : "bg-zinc-900 border border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:text-white"
              }`}
            >
              <span className="font-bold">{asset.icon}</span>
              <span>{asset.name}</span>
              <span className="text-xs opacity-70">({asset.symbol})</span>

              {asset.isCustom && (
                <button
                  type="button"
                  onClick={(e) => handleRemoveCustomAsset(e, asset.symbol)}
                  className={`ml-1 rounded p-0.5 transition-colors ${
                    isSelected
                      ? "text-zinc-950/70 hover:bg-cyan-600 hover:text-zinc-950"
                      : "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                  }`}
                  title={`Remove ${asset.symbol}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}

        {!showCustomInput ? (
          <button
            onClick={() => setShowCustomInput(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium border border-dashed border-zinc-700 bg-zinc-900/60 text-zinc-400 hover:text-white hover:border-cyan-500 hover:bg-zinc-900 transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Custom Asset</span>
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
                className="rounded-lg border border-cyan-500/50 bg-zinc-900 px-3 py-1.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400 w-44 uppercase"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-cyan-400 transition-colors"
            >
              Optimize
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

      {/* Action Bar with Explicit Optimize Button & Scope */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-white">
              Optimization Target: <span className="text-cyan-400 font-mono">{symbol}</span>
            </h2>
            <span className="rounded-full bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 text-[10px] font-medium text-cyan-400">
              144 Combinations
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-400">
            Searches Buy ≤ [15..40] × Sell ≥ [60..85] × Alloc [40%..100%] via compiled Numba engine.
          </p>
        </div>

        <button
          onClick={() => handleRunOptimizer(symbol)}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-xs font-semibold text-zinc-950 shadow-md shadow-cyan-500/20 hover:bg-cyan-400 transition-all disabled:opacity-50 shrink-0"
        >
          {loading ? (
            <>
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              <span>Optimizing 144 Trials...</span>
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Run Parameter Optimization</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-500/30 bg-red-950/20 p-4 text-sm text-red-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => handleRunOptimizer(symbol)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/20 border border-red-500/30 px-3 py-1 text-xs font-semibold text-red-300 hover:bg-red-500/30 transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            <span>Retry</span>
          </button>
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
          {/* Quantitative Engine Indicator */}
          {result.asset_type === "equity" ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-500/25 bg-blue-950/20 px-4 py-3.5 text-xs text-zinc-300">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
                  <TrendingUp className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">Quantitative Engine:</span>
                    <span className="rounded-full bg-blue-500/20 border border-blue-500/30 px-2 py-0.5 text-[11px] font-medium text-blue-300">
                      Equity Compounding Model
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-zinc-400">
                    Causal log-linear growth trend with dynamic volatility bands and 50/200 EMA secular regime gating to protect against multi-year bear markets.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/25 bg-emerald-950/20 px-4 py-3.5 text-xs text-zinc-300">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <Zap className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">Quantitative Engine:</span>
                    <span className="rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
                      Crypto Power-Law Model
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-zinc-400">
                    Scale-invariant logarithmic adoption trajectory with dynamic quantile band normalization calibrated for cryptocurrency halving cycles.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Transfer Guidance Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-cyan-500/20 bg-cyan-950/10 p-4 text-xs text-zinc-300">
            <div className="flex items-center gap-2.5">
              <Zap className="h-4 w-4 text-cyan-400 shrink-0" />
              <span>
                <strong>Grid Search Complete:</strong> Evaluated {result.total_trials} parameter sets for {symbol}. Click <strong>&quot;Apply to Simulator&quot;</strong> on any card or table row to test and view candlestick charts and equity curves.
              </span>
            </div>
            {result.best_by_sharpe && (
              <button
                onClick={() =>
                  handleApplyToSimulator(
                    result.best_by_sharpe.threshold_buy,
                    result.best_by_sharpe.threshold_sell,
                    result.best_by_sharpe.alloc_buy_pct
                  )
                }
                className="inline-flex items-center gap-1.5 shrink-0 rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-cyan-400 transition-colors"
              >
                <span>Launch Best Sharpe Setup</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Optimal Configurations Overview */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {result.best_by_return && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/10 p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5" /> Best Total Return
                    </span>
                    <span className="text-xs text-zinc-400">
                      Alloc: {Math.round((result.best_by_return.alloc_buy_pct ?? 0) * 100)}%
                    </span>
                  </div>
                  <div className="text-2xl font-extrabold text-white">
                    +{result.best_by_return.total_return_pct ?? 0}%
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-zinc-400 border-t border-emerald-500/20 pt-2">
                    <span>Buy ≤ <strong className="text-emerald-400">{result.best_by_return.threshold_buy}</strong></span>
                    <span>Sell ≥ <strong className="text-cyan-400">{result.best_by_return.threshold_sell}</strong></span>
                    <span>MDD: <strong>-{result.best_by_return.max_drawdown_pct ?? 0}%</strong></span>
                  </div>
                </div>

                <button
                  onClick={() =>
                    handleApplyToSimulator(
                      result.best_by_return.threshold_buy,
                      result.best_by_return.threshold_sell,
                      result.best_by_return.alloc_buy_pct
                    )
                  }
                  className="mt-4 w-full flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500 hover:text-zinc-950 transition-colors"
                >
                  <span>Apply to Simulator</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {result.best_by_sharpe && (
              <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/10 p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                      <Award className="h-3.5 w-3.5" /> Best Sharpe Ratio
                    </span>
                    <span className="text-xs text-zinc-400">
                      Alloc: {Math.round((result.best_by_sharpe.alloc_buy_pct ?? 0) * 100)}%
                    </span>
                  </div>
                  <div className="text-2xl font-extrabold text-white">
                    {result.best_by_sharpe.sharpe_ratio != null ? result.best_by_sharpe.sharpe_ratio.toFixed(2) : "N/A"}
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-zinc-400 border-t border-cyan-500/20 pt-2">
                    <span>Buy ≤ <strong className="text-emerald-400">{result.best_by_sharpe.threshold_buy}</strong></span>
                    <span>Sell ≥ <strong className="text-cyan-400">{result.best_by_sharpe.threshold_sell}</strong></span>
                    <span>Return: <strong>+{result.best_by_sharpe.total_return_pct ?? 0}%</strong></span>
                  </div>
                </div>

                <button
                  onClick={() =>
                    handleApplyToSimulator(
                      result.best_by_sharpe.threshold_buy,
                      result.best_by_sharpe.threshold_sell,
                      result.best_by_sharpe.alloc_buy_pct
                    )
                  }
                  className="mt-4 w-full flex items-center justify-center gap-1.5 rounded-lg bg-cyan-500/20 border border-cyan-500/40 px-3 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500 hover:text-zinc-950 transition-colors"
                >
                  <span>Apply to Simulator</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {result.best_by_drawdown && (
              <div className="rounded-xl border border-purple-500/30 bg-purple-950/10 p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5" /> Minimum Drawdown
                    </span>
                    <span className="text-xs text-zinc-400">
                      Alloc: {Math.round((result.best_by_drawdown.alloc_buy_pct ?? 0) * 100)}%
                    </span>
                  </div>
                  <div className="text-2xl font-extrabold text-white">
                    -{result.best_by_drawdown.max_drawdown_pct ?? 0}%
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-zinc-400 border-t border-purple-500/20 pt-2">
                    <span>Buy ≤ <strong className="text-emerald-400">{result.best_by_drawdown.threshold_buy}</strong></span>
                    <span>Sell ≥ <strong className="text-cyan-400">{result.best_by_drawdown.threshold_sell}</strong></span>
                    <span>Sharpe: <strong>{result.best_by_drawdown.sharpe_ratio != null ? result.best_by_drawdown.sharpe_ratio.toFixed(2) : "N/A"}</strong></span>
                  </div>
                </div>

                <button
                  onClick={() =>
                    handleApplyToSimulator(
                      result.best_by_drawdown.threshold_buy,
                      result.best_by_drawdown.threshold_sell,
                      result.best_by_drawdown.alloc_buy_pct
                    )
                  }
                  className="mt-4 w-full flex items-center justify-center gap-1.5 rounded-lg bg-purple-500/20 border border-purple-500/40 px-3 py-2 text-xs font-semibold text-purple-300 hover:bg-purple-500 hover:text-zinc-950 transition-colors"
                >
                  <span>Apply to Simulator</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* 2D Sensitivity Heatmap */}
          {result.buy_thresholds?.length > 0 && result.sell_thresholds?.length > 0 && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-2">
                <div>
                  <h3 className="font-semibold text-white">Parameter Sensitivity Heatmap (Sharpe Ratio)</h3>
                  <p className="text-xs text-zinc-400">
                    Evaluated at {Math.round((result.target_alloc_for_heatmap ?? 0) * 100)}% cash allocation across Buy and Sell thresholds.
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
                          const val = result.heatmap_matrix?.[rowIdx]?.[colIdx];
                          if (val === null || val === undefined || isNaN(val)) {
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
          )}

          {/* Top Trial Combinations Table */}
          {result.top_trials && result.top_trials.length > 0 && (
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
                      <th className="pb-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50 text-zinc-300">
                    {result.top_trials.map((t, idx) => (
                      <tr key={idx} className="hover:bg-zinc-800/30">
                        <td className="py-2.5 font-semibold text-zinc-500">#{idx + 1}</td>
                        <td className="py-2.5 font-mono text-emerald-400">≤ {t.threshold_buy}</td>
                        <td className="py-2.5 font-mono text-cyan-400">≥ {t.threshold_sell}</td>
                        <td className="py-2.5 font-mono">{Math.round((t.alloc_buy_pct ?? 0) * 100)}%</td>
                        <td className="py-2.5 font-mono text-emerald-400 font-bold">+{t.total_return_pct ?? 0}%</td>
                        <td className="py-2.5 font-mono text-red-400">-{t.max_drawdown_pct ?? 0}%</td>
                        <td className="py-2.5 font-mono text-cyan-400 font-bold">
                          {t.sharpe_ratio != null ? t.sharpe_ratio.toFixed(2) : "N/A"}
                        </td>
                        <td className="py-2.5 font-mono">{t.win_rate_pct ?? 0}%</td>
                        <td className="py-2.5 font-mono">{t.trade_count ?? 0}</td>
                        <td className="py-2.5 text-right">
                          <button
                            onClick={() =>
                              handleApplyToSimulator(
                                t.threshold_buy,
                                t.threshold_sell,
                                t.alloc_buy_pct
                              )
                            }
                            className="inline-flex items-center gap-1 rounded bg-cyan-500/10 border border-cyan-500/30 px-2 py-1 text-[11px] font-semibold text-cyan-300 hover:bg-cyan-500 hover:text-zinc-950 transition-colors"
                            title={`Simulate Buy ≤ ${t.threshold_buy}, Sell ≥ ${t.threshold_sell}`}
                          >
                            <span>Simulate</span>
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
