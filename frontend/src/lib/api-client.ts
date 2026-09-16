import { AssetInfo, BacktestRequest, BacktestResponse, MarketDataResponse } from "@/types/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export async function fetchAssets(): Promise<AssetInfo[]> {
  const res = await fetch(`${API_BASE_URL}/assets`, { next: { revalidate: 60 } });
  if (!res.ok) {
    throw new Error(`Failed to fetch assets: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchMarketData(
  symbol: string,
  startDate?: string,
  endDate?: string
): Promise<MarketDataResponse> {
  const params = new URLSearchParams();
  if (startDate) params.append("start_date", startDate);
  if (endDate) params.append("end_date", endDate);

  const url = `${API_BASE_URL}/market-data/${encodeURIComponent(symbol)}?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch market data for ${symbol}: ${res.statusText}`);
  }
  return res.json();
}

export async function runBacktest(req: BacktestRequest): Promise<BacktestResponse> {
  const res = await fetch(`${API_BASE_URL}/backtest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Backtest failed: ${res.statusText}`);
  }
  return res.json();
}

export async function runOptimizer(req: import("@/types/api").OptimizeRequest): Promise<import("@/types/api").OptimizeResponse> {
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
  const res = await fetch(`${API_BASE_URL}/optimize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Optimizer failed: ${res.statusText}`);
  }
  return res.json();
}
