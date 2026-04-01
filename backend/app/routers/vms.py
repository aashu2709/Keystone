"""
VMs Router
Endpoints for regular users to view their assigned VMs.

Password reset functionality is in password.py:
- POST /password/reset
- GET /password/history/{vm_id}
- GET /password/audit
"""

from fastapi import APIRouter, HTTPException, status, Depends

from app.schemas import (
    VMUserViewResponse,
    VMUserListResponse,
)
from app.database import (
    get_vms_collection,
    get_mappings_collection,
)
from app.middleware.auth import get_current_active_user


router = APIRouter(prefix="/vms", tags=["VMs"])


# ===========================================
# HELPER FUNCTIONS
# ===========================================

async def get_user_vm_mapping(user_id: str, vm_id: str):
    """Get the mapping between a user and VM, if exists."""
    mappings_collection = get_mappings_collection()

    mapping = await mappings_collection.find_one({
        "user_id": user_id,
        "vm_id": vm_id
    })

    return mapping


# ===========================================
# GET USER'S VMs
# ===========================================

@router.get("", response_model=VMUserListResponse)
async def get_my_vms(
    current_user: dict = Depends(get_current_active_user)
):
    """
    Get all VMs assigned to the current user.

    Returns a list of VMs with:
    - VM details (name, IP, description, health status)
    - User's local username on each VM
    - Permissions (can_reset_password)
    """
    mappings_collection = get_mappings_collection()
    vms_collection = get_vms_collection()

    user_id = current_user["sub"]

    # Get all mappings for this user
    cursor = mappings_collection.find({"user_id": user_id})
    mappings = await cursor.to_list(length=100)

    # Get VM details for each mapping
    vm_list = []
    for mapping in mappings:
        vm = await vms_collection.find_one({"id": mapping["vm_id"]})
        
        if vm and vm.get("is_active", True):
            vm_list.append(VMUserViewResponse(
                id=vm["id"],
                name=vm["name"],
                ip_address=vm["ip_address"],
                description=vm.get("description"),
                health_status=vm.get("health_status", "unknown"),
                local_username=mapping["local_username"],
                can_reset_password=mapping.get("can_reset_password", True),
                last_health_check=vm.get("last_health_check"),
                days_until_expiry=mapping.get("days_until_expiry") 
            ))

    return VMUserListResponse(vms=vm_list, total=len(vm_list))


@router.get("/{vm_id}", response_model=VMUserViewResponse)
async def get_my_vm(
    vm_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """
    Get a specific VM assigned to the current user.

    Returns VM details if user has access, otherwise 403.
    """
    vms_collection = get_vms_collection()

    user_id = current_user["sub"]

    # Check if user has access to this VM
    mapping = await get_user_vm_mapping(user_id, vm_id)
    if not mapping:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this VM"
        )

    # Get VM details
    vm = await vms_collection.find_one({"id": vm_id})
    if not vm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="VM not found"
        )

    if not vm.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="VM is not active"
        )

    return VMUserViewResponse(
        id=vm["id"],
        name=vm["name"],
        ip_address=vm["ip_address"],
        description=vm.get("description"),
        health_status=vm.get("health_status", "unknown"),
        local_username=mapping["local_username"],
        can_reset_password=mapping.get("can_reset_password", True),
        last_health_check=vm.get("last_health_check")
    )