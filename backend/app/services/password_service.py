"""
Password Service
Business logic for password operations.

This service handles:
- Password validation (strength + history check)
- Password reset execution (via PowerShell)
- Password history management
- Audit logging for password operations
- Admin notifications for password changes (NEW!)
"""

import asyncio
from typing import Optional, Dict, Any, Tuple
from datetime import datetime

from app.database import (
    get_password_history_collection,
    get_audit_logs_collection,
    get_vms_collection,
    get_mappings_collection,
    get_users_collection
)
from app.utils.security import (
    hash_password,
    verify_password,
    validate_password_strength,
    generate_uuid,
    decrypt_string
)
from app.utils.powershell import execute_password_reset
from app.models.password import (
    create_password_history_dict,
    create_audit_log_dict,
    AuditAction,
    ResourceType
)
from app.services.notification_service import (
    notify_password_reset_success,
    notify_password_reset_failed,
    notify_admins_password_change  # NEW: Import admin notification function
)


# ===========================================
# PASSWORD HISTORY CONSTANTS
# ===========================================

PASSWORD_HISTORY_COUNT = 5  # Number of passwords to check for reuse


# ===========================================
# PASSWORD HISTORY FUNCTIONS
# ===========================================

async def check_password_history(
    vm_id: str,
    local_username: str,
    new_password: str
) -> Tuple[bool, str]:
    """
    Check if the new password was used recently.

    We store the last 5 password hashes and compare against them.
    This prevents users from cycling through the same passwords.

    Args:
        vm_id: The VM's unique ID
        local_username: Username on the VM
        new_password: The new password to check (plaintext)

    Returns:
        Tuple of (is_valid, message)
        - (True, "Password is valid") if not recently used
        - (False, "Cannot reuse...") if recently used
    """
    collection = get_password_history_collection()

    # Get the last N password hashes for this VM user
    cursor = collection.find(
        {"vm_id": vm_id, "local_username": local_username}
    ).sort("created_at", -1).limit(PASSWORD_HISTORY_COUNT)

    history = await cursor.to_list(length=PASSWORD_HISTORY_COUNT)

    # Check if new password matches any recent password
    for record in history:
        if verify_password(new_password, record["password_hash"]):
            return (
                False,
                "You've already used this password recently. Please choose a new one."
            )

    return (True, "Password is valid")


async def save_password_to_history(
    vm_id: str,
    local_username: str,
    new_password: str,
    user_id: str
) -> str:
    """
    Save the new password hash to history.

    This is called AFTER a successful password reset.

    Args:
        vm_id: The VM's unique ID
        local_username: Username on the VM
        new_password: The new password (will be hashed before storing)
        user_id: Portal user who made the change

    Returns:
        The ID of the created history record
    """
    collection = get_password_history_collection()

    # Hash the password before storing
    password_hash = hash_password(new_password)

    # Generate a unique ID
    record_id = generate_uuid()

    # Create the history record
    record = create_password_history_dict(
        id=record_id,
        vm_id=vm_id,
        local_username=local_username,
        password_hash=password_hash,
        created_by_user_id=user_id
    )

    # Insert into database
    await collection.insert_one(record)

    print(f"📝 Password history saved for {local_username} on VM {vm_id}")

    return record_id


async def get_password_history(
    vm_id: str,
    local_username: str,
    limit: int = 10
) -> list:
    """
    Get password change history for a VM user.

    Note: This returns WHEN passwords were changed and BY WHOM,
    but NEVER the actual passwords or hashes!

    Args:
        vm_id: The VM's unique ID
        local_username: Username on the VM
        limit: Maximum number of records to return

    Returns:
        List of history records (without password hashes)
    """
    collection = get_password_history_collection()
    users_collection = get_users_collection()

    cursor = collection.find(
        {"vm_id": vm_id, "local_username": local_username}
    ).sort("created_at", -1).limit(limit)

    history = await cursor.to_list(length=limit)

    # Enrich with user names (who changed the password)
    result = []
    for record in history:
        # Get the user who made the change
        user = await users_collection.find_one({"id": record["created_by_user_id"]})
        
        result.append({
            "changed_at": record["created_at"],
            "changed_by": user["full_name"] if user else "Unknown User"
        })

    return result


# ===========================================
# AUDIT LOGGING FUNCTIONS
# ===========================================

