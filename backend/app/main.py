# backend/app/main.py
"""
FastAPI Application Entry Point

Fixes Applied:
  Fix 1 + 5 - Telemetry loop (run→wait→run) started here on boot.
              Fires first collection 5s after startup (not 30s).
  Fix 6      - Nightly downsampling job registered in scheduler.
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import logging

from app.config import settings
from app.database import connect_to_mongodb, close_mongodb_connection
from app.routers import auth, admin, vms, password, notifications, captcha, firewall, certificates
from app.routers import user_management as user_mgmt_router
from app.routers import services as services_router
from app.routers import vm_health as vm_health_router
from app.routers import terminal as terminal_router

# Setup logger
logger = logging.getLogger(__name__)


# ===========================================
# APPLICATION LIFESPAN
# ===========================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown events."""
    # ============ STARTUP ============
    print("🚀 Starting up...")
    
    # Connect to MongoDB
    await connect_to_mongodb()
    
    # Start APScheduler (health check, password expiry, nightly downsampling)
    try:
        from app.scheduler import start_scheduler, start_telemetry_loop
        start_scheduler()
        print("✅ Background scheduler started (health check, expiry, downsampling)")

        # Fix 1 + Fix 5: Start the loop-based telemetry collector.
        # Fires first collection 5s after startup, then waits 30s after each run.
        # This NEVER skips a cycle even if collection takes longer than 30s.
        start_telemetry_loop()
        print("✅ Telemetry collection loop started (first run in 5s)")

    except ImportError as e:
        print(f"⚠️ Scheduler module not found: {e}")
        print("   Background jobs will not run.")
    except Exception as e:
        print(f"❌ Failed to start scheduler: {e}")
        logger.error(f"Scheduler startup failed: {e}", exc_info=True)
    
    yield
    
    # ============ SHUTDOWN ============
    print("🛑 Shutting down...")
    
    # Stop telemetry loop and APScheduler
    try:
        from app.scheduler import shutdown_scheduler, stop_telemetry_loop
        stop_telemetry_loop()     # Cancel the asyncio telemetry loop task
        shutdown_scheduler()      # Stop APScheduler gracefully
        print("✅ Background scheduler and telemetry loop stopped")
    except ImportError:
        pass
    except Exception as e:
        print(f"❌ Error stopping scheduler: {e}")
        logger.error(f"Scheduler shutdown failed: {e}", exc_info=True)
    
    # Close MongoDB connection
    await close_mongodb_connection()


# ===========================================
# CREATE THE APP
# ===========================================
app = FastAPI(
    title=settings.APP_NAME,
    description="Secure Multi-Tenant Password Management Portal",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json"
)


# ===========================================
# CORS MIDDLEWARE - MUST BE FIRST!
# ===========================================

# Parse CORS origins from settings
origins = [origin.strip() for origin in settings.CORS_ORIGINS.split(",")]

# Add common development origins
origins.extend([
    "http://localhost:5173",   # Vite default
    "http://127.0.0.1:5173",   # Vite alternative
    "http://localhost:5174",   # Vite fallback 1
    "http://127.0.0.1:5174",   # Vite fallback 1
    "http://localhost:5175",   # Vite fallback 2
    "http://127.0.0.1:5175",   # Vite fallback 2
    "http://localhost:3000",   # React default
    "http://127.0.0.1:3000",   # React alternative
])

# Remove duplicates
origins = list(set(origins))

print(f"📡 CORS Origins: {origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*", "Retry-After"],
    max_age=600,  # Cache preflight requests for 10 minutes
)


# ===========================================
# INCLUDE ROUTERS
# ===========================================
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    import json
    print(f"🚨 Validation ERROR on {request.url}")
    print(f"Errors: {json.dumps(exc.errors(), default=str)}")
    print(f"Body: {exc.body}")
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()}
    )

app.include_router(auth.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(vms.router, prefix="/api")
app.include_router(password.router, prefix="/api")
app.include_router(firewall.router, prefix="/api")
app.include_router(certificates.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(captcha.router, prefix="/api")
app.include_router(user_mgmt_router.router, prefix="/api")
app.include_router(services_router.router, prefix="/api")
app.include_router(vm_health_router.router, prefix="/api")
app.include_router(terminal_router.router, prefix="/api")


# ===========================================
# TELEMETRY LOOP STATUS ENDPOINT
# ===========================================
from fastapi import Depends as _Depends
from app.middleware.auth import require_admin as _require_admin

@app.get("/api/admin/telemetry-status")
async def telemetry_loop_status(current_user: dict = _Depends(_require_admin)):
    """
    Standalone debug endpoint — no vm_id required.
    Shows live telemetry loop health: cycle count, duration, VM errors.
    Open: http://127.0.0.1:8001/api/admin/telemetry-status
    (Must be logged in as admin — bearer token required, use /api/docs to test)
    """
    from app.services.telemetry_service import _loop_stats
    from app.database import get_database

    db = get_database()

    # Count total raw telemetry records
    total_raw = await db.telemetry.count_documents({})
    total_compressed = await db.telemetry_compressed.count_documents({})

    # Per-VM summary: how many records in last hour per VM
    from datetime import datetime, timedelta
    one_hour_ago = datetime.now() - timedelta(hours=1)
    pipeline = [
        {"$match": {"timestamp": {"$gte": one_hour_ago}}},
        {"$group": {"_id": "$vm_id", "count": {"$sum": 1}}},
        {"$sort": {"count": 1}}  # worst first
    ]
    per_vm = await db.telemetry.aggregate(pipeline).to_list(length=None)

    return {
        "loop": {**_loop_stats},
        "db": {
            "total_raw_records":        total_raw,
            "total_compressed_records": total_compressed,
        },
        "per_vm_last_1h": [
            {"vm_id": r["_id"], "records": r["count"]} for r in per_vm
        ],
        "hint": "Each VM should have ~60-70 records/hour. Less = gaps in graph."
    }



# ===========================================
# HEALTH CHECK ENDPOINT
# ===========================================
@app.get("/api/health")
async def health_check():
    """Simple health check endpoint."""
    # Get scheduler status if available
    scheduler_status = "unknown"
    try:
        from app.scheduler import get_scheduler_status
        status = get_scheduler_status()
        scheduler_status = status.get("status", "unknown")
    except ImportError:
        scheduler_status = "not_installed"
    except Exception:
        scheduler_status = "error"
    
    return {
        "status": "healthy",
        "app_name": settings.APP_NAME,
        "rate_limiting": settings.RATE_LIMIT_ENABLED,
        "scheduler": scheduler_status
    }


# ===========================================
# ROOT ENDPOINT
# ===========================================
@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": f"Welcome to {settings.APP_NAME}",
        "docs": "/api/docs"
    }