"""
Security Utilities
Password hashing, JWT tokens, and encryption functions.
"""

from datetime import datetime, timedelta
from typing import Optional
import uuid
import secrets

import bcrypt
from jose import JWTError, jwt
from cryptography.fernet import Fernet

from app.config import settings


# ===========================================
# PASSWORD HASHING (bcrypt)
# ===========================================

def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    password_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    try:
        password_bytes = plain_password.encode('utf-8')
        hashed_bytes = hashed_password.encode('utf-8')
        return bcrypt.checkpw(password_bytes, hashed_bytes)
    except Exception:
        return False


# ===========================================
# JWT TOKENS
# ===========================================

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES
        )

    to_encode.update({
        "exp": expire,
        "iat": datetime.utcnow()
    })

    encoded_jwt = jwt.encode(
        to_encode, 
        settings.JWT_SECRET_KEY, 
        algorithm=settings.JWT_ALGORITHM
    )

    return encoded_jwt


def verify_access_token(token: str) -> Optional[dict]:
    """Verify a JWT token and return its payload."""
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except JWTError:
        return None


# ===========================================
# PASSWORD RESET TOKENS
# ===========================================

def generate_reset_token() -> str:
    """Generate a secure random token for password reset."""
    return secrets.token_urlsafe(32)


def create_reset_token_data(user_id: str, token: str) -> dict:
    """Create reset token data to store in database."""
    expires_at = datetime.now() + timedelta(
        minutes=settings.RESET_TOKEN_EXPIRE_MINUTES
    )
    return {
        "user_id": user_id,
        "token": token,
        "expires_at": expires_at,
        "used": False,
        "created_at": datetime.now()
    }


# ===========================================
# ENCRYPTION (for VM admin passwords)
# ===========================================

def get_fernet() -> Fernet:
    """Get a Fernet encryption instance."""
    key = settings.ENCRYPTION_SECRET_KEY
    if isinstance(key, str):
        key = key.encode()
    return Fernet(key)


def encrypt_string(plain_text: str) -> str:
    """Encrypt a string."""
    f = get_fernet()
    encrypted_bytes = f.encrypt(plain_text.encode())
    return encrypted_bytes.decode()


def decrypt_string(encrypted_text: str) -> str:
    """Decrypt an encrypted string."""
    f = get_fernet()
    decrypted_bytes = f.decrypt(encrypted_text.encode())
    return decrypted_bytes.decode()


# ===========================================
# UUID GENERATION
# ===========================================

def generate_uuid() -> str:
    """Generate a unique ID."""
    return str(uuid.uuid4())


# ===========================================
# PASSWORD VALIDATION
# ===========================================

def validate_password_strength(password: str) -> tuple[bool, str]:
    """Validate password meets security requirements."""
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"

    if len(password) > 72:
        return False, "Password cannot exceed 72 characters"

    if not any(c.isupper() for c in password):
        return False, "Password must contain at least one uppercase letter"

    if not any(c.islower() for c in password):
        return False, "Password must contain at least one lowercase letter"

    if not any(c.isdigit() for c in password):
        return False, "Password must contain at least one digit"

    special_chars = "!@#$%^&*()_+-=[]{}|;':\",./<>?"
    if not any(c in special_chars for c in password):
        return False, "Password must contain at least one special character"

    return True, "Password is valid"