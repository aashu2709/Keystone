# backend/app/services/user_management_service.py
"""
User Management Service
Orchestrates remote user account operations across multiple VMs.
Handles: create, disable, enable, unlock, delete, list users.
"""

import secrets
import string
from datetime import datetime
from typing import List, Optional
import re

from app.database import get_vms_collection, get_audit_logs_collection, get_mappings_collection
from app.utils.security import generate_uuid, decrypt_string
from app.utils.powershell import execute_user_management
from app.services.notification_service import create_notification


# ===========================================
# PASSWORD GENERATOR
# ===========================================

def generate_strong_password(length: int = 16) -> str:
    """
    Generate a cryptographically strong random password.
    Ensures at least: 1 uppercase, 1 lowercase, 1 digit, 1 special character.
    """
    if length < 12:
        length = 12

    uppercase = string.ascii_uppercase
    lowercase = string.ascii_lowercase
    digits = string.digits
    # Use special chars that are safe for Windows and won't break PowerShell
    special = "!@#$%&*_+-=?"

    # Guarantee at least one of each required type
    password = [
        secrets.choice(uppercase),
        secrets.choice(uppercase),
        secrets.choice(lowercase),
        secrets.choice(lowercase),
        secrets.choice(digits),
        secrets.choice(digits),
        secrets.choice(special),
        secrets.choice(special),
    ]

    # Fill remaining length with a mix of all
    all_chars = uppercase + lowercase + digits + special
    for _ in range(length - len(password)):
        password.append(secrets.choice(all_chars))

    # Shuffle to avoid predictable pattern
    password_list = list(password)
    secrets.SystemRandom().shuffle(password_list)

    return "".join(password_list)


# ===========================================
# AUDIT LOGGING
# ===========================================

async def log_user_management_action(
    admin_user_id: str,
    action: str,
    target_username: str,
    vm_results: list,
    details: dict = None,
    ip_address: str = None,
    user_agent: str = None
):
    """Log a user management action for audit trail."""
    audit_logs = get_audit_logs_collection()

    log_doc = {
        "id": generate_uuid(),
        "user_id": admin_user_id,
        "action": f"remote_user_{action}",
        "resource_type": "remote_user",
        "resource_id": target_username,
        "details": {
            "target_username": target_username,
            "action": action,
            "vm_count": len(vm_results),
            "successful": sum(1 for r in vm_results if r["success"]),
            "failed": sum(1 for r in vm_results if not r["success"]),
            "vm_results": [
                {
                    "vm_name": r["vm_name"],
                    "ip_address": r["ip_address"],
                    "success": r["success"],
                    "message": r["message"]
                }
                for r in vm_results
            ],
            **(details or {})
        },
        "ip_address": ip_address,
        "user_agent": user_agent,
        "timestamp": datetime.now()
    }

    await audit_logs.insert_one(log_doc)


# ===========================================
# HELPER: FETCH & VALIDATE VMs
# ===========================================

async def get_vms_by_ids(vm_ids: List[str]) -> list:
    """Fetch VM documents by IDs. Returns list of VM docs."""
    vms_collection = get_vms_collection()
    vms = []
    for vm_id in vm_ids:
        vm = await vms_collection.find_one({"id": vm_id})
        if vm:
            vms.append(vm)
    return vms


async def decrypt_vm_admin_password(vm: dict) -> Optional[str]:
    """Decrypt the admin password for a VM. Returns None on failure."""
    try:
        return decrypt_string(vm.get("admin_password_encrypted", ""))
    except Exception as e:
        print(f"❌ Failed to decrypt admin password for VM {vm.get('name', '?')}: {e}")
        return None


# ===========================================
# CORE OPERATIONS
# ===========================================

