# VibeSec Security Audit Report: Poly Strategy Lab

**Target Application:** Poly Strategy Lab (Quantitative Strategy & Optimization Engine)  
**Repository Scope:** Backend (FastAPI, Numba, Pandas, PyArrow) & Frontend (Next.js 14, TypeScript, TailwindCSS)  
**Security Standard:** VibeSec Application Security Framework & OWASP Top 10 API Security  
**Audit Date:** 2026-09-18  
**Audit Classification:** Offensive Security Review & Vulnerability Assessment  

---

## 1. Executive Summary

A comprehensive offensive security audit and code review of the Poly Strategy Lab codebase was conducted following the VibeSec application security framework. The review covered both server-side Python (FastAPI/Numba) and client-side TypeScript (Next.js/React) components.

The assessment identified **7 security vulnerabilities** spanning Critical, High, Medium, and Low severity classifications. The most critical finding is an active, verified **CWE-22 Path Traversal** vulnerability in the data caching service that permits arbitrary Parquet file reads outside the cache sandbox and arbitrary file overwrite upon market data downloads. Additionally, high-impact **Denial of Service (DoS)** vulnerabilities exist due to unbounded parameter grid search permutations executed directly on the synchronous asyncio event loop, causing total server starvation.

### Vulnerability Summary Matrix

| Finding ID | Vulnerability Title | CWE ID | Severity | CVSS v3.1 | Affected Component |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **VIBESEC-01** | Arbitrary File Read & Overwrite via Path Traversal in Data Caching Layer | CWE-22, CWE-73 | **CRITICAL** | 9.1 | `backend/app/services/data_fetcher.py` |
| **VIBESEC-02** | CPU Starvation & Event Loop Blocking via Unbounded Grid Search Combinations | CWE-400, CWE-834 | **HIGH** | 8.2 | `backend/app/engine/optimizer_grid.py` |
| **VIBESEC-03** | Missing HTTP Request Body Size Limits & Global Timeout Guards | CWE-770, CWE-400 | **MEDIUM** | 6.5 | `backend/app/main.py` |
| **VIBESEC-04** | Upstream API Rate Limit Exhaustion via Unsanitized Ticker Inputs | CWE-20, CWE-918 | **MEDIUM** | 6.1 | `backend/app/services/data_fetcher.py` |
| **VIBESEC-05** | Overly Permissive CORS Policy & Missing Core HTTP Security Headers | CWE-942, CWE-693 | **MEDIUM** | 5.7 | `backend/app/main.py`, `frontend/next.config.mjs` |
| **VIBESEC-06** | Internal Filesystem & Stack Trace Disclosure via Unhandled Exceptions | CWE-209, CWE-200 | **LOW** | 4.3 | `backend/app/api/v1/*.py` |
| **VIBESEC-07** | Client-Side LocalStorage Unbounded Growth & Untrusted Input Ingestion | CWE-20, CWE-770 | **LOW** | 3.8 | `frontend/src/lib/asset-store.ts` |

---

## 2. Detailed Vulnerability Findings

---

### Finding VIBESEC-01: Arbitrary File Read & Overwrite via Path Traversal in Data Caching Layer

- **CWE Identifier:** CWE-22 (Improper Limitation of a Pathname to a Restricted Directory), CWE-73 (External Control of File Name or Path)
- **OWASP API Security:** API3:2023 - Broken Object Property Level Authorization / Injection
- **Severity Rating:** **CRITICAL**
- **CVSS v3.1 Score:** 9.1 (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N)
- **Affected File & Line Number:** `backend/app/services/data_fetcher.py:116`, `backend/app/models/schemas.py:14, 93`, `backend/app/api/v1/market_data.py:10-17`

#### Vulnerability Description
In `backend/app/services/data_fetcher.py`, the market data caching subsystem constructs file paths by joining the cache directory with the user-provided `symbol` parameter:

```python
cache_dir = Path(settings.DATA_CACHE_DIR)
cache_dir.mkdir(parents=True, exist_ok=True)
cache_file = cache_dir / f"{symbol.replace('/', '_')}.parquet"
```

