"""
Password Expiry Service
=======================
Checks password expiry dates on VMs and creates notifications.

How it works:
1. Gets all user-VM mappings
2. Runs PowerShell to check password age on each VM
3. If password expires within 14/7/3/1 days, creates notification
4. Optionally sends email alerts for urgent expirations
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta

from app.database import (
    get_mappings_collection,
    get_vms_collection,
    get_users_collection,
    get_notifications_collection
)
from app.utils.security import decrypt_string
from app.utils.powershell import check_password_expiry_ps
from app.services.notification_service import (
    notify_password_expiry_warning
)
from app.utils.email import (
    send_email,
    get_password_expiry_email_html,
    get_password_expiry_email_text
)
from app.config import settings


# ===========================================
# CONSTANTS
# ===========================================

# Days before expiry to send warnings
EXPIRY_WARNING_DAYS = [14, 7, 3, 1]

# Cache to prevent duplicate notifications on same day
# Format: {f"{user_id}:{vm_id}:{days}": last_notified_date}
_notification_cache: Dict[str, datetime] = {}


# ===========================================
# MAIN FUNCTION
# ===========================================

async def check_all_password_expiry() -> Dict[str, Any]:
    """
    Check password expiry for all users on all VMs.
    
    Returns:
        Dict with:
        - users_checked: Number of user-VM mappings checked
        - expiring_count: Number of passwords expiring soon
        - notifications_sent: Number of notifications created
        - emails_sent: Number of emails sent
        - errors: List of errors encountered
    """
    mappings_collection = get_mappings_collection()
    vms_collection = get_vms_collection()
    users_collection = get_users_collection()
    
    result = {
        "users_checked": 0,
        "expiring_count": 0,
        "notifications_sent": 0,
        "emails_sent": 0,
        "errors": []
    }
    
    # Get all mappings
    mappings = await mappings_collection.find({}).to_list(length=1000)
    
    if not mappings:
        print("   No user-VM mappings found")
        return result
    
    # Group mappings by VM to reduce PowerShell calls
    vm_mappings: Dict[str, List[dict]] = {}
    for mapping in mappings:
        vm_id = mapping["vm_id"]
        if vm_id not in vm_mappings:
            vm_mappings[vm_id] = []
        vm_mappings[vm_id].append(mapping)
    
    # Process each VM
    for vm_id, user_mappings in vm_mappings.items():
        # Get VM details
        vm = await vms_collection.find_one({"id": vm_id})
        
        if not vm or not vm.get("is_active", True):
            continue
        
        if vm.get("health_status") == "unreachable":
            print(f"   Skipping unreachable VM: {vm.get('name')}")
            continue
        
        # Decrypt admin password
        try:
            admin_password = decrypt_string(vm.get("admin_password_encrypted", ""))
        except Exception as e:
            result["errors"].append(f"Failed to decrypt password for VM {vm.get('name')}: {e}")
            continue
        
        # Check each user on this VM
        for mapping in user_mappings:
            result["users_checked"] += 1
            
            local_username = mapping["local_username"]
            user_id = mapping["user_id"]
            
            try:
                # Get password expiry info from VM
                expiry_info = await check_password_expiry_ps(
                    vm_ip=vm["ip_address"],
                    vm_admin_username=vm.get("admin_username", "Administrator"),
                    vm_admin_password=admin_password,
                    target_username=local_username
                )
                
                if not expiry_info.get("success"):
                    # Could not check - VM might be unreachable
                    continue
                
                days_until_expiry = expiry_info.get("days_until_expiry")

                if days_until_expiry is not None:
                    await mappings_collection.update_one(
                        {"id": mapping["id"]},
                        {"$set": {
                            "days_until_expiry": days_until_expiry,
                            "last_expiry_check": datetime.now()
                        }}
                    )
                
                if days_until_expiry is None:
                    # Password never expires
                    continue
                
                # Check if we should send warning
                for warning_days in EXPIRY_WARNING_DAYS:
                    if days_until_expiry <= warning_days:
                        # Check if we already sent this notification today
                        cache_key = f"{user_id}:{vm_id}:{warning_days}"
                        last_notified = _notification_cache.get(cache_key)
                        
                        if last_notified and last_notified.date() == datetime.now().date():
                            # Already notified today
                            break
                        
                        # Get user info for email
                        user = await users_collection.find_one({"id": user_id})
                        
                        if not user:
                            continue
                        
                        result["expiring_count"] += 1
                        
                        # Create notification
                        await notify_password_expiry_warning(
                            user_id=user_id,
                            vm_name=vm["name"],
                            local_username=local_username,
                            days_until_expiry=days_until_expiry,
                            vm_id=vm_id
                        )
                        result["notifications_sent"] += 1
                        
                        # Send email for urgent expirations (3 days or less)
                        if days_until_expiry <= 3 and user.get("email"):
                            email_result = await send_password_expiry_email(
                                to_email=user["email"],
                                user_name=user.get("full_name", user["username"]),
                                vm_name=vm["name"],
                                local_username=local_username,
                                days_until_expiry=days_until_expiry
                            )
                            if email_result.get("success"):
                                result["emails_sent"] += 1
                        
                        # Update cache
                        _notification_cache[cache_key] = datetime.now()
                        
                        # Only send one warning per user-VM pair
                        break
                        
            except Exception as e:
                result["errors"].append(
                    f"Error checking {local_username}@{vm.get('name')}: {str(e)}"
                )
    
    return result


# ===========================================
# EMAIL HELPER
# ===========================================

async def send_password_expiry_email(
    to_email: str,
    user_name: str,
    vm_name: str,
    local_username: str,
    days_until_expiry: int
) -> dict:
    """Send password expiry warning email."""
    
    # Determine subject urgency
    if days_until_expiry <= 1:
        urgency = "URGENT"
    elif days_until_expiry <= 3:
        urgency = "WARNING"
    else:
        urgency = "NOTICE"
    
    days_text = "day" if days_until_expiry == 1 else "days"
    
    return await send_email(
        to_email=to_email,
        subject=f"[{urgency}] Password Expires in {days_until_expiry} {days_text} - {vm_name}",
        html_content=get_password_expiry_email_html(
            user_name=user_name,
            vm_name=vm_name,
            local_username=local_username,
            days_until_expiry=days_until_expiry,
            portal_url=settings.FRONTEND_URL
        ),
        text_content=get_password_expiry_email_text(
            user_name=user_name,
            vm_name=vm_name,
            local_username=local_username,
            days_until_expiry=days_until_expiry,
            portal_url=settings.FRONTEND_URL
        )
    )


# ===========================================
# SINGLE USER CHECK (For manual trigger)
# ===========================================

async def check_user_password_expiry(
    user_id: str,
    vm_id: str
) -> Optional[Dict[str, Any]]:
    """
    Check password expiry for a specific user on a specific VM.
    
    Returns expiry information or None if cannot check.
    """
    mappings_collection = get_mappings_collection()
    vms_collection = get_vms_collection()
    
    # Get mapping
    mapping = await mappings_collection.find_one({
        "user_id": user_id,
        "vm_id": vm_id
    })
    
    if not mapping:
        return None
    
    # Get VM
    vm = await vms_collection.find_one({"id": vm_id})
    
    if not vm:
        return None
    
    # Decrypt admin password
    try:
        admin_password = decrypt_string(vm.get("admin_password_encrypted", ""))
    except Exception:
        return None
    
    # Check expiry
    return await check_password_expiry_ps(
        vm_ip=vm["ip_address"],
        vm_admin_username=vm.get("admin_username", "Administrator"),
        vm_admin_password=admin_password,
        target_username=mapping["local_username"]
    )


# ===========================================
# CLEAR NOTIFICATION CACHE
# ===========================================

def clear_notification_cache():
    """Clear the notification cache. Used for testing."""
    global _notification_cache
    _notification_cache = {}
    print("🧹 Password expiry notification cache cleared")