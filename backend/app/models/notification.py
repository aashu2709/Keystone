"""
Notification Models
Database models for user notifications.

Updated: Added admin notification types
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum


# ===========================================
# NOTIFICATION TYPES
# ===========================================

class NotificationType(str, Enum):
    """Types of notifications that can be sent."""

    # Password related
    PASSWORD_RESET_SUCCESS = "password_reset_success"
    PASSWORD_RESET_FAILED = "password_reset_failed"
    PASSWORD_EXPIRY_WARNING = "password_expiry_warning"

    # VM related
    VM_UNREACHABLE = "vm_unreachable"
    VM_HEALTH_RESTORED = "vm_health_restored"
    VM_STATUS_CHANGE = "vm_status_change"  # NEW: For health status changes

    # Account related
    LOGIN_FROM_NEW_DEVICE = "login_from_new_device"
    ACCOUNT_LOCKED = "account_locked"

    # System
    SYSTEM_ALERT = "system_alert"
    WELCOME = "welcome"

    # ===========================================
    # ADMIN NOTIFICATION TYPES (NEW!)
    # ===========================================
    ADMIN_PASSWORD_ALERT = "admin_password_alert"      # When any user changes password
    ADMIN_USER_SIGNUP = "admin_user_signup"            # When new user registers
    ADMIN_VM_ALERT = "admin_vm_alert"                  # General VM alerts for admins
    ADMIN_SECURITY_ALERT = "admin_security_alert"      # Security related alerts


class NotificationPriority(str, Enum):
    """Priority levels for notifications."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


# ===========================================
# NOTIFICATION MODEL
# ===========================================

class NotificationModel(BaseModel):
    """
    Notification stored in database.

    Fields:
    - id: Unique identifier (UUID)
    - user_id: Who receives this notification
    - type: Type of notification (from NotificationType enum)
    - title: Short title
    - message: Detailed message
    - priority: Urgency level
    - is_read: Whether user has seen it
    - related_vm_id: Optional - if notification is about a specific VM
    - action_url: Optional - URL to navigate when clicked
    - created_at: When notification was created
    - read_at: When user marked it as read
    """
    id: str = Field(..., description="Unique identifier (UUID)")
    user_id: str = Field(..., description="User who receives notification")
    type: str = Field(..., description="Notification type")
    title: str = Field(..., description="Short title")
    message: str = Field(..., description="Detailed message")
    priority: str = Field(default="medium", description="Priority level")
    is_read: bool = Field(default=False, description="Has user read this")
    related_vm_id: Optional[str] = Field(None, description="Related VM ID if applicable")
    action_url: Optional[str] = Field(None, description="URL to navigate to")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    read_at: Optional[datetime] = Field(None, description="When marked as read")

    class Config:
        json_schema_extra = {
            "example": {
                "id": "notif-uuid-123",
                "user_id": "user-uuid-456",
                "type": "password_reset_success",
                "title": "Password Changed",
                "message": "Your password on 'Production Server 1' was changed successfully.",
                "priority": "medium",
                "is_read": False,
                "related_vm_id": "vm-uuid-789",
                "action_url": "/dashboard/vms",
                "created_at": "2025-01-15T14:30:00Z",
                "read_at": None
            }
        }


# ===========================================
# HELPER FUNCTIONS
# ===========================================

def create_notification_dict(
    id: str,
    user_id: str,
    notification_type: str,
    title: str,
    message: str,
    priority: str = "medium",
    related_vm_id: Optional[str] = None,
    action_url: Optional[str] = None
) -> dict:
    """
    Create a notification dictionary for MongoDB insertion.
    """
    return {
        "id": id,
        "user_id": user_id,
        "type": notification_type,
        "title": title,
        "message": message,
        "priority": priority,
        "is_read": False,
        "related_vm_id": related_vm_id,
        "action_url": action_url,
        "created_at": datetime.now(),
        "read_at": None
    }