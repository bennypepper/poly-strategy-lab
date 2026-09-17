import Link from "next/link";
import { Activity, ShieldCheck, Zap, BarChart3, ArrowRight, CheckCircle2, TrendingUp, Layers } from "lucide-react";

export default function Home() {
  const features = [
    {
      title: "Multi-Asset Universe",
      description: "Backtest seamlessly across Bitcoin (BTC), Ethereum (ETH), Solana (SOL), and custom asset pairs with automatic dynamic channel calibration.",
      icon: Layers,
    },
    {
      title: "Zero Return Dilution",
      description: "Engine mathematics evaluate inter-day transitions exclusively across trading periods, eliminating day 0 uncomputed variance dilution.",
      icon: ShieldCheck,
    },
    {
      title: "Dynamic Channel Normalization",
      description: "Adaptive power-law logarithmic regression channels remove Index Revision Bias and prevent retroactive signal shifting.",
      icon: TrendingUp,
    },
    {
      title: "Sub-Millisecond Numba Kernels",
      description: "Vectorized C-speed simulation kernels running asynchronous FastAPI endpoints supporting hundreds of parameter combinations per second.",
      icon: Zap,
    },
  ];

  return (
    <div className="relative overflow-hidden">
      {/* Hero Section */}
      <section className="relative mx-auto max-w-7xl px-4 pt-16 pb-20 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400 mb-6">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Version 2.0 Live Platform
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-6xl sm:leading-tight">
            Multi-Asset Quantitative <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
              Strategy Laboratory
            </span>
          </h1>

          <p className="mt-6 text-lg text-zinc-400 leading-relaxed">
            The next-generation multi-asset successor to BTC Strategy Lab. Run high-speed strategy simulations, calibrate dynamic logarithmic channels, and optimize trading parameters across crypto assets.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/simulator"
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-emerald-500 px-6 py-3 text-sm font-semibold text-zinc-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-colors"
            >
              <Activity className="h-4 w-4" />
              Launch Strategy Simulator
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/research"
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/60 px-6 py-3 text-sm font-semibold text-zinc-200 hover:bg-zinc-800 hover:text-white transition-colors"
            >
              <BarChart3 className="h-4 w-4" />
              Explore Research Archive
            </Link>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 border-t border-zinc-800/60">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feat) => {
            const Icon = feat.icon;
            return (
              <div
                key={feat.title}
                className="relative rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 hover:border-zinc-700 transition-colors"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-4">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-zinc-100">{feat.title}</h3>
                <p className="mt-2 text-sm text-zinc-400 leading-normal">{feat.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Version Comparison Section */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 border-t border-zinc-800/60">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">Architectural Evolution</h2>
          <p className="mt-3 text-zinc-400 text-sm">
            Maintaining continuity with the foundational BTC Strategy Lab prototype while expanding into a production-grade multi-asset platform.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* v1 Card */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-zinc-300">v1 BTC Strategy Lab (Streamlit)</h3>
              <span className="text-xs text-zinc-500 border border-zinc-800 px-2 py-0.5 rounded">Prototype</span>
            </div>
            <ul className="space-y-2.5 text-sm text-zinc-400">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-zinc-500 shrink-0 mt-0.5" />
                <span>Single asset: Bitcoin (BTC) only</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-zinc-500 shrink-0 mt-0.5" />
                <span>Foundational Bitcoin quantitative strategy prototype</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-zinc-500 shrink-0 mt-0.5" />
                <span>Synchronous Streamlit research interface</span>
              </li>
            </ul>
          </div>

          {/* v2 Card */}
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/10 p-6 relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-emerald-400">v2 Poly Strategy Lab</h3>
              <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded">Active Platform</span>
            </div>
            <ul className="space-y-2.5 text-sm text-zinc-300">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Multi-asset universe: BTC, ETH, SOL, altcoins</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>TradingView Lightweight Charts (60fps canvas rendering)</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Asynchronous FastAPI backend with typed Pydantic contracts</span>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
