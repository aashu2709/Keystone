"""
VM Schemas
Request/response schemas for VM management.
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime
import re


# ===========================================
# REQUEST SCHEMAS
# ===========================================

class VMCreateRequest(BaseModel):
    """Schema for creating a new VM (admin only)."""
    name: str = Field(..., min_length=1, max_length=100, description="VM display name")
    ip_address: str = Field(..., description="IP address of the VM")
    description: Optional[str] = Field(None, max_length=500)
    os_version: Optional[str] = Field("Windows Server 2022", max_length=100)
    winrm_port: int = Field(5985, ge=1, le=65535)
    admin_username: str = Field(..., min_length=1, max_length=100, description="VM admin account")
    admin_password: str = Field(..., min_length=1, max_length=128, description="VM admin password")

    @field_validator('ip_address')
    @classmethod
    def validate_ip(cls, v):
        """Validate IP address format."""
        ip_pattern = r'^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$'
        if not re.match(ip_pattern, v):
            raise ValueError('Invalid IP address format')
        return v


class VMUpdateRequest(BaseModel):
    """Schema for updating a VM."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    os_version: Optional[str] = Field(None, max_length=100)
    winrm_port: Optional[int] = Field(None, ge=1, le=65535)
    admin_username: Optional[str] = Field(None, min_length=1, max_length=100)
    admin_password: Optional[str] = Field(None, min_length=1, max_length=128)
    is_active: Optional[bool] = None


# ===========================================
# RESPONSE SCHEMAS
# ===========================================

class VMResponse(BaseModel):
    """Schema for VM data in responses (admin view)."""
    id: str
    name: str
    ip_address: str
    description: Optional[str]
    os_version: Optional[str]
    winrm_port: int
    admin_username: str
    # Note: admin_password is NEVER returned in API responses
    is_active: bool
    health_status: str
    last_health_check: Optional[datetime]
    days_until_expiry: Optional[int] = None
    created_at: datetime
    updated_at: datetime


class VMListResponse(BaseModel):
    """Schema for list of VMs."""
    vms: List[VMResponse]
    total: int


class VMUserViewResponse(BaseModel):
    """Schema for VM data visible to regular users."""
    id: str
    name: str
    ip_address: str
    description: Optional[str]
    health_status: str
    local_username: str  # User's account on this VM
    days_until_expiry: Optional[int] = None
    can_reset_password: bool
    last_health_check: Optional[datetime]


class VMUserListResponse(BaseModel):
    """Schema for list of VMs for regular users."""
    vms: List[VMUserViewResponse]
    total: int