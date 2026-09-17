import {
  AssetInfo,
  BacktestRequest,
  BacktestResponse,
  MarketDataResponse,
  OptimizeRequest,
  OptimizeResponse,
} from "@/types/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const DEFAULT_TIMEOUT_MS = 30000;
const OPTIMIZER_TIMEOUT_MS = 60000;
const DATA_TIMEOUT_MS = 15000;

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly detail?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Executes fetch with an explicit timeout and optional external abort signal.
 * Adheres to Pragmatic Systems Handbook Section 1.3 (Defensive Architecture / Explicit Timeouts).
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new Error(`Request timed out after ${timeoutMs}ms`));
  }, timeoutMs);

  // Link external abort signal if provided
  if (options.signal) {
    if (options.signal.aborted) {
      clearTimeout(timer);
      throw options.signal.reason;
    }
    options.signal.addEventListener("abort", () => {
      clearTimeout(timer);
      controller.abort(options.signal?.reason);
    });
  }

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError(`Network request timed out or was cancelled: ${err.message}`, 408);
    }
    const message = err instanceof Error ? err.message : "Unknown network connection failure";
    throw new ApiError(`Network error communicating with API at ${url}: ${message}`);
  } finally {
    clearTimeout(timer);
  }
}

async function handleResponse<T>(res: Response, fallbackActionName: string): Promise<T> {
  if (!res.ok) {
    let errorDetail: string | undefined;
    try {
      const errorData = await res.json();
      errorDetail = errorData.detail || errorData.message;
    } catch {
      // Body is not JSON (e.g. proxy HTML 502/504 error page)
    }
    const statusInfo = res.statusText ? ` (${res.statusText})` : "";
    const message = errorDetail || `${fallbackActionName} failed with HTTP ${res.status}${statusInfo}`;
    throw new ApiError(message, res.status, errorDetail);
  }
  return res.json();
}

export async function fetchAssets(signal?: AbortSignal): Promise<AssetInfo[]> {
  const res = await fetchWithTimeout(
    `${API_BASE_URL}/assets`,
    { signal },
    DATA_TIMEOUT_MS
  );
  return handleResponse<AssetInfo[]>(res, "Fetching asset catalog");
}

export async function fetchMarketData(
  symbol: string,
  startDate?: string,
  endDate?: string,
  signal?: AbortSignal
): Promise<MarketDataResponse> {
  const params = new URLSearchParams();
  if (startDate) params.append("start_date", startDate);
  if (endDate) params.append("end_date", endDate);

  const query = params.toString() ? `?${params.toString()}` : "";
  const url = `${API_BASE_URL}/market-data/${encodeURIComponent(symbol)}${query}`;
  const res = await fetchWithTimeout(url, { signal }, DATA_TIMEOUT_MS);
  return handleResponse<MarketDataResponse>(res, `Fetching market data for ${symbol}`);
}

export async function runBacktest(
  req: BacktestRequest,
  signal?: AbortSignal
): Promise<BacktestResponse> {
  const res = await fetchWithTimeout(
    `${API_BASE_URL}/backtest`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      signal,
    },
    DEFAULT_TIMEOUT_MS
  );
  return handleResponse<BacktestResponse>(res, "Backtest simulation");
}

export async function runOptimizer(
  req: OptimizeRequest,
  signal?: AbortSignal
): Promise<OptimizeResponse> {
  const res = await fetchWithTimeout(
    `${API_BASE_URL}/optimize`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      signal,
    },
    OPTIMIZER_TIMEOUT_MS
  );
  return handleResponse<OptimizeResponse>(res, "Parameter grid search optimization");
}
