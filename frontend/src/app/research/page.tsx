import Link from "next/link";
import { ExternalLink, BookOpen, Award, CheckCircle2 } from "lucide-react";

export default function ResearchPage() {
  const indicators = [
    { name: "Logarithmic Regression (Trolololo)", rank: 1, rho90: -0.4261, comp: 0.6557, selected: true },
    { name: "MVRV Z-Score", rank: 2, rho90: -0.3421, comp: 0.5841, selected: false },
    { name: "Puell Multiple", rank: 3, rho90: -0.3115, comp: 0.5429, selected: false },
    { name: "Pi Cycle Top", rank: 4, rho90: -0.2840, comp: 0.5012, selected: false },
    { name: "RHODL Ratio", rank: 5, rho90: -0.2618, comp: 0.4810, selected: false },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-3xl mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400 mb-3">
          <Award className="h-3.5 w-3.5" />
          Quantitative Methodology
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Quantitative Research Archive
        </h1>
        <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
          Empirical indicator evaluation, statistical correlation metrics, and quantitative foundations underpinning the Poly Strategy Lab backtesting engine.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="md:col-span-2 space-y-8">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Indicator Evaluation & Selection</h2>
            <p className="text-xs text-zinc-400 mb-4">
              Across 10 on-chain and technical market indicators evaluated with Spearman correlation over 5 lag windows (14, 30, 60, 90, 180 days), Logarithmic Regression achieved the highest composite predictive consistency.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-zinc-800 text-zinc-400">
                  <tr>
                    <th className="pb-2">Rank</th>
                    <th className="pb-2">Indicator Name</th>
                    <th className="pb-2">Spearman ρ (90d)</th>
                    <th className="pb-2">Composite Score</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50 text-zinc-300">
                  {indicators.map((ind) => (
                    <tr key={ind.rank} className={ind.selected ? "bg-emerald-500/5 font-medium" : ""}>
                      <td className="py-2.5">#{ind.rank}</td>
                      <td className="py-2.5 font-semibold text-white">{ind.name}</td>
                      <td className="py-2.5 font-mono">{ind.rho90.toFixed(4)}</td>
                      <td className="py-2.5 font-mono">{ind.comp.toFixed(4)}</td>
                      <td className="py-2.5">
                        {ind.selected ? (
                          <span className="rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 text-[10px]">
                            Selected
                          </span>
                        ) : (
                          <span className="text-zinc-500 text-[10px]">Benchmark</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
            <h2 className="text-lg font-semibold text-white mb-3">Anti-Lookahead Bias Guarantees</h2>
            <p className="text-xs text-zinc-400 leading-relaxed mb-4">
              To guarantee zero forward-looking bias, the simulation strictly enforces day T signal evaluation with day T+1 market open execution. Signals are generated at close of day T, and all simulated orders fill at open of day T+1.
            </p>
            <div className="rounded-lg bg-zinc-950 p-4 border border-zinc-800 font-mono text-xs text-zinc-400 space-y-1">
              <div>Signal Generated: <span className="text-emerald-400">Signal[T] &lt;= Threshold (at Close T)</span></div>
              <div>Trade Executed:   <span className="text-cyan-400">Price = Open[T+1]</span></div>
              <div>Portfolio Marked: <span className="text-zinc-300">Close[T+1]</span></div>
            </div>
          </div>
        </div>

        {/* Sidebar Links */}
        <div className="space-y-6">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
            <h3 className="text-sm font-semibold text-white mb-3">Research Repositories</h3>
            <div className="space-y-3">
              <a
                href="https://btc-strategy-lab.streamlit.app"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-xs text-zinc-200 hover:border-zinc-700 hover:text-white transition-colors"
              >
                <div>
                  <div className="font-medium">BTC Strategy Lab (v1 Demo)</div>
                  <div className="text-zinc-500">Initial Bitcoin strategy prototype</div>
                </div>
                <ExternalLink className="h-4 w-4 text-zinc-400" />
              </a>

              <a
                href="https://github.com/bennypepper/btc-strategy-lab"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-xs text-zinc-200 hover:border-zinc-700 hover:text-white transition-colors"
              >
                <div>
                  <div className="font-medium">btc-strategy-lab</div>
                  <div className="text-zinc-500">Foundational Bitcoin strategy repo</div>
                </div>
                <ExternalLink className="h-4 w-4 text-zinc-400" />
              </a>

              <a
                href="https://github.com/bennypepper/btc-trading-optimization"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-xs text-zinc-200 hover:border-zinc-700 hover:text-white transition-colors"
              >
                <div>
                  <div className="font-medium">btc-trading-optimization</div>
                  <div className="text-zinc-500">Indicator evaluation pipeline</div>
                </div>
                <ExternalLink className="h-4 w-4 text-zinc-400" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
