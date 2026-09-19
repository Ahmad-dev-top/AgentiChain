from contextlib import asynccontextmanager
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import router
from app.core.config import settings
from app.core.errors import ApiError, api_error_handler, api_error_payload
from app.db import init_db

Path("data").mkdir(exist_ok=True)


@asynccontextmanager
async def lifespan(_: FastAPI):
    await init_db()
    yield


app = FastAPI(title=settings.app_name, version=settings.app_version, lifespan=lifespan)
wildcard_cors = settings.cors_origin_list == ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=not wildcard_cors,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_exception_handler(ApiError, api_error_handler)


@app.middleware("http")
async def correlation_middleware(request: Request, call_next):
    correlation_id = request.headers.get("x-correlation-id") or str(uuid4())
    request.state.correlation_id = correlation_id
    try:
        response = await call_next(request)
    except Exception as exc:  # pragma: no cover - last-resort envelope
        payload = api_error_payload(str(exc), "internal_error", correlation_id)
        response = JSONResponse(status_code=500, content=payload)
    response.headers["x-correlation-id"] = correlation_id
    return response


app.include_router(router, prefix=settings.api_prefix)


@app.get("/")
async def root() -> dict:
    return {
        "service": settings.app_name,
        "docs": "/docs",
        "health": "/api/health",
        "ui": "Flutter command center in apps/agentichain",
    }
