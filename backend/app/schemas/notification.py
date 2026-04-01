"""
Notification Schemas
Request/response schemas for notification endpoints.
"""

from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime


# ===========================================
# RESPONSE SCHEMAS
# ===========================================

class NotificationResponse(BaseModel):
    """Single notification response."""
    id: str
    type: str
    title: str
    message: str
    priority: str
    is_read: bool
    related_vm_id: Optional[str] = None
    action_url: Optional[str] = None
    created_at: datetime
    read_at: Optional[datetime] = None

    # Human-readable time (e.g., "2 hours ago")
    time_ago: Optional[str] = None


class NotificationListResponse(BaseModel):
    """List of notifications response."""
    notifications: List[NotificationResponse]
    total: int
    unread_count: int


class NotificationCountResponse(BaseModel):
    """Just the unread count."""
    unread_count: int


# ===========================================
# REQUEST SCHEMAS
# ===========================================

class MarkAsReadRequest(BaseModel):
    """Request to mark notifications as read."""
    notification_ids: List[str] = Field(..., description="List of notification IDs to mark as read")


class MarkAllReadResponse(BaseModel):
    """Response after marking notifications as read."""
    message: str
    marked_count: int