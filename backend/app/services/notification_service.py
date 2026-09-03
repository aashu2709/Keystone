# backend/app/services/notification_service.py
"""
Notification Service
Business logic for notification operations.

Updated: Added admin notifications for password changes
Updated: Added vm_ip parameter to notify_vm_unreachable, added notify_vm_recovered
"""

from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta

from app.database import (
    get_notifications_collection,
    get_vms_collection,
    get_users_collection
)
from app.utils.security import generate_uuid
from app.models.notification import (
    create_notification_dict,
    NotificationType,
    NotificationPriority
)


# ===========================================
# CREATE NOTIFICATIONS
# ===========================================

async def create_notification(
    user_id: str,
    notification_type: str,
    title: str,
    message: str,
    priority: str = "medium",
    related_vm_id: Optional[str] = None,
    action_url: Optional[str] = None
) -> str:
    """
    Create a new notification for a user.

    Args:
        user_id: User to notify
        notification_type: Type of notification
        title: Short title
        message: Detailed message
        priority: low/medium/high/urgent
        related_vm_id: Optional VM ID
        action_url: Optional URL to navigate

    Returns:
        The created notification ID
    """
    collection = get_notifications_collection()

    notif_id = generate_uuid()

    notification = create_notification_dict(
        id=notif_id,
        user_id=user_id,
        notification_type=notification_type,
        title=title,
        message=message,
        priority=priority,
        related_vm_id=related_vm_id,
        action_url=action_url
    )

    await collection.insert_one(notification)

    print(f"🔔 Notification created for user {user_id}: {title}")

    return notif_id


# ===========================================
# NOTIFICATION FACTORY FUNCTIONS
# ===========================================

async def notify_password_reset_success(
    user_id: str,
    vm_name: str,
    local_username: str,
    vm_id: str
) -> str:
    """Create notification for successful password reset."""
    return await create_notification(
        user_id=user_id,
        notification_type=NotificationType.PASSWORD_RESET_SUCCESS,
        title="Password Changed Successfully",
        message=f"Your password for user '{local_username}' on '{vm_name}' was changed successfully.",
        priority=NotificationPriority.MEDIUM,
        related_vm_id=vm_id,
        action_url="/dashboard/vms"
    )


async def notify_password_reset_failed(
    user_id: str,
    vm_name: str,
    local_username: str,
    error_reason: str,
    vm_id: str
) -> str:
    """Create notification for failed password reset."""
    return await create_notification(
        user_id=user_id,
        notification_type=NotificationType.PASSWORD_RESET_FAILED,
        title="Password Change Failed",
        message=f"Failed to change password for '{local_username}' on '{vm_name}': {error_reason}",
        priority=NotificationPriority.HIGH,
        related_vm_id=vm_id,
        action_url="/dashboard/password-reset"
    )


async def notify_password_expiry_warning(
    user_id: str,
    vm_name: str,
    local_username: str,
    days_until_expiry: int,
    vm_id: str
) -> str:
    """Create notification for password expiry warning."""
    if days_until_expiry <= 0:
        priority = NotificationPriority.URGENT
        title = "Password Has Expired"
    elif days_until_expiry == 1:
        priority = NotificationPriority.URGENT
        title = "Password Expires Tomorrow!"
    elif days_until_expiry <= 3:
        priority = NotificationPriority.HIGH
        title = f"Password Expires in {days_until_expiry} Days"
    elif days_until_expiry <= 7:
        priority = NotificationPriority.MEDIUM
        title = f"Password Expires in {days_until_expiry} Days"
    else:
        priority = NotificationPriority.MEDIUM
        title = f"Password Expires in {days_until_expiry} Days"

    # Build appropriate message body
    if days_until_expiry <= 0:
        expiry_msg = f"Your password for '{local_username}' on '{vm_name}' has already expired. Please change it immediately."
    elif days_until_expiry == 1:
        expiry_msg = f"Your password for '{local_username}' on '{vm_name}' expires tomorrow. Please change it now."
    else:
        expiry_msg = f"Your password for '{local_username}' on '{vm_name}' will expire in {days_until_expiry} days. Please change it soon."

    return await create_notification(
        user_id=user_id,
        notification_type=NotificationType.PASSWORD_EXPIRY_WARNING,
        title=title,
        message=expiry_msg,
        priority=priority,
        related_vm_id=vm_id,
        action_url="/dashboard/password-reset"
    )