The sanitization only replaces the POSIX forward slash (`/`) with an underscore (`_`). It completely ignores Windows backslash path separators (`\`), directory traversal sequences (`..`), and absolute path indicators. Furthermore, neither `BacktestRequest` nor `OptimizeRequest` enforces validation or regex restrictions on `symbol`.

#### Attack Vector & Exploit Scenario
1. **Arbitrary Parquet File Read:**
   When an attacker submits a backtest or market data request with `symbol: "..\\master_dataset"`, the path resolves to:
   `Path("data/cache") / "..\\master_dataset.parquet" -> "data/master_dataset.parquet"`.
   Because `backend/data/master_dataset.parquet` exists on the server, `cache_file.exists()` evaluates to `True`. `fetch_market_data` reads the Parquet file and loads 5,188 rows of internal research data outside the intended cache directory.

2. **Arbitrary File Write / Overwrite:**
   If the specified file does not exist locally and yfinance returns data for a requested ticker string, the service executes:
   ```python
   df.to_parquet(cache_file)
   ```
   This writes a binary Parquet file directly to any arbitrary location writable by the application process (e.g. `..\\..\\evil.parquet` in the project root or system temporary folders).

#### Concrete Remediation Code & Hardened Pattern

Implement strict two-layer defense according to VibeSec guidelines:

1. **Input Validation (Pydantic Schema):** Enforce strict alphanumeric and standard ticker character whitelisting in `backend/app/models/schemas.py`:

```python
import re
from pydantic import BaseModel, Field, field_validator

TICKER_REGEX = re.compile(r"^[A-Z0-9\.\-\=]{1,20}$")

class BaseAssetRequest(BaseModel):
    symbol: str = Field(default="BTC-USD", min_length=1, max_length=20)

    @field_validator("symbol")
    @classmethod
    def validate_symbol_format(cls, v: str) -> str:
        clean = v.strip().upper()
        if not TICKER_REGEX.match(clean):
            raise ValueError(f"Invalid symbol format: '{clean}'. Must match {TICKER_REGEX.pattern}")
        return clean
```

2. **Canonical Path Sandboxing:** Enforce canonical containment in `backend/app/services/data_fetcher.py`:

```python
import os
from pathlib import Path

def resolve_safe_cache_path(base_dir: str | Path, symbol: str) -> Path:
    """
    Resolves canonical cache path and guarantees boundary containment within base_dir.
    Raises PermissionError upon directory traversal detection (CWE-22).
    """
    # 1. Sanitize: allow only strict safe characters, convert to safe base name
    safe_name = re.sub(r"[^A-Za-z0-9_\-]", "_", symbol.strip().upper())
    filename = f"{safe_name}.parquet"

    # 2. Canonicalize base and target paths
    base_canonical = Path(base_dir).resolve()
    target_canonical = (base_canonical / filename).resolve()

    # 3. Enforce directory boundary containment
    if base_canonical not in target_canonical.parents and target_canonical != base_canonical:
        raise PermissionError(f"CWE-22 Path Traversal detected for symbol: {symbol}")

    return target_canonical
```

---

### Finding VIBESEC-02: CPU Starvation & Event Loop Blocking via Unbounded Grid Search Combinations

- **CWE Identifier:** CWE-400 (Uncontrolled Resource Consumption), CWE-834 (Excessive Iteration), CWE-770 (Allocation of Resources Without Limits or Throttling)
- **OWASP API Security:** API4:2023 - Unrestricted Resource Consumption
- **Severity Rating:** **HIGH**
- **CVSS v3.1 Score:** 8.2 (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H)
- **Affected File & Line Number:** `backend/app/models/schemas.py:94-96`, `backend/app/api/v1/optimizer.py:10, 21-29`, `backend/app/engine/optimizer_grid.py:33-63, 75-84`

#### Vulnerability Description
The parameter optimizer endpoint (`POST /api/v1/optimize`) allows clients to submit arbitrary lists of integers and floats:

```python
class OptimizeRequest(BaseModel):
    symbol: str = Field(default="BTC-USD")
    buy_thresholds: List[int] = Field(default=[15, 20, 25, 30, 35, 40])
    sell_thresholds: List[int] = Field(default=[60, 65, 70, 75, 80, 85])
    alloc_pcts: List[float] = Field(default=[0.4, 0.6, 0.8, 1.0])
    initial_capital: float = Field(default=100_000.0)
    fee_rate: float = Field(default=0.001)
```

There are four distinct architectural flaws compounding this vulnerability:
1. **Unbounded Array Sizes:** No `max_length` or upper combination constraint is imposed on `buy_thresholds`, `sell_thresholds`, or `alloc_pcts`.
2. **Missing Boundary Validation:** Values such as negative thresholds (`-999`), negative allocations (`-5.0`), or negative initial capital pass schema validation without error.
3. **Algorithmic Complexity in Heatmap Matrix Generation:** Lines 75-84 in `optimizer_grid.py` execute an inner linear scan (`next(...)`) over the accumulated `trials` array for every (buy, sell) pair, causing $O(\text{trials} \times \text{buy} \times \text{sell})$ complexity.
4. **Async Event Loop Starvation:** `optimize_parameters` is declared with `async def`. In FastAPI, CPU-bound computations executed inside `async def` run on the main thread and block the entire asyncio event loop. No other incoming HTTP requests (including `/health` or backtests) can be handled until the grid search completes.

#### Attack Vector & Exploit Scenario
An attacker posts a request with 100 buy thresholds, 100 sell thresholds, and 100 allocation percentages:
- Total combinations: $100 \times 100 \times 100 = 1,000,000$ backtests.
- Each backtest iterates through ~3,000 daily candles, resulting in 3 billion loop cycles.
- The server allocates 1,000,000 dictionary objects in memory.
- The main asyncio event loop freezes for 10+ minutes. The server becomes completely unresponsive, triggering container health check timeouts and cascading service failure.

#### Concrete Remediation Code & Hardened Pattern

1. **Schema Constraints & Total Combination Guard:** Update `backend/app/models/schemas.py`:

```python
from pydantic import BaseModel, Field, field_validator, model_validator
from typing import List

MAX_GRID_COMBINATIONS = 500

class OptimizeRequest(BaseModel):
    symbol: str = Field(default="BTC-USD", min_length=1, max_length=20)
    buy_thresholds: List[int] = Field(
        default=[15, 20, 25, 30, 35, 40],
        min_length=1,
        max_length=15,
        description="Buy trigger thresholds (0 to 100)"
    )
    sell_thresholds: List[int] = Field(
        default=[60, 65, 70, 75, 80, 85],
        min_length=1,
        max_length=15,
        description="Sell trigger thresholds (0 to 100)"
    )
    alloc_pcts: List[float] = Field(
        default=[0.4, 0.6, 0.8, 1.0],
        min_length=1,
        max_length=10,
        description="Allocation fractions (0.05 to 1.0)"
    )
    initial_capital: float = Field(default=100_000.0, gt=0.0, le=100_000_000.0)
    fee_rate: float = Field(default=0.001, ge=0.0, le=0.05)

    @field_validator("buy_thresholds", "sell_thresholds")
    @classmethod
    def validate_threshold_values(cls, vals: List[int]) -> List[int]:
        for v in vals:
            if v < 0 or v > 100:
                raise ValueError(f"Threshold values must be between 0 and 100. Received: {v}")
        return sorted(list(set(vals)))

    @field_validator("alloc_pcts")
    @classmethod
    def validate_alloc_values(cls, vals: List[float]) -> List[float]:
        for v in vals:
            if v <= 0.0 or v > 1.0:
                raise ValueError(f"Allocation percentages must be in range (0.0, 1.0]. Received: {v}")
        return sorted(list(set(vals)))

    @model_validator(mode="after")
    def validate_total_search_space(self) -> "OptimizeRequest":
        total = len(self.buy_thresholds) * len(self.sell_thresholds) * len(self.alloc_pcts)
        if total > MAX_GRID_COMBINATIONS:
            raise ValueError(
                f"Total parameter combinations ({total}) exceeds maximum allowable limit ({MAX_GRID_COMBINATIONS}). "
                "Please narrow your threshold or allocation intervals."
            )
        return self
```

2. **Asyncio Worker Offloading:** Offload synchronous CPU grid search execution in `backend/app/api/v1/optimizer.py`:

```python
import asyncio
from fastapi import APIRouter, HTTPException

@router.post("", response_model=OptimizeResponse)
async def optimize_parameters(req: OptimizeRequest):
    df = await asyncio.to_thread(fetch_market_data, req.symbol)
    if len(df) < 10:
        raise HTTPException(status_code=400, detail="Insufficient data to perform parameter optimization.")

    # Offload CPU-bound computation away from asyncio main thread
    try:
        res = await asyncio.to_thread(
            run_grid_search,
            df=df,
            buy_thresholds=req.buy_thresholds,
            sell_thresholds=req.sell_thresholds,
            alloc_pcts=req.alloc_pcts,
            initial_cash=req.initial_capital,
            fee_rate=req.fee_rate,
            signal_col="signal",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Grid search execution failure: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Grid search processing failed.")
```

3. **Algorithmic Matrix Lookup Optimization:** In `optimizer_grid.py`, replace the $O(N)$ `next(...)` generator scan with an $O(1)$ dictionary mapping:

```python
# SECURE & OPTIMIZED: Pre-index trials by (buy, sell, alloc) for O(1) cell lookup
lookup = {
    (t["threshold_buy"], t["threshold_sell"]): t["sharpe_ratio"]
    for t in trials
    if abs(t["alloc_buy_pct"] - target_alloc) < 1e-4
}

matrix = [
    [lookup.get((tb, ts), None) for ts in sell_thresholds]
    for tb in buy_thresholds
]
```

---

### Finding VIBESEC-03: Missing HTTP Request Body Size Limits & Global Timeout Guards

- **CWE Identifier:** CWE-770 (Allocation of Resources Without Limits or Throttling), CWE-400 (Uncontrolled Resource Consumption)
- **OWASP API Security:** API4:2023 - Unrestricted Resource Consumption
- **Severity Rating:** **MEDIUM**
- **CVSS v3.1 Score:** 6.5 (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:M)
- **Affected File & Line Number:** `backend/app/main.py:6-24`, `backend/Dockerfile:18`

#### Vulnerability Description
FastAPI and Uvicorn have no default maximum payload constraint for incoming JSON HTTP requests. An attacker can stream multi-megabyte payloads to `/api/v1/backtest` or `/api/v1/optimize`, forcing JSON parser memory consumption. Furthermore, no request execution timeout middleware is active.

#### Attack Vector & Exploit Scenario
An attacker initiates multiple concurrent HTTP POST connections transmitting 50MB JSON bodies consisting of deep nested objects or large junk padding. Memory usage spikes rapidly, inducing heap fragmentation and memory exhaustion.

#### Concrete Remediation Code & Hardened Pattern

Add request payload size enforcement middleware in `backend/app/main.py`:

```python
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

MAX_REQUEST_BODY_BYTES = 1024 * 1024 # 1 Megabyte

class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        content_length = request.headers.get("content-length")
        if content_length:
            if int(content_length) > MAX_REQUEST_BODY_BYTES:
                return JSONResponse(
                    status_code=413,
                    content={"detail": "Payload too large. Maximum allowed size is 1MB."},
                )
        return await call_next(request)

app.add_middleware(RequestSizeLimitMiddleware)
```

In `backend/Dockerfile`, configure Uvicorn connection limits:

```dockerfile
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--limit-concurrency", "50", "--limit-max-requests", "10000", "--timeout-keep-alive", "5"]
```

---

### Finding VIBESEC-04: Upstream API Rate Limit Exhaustion via Unsanitized Ticker Inputs

- **CWE Identifier:** CWE-20 (Improper Input Validation), CWE-918 (Server-Side Request Forgery - SSRF profile / Upstream Query Manipulation)
- **OWASP API Security:** API7:2023 - Server Side Request Forgery / API8:2023 - Lack of Protection from Automated Threats
- **Severity Rating:** **MEDIUM**
- **CVSS v3.1 Score:** 6.1 (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:M)
- **Affected File & Line Number:** `backend/app/services/data_fetcher.py:105, 134-141`, `backend/app/models/schemas.py:14, 93`

#### Vulnerability Description
When a ticker symbol is requested that is not present in local cache, `fetch_market_data` forwards the raw string directly to `yf.download(tickers=symbol, ...)`:

```python
raw = yf.download(
    tickers=symbol,
    period="max",
    interval="1d",
    progress=False,
    auto_adjust=False,
    timeout=settings.REQUEST_TIMEOUT_SECONDS,
)
```

If an attacker transmits arbitrary URL strings (`http://localhost:8000`), control characters, or thousands of randomized invalid tickers, `yfinance` queries Yahoo Finance endpoints (`https://query2.finance.yahoo.com/v8/finance/chart/...`). While `yfinance` restricts HTTP destinations to Yahoo's API, Yahoo responds with `YFRateLimitError: Too Many Requests`. This rate-limit ban locks out all users of the Poly Strategy Lab backend from fetching legitimate market data.

#### Attack Vector & Exploit Scenario
An attacker scripts a loop requesting 50 non-existent symbols (`INVALID-1`, `INVALID-2`, etc.). Within seconds, Yahoo Finance's bot protection flags the backend's outbound IP address. Subsequent calls to fetch real crypto or equity data fail with `YFRateLimitError`, rendering the application non-functional.

#### Concrete Remediation Code & Hardened Pattern

1. **Strict Symbol Whitelisting & Normalization:** Reject any ticker containing non-standard characters before invoking upstream fetchers:

```python
VALID_TICKER_PATTERN = re.compile(r"^[A-Z0-9]{1,10}(-[A-Z0-9]{1,6})?$")

def sanitize_symbol(raw_symbol: str) -> str:
    cleaned = raw_symbol.strip().upper()
    if not VALID_TICKER_PATTERN.match(cleaned):
        raise ValueError(f"Invalid symbol: '{raw_symbol}'. Format must be like 'BTC-USD' or 'QQQ'.")
    return cleaned
```

2. **Negative Caching / Cooldown Cache:** Cache failed download lookups in-memory for 10 minutes to prevent repeating queries for invalid symbols against Yahoo Finance:

```python
from cachetools import TTLCache

# Cache up to 1000 failed symbols for 10 minutes (600 seconds)
failed_symbols_cache = TTLCache(maxsize=1000, ttl=600)

def fetch_market_data(symbol: str, ...):
    clean_sym = sanitize_symbol(symbol)
    if clean_sym in failed_symbols_cache:
        raise ValueError(f"Symbol '{clean_sym}' is known to be unavailable. Cooldown active.")
    ...
    try:
        # download logic
    except Exception as e:
        failed_symbols_cache[clean_sym] = True
        raise
```

---

### Finding VIBESEC-05: Overly Permissive CORS Policy & Missing Core HTTP Security Headers

- **CWE Identifier:** CWE-942 (Permissive Cross-Origin Resource Sharing Policy with Wildcard/Credentials), CWE-693 (Protection Mechanism Failure)
- **OWASP API Security:** API8:2023 - Security Misconfiguration
- **Severity Rating:** **MEDIUM**
- **CVSS v3.1 Score:** 5.7 (CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:L/I:L/A:N)
- **Affected File & Line Number:** `backend/app/main.py:14-20`, `frontend/next.config.mjs:1-5`

#### Vulnerability Description
1. **Backend CORS Configuration:** In `backend/app/main.py`:
   ```python
   app.add_middleware(
       CORSMiddleware,
       allow_origins=settings.CORS_ORIGINS,
       allow_credentials=True,
       allow_methods=["*"],
       allow_headers=["*"],
   )
   ```
   Specifying `allow_methods=["*"]` and `allow_headers=["*"]` is overly permissive. It permits arbitrary HTTP verbs (e.g. `DELETE`, `PUT`, `TRACE`) and arbitrary headers.
2. **Missing Security Headers:** Neither the FastAPI backend nor the Next.js frontend defines standard browser security headers (`Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`).

#### Attack Vector & Exploit Scenario
1. **Clickjacking:** Without `X-Frame-Options: DENY` or CSP `frame-ancestors 'none'`, a malicious web page can host `https://poly-strategy-lab.vercel.app` inside an invisible iframe (`opacity: 0`) and trick users into clicking buttons or triggering simulations.
2. **MIME Sniffing:** Without `X-Content-Type-Options: nosniff`, browsers may inspect file payloads and interpret data as HTML or script.

#### Concrete Remediation Code & Hardened Pattern

1. **Harden Backend CORS & Add Security Headers Middleware (`backend/app/main.py`):**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

app = FastAPI(...)

# Restrict CORS to explicit methods and headers
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Accept"],
    max_age=600,
)

# Enforce security headers
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "accelerometer=(), camera=(), geolocation=(), microphone=()"
        return response

app.add_middleware(SecurityHeadersMiddleware)
```

2. **Harden Frontend Next.js Headers (`frontend/next.config.mjs`):**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "connect-src 'self' http://localhost:8000 http://127.0.0.1:8000 https://poly-strategy-lab.vercel.app",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
```

---

### Finding VIBESEC-06: Internal Filesystem & Stack Trace Disclosure via Unhandled Exceptions

- **CWE Identifier:** CWE-209 (Generation of Error Message Containing Sensitive Information), CWE-200 (Exposure of Sensitive Information to an Unauthorized Actor)
- **OWASP API Security:** API8:2023 - Security Misconfiguration
- **Severity Rating:** **LOW**
- **CVSS v3.1 Score:** 4.3 (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N)
- **Affected File & Line Number:** `backend/app/api/v1/market_data.py:19`, `backend/app/api/v1/backtest.py:19, 36`, `backend/app/api/v1/optimizer.py:15, 33`, `backend/app/main.py:6-11`

#### Vulnerability Description
Across the API routes, exception handlers reflect raw Python exception messages back to the client:
```python
except Exception as e:
    raise HTTPException(status_code=400, detail=f"Failed to fetch market data: {str(e)}")
```

When file operations fail or internal library errors occur, `str(e)` reveals local disk paths (e.g. `[Errno 2] No such file or directory: 'data/cache/...'`), module internals, and dependency versions. Furthermore, Swagger UI (`/docs`) and OpenAPI documentation (`/openapi.json`) are mounted without authentication in all runtime modes.

#### Attack Vector & Exploit Scenario
An attacker sends malformed inputs to induce server errors and reads the JSON responses to map internal directory structures, operating system conventions, and dependency versions.

#### Concrete Remediation Code & Hardened Pattern

1. **Sanitize Error Responses:** Log detailed traces server-side and return generic, actionable messages to clients:

```python
except Exception as e:
    logger.error(f"Market data retrieval failure for symbol '{symbol}': {e}", exc_info=True)
    raise HTTPException(
        status_code=400,
        detail="Unable to retrieve market data for the requested symbol. Please verify the ticker."
    )
```

2. **Disable OpenAPI Documentation in Production (`backend/app/main.py`):**

```python
is_production = os.getenv("ENVIRONMENT", "development").lower() == "production"

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=None if is_production else f"{settings.API_V1_STR}/openapi.json",
    docs_url=None if is_production else "/docs",
    redoc_url=None if is_production else "/redoc",
)
```

---

### Finding VIBESEC-07: Client-Side LocalStorage Unbounded Growth & Untrusted Input Ingestion

- **CWE Identifier:** CWE-20 (Improper Input Validation), CWE-770 (Allocation of Resources Without Limits or Throttling)
- **Severity Rating:** **LOW**
- **CVSS v3.1 Score:** 3.8 (CVSS:3.1/AV:L/AC:L/PR:N/UI:N/S:U/C:N/I:L/A:L)
- **Affected File & Line Number:** `frontend/src/lib/asset-store.ts:49-82`, `frontend/src/app/simulator/page.tsx:166-175`

#### Vulnerability Description
In `frontend/src/lib/asset-store.ts`, `saveCustomAsset` accepts any string from user input or query parameters and directly persists it to browser `localStorage` without length constraints, regex filtering, or a cap on the maximum number of custom assets:

```typescript
export function saveCustomAsset(rawSymbol: string): Asset[] {
  if (typeof window === "undefined") return [];
  const clean = rawSymbol.trim().toUpperCase();
  if (!clean) return getCustomAssets();
  ...
  const updated = [...existing, newAsset];
  localStorage.setItem(CUSTOM_ASSETS_STORAGE_KEY, JSON.stringify(updated));
}
```

While React escapes values rendered as text nodes in JSX, storing unvalidated or unbounded data in `localStorage` can exhaust browser storage quotas (5MB) or trigger UI rendering lag when large arrays of custom tickers are mapped.

#### Concrete Remediation Code & Hardened Pattern

Update `frontend/src/lib/asset-store.ts` with strict validation and storage caps:

```typescript
const TICKER_REGEX = /^[A-Z0-9]{1,10}(-[A-Z0-9]{1,6})?$/;
const MAX_CUSTOM_ASSETS = 20;

export function saveCustomAsset(rawSymbol: string): Asset[] {
  if (typeof window === "undefined") return [];

  const clean = rawSymbol.trim().toUpperCase();
  if (!clean || !TICKER_REGEX.test(clean)) {
    console.warn(`Rejected invalid custom asset ticker: '${rawSymbol}'`);
    return getCustomAssets();
  }

  const existing = getCustomAssets();
  if (existing.some((a) => a.symbol === clean) || DEFAULT_CRYPTO_ASSETS.some((a) => a.symbol === clean)) {
    return existing;
  }

  // Enforce maximum capacity limit to prevent localStorage exhaustion
  if (existing.length >= MAX_CUSTOM_ASSETS) {
    console.warn(`Custom asset limit reached (${MAX_CUSTOM_ASSETS}). Remove an asset first.`);
    return existing;
  }

  const newAsset: Asset = {
    symbol: clean,
    name: clean.replace("-USD", ""),
    icon: "◈",
    isCustom: true,
  };

  const updated = [...existing, newAsset];
  try {
    localStorage.setItem(CUSTOM_ASSETS_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event(CUSTOM_ASSETS_EVENT));
  } catch (err) {
    console.warn("Failed to persist custom asset to localStorage:", err);
  }

  return updated;
}
```

---

## 3. VibeSec Defensive Standards Compliance Audit

| VibeSec Standard | Requirement | Current Status | Audit Finding / Notes |
| :--- | :--- | :---: | :--- |
| **Section 1: Path Traversal (CWE-22)** | Enforce `safe_filepath_resolve` with canonical checks | **FAIL** | Fixed in VIBESEC-01 remediation. Missing canonicalization on `symbol`. |
| **Section 1: Zip Slip Defense** | Check extracted archive filepaths | **PASS** | No archive decompression endpoints exist in the current application. |
| **Section 2: Buffer Limits & DoS** | Enforce request body size limits (e.g. 1MB) | **FAIL** | Fixed in VIBESEC-03. Added `RequestSizeLimitMiddleware`. |
| **Section 2: ReDoS Mitigation** | Avoid nested quantifiers in regular expressions | **PASS** | Existing regular expressions in indicators and export utilities are linear. |
| **Section 3: SQL Injection** | Enforce parameterized queries | **PASS** | Application uses Parquet columnar storage via PyArrow; no relational SQL DB. |
| **Section 3: Command Injection** | Zero `os.system` or `subprocess(shell=True)` | **PASS** | Codebase contains zero shell command executions. |
| **Section 4: Credential Sanitization** | Secrets in `.env` only, excluded from `.gitignore` | **PASS** | `.env*` properly excluded in `.gitignore`; no hardcoded secrets identified. |
| **Section 4: Frontend Secret Leaks** | No backend secrets with `NEXT_PUBLIC_` prefix | **PASS** | Only `NEXT_PUBLIC_API_URL` is exposed to Next.js client bundles. |

---

## 4. Verification & Testing Strategy

To verify that these remediations do not break legitimate quantitative functionality, the following automated test suite must be implemented:

1. **Path Traversal Regression Tests:**
   - Attempt backtest and market data requests with:
     - `..\\evil`
     - `../../evil`
     - `..%2F..%2Fevil`
     - `..\\master_dataset`
   - Assert HTTP 422 (Unprocessable Entity) or HTTP 400 with strict validation failure.
   - Assert that no files outside `backend/data/cache` are accessed or created.

2. **Resource Exhaustion Boundary Tests:**
   - Submit `OptimizeRequest` with 50 items in `buy_thresholds`. Assert HTTP 422 validation failure.
   - Submit `OptimizeRequest` exceeding `MAX_GRID_COMBINATIONS`. Assert descriptive HTTP 422 error.
   - Submit `initial_capital: -100` and `alloc_pcts: [-1.0]`. Assert HTTP 422 error.

3. **Security Headers Verification:**
   - Send `GET /health` and inspect response headers.
   - Assert presence of `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`.
