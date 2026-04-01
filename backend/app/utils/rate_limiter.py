"""
Custom Rate Limiter
A simple, custom rate limiter that doesn't depend on slowapi's Config.
This avoids the Windows .env encoding issues.

Rate limits are applied per-IP address:
- Login: 5 attempts per minute
- Signup: 3 attempts per minute
- Forgot Password: 3 attempts per minute
- Password Reset: 5 attempts per minute
- General API: 100 requests per minute
"""

import time
from collections import defaultdict
from functools import wraps
from typing import Callable, Dict, Optional, Tuple
from fastapi import Request, HTTPException, status


# ===========================================
# IN-MEMORY STORAGE FOR RATE LIMITS
# ===========================================

# Structure: {ip_address: {endpoint: [(timestamp1, timestamp2, ...)]}}
_request_history: Dict[str, Dict[str, list]] = defaultdict(lambda: defaultdict(list))


# ===========================================
# IP ADDRESS DETECTION
# ===========================================

def get_real_client_ip(request: Request) -> str:
    """
    Get the real client IP address, considering reverse proxy headers.

    When behind Nginx or other reverse proxies, the client IP is in headers.
    Order of precedence:
    1. X-Forwarded-For (standard proxy header)
    2. X-Real-IP (Nginx specific)
    3. Direct client connection
    """

    # Check for X-Forwarded-For header (common with proxies)
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()

    # Check for X-Real-IP header (Nginx specific)
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()

    # Fallback to direct client IP
    if request.client and request.client.host:
        return request.client.host

    return "127.0.0.1"


# ===========================================
# RATE LIMIT PARSING
# ===========================================

def parse_rate_limit(limit_string: str) -> Tuple[int, int]:
    """
    Parse a rate limit string like "5/minute" into (max_requests, window_seconds).

    Supported formats:
    - "5/minute" -> (5, 60)
    - "10/hour" -> (10, 3600)
    - "100/day" -> (100, 86400)
    - "3/second" -> (3, 1)
    """
    try:
        count, period = limit_string.split("/")
        count = int(count)
        
        period_map = {
            "second": 1,
            "minute": 60,
            "hour": 3600,
            "day": 86400,
        }
        
        seconds = period_map.get(period.lower(), 60)
        return (count, seconds)
    except Exception:
        # Default: 100 per minute
        return (100, 60)


# ===========================================
# RATE LIMIT CHECK FUNCTION
# ===========================================

def is_rate_limited(ip: str, endpoint: str, max_requests: int, window_seconds: int) -> Tuple[bool, int]:
    """
    Check if an IP is rate limited for a specific endpoint.

    Args:
        ip: Client IP address
        endpoint: API endpoint identifier
        max_requests: Maximum requests allowed in the window
        window_seconds: Time window in seconds

    Returns:
        Tuple of (is_limited, retry_after_seconds)
    """
    current_time = time.time()
    window_start = current_time - window_seconds

    # Get request history for this IP and endpoint
    history = _request_history[ip][endpoint]

    # Remove old entries outside the window
    history[:] = [t for t in history if t > window_start]

    # Check if limit exceeded
    if len(history) >= max_requests:
        # Calculate retry-after time
        oldest_request = min(history)
        retry_after = int(oldest_request + window_seconds - current_time) + 1
        return (True, max(1, retry_after))

    # Add current request to history
    history.append(current_time)

    return (False, 0)


# ===========================================
# RATE LIMIT DECORATOR
# ===========================================

