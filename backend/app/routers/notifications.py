"""
Notifications Router
API endpoints for user notifications.

Endpoints:
- GET /api/notifications - Get user's notifications
- GET /api/notifications/count - Get unread count only
- PUT /api/notifications/{id}/read - Mark single as read
- PUT /api/notifications/read-all - Mark all as read
- DELETE /api/notifications/{id} - Delete notification
- DELETE /api/notifications/read - Delete all read notifications
"""

from fastapi import APIRouter, Depends, HTTPException, status
from typing import Optional

from app.schemas.notification import (
    NotificationResponse,
    NotificationListResponse,
    NotificationCountResponse,
    MarkAsReadRequest,
    MarkAllReadResponse
)
from app.services.notification_service import (
    get_user_notifications,
    get_unread_count,
    mark_as_read,
    mark_multiple_as_read,
    mark_all_as_read,
    delete_notification,
    delete_all_read
)
from app.middleware.auth import get_current_user


# Create the router
router = APIRouter(
    prefix="/notifications",
    tags=["Notifications"]
)


# ===========================================
# HELPER FUNCTION
# ===========================================

def get_user_id_from_token(current_user: dict) -> str:
    """Extract user ID from JWT token payload."""
    return current_user.get("sub")


# ===========================================
# GET NOTIFICATIONS
# ===========================================

@router.get(
    "",
    response_model=NotificationListResponse,
    summary="Get My Notifications",
    description="Get all notifications for the current user."
)
async def get_notifications(
    current_user: dict = Depends(get_current_user),
    limit: int = 50,
    offset: int = 0,
    unread_only: bool = False
):
    """
    Get notifications for the current user.

    Query Parameters:
    - limit: Max notifications to return (default: 50, 0 = no limit)
    - offset: Skip count for pagination (default: 0)
    - unread_only: If true, only return unread notifications (default: false)
    """
    user_id = get_user_id_from_token(current_user)

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )

    result = await get_user_notifications(
        user_id=user_id,
        limit=limit,
        offset=offset,
        unread_only=unread_only
    )

    return NotificationListResponse(
        notifications=result["notifications"],
        total=result["total"],
        unread_count=result["unread_count"]
    )


@router.get(
    "/count",
    response_model=NotificationCountResponse,
    summary="Get Unread Count",
    description="Get the count of unread notifications."
)
async def get_notification_count(
    current_user: dict = Depends(get_current_user)
):
    """Get unread notification count."""
    user_id = get_user_id_from_token(current_user)

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )

    count = await get_unread_count(user_id)

    return NotificationCountResponse(unread_count=count)


# ===========================================
# MARK AS READ
# ===========================================

@router.put(
    "/{notification_id}/read",
    summary="Mark as Read",
    description="Mark a single notification as read."
)
async def mark_notification_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Mark a single notification as read."""
    user_id = get_user_id_from_token(current_user)

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )

    success = await mark_as_read(user_id, notification_id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )

    return {"message": "Notification marked as read"}


@router.put(
    "/read-multiple",
    response_model=MarkAllReadResponse,
    summary="Mark Multiple as Read",
    description="Mark multiple notifications as read."
)
async def mark_multiple_read(
    request: MarkAsReadRequest,
    current_user: dict = Depends(get_current_user)
):
    """Mark multiple notifications as read."""
    user_id = get_user_id_from_token(current_user)

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )

    count = await mark_multiple_as_read(user_id, request.notification_ids)

    return MarkAllReadResponse(
        message=f"Marked {count} notifications as read",
        marked_count=count
    )


@router.put(
    "/read-all",
    response_model=MarkAllReadResponse,
    summary="Mark All as Read",
    description="Mark all notifications as read."
)
async def mark_all_read(
    current_user: dict = Depends(get_current_user)
):
    """Mark all notifications as read."""
    user_id = get_user_id_from_token(current_user)

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )

    count = await mark_all_as_read(user_id)

    return MarkAllReadResponse(
        message=f"Marked {count} notifications as read",
        marked_count=count
    )


# ===========================================
# DELETE NOTIFICATIONS
# ===========================================

@router.delete(
    "/clear-read",
    summary="Clear Read Notifications",
    description="Delete all read notifications."
)
async def clear_read_notifications(
    current_user: dict = Depends(get_current_user)
):
    """Delete all read notifications."""
    user_id = get_user_id_from_token(current_user)

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )

    count = await delete_all_read(user_id)

    return {
        "message": f"Deleted {count} read notifications",
        "deleted_count": count
    }


@router.delete(
    "/{notification_id}",
    summary="Delete Notification",
    description="Delete a single notification."
)
async def delete_single_notification(
    notification_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a single notification."""
    user_id = get_user_id_from_token(current_user)

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )

    success = await delete_notification(user_id, notification_id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )

    return {"message": "Notification deleted"}