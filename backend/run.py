"""
Development Server Runner
=========================
Run this file to start the FastAPI server.

Usage: python run.py
"""

import uvicorn
from app.config import settings

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",  # Import path to FastAPI app
        host=settings.HOST,
        port=settings.PORT,
        reload=True  # Auto-reload on code changes (dev only!)
    )