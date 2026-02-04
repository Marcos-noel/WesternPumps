from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import Base, engine, ensure_schema
from app.routers import auth, categories, customers, jobs, locations, parts, reports, requests, stock, suppliers, users


def create_app() -> FastAPI:
    app = FastAPI(title="WesternPumps API")

    origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/")
    def root() -> dict[str, str]:
        return {"message": "WesternPumps API", "docs": "/docs", "health": "/health"}

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(auth.router)
    app.include_router(users.router)
    app.include_router(categories.router)
    app.include_router(locations.router)
    app.include_router(customers.router)
    app.include_router(jobs.router)
    app.include_router(parts.router)
    app.include_router(parts.api_router)
    app.include_router(suppliers.router)
    app.include_router(stock.router)
    app.include_router(requests.router)
    app.include_router(reports.router)

    @app.on_event("startup")
    def on_startup() -> None:
        if settings.auto_create_tables:
            ensure_schema(engine)

    return app


app = create_app()
