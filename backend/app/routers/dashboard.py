"""
Dashboard Router
================
User-facing dashboard statistics endpoint.
Returns real data for the dashboard page.
"""

from fastapi import APIRouter, Depends
from datetime import datetime

from app.database import (
    get_mappings_collection,
    get_audit_logs_collection,
    get_notifications_collection,
    get_vms_collection
)
from app.middleware.auth import get_current_user


router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats")
async def get_user_dashboard_stats(
    current_user: dict = Depends(get_current_user)
):
    """
    Get dashboard statistics for the current logged-in user.
    
    Returns:
    - VM count (how many VMs user has access to)
    - Password reset count (how many times user reset passwords)
    - Unread notifications count
    - User's VM list with health status
    - Recent activity
    """
    user_id = current_user["sub"]
    
    mappings_collection = get_mappings_collection()
    audit_logs = get_audit_logs_collection()
    notifications_collection = get_notifications_collection()
    vms_collection = get_vms_collection()
    
    # ===== Count User's VMs =====
    vm_count = await mappings_collection.count_documents({"user_id": user_id})
    
    # ===== Count Password Resets by This User =====
    reset_count = await audit_logs.count_documents({
        "user_id": user_id,
        "action": "password_reset"
    })
    
    # ===== Unread Notifications =====
    unread_count = await notifications_collection.count_documents({
        "user_id": user_id,
        "is_read": False
    })
    
    # ===== Get User's VMs with Health Status =====
    user_mappings = await mappings_collection.find(
        {"user_id": user_id}
    ).to_list(length=50)
    
    vm_ids = [m["vm_id"] for m in user_mappings]
    
    user_vms = []
    if vm_ids:
        vms = await vms_collection.find(
            {"id": {"$in": vm_ids}}
        ).to_list(length=50)
        
        for vm in vms:
            # Find corresponding mapping
            mapping = next(
                (m for m in user_mappings if m["vm_id"] == vm["id"]),
                None
            )
            user_vms.append({
                "vm_id": vm["id"],
                "vm_name": vm["name"],
                "ip_address": vm["ip_address"],
                "health_status": vm.get("health_status", "unknown"),
                "local_username": mapping["local_username"] if mapping else "unknown",
                "is_active": vm.get("is_active", True)
            })
    
    # ===== Recent Activity for This User =====
    recent_cursor = audit_logs.find(
        {"user_id": user_id}
    ).sort("timestamp", -1).limit(5)
    
    recent_logs = await recent_cursor.to_list(length=5)
    
    recent_activity = []
    for log in recent_logs:
        recent_activity.append({
            "id": log["id"],
            "action": log["action"],
            "resource_type": log.get("resource_type", ""),
            "details": log.get("details", {}),
            "timestamp": log["timestamp"]
        })
    
    return {
        "vm_count": vm_count,
        "password_resets": reset_count,
        "unread_notifications": unread_count,
        "user_vms": user_vms,
        "recent_activity": recent_activity
    }