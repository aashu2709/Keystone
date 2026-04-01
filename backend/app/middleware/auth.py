"""
Authentication Middleware
This handles JWT token validation for protected routes.

Updated: Now checks token blacklist for secure logout

Middleware Concept:
- Code that runs BEFORE your route handler
- Used for authentication, logging, etc.
- In FastAPI, we use "Dependencies" for this

Security Flow:
1. Extract token from Authorization header
2. Verify token signature and expiry
3. Check if token is blacklisted (NEW!)
4. Verify user still exists and is active
5. Return user payload or reject request
"""

from fastapi import HTTPException, status, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.utils.security import verify_access_token
from app.database import get_users_collection
from app.services.token_service import is_token_blacklisted


# HTTPBearer extracts the token from "Authorization: Bearer <token>" header
security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """
    Dependency that extracts and validates the JWT token.

    Now includes blacklist check for secure logout!

    Usage in route:
        @router.get("/protected")
        async def protected_route(current_user: dict = Depends(get_current_user)):
            # current_user contains the token payload
            pass

    Returns the token payload: {"sub": "user-id", "username": "...", "role": "..."}

    Raises:
        401 Unauthorized: If token is invalid, expired, or blacklisted
    """
    token = credentials.credentials

    # Step 1: Verify the token signature and expiry
    payload = verify_access_token(token)

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"}
        )

    # Step 2: Check if token is blacklisted (NEW!)
    if await is_token_blacklisted(token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked. Please login again.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    # Token is valid and not blacklisted
    return payload


async def get_current_active_user(
    current_user: dict = Depends(get_current_user)
) -> dict:
    """
    Get current user and verify they're still active.

    This adds an extra database check to ensure:
    - User still exists (wasn't deleted)
    - User is still active (wasn't deactivated)
    """
    users = get_users_collection()
    user = await users.find_one({"id": current_user["sub"]})

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated"
        )

    return current_user


def require_role(allowed_roles: list[str]):
    """
    Dependency factory for role-based access control.

    Usage:
        @router.get("/admin-only")
        async def admin_route(
            current_user: dict = Depends(require_role(["admin", "superadmin"]))
        ):
            pass
    """
    async def role_checker(
        current_user: dict = Depends(get_current_active_user)
    ) -> dict:
        if current_user.get("role") not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )
        return current_user

    return role_checker


# Pre-made role dependencies for convenience
require_admin = require_role(["admin", "superadmin"])
require_superadmin = require_role(["superadmin"])


# ===========================================
# OPTIONAL: Get token from request
# ===========================================

async def get_token_from_request(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> str:
    """
    Get the raw JWT token from the request.

    Useful when you need the actual token (e.g., for blacklisting).

    Usage:
        @router.post("/logout")
        async def logout(token: str = Depends(get_token_from_request)):
            # Now you have the actual token string
            pass
    """
    return credentials.credentials