async def notify_vm_unreachable(
    user_id: str,
    vm_name: str,
    vm_ip: str,
    vm_id: str
) -> str:
    """
    Create notification when VM becomes unreachable.
    
    Args:
        user_id: User to notify
        vm_name: Name of the VM
        vm_ip: IP address of the VM
        vm_id: VM identifier
    
    Returns:
        Created notification ID
    """
    return await create_notification(
        user_id=user_id,
        notification_type=NotificationType.VM_UNREACHABLE,
        title="VM Unreachable",
        message=f"Unable to connect to '{vm_name}' ({vm_ip}). The server may be offline or there may be network issues.",
        priority=NotificationPriority.HIGH,
        related_vm_id=vm_id,
        action_url="/dashboard/vms"
    )


async def notify_vm_recovered(
    user_id: str,
    vm_name: str,
    vm_ip: str,
    vm_id: str
) -> str:
    """
    Create notification when VM recovers from unreachable state.
    
    Args:
        user_id: User to notify
        vm_name: Name of the VM
        vm_ip: IP address of the VM
        vm_id: VM identifier
    
    Returns:
        Created notification ID
    """
    return await create_notification(
        user_id=user_id,
        notification_type=NotificationType.VM_STATUS_CHANGE,
        title="VM Back Online",
        message=f"VM '{vm_name}' ({vm_ip}) is now reachable again.",
        priority=NotificationPriority.MEDIUM,
        related_vm_id=vm_id,
        action_url="/dashboard/vms"
    )


async def notify_welcome(user_id: str, username: str) -> str:
    """Create welcome notification for new users."""
    return await create_notification(
        user_id=user_id,
        notification_type=NotificationType.WELCOME,
        title="Welcome to Password Portal!",
        message=f"Hello {username}! Welcome to the Password Management Portal. You can now manage passwords for your assigned VMs.",
        priority=NotificationPriority.LOW,
        action_url="/dashboard"
    )


# ===========================================
# ADMIN NOTIFICATIONS
# ===========================================

async def notify_admins_password_change(
    actor_user_id: str,
    actor_username: str,
    actor_full_name: str,
    vm_name: str,
    vm_ip: str,
    local_username: str,
    vm_id: str,
    success: bool = True
) -> int:
    """
    Notify ALL admin users when ANY user changes a password.

    This is for security monitoring - admins should know about
    all password changes happening in the system.

    Args:
        actor_user_id: ID of user who performed the action
        actor_username: Username of the actor
        actor_full_name: Full name of the actor
        vm_name: Name of the VM
        vm_ip: IP address of the VM
        local_username: Local username on the VM
        vm_id: VM ID for reference
        success: Whether the password change succeeded

    Returns:
        Number of admin notifications created
    """
    users_collection = get_users_collection()

    # Find all admin and superadmin users
    admin_cursor = users_collection.find({
        "role": {"$in": ["admin", "superadmin"]},
        "is_active": True
    })

    admins = await admin_cursor.to_list(length=100)  # Max 100 admins

    if not admins:
        print("⚠️ No active admins found to notify")
        return 0

    notifications_created = 0

    for admin in admins:
        admin_id = admin["id"]
        
        # Skip if the actor is the admin themselves
        # (They already got their own notification)
        if admin_id == actor_user_id:
            print(f"⏭️ Skipping admin notification for {admin['username']} (they are the actor)")
            continue
        
        # Create notification for this admin
        if success:
            notification_type = NotificationType.ADMIN_PASSWORD_ALERT
            title = "Password Changed by User"
            message = (
                f"User '{actor_full_name}' (@{actor_username}) changed the password "
                f"for local user '{local_username}' on VM '{vm_name}' ({vm_ip})."
            )
            priority = NotificationPriority.MEDIUM
        else:
            notification_type = NotificationType.ADMIN_PASSWORD_ALERT
            title = "Password Change Failed"
            message = (
                f"User '{actor_full_name}' (@{actor_username}) attempted to change "
                f"the password for local user '{local_username}' on VM '{vm_name}' ({vm_ip}), "
                f"but the operation failed."
            )
            priority = NotificationPriority.HIGH
        
        await create_notification(
            user_id=admin_id,
            notification_type=notification_type,
            title=title,
            message=message,
            priority=priority,
            related_vm_id=vm_id,
            action_url="/admin/audit-logs"
        )
        
        notifications_created += 1
        print(f"🔔 Admin notification sent to: {admin['username']}")

    print(f"📢 Total admin notifications created: {notifications_created}")

    return notifications_created


