# Poly Strategy Lab

Interactive multi-asset quantitative trading strategy laboratory and parameter optimization platform.

Poly Strategy Lab is a production-grade, multi-asset quantitative platform extending algorithmic backtesting, dynamic channel normalization, and parameter grid search across cryptocurrencies, equities, and customizable asset universes.

---

## Key Features

1. **Bifurcated Quantitative Architecture**:
   - **Equities & Stock Index ETFs (QQQ, SPY, Growth Equities)**:
     - Causal rolling log-linear regression channel tracking geometric compounding growth.
     - Gaussian valuation oscillator ($\Phi(Z_t)$) with rolling volatility normalization.
     - Secular Trend Regime Gating (50-EMA vs. 200-EMA) that rotates exposure to cash during multi-year secular bear regimes (slashing QQQ maximum drawdown from -80.45% to -29.82% over 1999-2026).
   - **Cryptocurrencies (BTC, ETH, SOL, Altcoins)**:
     - Bitcoin: Scale-invariant logarithmic regression and halving-cycle rainbow bands.
     - Altcoins: Dynamic Adaptive Residual Channel (DARC) with beta-adjusted momentum and continuous normalization.

2. **Multi-Asset Strategy Simulator**:
   - Support for Top 10 Cryptocurrencies by market cap (BTC, ETH, SOL, BNB, XRP, ADA, DOGE, AVAX, LINK, NEAR) plus custom tickers (e.g. SPY, QQQ, AAPL).
   - High-performance TradingView Lightweight Charts (candlestick chart with dynamic channel bands and equity curve).
   - Logarithmic and linear scale switching for multi-decade exponential curves.
   - Benchmark comparison against Buy & Hold.
   - Instant parameter adjustments with URL sharing and deep-linking.
   - Trade history export in CSV and full JSON simulation reports.

3. **Multi-Objective Parameter Optimizer**:
   - Numba JIT-compiled C-speed backtesting engine evaluating 144 parameter combinations in seconds.
   - 2D sensitivity heatmap identifying robust parameter neighborhoods.
   - Optimal parameter profiles ranked by Sharpe Ratio, Total Return, and Minimum Drawdown.
   - One-click transfer to Strategy Simulator from any configuration card or table row.

4. **Persistent Watchlist**:
   - Client-side reactive asset store backed by `localStorage`.
   - Unified watchlist synchronized seamlessly between Simulator and Optimizer.

---

## Architecture Overview

```text
poly-strategy-lab/
├── backend/                  # Asynchronous FastAPI quantitative engine
│   ├── app/
│   │   ├── api/v1/           # REST endpoints (assets, market data, backtest, optimize)
│   │   ├── core/             # Configuration, logging, CORS
│   │   ├── engine/           # Vectorized & Numba JIT-accelerated backtest kernels
│   │   ├── indicators/       # Bifurcated dynamic channels (equity compounding & crypto power-law)
│   │   ├── models/           # Pydantic v2 schemas and domain models
│   │   └── services/         # Multi-asset data fetching and parquet caching
│   └── tests/                # Automated pytest suite (unit, boundary, edge-cases)
├── frontend/                 # Modern Next.js 14/15 App Router web application
│   ├── src/
│   │   ├── app/              # Routes: /simulator, /optimizer, /research, /docs
│   │   ├── components/       # TradingView Lightweight Charts, parameter controls, badges
│   │   ├── hooks/            # Reactive data fetching hooks
│   │   ├── lib/              # Typed API clients, asset store, export utilities
│   │   └── types/            # TypeScript domain interfaces
│   └── public/               # Static assets
└── docs/
    └── research/             # Comprehensive quantitative research whitepapers
        ├── CRYPTO_METHODOLOGY.md       # Crypto power-law & altcoin DARC research
        └── EQUITY_ETF_METHODOLOGY.md   # Equity compounding channel & regime gating research
```

---

## Quantitative Research Documentation

Detailed theoretical frameworks, mathematical proofs, and empirical analyses are documented in:
- [Crypto Methodology Whitepaper](docs/research/CRYPTO_METHODOLOGY.md): Scale-invariant power laws, Metcalfe network adoption, and Altcoin Dynamic Adaptive Residual Channel.
- [Equity & Index ETF Methodology Whitepaper](docs/research/EQUITY_ETF_METHODOLOGY.md): Compound growth dynamics, Moskowitz time-series momentum, and secular trend regime filtering.

---

## Lineage

- **Version 1 (Bitcoin Strategy Lab):** [btc-strategy-lab](https://github.com/bennypepper/btc-strategy-lab)
- **Phase 1-3 Research Pipeline:** [btc-trading-optimization](https://github.com/bennypepper/btc-trading-optimization)

---

## Quick Start (Local Development)

### 1. Backend Setup (FastAPI)

Prerequisites: Python 3.11+

```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --port 8000 --reload
```

Interactive API documentation will be available at `http://localhost:8000/docs`.

To run backend tests:
```bash
pytest
```

### 2. Frontend Setup (Next.js)

Prerequisites: Node.js 18+

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

To build and run in production mode:
```bash
npm run build
npm run start
```

---

## License

MIT License. See LICENSE file for details.
