from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import BASE_DIR, get_settings
from app.routers import access_control, auth, floors, health, reports, sales, stock, tables, users
from app.services.bootstrap import ensure_core_bootstrap
from app.services.reports import start_report_scheduler, stop_report_scheduler


def create_app() -> FastAPI:
    get_settings()
    uploads_dir = BASE_DIR / "uploads"
    uploads_dir.mkdir(parents=True, exist_ok=True)
    frontend_dist_dir = BASE_DIR.parent / "frontend" / "pos-frontend" / "dist"

    app = FastAPI()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(access_control.router)
    app.include_router(users.router)
    app.include_router(floors.router)
    app.include_router(tables.router)
    app.include_router(sales.router)
    app.include_router(reports.router)
    app.include_router(stock.router)
    app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

    if frontend_dist_dir.exists():
        app.mount(
            "/assets",
            StaticFiles(directory=frontend_dist_dir / "assets"),
            name="frontend-assets",
        )

        @app.get("/")
        async def serve_frontend_index():
            return FileResponse(frontend_dist_dir / "index.html")

        @app.get("/{full_path:path}")
        async def serve_frontend_app(full_path: str):
            normalized_path = (full_path or "").strip("/")

            if normalized_path.startswith("uploads/"):
                return FileResponse(uploads_dir / normalized_path.removeprefix("uploads/"))

            candidate_file = frontend_dist_dir / normalized_path

            if normalized_path and candidate_file.is_file():
                return FileResponse(candidate_file)

            return FileResponse(frontend_dist_dir / "index.html")

    @app.on_event("startup")
    def on_startup():
        ensure_core_bootstrap()
        start_report_scheduler()

    @app.on_event("shutdown")
    def on_shutdown():
        stop_report_scheduler()

    return app


app = create_app()