async def create_audit_log(
    user_id: Optional[str],
    username: Optional[str],
    action: str,
    resource_type: str,
    resource_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None
) -> str:
    """
    Create an audit log entry.

    This should be called for EVERY significant action in the system.

    Args:
        user_id: User who performed the action
        username: Username for display
        action: What action was performed
        resource_type: What type of resource was affected
        resource_id: ID of the affected resource
        details: Additional context (success, error, etc.)
        ip_address: Client's IP address
        user_agent: Client's browser/app info

    Returns:
        The ID of the created audit log
    """
    collection = get_audit_logs_collection()

    log_id = generate_uuid()

    log_entry = create_audit_log_dict(
        id=log_id,
        user_id=user_id,
        username=username,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details,
        ip_address=ip_address,
        user_agent=user_agent
    )

    await collection.insert_one(log_entry)

    # Also print for console logging
    success = details.get("success", True) if details else True
    status_emoji = "✅" if success else "❌"
    print(f"{status_emoji} Audit: {action} by {username or 'unknown'} - {details}")

    return log_id


# ===========================================
# MAIN PASSWORD RESET FUNCTION
# ===========================================

async def reset_vm_password(
    user_id: str,
    user_username: str,
    vm_id: str,
    old_password: str,
    new_password: str,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None
) -> Dict[str, Any]:
    """
    Reset a user's password on a VM.

    This is the MAIN function that orchestrates the entire password reset process:
    1. Validate the user has access to the VM
    2. Validate password strength
    3. Check password history (no reuse)
    4. Get VM credentials (decrypt admin password)
    5. Execute PowerShell script
    6. Save to password history
    7. Create audit log
    8. Create user notification
    9. Notify all admins (NEW!)

    Args:
        user_id: Portal user's ID
        user_username: Portal user's username
        vm_id: Target VM's ID
        old_password: Current password on the VM
        new_password: New password to set
        ip_address: Client's IP (for audit log)
        user_agent: Client's browser (for audit log)

    Returns:
        Dict with keys: success, message, vm_name, local_username, error
    """

    vms_collection = get_vms_collection()
    mappings_collection = get_mappings_collection()
    users_collection = get_users_collection()

    # ==========================================
    # STEP 1: Check user has access to this VM
    # ==========================================

    mapping = await mappings_collection.find_one({
        "user_id": user_id,
        "vm_id": vm_id
    })

    if not mapping:
        # User doesn't have access to this VM
        await create_audit_log(
            user_id=user_id,
            username=user_username,
            action=AuditAction.PASSWORD_RESET_FAILED,
            resource_type=ResourceType.VM,
            resource_id=vm_id,
            details={
                "success": False,
                "error_message": "User does not have access to this VM"
            },
            ip_address=ip_address,
            user_agent=user_agent
        )
        return {
            "success": False,
            "message": "Access denied",
            "error": "You do not have access to this VM",
            "vm_name": None,
            "local_username": None
        }

    # Check if user can reset password
    if not mapping.get("can_reset_password", False):
        await create_audit_log(
            user_id=user_id,
            username=user_username,
            action=AuditAction.PASSWORD_RESET_FAILED,
            resource_type=ResourceType.VM,
            resource_id=vm_id,
            details={
                "success": False,
                "error_message": "User does not have password reset permission"
            },
            ip_address=ip_address,
            user_agent=user_agent
        )
        return {
            "success": False,
            "message": "Permission denied",
            "error": "You do not have permission to reset passwords on this VM",
            "vm_name": None,
            "local_username": None
        }

    local_username = mapping["local_username"]

    # ==========================================
    # STEP 2: Get VM details
    # ==========================================

    vm = await vms_collection.find_one({"id": vm_id})

    if not vm:
        return {
            "success": False,
            "message": "VM not found",
            "error": "The specified VM does not exist",
            "vm_name": None,
            "local_username": local_username
        }

    if not vm.get("is_active", False):
        return {
            "success": False,
            "message": "VM is inactive",
            "error": "This VM is currently inactive",
            "vm_name": vm.get("name"),
            "local_username": local_username
        }

    vm_name = vm.get("name", "Unknown VM")
    vm_ip = vm.get("ip_address")
    admin_username = vm.get("admin_username")
    admin_password_encrypted = vm.get("admin_password_encrypted")

    # ==========================================
    # STEP 2.5: Get user's full name for notifications
    # ==========================================

    user = await users_collection.find_one({"id": user_id})
    user_full_name = user.get("full_name", user_username) if user else user_username

    # ==========================================
    # STEP 3: Validate password strength
    # ==========================================

    is_valid, strength_message = validate_password_strength(new_password)

    if not is_valid:
        await create_audit_log(
            user_id=user_id,
            username=user_username,
            action=AuditAction.PASSWORD_RESET_FAILED,
            resource_type=ResourceType.VM_USER,
            resource_id=vm_id,
            details={
                "vm_ip": vm_ip,
                "vm_name": vm_name,
                "local_username": local_username,
                "success": False,
                "error_message": strength_message
            },
            ip_address=ip_address,
            user_agent=user_agent
        )
        return {
            "success": False,
            "message": "Password too weak",
            "error": strength_message,
            "vm_name": vm_name,
            "local_username": local_username
        }

    # ==========================================
    # STEP 4: Check password history
    # ==========================================

    history_valid, history_message = await check_password_history(
        vm_id=vm_id,
        local_username=local_username,
        new_password=new_password
    )

    if not history_valid:
        await create_audit_log(
            user_id=user_id,
            username=user_username,
            action=AuditAction.PASSWORD_RESET_FAILED,
            resource_type=ResourceType.VM_USER,
            resource_id=vm_id,
            details={
                "vm_ip": vm_ip,
                "vm_name": vm_name,
                "local_username": local_username,
                "success": False,
                "error_message": history_message
            },
            ip_address=ip_address,
            user_agent=user_agent
        )
        return {
            "success": False,
            "message": "Password reuse detected",
            "error": history_message,
            "vm_name": vm_name,
            "local_username": local_username
        }

    # ==========================================
    # STEP 5: Check old password is not same as new
    # ==========================================

    if old_password == new_password:
        await create_audit_log(
            user_id=user_id,
            username=user_username,
            action=AuditAction.PASSWORD_RESET_FAILED,
            resource_type=ResourceType.VM_USER,
            resource_id=vm_id,
            details={
                "vm_ip": vm_ip,
                "vm_name": vm_name,
                "local_username": local_username,
                "success": False,
                "error_message": "New password cannot be the same as old password"
            },
            ip_address=ip_address,
            user_agent=user_agent
        )
        return {
            "success": False,
            "message": "Same password",
            "error": "New password cannot be the same as your current password",
            "vm_name": vm_name,
            "local_username": local_username
        }

    # ==========================================
    # STEP 6: Decrypt VM admin password
    # ==========================================

    try:
        admin_password = decrypt_string(admin_password_encrypted)
    except Exception as e:
        print(f"❌ Failed to decrypt admin password for VM {vm_id}: {e}")
        return {
            "success": False,
            "message": "Internal error",
            "error": "Failed to retrieve VM credentials. Contact administrator.",
            "vm_name": vm_name,
            "local_username": local_username
        }

    # ==========================================
    # STEP 7: Execute PowerShell password reset
    # ==========================================

    print(f"🔧 Executing password reset for {local_username} on {vm_ip}...")

    ps_result = await execute_password_reset(
        vm_ip=vm_ip,
        vm_admin_username=admin_username,
        vm_admin_password=admin_password,
        target_username=local_username,
        old_password=old_password,
        new_password=new_password
    )

    # ==========================================
    # STEP 8: Handle result
    # ==========================================

    if ps_result["success"]:
        # SUCCESS! Save to password history
        await save_password_to_history(
            vm_id=vm_id,
            local_username=local_username,
            new_password=new_password,
            user_id=user_id
        )
        
        # Create success audit log
        await create_audit_log(
            user_id=user_id,
            username=user_username,
            action=AuditAction.PASSWORD_RESET,
            resource_type=ResourceType.VM_USER,
            resource_id=vm_id,
            details={
                "vm_ip": vm_ip,
                "vm_name": vm_name,
                "local_username": local_username,
                "success": True,
                "error_message": None
            },
            ip_address=ip_address,
            user_agent=user_agent
        )

        # Create success notification for the user
        await notify_password_reset_success(
            user_id=user_id,
            vm_name=vm_name,
            local_username=local_username,
            vm_id=vm_id
        )
        
        # Notify all admins about this password change
        await notify_admins_password_change(
            actor_user_id=user_id,
            actor_username=user_username,
            actor_full_name=user_full_name,
            vm_name=vm_name,
            vm_ip=vm_ip,
            local_username=local_username,
            vm_id=vm_id,
            success=True
        )

        # ==========================================
        # Refresh password expiry in the background
        # Runs after returning the response so it
        # doesn't delay the user-facing API call.
        # ==========================================
        async def _refresh_expiry_after_reset():
            try:
                from app.services.password_expiry_service import check_user_password_expiry
                expiry = await check_user_password_expiry(
                    user_id=user_id,
                    vm_id=vm_id
                )
                if expiry and expiry.get("success"):
                    days = expiry.get("days_until_expiry")
                    await get_mappings_collection().update_one(
                        {"user_id": user_id, "vm_id": vm_id},
                        {"$set": {
                            "days_until_expiry": days,
                            "last_expiry_check": datetime.now()
                        }}
                    )
                    print(f"🔄 Expiry refreshed after reset: {days} days remaining for {local_username}@{vm_name}")
            except Exception as e:
                print(f"⚠️ Expiry refresh failed after reset for {local_username}@{vm_name}: {e}")

        asyncio.create_task(_refresh_expiry_after_reset())

        return {
            "success": True,
            "message": "Password reset successfully",
            "error": None,
            "vm_name": vm_name,
            "local_username": local_username
        }
    else:
        # FAILURE! Log the error
        await create_audit_log(
            user_id=user_id,
            username=user_username,
            action=AuditAction.PASSWORD_RESET_FAILED,
            resource_type=ResourceType.VM_USER,
            resource_id=vm_id,
            details={
                "vm_ip": vm_ip,
                "vm_name": vm_name,
                "local_username": local_username,
                "success": False,
                "error_message": ps_result.get("error")
            },
            ip_address=ip_address,
            user_agent=user_agent
        )

        # Create failure notification for the user
        await notify_password_reset_failed(
            user_id=user_id,
            vm_name=vm_name,
            local_username=local_username,
            error_reason=ps_result.get("error", "Unknown error"),
            vm_id=vm_id
        )
        
        # ==========================================
        # NEW: Notify admins about failed password change attempt
        # (Optional - you can remove this if you don't want failed attempt notifications)
        # ==========================================
        await notify_admins_password_change(
            actor_user_id=user_id,
            actor_username=user_username,
            actor_full_name=user_full_name,
            vm_name=vm_name,
            vm_ip=vm_ip,
            local_username=local_username,
            vm_id=vm_id,
            success=False
        )
        
        return {
            "success": False,
            "message": ps_result.get("message", "Password reset failed"),
            "error": ps_result.get("error", "Unknown error occurred"),
            "vm_name": vm_name,
            "local_username": local_username
        }


