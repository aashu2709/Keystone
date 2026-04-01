"""
Application Configuration
This file loads settings from environment variables.
Never hardcode secrets here!
"""

from pydantic_settings import BaseSettings
from typing import Optional
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.

    How it works:
    - Pydantic automatically reads from .env file
    - Variable names match env variable names (case-insensitive)
    """

    # Application
    APP_NAME: str = "Password Management Portal"
    DEBUG: bool = True

    # Server
    HOST: str = "127.0.0.1"
    PORT: int = 8001

    # MongoDB
    MONGODB_URL: str = "mongodb://localhost:27017"
    MONGODB_DB_NAME: str = "password_portal_db"

    # JWT Authentication
    JWT_SECRET_KEY: str  # REQUIRED - no default for security
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60  # 1 hour

    # Encryption (for VM admin passwords)
    ENCRYPTION_SECRET_KEY: str  # REQUIRED
        
    # CORS (Cross-Origin Resource Sharing)
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000"

    # reCAPTCHA v2 (Checkbox - for Signup)
    # RECAPTCHA_SITE_KEY_V2: str = "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"  # Test key
    # RECAPTCHA_SECRET_KEY_V2: str = "6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe"  # Test key

    # reCAPTCHA v3 (Invisible - for Login)
    # RECAPTCHA_SITE_KEY_V3: str = "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"  # Test key
    # RECAPTCHA_SECRET_KEY_V3: str = "6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe"  # Test key
    # RECAPTCHA_V3_SCORE_THRESHOLD: float = 0.5

    # Email Settings (SMTP)
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USERNAME: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM_EMAIL: Optional[str] = None
    SMTP_FROM_NAME: str = "Password Portal"

    # Password Reset
    RESET_TOKEN_EXPIRE_MINUTES: int = 10
    FRONTEND_URL: str = "http://localhost:5173"

    # =========================================
    # RATE LIMITING SETTINGS (NEW!)
    # =========================================
    # Format: "number/period" where period can be: second, minute, hour, day
    # Examples: "5/minute", "100/hour", "1000/day"

    RATE_LIMIT_ENABLED: bool = True  # Set to False to disable rate limiting
    RATE_LIMIT_LOGIN: str = "5/minute"  # Max login attempts per minute
    RATE_LIMIT_SIGNUP: str = "3/minute"  # Max signup attempts per minute
    RATE_LIMIT_FORGOT_PASSWORD: str = "3/minute"  # Max forgot password requests
    RATE_LIMIT_PASSWORD_RESET: str = "5/minute"  # Max VM password resets
    RATE_LIMIT_GENERAL: str = "100/minute"  # General API rate limit

    # Scheduler settings
    TIMEZONE: str = "Asia/Kolkata"  # Change to your timezone


    class Config:
        # Tell Pydantic where to find the .env file
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


# Create a single instance to use throughout the app
settings = Settings()
print(f"✅ Settings loaded: {settings.APP_NAME}")
print(f"🔒 Rate limiting: {'Enabled' if settings.RATE_LIMIT_ENABLED else 'Disabled'}")