async def notify_admins_user_signup(
    new_user_id: str,
    new_username: str,
    new_email: str,
    new_full_name: str
) -> int:
    """
    Notify ALL admins when a new user signs up.

    Args:
        new_user_id: ID of the new user
        new_username: Username of the new user
        new_email: Email of the new user
        new_full_name: Full name of the new user

    Returns:
        Number of admin notifications created
    """
    users_collection = get_users_collection()

    # Find all admin and superadmin users
    admin_cursor = users_collection.find({
        "role": {"$in": ["admin", "superadmin"]},
        "is_active": True
    })

    admins = await admin_cursor.to_list(length=100)

    if not admins:
        return 0

    notifications_created = 0

    for admin in admins:
        await create_notification(
            user_id=admin["id"],
            notification_type=NotificationType.ADMIN_USER_SIGNUP,
            title="New User Registered",
            message=f"A new user has registered: {new_full_name} (@{new_username}, {new_email}). "
                    f"They will need VM access assignments.",
            priority=NotificationPriority.LOW,
            action_url="/admin/users"
        )
        
        notifications_created += 1
        print(f"🔔 New user notification sent to admin: {admin['username']}")

    return notifications_created


async def notify_admins_vm_health_change(
    vm_name: str,
    vm_ip: str,
    vm_id: str,
    old_status: str,
    new_status: str
) -> int:
    """
    Notify ALL admins when a VM health status changes.

    Args:
        vm_name: Name of the VM
        vm_ip: IP address of the VM
        vm_id: VM ID
        old_status: Previous health status
        new_status: New health status

    Returns:
        Number of admin notifications created
    """
    users_collection = get_users_collection()

    # Find all admin and superadmin users
    admin_cursor = users_collection.find({
        "role": {"$in": ["admin", "superadmin"]},
        "is_active": True
    })

    admins = await admin_cursor.to_list(length=100)

    if not admins:
        return 0

    # Determine priority and title based on status change
    if new_status == "unreachable":
        priority = NotificationPriority.URGENT
        title = "VM Became Unreachable"
        message = f"VM '{vm_name}' ({vm_ip}) is now unreachable. Status changed from '{old_status}' to '{new_status}'."
    elif new_status == "healthy" and old_status == "unreachable":
        priority = NotificationPriority.MEDIUM
        title = "VM Back Online"
        message = f"VM '{vm_name}' ({vm_ip}) is now healthy again. Status changed from '{old_status}' to '{new_status}'."
    else:
        priority = NotificationPriority.LOW
        title = "VM Status Changed"
        message = f"VM '{vm_name}' ({vm_ip}) status changed from '{old_status}' to '{new_status}'."

    notifications_created = 0

    for admin in admins:
        await create_notification(
            user_id=admin["id"],
            notification_type=NotificationType.VM_STATUS_CHANGE,
            title=title,
            message=message,
            priority=priority,
            related_vm_id=vm_id,
            action_url="/admin/vms"
        )
        
        notifications_created += 1

    print(f"📢 VM health change notifications sent to {notifications_created} admins")

    return notifications_created


# ===========================================
# GET NOTIFICATIONS
# ===========================================

