# backend/app/main.py
"""
FastAPI Application Entry Point

Updated: Added scheduler startup/shutdown
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
    
    # Start background scheduler
    try:
        from app.scheduler import start_scheduler
        start_scheduler()
        print("✅ Background scheduler started")
    except ImportError as e:
        print(f"⚠️ Scheduler module not found: {e}")
        print("   Background jobs will not run.")
    except Exception as e:
        print(f"❌ Failed to start scheduler: {e}")
        logger.error(f"Scheduler startup failed: {e}", exc_info=True)
    
    yield
    
    # ============ SHUTDOWN ============
    print("🛑 Shutting down...")
    
    # Stop background scheduler
    try:
        from app.scheduler import shutdown_scheduler
        shutdown_scheduler()
        print("✅ Background scheduler stopped")
    except ImportError:
        pass  # Scheduler wasn't loaded
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
    "http://localhost:3000",   # React default
    "http://127.0.0.1:3000",   # React alternative
])

# Remove duplicates
origins = list(set(origins))

print(f"📡 CORS Origins: {origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
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