# ===========================================
# GET AUDIT LOGS FOR USER
# ===========================================

async def get_user_audit_logs(
    user_id: str,
    limit: int = 50,
    offset: int = 0,
    action_filter: Optional[str] = None
) -> Dict[str, Any]:
    """
    Get audit logs for a specific user.

    Args:
        user_id: The user's ID
        limit: Maximum records to return
        offset: Records to skip (for pagination)
        action_filter: Optional filter by action type

    Returns:
        Dict with logs list and total count
    """
    collection = get_audit_logs_collection()

    # Build query
    query = {"user_id": user_id}
    if action_filter:
        query["action"] = action_filter

    # Get total count
    total = await collection.count_documents(query)

    # Get paginated results
    cursor = collection.find(query).sort("timestamp", -1).skip(offset).limit(limit)
    logs = await cursor.to_list(length=limit)

    # Remove MongoDB _id field
    for log in logs:
        log.pop("_id", None)

    return {
        "logs": logs,
        "total": total,
        "limit": limit,
        "offset": offset
    }


# ===========================================
# GET ALL AUDIT LOGS (Admin Only)
# ===========================================

async def get_all_audit_logs(
    limit: int = 50,
    offset: int = 0,
    action_filter: Optional[str] = None
) -> Dict[str, Any]:
    """
    Get all audit logs (for admins).

    Args:
        limit: Maximum records to return
        offset: Records to skip (for pagination)
        action_filter: Optional filter by action type

    Returns:
        Dict with logs list and total count
    """
    collection = get_audit_logs_collection()

    # Build query
    query = {}
    if action_filter:
        query["action"] = action_filter

    # Get total count
    total = await collection.count_documents(query)

    # Get paginated results
    cursor = collection.find(query).sort("timestamp", -1).skip(offset).limit(limit)
    logs = await cursor.to_list(length=limit)

    # Remove MongoDB _id field
    for log in logs:
        log.pop("_id", None)

    return {
        "logs": logs,
        "total": total,
        "limit": limit,
        "offset": offset
    }