async def get_user_notifications(
    user_id: str,
    limit: int = 50,
    offset: int = 0,
    unread_only: bool = False
) -> Dict[str, Any]:
    """
    Get notifications for a user.

    Args:
        user_id: User's ID
        limit: Max notifications to return (0 = no limit)
        offset: Skip count for pagination
        unread_only: If True, only return unread notifications

    Returns:
        Dict with notifications list, total count, and unread count
    """
    collection = get_notifications_collection()

    # Build query
    query = {"user_id": user_id}
    if unread_only:
        query["is_read"] = False

    # Get total count
    total = await collection.count_documents(query)

    # Get unread count (always)
    unread_count = await collection.count_documents({
        "user_id": user_id,
        "is_read": False
    })

    # Get notifications (newest first)
    cursor = collection.find(query).sort("created_at", -1).skip(offset)
    if limit > 0:
        cursor = cursor.limit(limit)
    notifications = await cursor.to_list(length=limit if limit > 0 else None)

    # Process notifications
    result = []
    for notif in notifications:
        notif.pop("_id", None)  # Remove MongoDB internal ID
        
        # Add human-readable time
        notif["time_ago"] = get_time_ago(notif["created_at"])
        
        result.append(notif)

    return {
        "notifications": result,
        "total": total,
        "unread_count": unread_count
    }


async def get_unread_count(user_id: str) -> int:
    """Get count of unread notifications for a user."""
    collection = get_notifications_collection()

    count = await collection.count_documents({
        "user_id": user_id,
        "is_read": False
    })

    return count


# ===========================================
# MARK AS READ
# ===========================================

async def mark_as_read(user_id: str, notification_id: str) -> bool:
    """
    Mark a single notification as read.

    Returns True if successful, False if not found.
    """
    collection = get_notifications_collection()

    result = await collection.update_one(
        {"id": notification_id, "user_id": user_id},
        {
            "$set": {
                "is_read": True,
                "read_at": datetime.now()
            }
        }
    )

    return result.modified_count > 0


async def mark_multiple_as_read(user_id: str, notification_ids: List[str]) -> int:
    """
    Mark multiple notifications as read.

    Returns count of notifications marked as read.
    """
    collection = get_notifications_collection()

    result = await collection.update_many(
        {
            "id": {"$in": notification_ids},
            "user_id": user_id
        },
        {
            "$set": {
                "is_read": True,
                "read_at": datetime.now()
            }
        }
    )

    return result.modified_count


async def mark_all_as_read(user_id: str) -> int:
    """
    Mark all notifications as read for a user.

    Returns count of notifications marked as read.
    """
    collection = get_notifications_collection()

    result = await collection.update_many(
        {"user_id": user_id, "is_read": False},
        {
            "$set": {
                "is_read": True,
                "read_at": datetime.now()
            }
        }
    )

    return result.modified_count


# ===========================================
# DELETE NOTIFICATIONS
# ===========================================

async def delete_notification(user_id: str, notification_id: str) -> bool:
    """Delete a single notification."""
    collection = get_notifications_collection()

    result = await collection.delete_one({
        "id": notification_id,
        "user_id": user_id
    })

    return result.deleted_count > 0


async def delete_all_read(user_id: str) -> int:
    """Delete all read notifications for a user."""
    collection = get_notifications_collection()

    result = await collection.delete_many({
        "user_id": user_id,
        "is_read": True
    })

    return result.deleted_count


# ===========================================
# HELPER FUNCTIONS
# ===========================================

def get_time_ago(dt: datetime) -> str:
    """
    Convert datetime to human-readable "time ago" string.

    Examples:
    - "Just now"
    - "5 minutes ago"
    - "2 hours ago"
    - "Yesterday"
    - "3 days ago"
    """
    now = datetime.now()
    diff = now - dt

    seconds = diff.total_seconds()

    if seconds < 60:
        return "Just now"
    elif seconds < 3600:  # Less than 1 hour
        minutes = int(seconds / 60)
        return f"{minutes} minute{'s' if minutes != 1 else ''} ago"
    elif seconds < 86400:  # Less than 1 day
        hours = int(seconds / 3600)
        return f"{hours} hour{'s' if hours != 1 else ''} ago"
    elif seconds < 172800:  # Less than 2 days
        return "Yesterday"
    elif seconds < 604800:  # Less than 1 week
        days = int(seconds / 86400)
        return f"{days} days ago"
    elif seconds < 2592000:  # Less than 30 days
        weeks = int(seconds / 604800)
        return f"{weeks} week{'s' if weeks != 1 else ''} ago"
    else:
        return dt.strftime("%b %d, %Y")