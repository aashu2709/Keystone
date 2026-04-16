# backend/app/routers/user_management.py
"""
User Management Router
Admin-only endpoints for managing local user accounts on remote VMs.
"""

from fastapi import APIRouter, HTTPException, status, Depends, Request
from typing import Optional

from app.schemas.user_management import (
    CreateRemoteUserRequest,
    ManageRemoteUserRequest,
    UserManagementResponse,
    ListRemoteUsersResponse,
    GeneratePasswordResponse,
    BulkResetPasswordRequest,
)
from app.services.user_management_service import (
    create_remote_user,
    manage_remote_user,
    list_remote_users,
    generate_strong_password,
    bulk_reset_remote_password,
)
from app.middleware.auth import require_admin
from app.database import get_vms_collection


router = APIRouter(prefix="/admin/remote-users", tags=["Remote User Management"])


# ===========================================
# HELPER
# ===========================================

def get_client_ip(request: Request) -> str:
    """Extract client IP from request."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# ===========================================
# CREATE USER
# ===========================================

@router.post("/create", response_model=UserManagementResponse)
async def create_user_endpoint(
    request_data: CreateRemoteUserRequest,
    request: Request,
    current_user: dict = Depends(require_admin)
):
    """
    Create a local user account on one or more remote VMs.
    
    Requires admin role. Creates audit log entry for each operation.
    """
    # Validate VMs exist
    vms_collection = get_vms_collection()
    for vm_id in request_data.vm_ids:
        vm = await vms_collection.find_one({"id": vm_id})
        if not vm:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"VM with ID '{vm_id}' not found"
            )
        if not vm.get("is_active", True):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"VM '{vm.get('name', vm_id)}' is not active"
            )

    result = await create_remote_user(
        vm_ids=request_data.vm_ids,
        username=request_data.username,
        full_name=request_data.full_name,
        password=request_data.password,
        user_type=request_data.user_type,
        description=request_data.description,
        must_change_password=request_data.must_change_password,
        enable_rdp=request_data.enable_rdp,
        admin_user_id=current_user["sub"],
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("User-Agent"),
    )

    return UserManagementResponse(**result)


# ===========================================
# DISABLE USER
# ===========================================

@router.post("/disable", response_model=UserManagementResponse)
async def disable_user_endpoint(
    request_data: ManageRemoteUserRequest,
    request: Request,
    current_user: dict = Depends(require_admin)
):
    """Disable a local user account on one or more remote VMs."""
    result = await manage_remote_user(
        action="disable",
        vm_ids=request_data.vm_ids,
        username=request_data.username,
        admin_user_id=current_user["sub"],
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("User-Agent"),
    )
    return UserManagementResponse(**result)


# ===========================================
# ENABLE USER
# ===========================================

@router.post("/enable", response_model=UserManagementResponse)
async def enable_user_endpoint(
    request_data: ManageRemoteUserRequest,
    request: Request,
    current_user: dict = Depends(require_admin)
):
    """Enable a disabled local user account on one or more remote VMs."""
    result = await manage_remote_user(
        action="enable",
        vm_ids=request_data.vm_ids,
        username=request_data.username,
        admin_user_id=current_user["sub"],
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("User-Agent"),
    )
    return UserManagementResponse(**result)


# ===========================================
# UNLOCK USER
# ===========================================

@router.post("/unlock", response_model=UserManagementResponse)
async def unlock_user_endpoint(
    request_data: ManageRemoteUserRequest,
    request: Request,
    current_user: dict = Depends(require_admin)
):
    """Unlock a locked-out local user account on one or more remote VMs."""
    result = await manage_remote_user(
        action="unlock",
        vm_ids=request_data.vm_ids,
        username=request_data.username,
        admin_user_id=current_user["sub"],
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("User-Agent"),
    )
    return UserManagementResponse(**result)


# ===========================================
# DELETE USER
# ===========================================

@router.post("/delete", response_model=UserManagementResponse)
async def delete_user_endpoint(
    request_data: ManageRemoteUserRequest,
    request: Request,
    current_user: dict = Depends(require_admin)
):
    """
    Delete a local user account from one or more remote VMs.
    
    Also removes any Keystone user-VM mappings for the deleted user.
    Built-in accounts (Administrator, Guest, etc.) cannot be deleted.
    """
    result = await manage_remote_user(
        action="delete",
        vm_ids=request_data.vm_ids,
        username=request_data.username,
        admin_user_id=current_user["sub"],
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("User-Agent"),
    )
    return UserManagementResponse(**result)


# ===========================================
# LIST USERS ON A VM
# ===========================================

@router.get("/list/{vm_id}")
async def list_users_endpoint(
    vm_id: str,
    current_user: dict = Depends(require_admin)
):
    """
    List all local user accounts on a specific VM.
    
    Returns user details including: name, full_name, enabled status,
    locked_out status, description, last_logon, password_last_set.
    """
    # Validate VM exists
    vms_collection = get_vms_collection()
    vm = await vms_collection.find_one({"id": vm_id})
    if not vm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="VM not found"
        )

    result = await list_remote_users(
        vm_id=vm_id,
        admin_user_id=current_user["sub"],
    )

    if "error" in result and not result.get("users"):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=result["error"]
        )

    return result


# ===========================================
# GENERATE PASSWORD
# ===========================================

@router.get("/generate-password", response_model=GeneratePasswordResponse)
async def generate_password_endpoint(
    length: int = 16,
    current_user: dict = Depends(require_admin)
):
    """
    Generate a cryptographically strong random password.
    
    Default length: 16 characters.
    Guaranteed: 2 uppercase, 2 lowercase, 2 digits, 2 special characters.
    """
    if length < 12:
        length = 12
    if length > 64:
        length = 64

    password = generate_strong_password(length)
    return GeneratePasswordResponse(password=password)


# ===========================================
# BULK PASSWORD RESET
# ===========================================

@router.post("/bulk-password-reset", response_model=UserManagementResponse)
async def bulk_reset_password_endpoint(
    request_data: BulkResetPasswordRequest,
    request: Request,
    current_user: dict = Depends(require_admin)
):
    """
    Reset a portal user's password on all their mapped remote VMs at once.
    
    Requires admin role. Performs administrative reset using VM admin credentials.
    Creates audit log and notifications for the operation.
    """
    result = await bulk_reset_remote_password(
        target_username=request_data.username,
        new_password=request_data.new_password,
        vm_ids=request_data.vm_ids,
        admin_user_id=current_user["sub"],
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("User-Agent"),
    )

    return UserManagementResponse(**result)
