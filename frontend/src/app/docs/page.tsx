export default function DocsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
        Documentation & Mathematical Specification
      </h1>
      <p className="text-sm text-zinc-400 mb-8">
        Architecture, Dynamic Channel Normalization mathematics, and metric definitions.
      </p>

      <div className="space-y-8 text-sm text-zinc-300 leading-relaxed">
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-3">
          <h2 className="text-lg font-semibold text-white">1. Dynamic Channel Normalization</h2>
          <p>
            Logarithmic regression models the long-term cyclical growth of digital assets by expressing price evolution in natural logarithmic space:
          </p>
          <div className="rounded-lg bg-zinc-950 p-4 border border-zinc-800 font-mono text-xs text-emerald-400">
            ln(Price) = a · ln(t + offset) + b + drift(t)
          </div>
          <p>
            For Bitcoin, the model fits two power-law base channels (top and bottom) with confirmed historical cycle marks (2013, 2017, 2021 peaks and 2012, 2015, 2018, 2022 bottoms). The residual drift accounts for diminishing cycle amplitude over time.
          </p>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-3">
          <h2 className="text-lg font-semibold text-white">2. Return & Sharpe Ratio Correctness</h2>
          <p>
            Standard financial backtesting requires that daily return arrays evaluate exclusively across active trading transitions:
          </p>
          <div className="rounded-lg bg-zinc-950 p-4 border border-zinc-800 font-mono text-xs text-cyan-400">
            R[i] = (V[i] - V[i - 1]) / V[i - 1]  for i ∈ [1, n - 1]
          </div>
          <p>
            Day 0 represents portfolio initialization where return is uncomputed. In Poly Strategy Lab, the day 0 slot is excluded from mean return and volatility calculations, preventing return and variance dilution.
          </p>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-3">
          <h2 className="text-lg font-semibold text-white">3. Defensive Dust Guards</h2>
          <p>
            To reflect realistic exchange execution constraints:
          </p>
          <ul className="list-disc list-inside space-y-1 text-zinc-400 text-xs">
            <li>Buy trades require a minimum trade amount of $1.00.</li>
            <li>Sell trades require a minimum unit threshold of 0.000001 units.</li>
            <li>Default commission fee rate is set to 0.10% (0.001) per trade.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