async def create_remote_user(
    vm_ids: List[str],
    username: str,
    full_name: str,
    password: str,
    user_type: str = "standard",
    description: str = "",
    must_change_password: bool = False,
    enable_rdp: bool = True,
    admin_user_id: str = "",
    ip_address: str = None,
    user_agent: str = None
) -> dict:
    """Create a local user account on multiple VMs."""
    vms = await get_vms_by_ids(vm_ids)

    if not vms:
        return {
            "action": "create",
            "username": username,
            "total_vms": 0,
            "successful": 0,
            "failed": 0,
            "results": [],
        }

    results = []

    for vm in vms:
        admin_password = await decrypt_vm_admin_password(vm)
        if not admin_password:
            results.append({
                "vm_id": vm["id"],
                "vm_name": vm["name"],
                "ip_address": vm["ip_address"],
                "success": False,
                "message": "Failed to decrypt VM admin credentials",
            })
            continue

        result = await execute_user_management(
            action="create",
            vm_ip=vm["ip_address"],
            vm_admin_username=vm.get("admin_username", "Administrator"),
            vm_admin_password=admin_password,
            target_user=username,
            target_password=password,
            full_name=full_name,
            description=description,
            user_type=user_type,
            must_change_password="true" if must_change_password else "false",
            enable_rdp="true" if enable_rdp else "false",
        )

        results.append({
            "vm_id": vm["id"],
            "vm_name": vm["name"],
            "ip_address": vm["ip_address"],
            "success": result.get("success", False),
            "message": result.get("message", "Unknown error"),
        })

    # Audit log
    await log_user_management_action(
        admin_user_id=admin_user_id,
        action="create",
        target_username=username,
        vm_results=results,
        details={
            "full_name": full_name,
            "user_type": user_type,
            "must_change_password": must_change_password,
            "enable_rdp": enable_rdp,
        },
        ip_address=ip_address,
        user_agent=user_agent,
    )

    # Send notification to admins
    successful = sum(1 for r in results if r["success"])
    failed = sum(1 for r in results if not r["success"])
    await _notify_admins_user_action(admin_user_id, "created", username, successful, failed)

    return {
        "action": "create",
        "username": username,
        "total_vms": len(results),
        "successful": successful,
        "failed": failed,
        "results": results,
    }


async def manage_remote_user(
    action: str,
    vm_ids: List[str],
    username: str,
    admin_user_id: str = "",
    ip_address: str = None,
    user_agent: str = None
) -> dict:
    """Disable, enable, unlock, or delete a user on multiple VMs."""
    vms = await get_vms_by_ids(vm_ids)

    if not vms:
        return {
            "action": action,
            "username": username,
            "total_vms": 0,
            "successful": 0,
            "failed": 0,
            "results": [],
        }

    results = []

    for vm in vms:
        admin_password = await decrypt_vm_admin_password(vm)
        if not admin_password:
            results.append({
                "vm_id": vm["id"],
                "vm_name": vm["name"],
                "ip_address": vm["ip_address"],
                "success": False,
                "message": "Failed to decrypt VM admin credentials",
            })
            continue

        result = await execute_user_management(
            action=action,
            vm_ip=vm["ip_address"],
            vm_admin_username=vm.get("admin_username", "Administrator"),
            vm_admin_password=admin_password,
            target_user=username,
        )

        results.append({
            "vm_id": vm["id"],
            "vm_name": vm["name"],
            "ip_address": vm["ip_address"],
            "success": result.get("success", False),
            "message": result.get("message", "Unknown error"),
        })

    # If action is delete, also clean up Keystone mappings
    if action == "delete":
        await _cleanup_mappings_for_deleted_user(username, vm_ids, results)

    # Audit log
    await log_user_management_action(
        admin_user_id=admin_user_id,
        action=action,
        target_username=username,
        vm_results=results,
        ip_address=ip_address,
        user_agent=user_agent,
    )

    # Notification
    action_past = {"disable": "disabled", "enable": "enabled", "unlock": "unlocked", "delete": "deleted"}.get(action, action)
    successful = sum(1 for r in results if r["success"])
    failed = sum(1 for r in results if not r["success"])
    await _notify_admins_user_action(admin_user_id, action_past, username, successful, failed)

    return {
        "action": action,
        "username": username,
        "total_vms": len(results),
        "successful": successful,
        "failed": failed,
        "results": results,
    }


async def list_remote_users(
    vm_id: str,
    admin_user_id: str = ""
) -> dict:
    """List all local users on a single VM."""
    vms_collection = get_vms_collection()
    vm = await vms_collection.find_one({"id": vm_id})

    if not vm:
        return {
            "vm_id": vm_id,
            "vm_name": "Unknown",
            "ip_address": "Unknown",
            "total_users": 0,
            "users": [],
            "error": "VM not found",
        }

    admin_password = await decrypt_vm_admin_password(vm)
    if not admin_password:
        return {
            "vm_id": vm_id,
            "vm_name": vm["name"],
            "ip_address": vm["ip_address"],
            "total_users": 0,
            "users": [],
            "error": "Failed to decrypt VM admin credentials",
        }

    result = await execute_user_management(
        action="list",
        vm_ip=vm["ip_address"],
        vm_admin_username=vm.get("admin_username", "Administrator"),
        vm_admin_password=admin_password,
    )

    if result.get("success") and result.get("data", {}).get("users"):
        users = result["data"]["users"]
        return {
            "vm_id": vm_id,
            "vm_name": vm["name"],
            "ip_address": vm["ip_address"],
            "total_users": len(users),
            "users": users,
        }
    else:
        return {
            "vm_id": vm_id,
            "vm_name": vm["name"],
            "ip_address": vm["ip_address"],
            "total_users": 0,
            "users": [],
            "error": result.get("message", "Failed to list users"),
        }


