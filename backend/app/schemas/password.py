"""
Password Schemas
Request/response schemas for VM password operations.
"""

from pydantic import BaseModel, Field, field_validator
from typing import List
from datetime import datetime


# ===========================================
# REQUEST SCHEMAS
# ===========================================

class VMPasswordResetRequest(BaseModel):
    """Schema for resetting password on a VM."""
    vm_id: str = Field(..., description="ID of the target VM")
    old_password: str = Field(..., min_length=1, max_length=128, description="Current VM password")
    new_password: str = Field(..., min_length=8, max_length=128, description="New VM password")
    confirm_password: str = Field(..., min_length=8, max_length=128, description="Confirm new password")

    @field_validator('confirm_password')
    @classmethod
    def passwords_match(cls, v, info):
        if 'new_password' in info.data and v != info.data['new_password']:
            raise ValueError('Passwords do not match')
        return v


# ===========================================
# RESPONSE SCHEMAS
# ===========================================

class VMPasswordResetResponse(BaseModel):
    """Response after successful VM password reset."""
    message: str
    vm_name: str
    local_username: str


class PasswordHistoryItem(BaseModel):
    """Single password history entry."""
    changed_at: datetime
    changed_by: str  # Full name of user who changed it


class PasswordHistoryResponse(BaseModel):
    """Password change history for a VM user."""
    vm_id: str
    vm_name: str
    local_username: str
    history: List[PasswordHistoryItem]
    total: int