import Link from "next/link";
import { ExternalLink, BookOpen, Award, ShieldCheck, Zap, TrendingUp, Layers, CheckCircle2 } from "lucide-react";

export default function ResearchPage() {
  const models = [
    {
      name: "Bitcoin Power-Law (CRPL)",
      assetClass: "Cryptocurrency (BTC)",
      formulation: "ln P_t = α_t + β_t ln(days_t) + ε_t",
      normalization: "Continuous Tanh-MAD (γ = 2.0)",
      lookaheadStatus: "Zero-Lookahead (Causal Expanding OLS)",
      description: "Scale-invariant logarithmic adoption trajectory anchored to the Bitcoin Genesis block (2009-01-03). Evaluates dynamic 4-year cycle (1460-day) rolling dispersion without forward-peeking extrema.",
    },
    {
      name: "Altcoin Adaptive Residual Channel (DARC)",
      assetClass: "Altcoins (ETH, SOL, AVAX, L1s)",
      formulation: "ε_t = ln P_t - EMA_21(ln P_t)",
      normalization: "Continuous Tanh-MAD (γ = 2.5)",
      lookaheadStatus: "Zero-Lookahead (Causal Rolling MAD)",
      description: "Stationary residual trajectory with dynamic volatility envelopes. Replaces unanchored calendar fits and hard clipping with continuous sigmoidal gradients (dS/dZ > 0) to capture extreme tail events.",
    },
    {
      name: "Equity Compounding Channel",
      assetClass: "Index ETFs & Equities (QQQ, SPY)",
      formulation: "ln P_t = α_t + g_t · t + ε_t",
      normalization: "Gaussian Oscillator Ω_t = 100 · Φ(Z_t)",
      lookaheadStatus: "Zero-Lookahead (252-day Rolling OLS)",
      description: "Exponential compounding baseline with smooth logistic secular regime gating (EMA 50 vs EMA 200) and 200-bar warmup masking to shield portfolios from multi-year macro drawdowns.",
    },
  ];

  const validationPrinciples = [
    {
      title: "Asset-Calibrated Annualization",
      detail: "US equities (QQQ, SPY) trade 252 days per year, while crypto markets trade 365 days. The backtest engine applies exact trading-day scaling (sqrt(252) vs sqrt(365)) and daily risk-free rates, eradicating the +20.35% Sharpe ratio inflation inherent in generic backtesters.",
    },
    {
      title: "Strict Execution Causality",
      detail: "Signals generated at close of day T are executed strictly at open of day T+1 (Price = Open[T+1]). Portfolio valuations mark at Close[T+1]. No bar T+1 pricing leaks into bar T indicator calculations.",
    },
    {
      title: "Walk-Forward Out-of-Sample Validation (WFO)",
      detail: "Grid optimization splits historical data into 70% in-sample training and 30% out-of-sample holdout testing. The platform computes an automated Generalization Efficiency Ratio (OOS Sharpe / In-Sample Sharpe) to distinguish genuine alpha from curve-fit data snooping.",
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="max-w-3xl mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-400 mb-3">
          <Award className="h-3.5 w-3.5" />
          Quantitative Econometrics &amp; Methodology
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Quantitative Research Archive
        </h1>
        <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
          Empirical asset pricing models, causal statistical indicators, and anti-lookahead execution guarantees underpinning the Poly Strategy Lab quantitative engine.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Column */}
        <div className="lg:col-span-2 space-y-8">
          {/* Production Models Section */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
            <h2 className="text-base font-semibold text-white mb-2">Production Quantitative Engines</h2>
            <p className="text-xs text-zinc-400 mb-6">
              Bifurcated econometric architectures tailored specifically to the structural characteristics of distinct asset classes.
            </p>

            <div className="space-y-4">
              {models.map((model) => (
                <div key={model.name} className="rounded-xl border border-zinc-800/80 bg-zinc-900/90 p-4 hover:border-zinc-700 transition-colors">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <h3 className="text-sm font-semibold text-white">{model.name}</h3>
                    <span className="rounded-full bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 text-[10px] font-medium text-cyan-400">
                      {model.assetClass}
                    </span>
                  </div>

                  <p className="text-xs text-zinc-300 leading-relaxed mb-3">
                    {model.description}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono border-t border-zinc-800/60 pt-3 text-zinc-400">
                    <div>
                      <span className="text-zinc-500">Formulation: </span>
                      <span className="text-zinc-200">{model.formulation}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500">Scaling: </span>
                      <span className="text-zinc-200">{model.normalization}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Execution Integrity Guarantees */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <h2 className="text-base font-semibold text-white">Execution Integrity &amp; Anti-Bias Guarantees</h2>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed mb-6">
              Rigorous econometric safeguards eliminating lookahead bias, parameter step cliffs, and metric inflation.
            </p>

            <div className="space-y-4">
              {validationPrinciples.map((item, idx) => (
                <div key={idx} className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-4">
                  <h4 className="text-xs font-semibold text-zinc-200 mb-1">{item.title}</h4>
                  <p className="text-xs text-zinc-400 leading-relaxed">{item.detail}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-lg bg-zinc-950 p-4 border border-zinc-800 font-mono text-xs text-zinc-400 space-y-1.5">
              <div className="text-zinc-500">{"// Causal Trade Execution Lifecycle"}</div>
              <div>Signal Evaluated: <span className="text-emerald-400">Signal[T] &lt;= Threshold (at Close T)</span></div>
              <div>Order Filled:     <span className="text-cyan-400">Execution Price = Open[T+1]</span></div>
              <div>Mark-to-Market:   <span className="text-zinc-300">Portfolio Marked = Close[T+1]</span></div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Stats / Specification */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider text-zinc-400 mb-3">
              Platform Specifications
            </h3>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between border-b border-zinc-800/60 pb-2">
                <span className="text-zinc-500">Execution Engine</span>
                <span className="text-zinc-200 font-mono">Numba C-JIT</span>
              </div>
              <div className="flex justify-between border-b border-zinc-800/60 pb-2">
                <span className="text-zinc-500">Signal Bounds</span>
                <span className="text-zinc-200 font-mono">[0.0, 100.0]</span>
              </div>
              <div className="flex justify-between border-b border-zinc-800/60 pb-2">
                <span className="text-zinc-500">Normalization</span>
                <span className="text-zinc-200 font-mono">Tanh-MAD / Gaussian</span>
              </div>
              <div className="flex justify-between border-b border-zinc-800/60 pb-2">
                <span className="text-zinc-500">Equity Calendar</span>
                <span className="text-zinc-200 font-mono">252 Trading Days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Crypto Calendar</span>
                <span className="text-zinc-200 font-mono">365 Calendar Days</span>
              </div>
            </div>
          </div>

          {/* Research Documents */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider text-zinc-400 mb-3">
              Whitepapers &amp; Documents
            </h3>
            <div className="space-y-2.5">
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/80 p-3 text-xs">
                <div className="font-medium text-zinc-200">Crypto Power-Law Whitepaper</div>
                <div className="text-[11px] text-zinc-500 mt-0.5">Scale invariance, DARC, and non-clipping signal transforms (1,200 lines).</div>
                <div className="text-[10px] text-cyan-400 font-mono mt-1">docs/research/CRYPTO_METHODOLOGY.md</div>
              </div>

              <div className="rounded-lg border border-zinc-800 bg-zinc-900/80 p-3 text-xs">
                <div className="font-medium text-zinc-200">Equity ETF Methodology</div>
                <div className="text-[11px] text-zinc-500 mt-0.5">Exponential compounding, secular regime gating, and annualization (570 lines).</div>
                <div className="text-[10px] text-cyan-400 font-mono mt-1">docs/research/EQUITY_ETF_METHODOLOGY.md</div>
              </div>
            </div>
          </div>

          {/* Legacy Demo Reference */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider text-zinc-400 mb-3">
              Historical Prototype (v1)
            </h3>
            <a
              href="https://btc-strategy-lab.streamlit.app"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/80 p-3 text-xs text-zinc-200 hover:border-zinc-700 hover:text-white transition-colors"
            >
              <div>
                <div className="font-medium">BTC Strategy Lab (v1 Demo)</div>
                <div className="text-[11px] text-zinc-500">Initial Streamlit prototype</div>
              </div>
              <ExternalLink className="h-4 w-4 text-zinc-400" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
