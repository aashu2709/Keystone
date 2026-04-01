"""
Token Service
Handles JWT token blacklist operations for secure logout.

How it works:
- When user logs out, their token is added to blacklist
- Every authenticated request checks if token is blacklisted
- Blacklisted tokens are rejected (401 Unauthorized)
- Expired tokens are automatically cleaned up by MongoDB TTL index

Security Benefits:
- Prevents token reuse after logout
- Protects against stolen tokens
- Allows "logout from all devices" functionality
"""

from datetime import datetime
from typing import Optional
import hashlib

from app.database import get_token_blacklist_collection
from app.utils.security import verify_access_token


def hash_token(token: str) -> str:
    """
    Hash the token before storing in database.

    We store a hash instead of the actual token for security:
    - If database is compromised, attacker can't use the tokens
    - Smaller storage size
    - Fast comparison
    """
    return hashlib.sha256(token.encode()).hexdigest()


async def blacklist_token(
    token: str,
    user_id: str,
    reason: str = "logout"
) -> bool:
    """
    Add a token to the blacklist.

    Args:
        token: The JWT token to blacklist
        user_id: The user's ID
        reason: Why the token was blacklisted (logout, security, etc.)

    Returns:
        True if successful, False otherwise
    """
    collection = get_token_blacklist_collection()

    # Decode token to get expiry time
    payload = verify_access_token(token)

    if not payload:
        # Token is already invalid, no need to blacklist
        return False

    # Get token expiry time
    exp_timestamp = payload.get("exp")
    if exp_timestamp:
        expires_at = datetime.fromtimestamp(exp_timestamp)
    else:
        # If no expiry, set to 24 hours from now
        from datetime import timedelta
        expires_at = datetime.now() + timedelta(hours=24)

    # Hash the token
    token_hash = hash_token(token)

    # Create blacklist document
    blacklist_doc = {
        "token": token_hash,
        "user_id": user_id,
        "reason": reason,
        "blacklisted_at": datetime.now(),
        "expires_at": expires_at  # MongoDB TTL will auto-delete after this
    }

    try:
        await collection.insert_one(blacklist_doc)
        print(f"🔒 Token blacklisted for user: {user_id} (reason: {reason})")
        return True
    except Exception as e:
        # Duplicate key error means token already blacklisted
        if "duplicate key" in str(e).lower():
            print(f"⚠️ Token already blacklisted for user: {user_id}")
            return True
        print(f"❌ Failed to blacklist token: {e}")
        return False


async def is_token_blacklisted(token: str) -> bool:
    """
    Check if a token is blacklisted.

    Args:
        token: The JWT token to check

    Returns:
        True if blacklisted, False otherwise
    """
    collection = get_token_blacklist_collection()

    # Hash the token
    token_hash = hash_token(token)

    # Check if exists in blacklist
    result = await collection.find_one({"token": token_hash})

    return result is not None


async def blacklist_all_user_tokens(
    user_id: str,
    reason: str = "logout_all"
) -> int:
    """
    Blacklist all tokens for a user (logout from all devices).

    Note: This doesn't actually blacklist existing tokens (we don't store them).
    Instead, we store a "blacklist all before" timestamp.

    For a simple implementation, we'll just note this capability.
    The actual implementation would require storing all active tokens
    or using a different approach (token versioning).

    Args:
        user_id: The user's ID
        reason: Why tokens are being blacklisted

    Returns:
        Number of tokens blacklisted (0 for this simple implementation)
    """
    # For now, this is a placeholder
    # A full implementation would either:
    # 1. Store all active tokens and blacklist them
    # 2. Use a "token version" approach in user document
    # 3. Store a "tokens_invalid_before" timestamp

    print(f"⚠️ blacklist_all_user_tokens called for user: {user_id} (not fully implemented)")
    return 0


async def cleanup_expired_tokens() -> int:
    """
    Manually cleanup expired tokens from blacklist.

    Note: MongoDB TTL index handles this automatically,
    but this can be called for immediate cleanup if needed.

    Returns:
        Number of tokens removed
    """
    collection = get_token_blacklist_collection()

    result = await collection.delete_many({
        "expires_at": {"$lt": datetime.now()}
    })

    if result.deleted_count > 0:
        print(f"🧹 Cleaned up {result.deleted_count} expired tokens from blacklist")

    return result.deleted_count


async def get_blacklist_stats() -> dict:
    """
    Get statistics about the token blacklist.

    Returns:
        Dictionary with blacklist statistics
    """
    collection = get_token_blacklist_collection()

    total_count = await collection.count_documents({})

    # Count by reason
    logout_count = await collection.count_documents({"reason": "logout"})
    security_count = await collection.count_documents({"reason": "security"})
    other_count = total_count - logout_count - security_count

    return {
        "total_blacklisted": total_count,
        "by_reason": {
            "logout": logout_count,
            "security": security_count,
            "other": other_count
        }
    }