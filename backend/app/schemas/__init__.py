"""
Schemas Package
Export all schemas from one place for easy imports.
"""

# Auth schemas
from app.schemas.auth import (
    SignupRequest,
    SignupResponse,
    LoginRequest,
    LoginResponse,
    UserResponse,
    MessageResponse,
    ForgotPasswordRequest,
    ResetPasswordRequest,
)

# VM schemas
from app.schemas.vm import (
    VMCreateRequest,
    VMUpdateRequest,
    VMResponse,
    VMListResponse,
    VMUserViewResponse,
    VMUserListResponse,
)

# Mapping schemas
from app.schemas.mapping import (
    MappingCreateRequest,
    MappingUpdateRequest,
    MappingResponse,
    MappingListResponse,
)

# Password schemas
from app.schemas.password import (
    VMPasswordResetRequest,
    VMPasswordResetResponse,
    PasswordHistoryItem,
    PasswordHistoryResponse,
)

# Notification schemas
from app.schemas.notification import (
    NotificationResponse,
    NotificationListResponse,
    NotificationCountResponse,
    MarkAsReadRequest,
    MarkAllReadResponse,
)

__all__ = [
    # Auth
    "SignupRequest",
    "SignupResponse",
    "LoginRequest",
    "LoginResponse",
    "UserResponse",
    "MessageResponse",
    "ForgotPasswordRequest",
    "ResetPasswordRequest",
    # VM
    "VMCreateRequest",
    "VMUpdateRequest",
    "VMResponse",
    "VMListResponse",
    "VMUserViewResponse",
    "VMUserListResponse",
    # Mapping
    "MappingCreateRequest",
    "MappingUpdateRequest",
    "MappingResponse",
    "MappingListResponse",
    # Password
    "VMPasswordResetRequest",
    "VMPasswordResetResponse",
    "PasswordHistoryItem",
    "PasswordHistoryResponse",
    # Notification
    "NotificationResponse",
    "NotificationListResponse",
    "NotificationCountResponse",
    "MarkAsReadRequest",
    "MarkAllReadResponse",
]