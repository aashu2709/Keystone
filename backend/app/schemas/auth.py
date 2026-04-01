"""
Authentication Schemas
Request/response schemas for auth endpoints.
"""

from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional
from datetime import datetime


# ===========================================
# REQUEST SCHEMAS
# ===========================================

class SignupRequest(BaseModel):
    """Schema for user registration."""
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    full_name: str = Field(..., min_length=2, max_length=100)
    captcha_token: str = Field(..., description="Encrypted CAPTCHA token")
    captcha_answer: str = Field(..., description="User's answer to the math CAPTCHA")

    @field_validator('username')
    @classmethod
    def username_alphanumeric(cls, v):
        import re
        if not re.match(r'^[a-zA-Z0-9._]+$', v):
            raise ValueError('Username can only contain letters, numbers, dots, and underscores')
        # Return as-is (preserve original case)
        return v


class LoginRequest(BaseModel):
    """Schema for user login."""
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)
    captcha_token: str = Field(..., description="Encrypted CAPTCHA token")
    captcha_answer: str = Field(..., description="User's answer to the math CAPTCHA")


class ForgotPasswordRequest(BaseModel):
    """Schema for forgot password request."""
    email: EmailStr
    captcha_token: str = Field(..., description="Encrypted CAPTCHA token")
    captcha_answer: str = Field(..., description="User's answer to the math CAPTCHA")


class ResetPasswordRequest(BaseModel):
    """Schema for resetting password with token."""
    token: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8, max_length=128)
    confirm_password: str = Field(..., min_length=8, max_length=128)

    @field_validator('confirm_password')
    @classmethod
    def passwords_match(cls, v, info):
        if 'new_password' in info.data and v != info.data['new_password']:
            raise ValueError('Passwords do not match')
        return v


# ===========================================
# RESPONSE SCHEMAS
# ===========================================

class UserResponse(BaseModel):
    """User data returned in API responses."""
    id: str
    username: str
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime
    last_login: Optional[datetime] = None


class LoginResponse(BaseModel):
    """Response after successful login."""
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class MessageResponse(BaseModel):
    """Simple message response."""
    message: str


class SignupResponse(BaseModel):
    """Response after successful signup."""
    message: str
    user_id: str