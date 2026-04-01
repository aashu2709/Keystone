"""
User-VM Mapping Schemas
Request/response schemas for user-VM mappings.
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


# ===========================================
# REQUEST SCHEMAS
# ===========================================

class MappingCreateRequest(BaseModel):
    """Schema for creating a user-VM mapping (admin only)."""
    user_id: str = Field(..., description="Portal user ID")
    vm_id: str = Field(..., description="VM ID")
    local_username: str = Field(..., min_length=1, max_length=100, description="Windows username on the VM")
    can_reset_password: bool = Field(True, description="Can user reset password on this VM?")
    can_view_history: bool = Field(False, description="Can user view password history?")
    notes: Optional[str] = Field(None, max_length=500)


class MappingUpdateRequest(BaseModel):
    """Schema for updating a mapping."""
    local_username: Optional[str] = Field(None, min_length=1, max_length=100)
    can_reset_password: Optional[bool] = None
    can_view_history: Optional[bool] = None
    notes: Optional[str] = Field(None, max_length=500)


# ===========================================
# RESPONSE SCHEMAS
# ===========================================

class MappingResponse(BaseModel):
    """Schema for mapping data in responses."""
    id: str
    user_id: str
    user_username: str  # Portal username
    user_full_name: str
    vm_id: str
    vm_name: str
    vm_ip_address: str
    local_username: str  # Windows username on VM
    can_reset_password: bool = True
    can_view_history: bool = False
    notes: Optional[str] = None
    created_at: datetime
    created_by: Optional[str] = None  # Admin who created this mapping


class MappingListResponse(BaseModel):
    """Schema for list of mappings."""
    mappings: List[MappingResponse]
    total: int