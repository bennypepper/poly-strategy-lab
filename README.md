# Poly Strategy Lab

Interactive multi-asset quantitative trading strategy laboratory and parameter optimization platform.

Poly Strategy Lab is the production-grade, multi-asset evolution (v2) of the academic research simulator [btc-strategy-lab](https://github.com/bennypepper/btc-strategy-lab) (PKL Research, 2026). It extends quantitative signal analysis and parameter optimization across Bitcoin (BTC), Ethereum (ETH), Solana (SOL), and customizable asset universes.

---

## Architecture Overview

Poly Strategy Lab is architected as a decoupled, high-performance web platform:

```text
poly-strategy-lab/
├── backend/                  # Asynchronous FastAPI quantitative engine
│   ├── app/
│   │   ├── api/v1/           # REST endpoints (assets, market data, backtest, optimize)
│   │   ├── core/             # Configuration, logging, CORS
│   │   ├── engine/           # Vectorized & Numba JIT-accelerated backtest kernels
│   │   ├── indicators/       # Dynamic logarithmic channel normalizer & momentum indicators
│   │   ├── models/           # Pydantic v2 schemas and domain models
│   │   └── services/         # Multi-asset data fetching (Yahoo Finance / CCXT) and caching
│   └── tests/                # Automated pytest suite (parity, edge-cases, multi-asset)
├── frontend/                 # Modern Next.js 15 App Router web application
│   ├── src/
│   │   ├── app/              # Routes: /simulator, /optimizer, /research, /docs
│   │   ├── components/       # TradingView Lightweight Charts, parameter controls, metrics
│   │   ├── hooks/            # Reactive data fetching and backtest execution hooks
│   │   └── lib/              # Typed API clients and formatters
└── docker-compose.yml        # Unified container orchestration
```

---

## Core Capabilities

1. **Multi-Asset Strategy Backtesting:**
   - Execute vectorized backtests across arbitrary cryptocurrencies and market indices.
   - Zero return dilution on day 0 evaluation: metrics reflect true inter-day volatility.
   - Dual-scenario and custom threshold execution with dust guards and realistic transaction costs.

2. **Generalized Dynamic Channel Normalization:**
   - Logarithmic regression bands calibrated per asset to eliminate retroactivity and Index Revision Bias.
   - Configurable channel parameters adapting to asset maturity and historical cycle length.

3. **TradingView Lightweight Charts Integration:**
   - High-performance 60fps canvas-rendered candlestick charts with dynamic indicator overlays.
   - Interactive equity curves comparing strategy performance against benchmark Buy & Hold.

4. **Multi-Objective Grid Search Optimization:**
   - Rapid parameter grid search across Total Return, Maximum Drawdown, and Sharpe Ratio.
   - 2D sensitivity heatmaps for identifying robust parameter regions and avoiding overfitting.

---

## Research Lineage

- **Version 1 (Academic Research Demo):** [btc-strategy-lab](https://github.com/bennypepper/btc-strategy-lab) (Live: [btc-strategy-lab.streamlit.app](https://btc-strategy-lab.streamlit.app))
- **Phase 1-3 Research Pipeline:** [btc-trading-optimization](https://github.com/bennypepper/btc-trading-optimization)
- **Thesis Title:** *Optimalisasi Parameter Trading Bitcoin Menggunakan Grid Search pada Tiga Metrik Evaluasi Berbasis Indikator Logarithmic Regression* (PKL Research, 2026)

---

## Quick Start (Local Development)

### 1. Backend Setup (FastAPI)
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Or on Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
Interactive Swagger API documentation will be available at `http://localhost:8000/docs`.

### 2. Frontend Setup (Next.js 15)
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:3000` in your browser.

---

## License

MIT License. See LICENSE file for details.