# ===========================================
# HELPERS
# ===========================================

async def _cleanup_mappings_for_deleted_user(username: str, vm_ids: List[str], results: list):
    """Remove Keystone user-VM mappings when a remote user is deleted."""
    mappings_collection = get_mappings_collection()

    for r in results:
        if r["success"]:
            # Find and delete mappings where local_username matches
            deleted = await mappings_collection.delete_many({
                "vm_id": r["vm_id"],
                "local_username": username
            })
            if deleted.deleted_count > 0:
                print(f"🗑️ Removed {deleted.deleted_count} mapping(s) for '{username}' on VM '{r['vm_name']}'")
                r["message"] += f" ({deleted.deleted_count} Keystone mapping(s) also removed)"


async def _notify_admins_user_action(admin_user_id: str, action: str, username: str, successful: int, failed: int):
    """Create notification for the admin who performed the action."""
    status_icon = "✅" if failed == 0 else "⚠️" if successful > 0 else "❌"
    message = f"{status_icon} User '{username}' {action} on {successful}/{successful + failed} server(s)"
    if failed > 0:
        message += f" ({failed} failed)"

    try:
        await create_notification(
            user_id=admin_user_id,
            title=f"Remote User {action.title()}",
            message=message,
            notification_type="user_management",
            priority="medium" if failed == 0 else "high",
        )
    except Exception as e:
        print(f"⚠️ Failed to create notification: {e}")


# ===========================================
# BULK RESET PASSWORD
# ===========================================

async def bulk_reset_remote_password(
    target_username: str,
    new_password: str,
    vm_ids: Optional[List[str]] = None,
    admin_user_id: str = "",
    ip_address: str = None,
    user_agent: str = None
) -> dict:
    """Reset a remote user's password on multiple VMs."""
    vms_collection = get_vms_collection()
    mappings_collection = get_mappings_collection()
    
    # 1. Identify Target VMs and Usernames
    targets = [] # List of (vm_doc, username)
    
    if not vm_ids:
        return {
            "action": "bulk_password_reset",
            "username": target_username,
            "total_vms": 0,
            "successful": 0,
            "failed": 0,
            "results": [],
            "error": "No target servers selected. Please select at least one server."
        }
    
    # Explicit VM selection (Manual mode)
    for vm_id in vm_ids:
        vm = await vms_collection.find_one({"id": vm_id})
        if vm:
            targets.append((vm, target_username))

    if not targets:
        return {
            "action": "bulk_password_reset",
            "username": target_username,
            "total_vms": 0,
            "successful": 0,
            "failed": 0,
            "results": [],
            "error": "No target servers found for this username."
        }

    # 2. Execute Resets
    results = []
    for vm, username in targets:
        admin_password = await decrypt_vm_admin_password(vm)
        if not admin_password:
            results.append({
                "vm_id": vm["id"],
                "vm_name": vm["name"],
                "ip_address": vm["ip_address"],
                "success": False,
                "message": "Failed to decrypt VM admin credentials",
            })
            continue

        print(f"🔐 Resetting: {username} on {vm['name']} ({vm['ip_address']})")
        result = await execute_user_management(
            action="reset-password",
            vm_ip=vm["ip_address"],
            vm_admin_username=vm.get("admin_username", "Administrator"),
            vm_admin_password=admin_password,
            target_user=username,
            target_password=new_password,
        )

        results.append({
            "vm_id": vm["id"],
            "vm_name": vm["name"],
            "ip_address": vm["ip_address"],
            "success": result.get("success", False),
            "message": result.get("message", "Unknown error"),
        })

    # 3. Finalization (Audit & Notifications)
    successful = sum(1 for r in results if r["success"])
    failed = len(results) - successful
    
    await log_user_management_action(
        admin_user_id=admin_user_id,
        action="bulk_password_reset",
        target_username=target_username,
        vm_results=results,
        details={"target_username": target_username},
        ip_address=ip_address,
        user_agent=user_agent,
    )
    
    await _notify_admins_user_action(admin_user_id, "bulk password reset", target_username, successful, failed)

    return {
        "action": "bulk_password_reset",
        "username": target_username,
        "total_vms": len(results),
        "successful": successful,
        "failed": failed,
        "results": results,
    }
