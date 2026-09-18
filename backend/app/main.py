from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1.router import api_v1_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Multi-asset quantitative backtest engine and parameter optimization laboratory.",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
)

# 1. Payload Size Limit Middleware (1MB cap against DoS memory exhaustion - CWE-770)
MAX_BODY_SIZE = 1_048_576  # 1 MB

@app.middleware("http")
async def limit_body_size(request: Request, call_next):
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_BODY_SIZE:
        return JSONResponse(
            status_code=413,
            content={"detail": "Payload too large. Maximum request body size is 1MB."},
        )
    return await call_next(request)

# 2. HTTP Security Headers Middleware (CWE-693)
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response

# 3. Tightened CORS Configuration (CWE-942)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# Mount API routes
app.include_router(api_v1_router, prefix=settings.API_V1_STR)


@app.get("/health", tags=["Health"])
async def health_check():
    """Liveness probe."""
    return {"status": "ok", "version": settings.VERSION}
