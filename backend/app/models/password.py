"""
Password Models
Database models for password history and audit logging.

These models define:
- PasswordHistory - Stores hashed passwords to prevent reuse
- AuditLog - Tracks every action in the system
"""

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
from enum import Enum


# ===========================================
# ENUMS (Predefined Values)
# ===========================================

class AuditAction(str, Enum):
    """
    Types of actions that can be audited.
    Using Enum ensures only valid actions are logged.
    """
    # Authentication actions
    USER_LOGIN = "user_login"
    USER_LOGOUT = "user_logout"
    USER_SIGNUP = "user_signup"
    LOGIN_FAILED = "login_failed"

    # Password actions
    PASSWORD_RESET = "password_reset"
    PASSWORD_RESET_FAILED = "password_reset_failed"

    # VM actions
    VM_CREATED = "vm_created"
    VM_UPDATED = "vm_updated"
    VM_DELETED = "vm_deleted"

    # Mapping actions
    MAPPING_CREATED = "mapping_created"
    MAPPING_DELETED = "mapping_deleted"

    # Admin actions
    USER_ROLE_CHANGED = "user_role_changed"
    USER_DEACTIVATED = "user_deactivated"


class ResourceType(str, Enum):
    """Types of resources that can be acted upon."""
    USER = "user"
    VM = "vm"
    VM_USER = "vm_user"  # Local user on a VM
    MAPPING = "mapping"
    SYSTEM = "system"


# ===========================================
# PASSWORD HISTORY MODEL
# ===========================================

class PasswordHistoryModel(BaseModel):
    """
    Stores password hashes to prevent reuse.

    IMPORTANT: We NEVER store plaintext passwords!
    Only bcrypt hashes are stored for comparison.

    Fields:
    - id: Unique identifier (UUID)
    - vm_id: Which VM this password is for
    - local_username: Username on the VM (e.g., "jdoe")
    - password_hash: Bcrypt hash of the password
    - created_at: When the password was set
    - created_by_user_id: Portal user who changed it
    """
    id: str = Field(..., description="Unique identifier (UUID)")
    vm_id: str = Field(..., description="VM ID")
    local_username: str = Field(..., description="Local username on the VM")
    password_hash: str = Field(..., description="Bcrypt hashed password")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    created_by_user_id: str = Field(..., description="Portal user who made the change")

    class Config:
        json_schema_extra = {
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "vm_id": "vm-uuid-here",
                "local_username": "jdoe",
                "password_hash": "$2b$12$...",
                "created_at": "2025-01-15T14:30:00Z",
                "created_by_user_id": "user-uuid-here"
            }
        }


# ===========================================
# AUDIT LOG MODEL
# ===========================================

class AuditLogModel(BaseModel):
    """
    Tracks every action in the system for security and compliance.

    This is crucial for:
    - Security auditing (who did what)
    - Troubleshooting (what happened and when)
    - Compliance (prove actions were authorized)

    Fields:
    - id: Unique identifier
    - user_id: Who performed the action
    - action: What action was performed (from AuditAction enum)
    - resource_type: What type of resource was affected
    - resource_id: ID of the affected resource
    - details: Additional context (success, error message, etc.)
    - ip_address: Client's IP address
    - user_agent: Client's browser/app info
    - timestamp: When the action occurred
    """
    id: str = Field(..., description="Unique identifier (UUID)")
    user_id: Optional[str] = Field(None, description="User who performed action (null for failed logins)")
    username: Optional[str] = Field(None, description="Username (for display purposes)")
    action: str = Field(..., description="Action type")
    resource_type: str = Field(..., description="Type of resource affected")
    resource_id: Optional[str] = Field(None, description="ID of affected resource")
    details: Dict[str, Any] = Field(default_factory=dict, description="Additional details")
    ip_address: Optional[str] = Field(None, description="Client IP address")
    user_agent: Optional[str] = Field(None, description="Client user agent")
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_schema_extra = {
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "user_id": "user-uuid",
                "username": "john.doe",
                "action": "password_reset",
                "resource_type": "vm_user",
                "resource_id": "vm-uuid",
                "details": {
                    "vm_ip": "192.168.91.129",
                    "local_username": "jdoe",
                    "success": True,
                    "error_message": None
                },
                "ip_address": "10.0.0.15",
                "user_agent": "Mozilla/5.0...",
                "timestamp": "2025-01-15T14:30:00Z"
            }
        }


# ===========================================
# HELPER FUNCTIONS
# ===========================================

def create_password_history_dict(
    vm_id: str,
    local_username: str,
    password_hash: str,
    created_by_user_id: str,
    id: str
) -> dict:
    """
    Create a dictionary for inserting into MongoDB.

    Args:
        vm_id: The VM's unique ID
        local_username: Username on the VM
        password_hash: Bcrypt hashed password
        created_by_user_id: Portal user who made the change
        id: Pre-generated UUID

    Returns:
        Dictionary ready for MongoDB insertion
    """
    return {
        "id": id,
        "vm_id": vm_id,
        "local_username": local_username,
        "password_hash": password_hash,
        "created_at": datetime.now(),
        "created_by_user_id": created_by_user_id
    }


def create_audit_log_dict(
    id: str,
    user_id: Optional[str],
    username: Optional[str],
    action: str,
    resource_type: str,
    resource_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None
) -> dict:
    """
    Create a dictionary for inserting audit log into MongoDB.

    Args:
        id: Pre-generated UUID
        user_id: User who performed the action
        username: Username for display
        action: Action type (e.g., "password_reset")
        resource_type: Type of resource affected
        resource_id: ID of affected resource
        details: Additional context
        ip_address: Client's IP
        user_agent: Client's browser info

    Returns:
        Dictionary ready for MongoDB insertion
    """
    return {
        "id": id,
        "user_id": user_id,
        "username": username,
        "action": action,
        "resource_type": resource_type,
        "resource_id": resource_id,
        "details": details or {},
        "ip_address": ip_address,
        "user_agent": user_agent,
        "timestamp": datetime.now()
    }