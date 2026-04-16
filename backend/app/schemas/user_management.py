# backend/app/schemas/user_management.py
"""
Schemas for Remote User Account Management.
"""

from pydantic import BaseModel, Field, field_validator
from typing import List, Optional
import re


# ===========================================
# REQUEST SCHEMAS
# ===========================================

class CreateRemoteUserRequest(BaseModel):
    """Request to create a local user on remote VMs."""
    username: str = Field(..., min_length=1, max_length=64, description="Local username to create")
    full_name: str = Field(..., min_length=1, max_length=128, description="User's full display name")
    password: str = Field(..., min_length=8, max_length=128, description="Initial password for the user")
    description: str = Field("", max_length=256, description="Optional description for the account")
    user_type: str = Field("standard", description="'standard' or 'administrator'")
    must_change_password: bool = Field(False, description="Force password change at next logon")
    enable_rdp: bool = Field(True, description="Add user to Remote Desktop Users group")
    vm_ids: List[str] = Field(..., min_length=1, description="List of VM IDs to create user on")

    @field_validator("username")
    @classmethod
    def validate_username(cls, v):
        if not re.match(r'^[A-Za-z0-9._@\\\-]{1,64}$', v):
            raise ValueError("Username can only contain letters, numbers, dots, underscores, hyphens, @ and backslash")
        return v

    @field_validator("user_type")
    @classmethod
    def validate_user_type(cls, v):
        if v not in ("standard", "administrator"):
            raise ValueError("user_type must be 'standard' or 'administrator'")
        return v


class ManageRemoteUserRequest(BaseModel):
    """Request to disable/enable/unlock/delete a user on remote VMs."""
    username: str = Field(..., min_length=1, max_length=64, description="Username to manage")
    vm_ids: List[str] = Field(..., min_length=1, description="List of VM IDs to perform action on")

    @field_validator("username")
    @classmethod
    def validate_username(cls, v):
        if not re.match(r'^[A-Za-z0-9._@\\\-]{1,64}$', v):
            raise ValueError("Invalid username format")
        return v


class BulkResetPasswordRequest(BaseModel):
    """Request to reset a user's password on multiple remote VMs."""
    username: str = Field(..., min_length=1, max_length=64, description="Remote Username to reset")
    new_password: str = Field(..., min_length=8, max_length=128, description="New password to set")
    vm_ids: Optional[List[str]] = Field(None, description="Optional list of specific VM IDs. If None, reset on all mapped VMs.")

    @field_validator("username")
    @classmethod
    def validate_username(cls, v):
        # Allow Windows-style usernames: letters, numbers, dots, dashes, underscores, and spaces
        if not re.match(r'^[A-Za-z0-9._\s@\\\-]{1,64}$', v):
            raise ValueError("Invalid username format. Use letters, numbers, dots, dashes, underscores, or spaces.")
        return v


# ===========================================
# RESPONSE SCHEMAS
# ===========================================

class VMOperationResult(BaseModel):
    """Result of an operation on a single VM."""
    vm_id: str
    vm_name: str
    ip_address: str
    success: bool
    message: str


class UserManagementResponse(BaseModel):
    """Response for bulk user management operations."""
    action: str
    username: str
    total_vms: int
    successful: int
    failed: int
    results: List[VMOperationResult]


class RemoteUserInfo(BaseModel):
    """Information about a local user on a remote VM."""
    name: str
    full_name: Optional[str] = ""
    enabled: bool = True
    locked_out: bool = False
    description: Optional[str] = ""
    last_logon: Optional[str] = None
    password_last_set: Optional[str] = None
    account_source: Optional[str] = "Local"


class ListRemoteUsersResponse(BaseModel):
    """Response for listing users on a VM."""
    vm_id: str
    vm_name: str
    ip_address: str
    total_users: int
    users: List[RemoteUserInfo]


class GeneratePasswordResponse(BaseModel):
    """Response for password generation."""
    password: str
