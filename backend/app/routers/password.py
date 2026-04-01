"""
Password Router
API endpoints for password operations.
Now with rate limiting protection!

Endpoints:
- POST /api/password/reset - Reset password on a VM (Rate Limited: 5/minute)
- GET /api/password/history/{vm_id} - Get password change history
- GET /api/password/audit - Get user's audit logs
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from typing import Optional

from app.schemas.password import (
    VMPasswordResetRequest,
    VMPasswordResetResponse,
    PasswordHistoryResponse,
    PasswordHistoryItem
)
from app.services.password_service import (
    reset_vm_password,
    get_password_history,
    get_user_audit_logs,
    get_all_audit_logs
)
from app.middleware.auth import get_current_user
from app.database import get_vms_collection, get_mappings_collection
from app.utils.rate_limiter import limiter
from app.config import settings


# Create the router
router = APIRouter(
    prefix="/password",
    tags=["Password Management"]
)


# ===========================================
# HELPER FUNCTIONS
# ===========================================

def get_client_ip(request: Request) -> Optional[str]:
    """Extract client IP from request."""
    # Check for forwarded IP (behind proxy)
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()

    # Check for X-Real-IP
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip

    # Direct connection
    if request.client:
        return request.client.host

    return None


def get_user_agent(request: Request) -> Optional[str]:
    """Extract user agent from request."""
    return request.headers.get("User-Agent")


def get_user_id_from_token(current_user: dict) -> str:
    """Extract user ID from JWT token payload."""
    return current_user.get("sub")


def get_username_from_token(current_user: dict) -> str:
    """Extract username from JWT token payload."""
    return current_user.get("username", "unknown")


# ===========================================
# PASSWORD RESET ENDPOINT (Rate Limited: 5/minute)
# ===========================================

@router.post(
    "/reset",
    response_model=VMPasswordResetResponse,
    summary="Reset VM Password",
    description="""
    Reset a user's password on a Windows VM.

    **Rate Limit:** 5 attempts per minute per IP address
    """
)
@limiter.limit(settings.RATE_LIMIT_PASSWORD_RESET)
async def reset_password(
    request: Request,
    password_data: VMPasswordResetRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Reset a user's password on a Windows VM.
    Rate Limited: 5 attempts per minute.
    """

    # Extract user info from JWT token
    user_id = get_user_id_from_token(current_user)
    user_username = get_username_from_token(current_user)

    # Validate we have user_id
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token: missing user ID"
        )

    # Get client info for audit logging
    client_ip = get_client_ip(request)
    user_agent = get_user_agent(request)

    print(f"🔐 Password reset request from {user_username} (IP: {client_ip})")

    # Call the service function
    result = await reset_vm_password(
        user_id=user_id,
        user_username=user_username,
        vm_id=password_data.vm_id,
        old_password=password_data.old_password,
        new_password=password_data.new_password,
        ip_address=client_ip,
        user_agent=user_agent
    )

    # Handle result
    if result["success"]:
        return VMPasswordResetResponse(
            message=result["message"],
            vm_name=result["vm_name"],
            local_username=result["local_username"]
        )
    else:
        # Determine appropriate status code
        error_msg = result.get("error", "")
        
        if "access" in error_msg.lower() or "permission" in error_msg.lower():
            status_code = status.HTTP_403_FORBIDDEN
        elif "not found" in error_msg.lower():
            status_code = status.HTTP_404_NOT_FOUND
        else:
            status_code = status.HTTP_400_BAD_REQUEST
        
        raise HTTPException(
            status_code=status_code,
            detail=result.get("error", "Password reset failed")
        )


# ===========================================
# PASSWORD HISTORY ENDPOINT (No rate limit - authenticated)
# ===========================================

@router.get(
    "/history/{vm_id}",
    response_model=PasswordHistoryResponse,
    summary="Get Password History"
)
async def get_history(
    vm_id: str,
    local_username: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get password change history for a VM."""

    user_id = get_user_id_from_token(current_user)
    user_role = current_user.get("role", "user")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token: missing user ID"
        )

    # Get VM details first
    vms_collection = get_vms_collection()
    vm = await vms_collection.find_one({"id": vm_id})

    if not vm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="VM not found"
        )

    # Check access based on role
    mappings_collection = get_mappings_collection()

    if user_role in ["admin", "superadmin"]:
        if local_username:
            target_username = local_username
        else:
            any_mapping = await mappings_collection.find_one({"vm_id": vm_id})
            if any_mapping:
                target_username = any_mapping["local_username"]
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No mappings exist for this VM. Please specify local_username parameter."
                )
    else:
        mapping = await mappings_collection.find_one({
            "user_id": user_id,
            "vm_id": vm_id
        })
        
        if not mapping:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this VM"
            )
        
        if not mapping.get("can_view_history", True):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to view password history"
            )
        
        target_username = mapping["local_username"]

    # Get password history
    history = await get_password_history(
        vm_id=vm_id,
        local_username=target_username
    )

    history_items = [
        PasswordHistoryItem(
            changed_at=item["changed_at"],
            changed_by=item["changed_by"]
        )
        for item in history
    ]

    return PasswordHistoryResponse(
        vm_id=vm_id,
        vm_name=vm.get("name", "Unknown VM"),
        local_username=target_username,
        history=history_items,
        total=len(history_items)
    )


# ===========================================
# AUDIT LOG ENDPOINT (No rate limit - authenticated)
# ===========================================

@router.get(
    "/audit",
    summary="Get My Audit Logs"
)
async def get_my_audit_logs(
    request: Request,
    current_user: dict = Depends(get_current_user),
    limit: int = 50,
    offset: int = 0,
    action: Optional[str] = None,
    all: bool = False
):
    """Get audit logs."""

    user_id = get_user_id_from_token(current_user)
    user_role = current_user.get("role", "user")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token: missing user ID"
        )

    if all and user_role in ["admin", "superadmin"]:
        result = await get_all_audit_logs(
            limit=limit,
            offset=offset,
            action_filter=action
        )
    else:
        result = await get_user_audit_logs(
            user_id=user_id,
            limit=limit,
            offset=offset,
            action_filter=action
        )

    return result