def rate_limit(limit_string: str, endpoint_name: Optional[str] = None):
    """
    Rate limit decorator for FastAPI endpoints.

    Usage:
        @router.post("/login")
        @rate_limit("5/minute")
        async def login(request: Request, ...):
            ...

    Args:
        limit_string: Rate limit like "5/minute", "10/hour"
        endpoint_name: Optional custom endpoint identifier
    """
    max_requests, window_seconds = parse_rate_limit(limit_string)

    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Find the Request object in args or kwargs
            request = None
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
            if request is None:
                request = kwargs.get("request")
            
            if request is None:
                # No request object found, skip rate limiting
                return await func(*args, **kwargs)
            
            # Get client IP
            ip = get_real_client_ip(request)
            
            # Determine endpoint name
            ep_name = endpoint_name or f"{request.method}:{request.url.path}"
            
            # Check rate limit
            is_limited, retry_after = is_rate_limited(ip, ep_name, max_requests, window_seconds)
            
            if is_limited:
                # Get custom message based on endpoint
                message = get_rate_limit_message(ep_name, retry_after)
                
                print(f"🚫 Rate limit exceeded for {ip} on {ep_name} (retry in {retry_after}s)")
                
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail={
                        "error": "rate_limit_exceeded",
                        "message": message,
                        "retry_after_seconds": retry_after
                    },
                    headers={"Retry-After": str(retry_after)}
                )
            
            return await func(*args, **kwargs)
        
        return wrapper
    return decorator


# ===========================================
# LIMITER CLASS (Compatible Interface)
# ===========================================

class CustomLimiter:
    """
    A custom rate limiter class with an interface similar to slowapi's Limiter.
    This avoids the encoding issues with slowapi on Windows.
    """

    def __init__(self, key_func: Callable = None, default_limits: list = None):
        self.key_func = key_func or get_real_client_ip
        self.default_limits = default_limits or ["100/minute"]

    def limit(self, limit_string: str, endpoint_name: Optional[str] = None):
        """
        Decorator to apply rate limiting to an endpoint.
        
        Usage:
            @router.post("/login")
            @limiter.limit("5/minute")
            async def login(request: Request, ...):
                ...
        """
        return rate_limit(limit_string, endpoint_name)


# ===========================================
# CREATE THE LIMITER INSTANCE
# ===========================================

limiter = CustomLimiter(
    key_func=get_real_client_ip,
    default_limits=["100/minute"]
)

print("✅ Custom rate limiter initialized successfully")


# ===========================================
# CUSTOM ERROR MESSAGES
# ===========================================

RATE_LIMIT_MESSAGES = {
    "login": "Too many login attempts. Please try again in {retry_after} seconds.",
    "signup": "Too many signup attempts. Please try again in {retry_after} seconds.",
    "forgot_password": "Too many password reset requests. Please try again in {retry_after} seconds.",
    "forgot-password": "Too many password reset requests. Please try again in {retry_after} seconds.",
    "password_reset": "Too many password reset attempts. Please try again in {retry_after} seconds.",
    "reset": "Too many password reset attempts. Please try again in {retry_after} seconds.",
    "general": "Too many requests. Please slow down and try again in {retry_after} seconds.",
}


def get_rate_limit_message(endpoint: str, retry_after: int = 60) -> str:
    """Get a user-friendly rate limit message based on the endpoint."""

    # Try to match endpoint to a known message
    endpoint_lower = endpoint.lower()

    for key, message in RATE_LIMIT_MESSAGES.items():
        if key in endpoint_lower:
            return message.format(retry_after=retry_after)

    # Default message
    return RATE_LIMIT_MESSAGES["general"].format(retry_after=retry_after)


# ===========================================
# CLEANUP FUNCTION (Optional)
# ===========================================

def cleanup_old_entries(max_age_seconds: int = 3600):
    """
    Clean up old entries from the request history.
    Call this periodically to prevent memory leaks.
    """
    current_time = time.time()
    cutoff = current_time - max_age_seconds

    for ip in list(_request_history.keys()):
        for endpoint in list(_request_history[ip].keys()):
            _request_history[ip][endpoint] = [
                t for t in _request_history[ip][endpoint] if t > cutoff
            ]
            # Remove empty endpoint entries
            if not _request_history[ip][endpoint]:
                del _request_history[ip][endpoint]
        # Remove empty IP entries
        if not _request_history[ip]:
            del _request_history[ip]