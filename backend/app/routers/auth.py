"""
Authentication Router
Handles user signup, login, logout, forgot password, and profile endpoints.

Features:
- Rate limiting protection
- Admin notifications for new signups
- Security alerts for failed login attempts
- Welcome notifications for new users
- Token blacklist for secure logout (NEW!)
"""

from fastapi import APIRouter, HTTPException, status, Depends, Request, BackgroundTasks
from datetime import datetime
from collections import defaultdict
import time

from app.schemas import (
    SignupRequest, SignupResponse,
    LoginRequest, LoginResponse,
    UserResponse, MessageResponse,
)
from app.schemas.auth import ForgotPasswordRequest, ResetPasswordRequest
from app.utils.security import (
    hash_password, verify_password,
    create_access_token, generate_uuid,
    validate_password_strength,
    generate_reset_token, create_reset_token_data
)
from app.utils.captcha import verify_captcha
from app.utils.email import (
    send_email,
    get_password_reset_email_html,
    get_password_reset_email_text
)
from app.utils.rate_limiter import limiter
from app.database import get_users_collection, get_database
from app.middleware.auth import get_current_user, get_token_from_request
from app.config import settings
from app.services.notification_service import (
    notify_welcome,
    notify_admins_user_signup,
    create_notification
)
from app.services.token_service import blacklist_token  # NEW!
from app.models.notification import NotificationType, NotificationPriority


router = APIRouter(prefix="/auth", tags=["Authentication"])


# ===========================================
# FAILED LOGIN TRACKING (For Security Alerts)
# ===========================================

# Track failed login attempts per IP
# Structure: {ip_address: [(timestamp, username), ...]}
_failed_login_attempts = defaultdict(list)

# Settings for security alerts
FAILED_LOGIN_THRESHOLD = 5  # Number of failed attempts to trigger alert
FAILED_LOGIN_WINDOW = 300   # Time window in seconds (5 minutes)


def get_client_ip(request: Request) -> str:
    """Extract client IP from request."""
    # Check for X-Forwarded-For header (behind proxy)
    forwarded = request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
    if forwarded:
        return forwarded

    # Check for X-Real-IP header
    real_ip = request.headers.get("X-Real-IP", "").strip()
    if real_ip:
        return real_ip

    # Direct connection
    if request.client and request.client.host:
        return request.client.host

    return "unknown"


async def track_failed_login(ip_address: str, username: str):
    """
    Track a failed login attempt and trigger security alert if threshold exceeded.
    """
    current_time = time.time()

    # Add this failed attempt
    _failed_login_attempts[ip_address].append((current_time, username))

    # Clean up old attempts (outside the window)
    _failed_login_attempts[ip_address] = [
        (ts, user) for ts, user in _failed_login_attempts[ip_address]
        if current_time - ts < FAILED_LOGIN_WINDOW
    ]

    # Check if threshold exceeded
    recent_attempts = _failed_login_attempts[ip_address]

    if len(recent_attempts) >= FAILED_LOGIN_THRESHOLD:
        # Get unique usernames attempted
        attempted_users = list(set([user for _, user in recent_attempts]))
        
        # Trigger security alert to admins
        await notify_admins_security_alert(
            ip_address=ip_address,
            attempt_count=len(recent_attempts),
            attempted_usernames=attempted_users
        )
        
        # Clear the attempts after alerting (to avoid spam)
        _failed_login_attempts[ip_address] = []


async def notify_admins_security_alert(
    ip_address: str,
    attempt_count: int,
    attempted_usernames: list
):
    """
    Notify all admins about suspicious login activity.
    """
    users_collection = get_users_collection()

    # Find all admin and superadmin users
    admin_cursor = users_collection.find({
        "role": {"$in": ["admin", "superadmin"]},
        "is_active": True
    })

    admins = await admin_cursor.to_list(length=100)

    if not admins:
        print("⚠️ No active admins found for security alert")
        return 0

    # Format the usernames list
    usernames_str = ", ".join(attempted_usernames[:5])
    if len(attempted_usernames) > 5:
        usernames_str += f" and {len(attempted_usernames) - 5} more"

    notifications_created = 0

    for admin in admins:
        await create_notification(
            user_id=admin["id"],
            notification_type=NotificationType.ADMIN_SECURITY_ALERT,
            title="Suspicious Login Activity Detected",
            message=(
                f"Multiple failed login attempts detected from IP {ip_address}. "
                f"{attempt_count} failed attempts in the last 5 minutes. "
                f"Attempted usernames: {usernames_str}. "
                f"This could indicate a brute force attack."
            ),
            priority=NotificationPriority.URGENT,
            action_url="/admin/audit-logs"
        )
        
        notifications_created += 1
        print(f"🚨 Security alert sent to admin: {admin['username']}")

    print(f"🚨 Security alerts sent to {notifications_created} admins")

    return notifications_created


# ===========================================
# SIGNUP ENDPOINT (Rate Limited: 3/minute)
# ===========================================
@router.post("/signup", response_model=SignupResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(settings.RATE_LIMIT_SIGNUP)
async def signup(request: Request, signup_data: SignupRequest):
    """
    Register a new user account.

    Rate Limit: 3 attempts per minute per IP
    Requires reCAPTCHA v2 verification.

    Triggers:
    - Welcome notification for the new user
    - Admin notification about new signup
    """
    import re
    users = get_users_collection()

    # Step 1: Verify Math CAPTCHA
    verify_captcha(signup_data.captcha_token, signup_data.captcha_answer)

    # Step 2: Validate password strength
    is_valid, error_msg = validate_password_strength(signup_data.password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg
        )

    # Step 3: Check if username already exists (case-insensitive)
    username_pattern = re.compile(f"^{re.escape(signup_data.username)}$", re.IGNORECASE)
    existing_user = await users.find_one({"username": username_pattern})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )

    # Step 4: Check if email already exists (case-insensitive)
    email_pattern = re.compile(f"^{re.escape(signup_data.email)}$", re.IGNORECASE)
    existing_email = await users.find_one({"email": email_pattern})
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Step 5: Create user document (preserve original username case)
    user_id = generate_uuid()
    user_doc = {
        "id": user_id,
        "username": signup_data.username,
        "email": signup_data.email,
        "password_hash": hash_password(signup_data.password),
        "full_name": signup_data.full_name,
        "role": "user",
        "is_active": True,
        "two_factor_enabled": False,
        "two_factor_secret": None,
        "created_at": datetime.now(),
        "updated_at": datetime.now(),
        "last_login": None
    }

    await users.insert_one(user_doc)

    print(f"✅ New user registered: {signup_data.username}")

    # ===========================================
    # NOTIFICATIONS
    # ===========================================

    # Send welcome notification to the new user
    try:
        await notify_welcome(
            user_id=user_id,
            username=signup_data.username
        )
        print(f"🔔 Welcome notification sent to: {signup_data.username}")
    except Exception as e:
        print(f"⚠️ Failed to send welcome notification: {e}")

    # Notify all admins about the new signup
    try:
        admin_count = await notify_admins_user_signup(
            new_user_id=user_id,
            new_username=signup_data.username,
            new_email=signup_data.email,
            new_full_name=signup_data.full_name
        )
        print(f"📢 Admin signup notifications sent: {admin_count}")
    except Exception as e:
        print(f"⚠️ Failed to send admin notifications: {e}")

    return SignupResponse(
        message="User registered successfully",
        user_id=user_id
    )


# ===========================================
# LOGIN ENDPOINT (Rate Limited: 5/minute)
# ===========================================
@router.post("/login", response_model=LoginResponse)
@limiter.limit(settings.RATE_LIMIT_LOGIN)
async def login(request: Request, login_data: LoginRequest):
    """
    Login and get JWT token.

    Rate Limit: 5 attempts per minute per IP
    Optionally verifies reCAPTCHA v3.

    Security:
    - Tracks failed login attempts
    - Alerts admins after 5 failed attempts from same IP
    """
    users = get_users_collection()

    # Get client IP for tracking
    client_ip = get_client_ip(request)

    # Step 1: Verify Math CAPTCHA
    verify_captcha(login_data.captcha_token, login_data.captcha_answer)

    # Step 2: Find user (case-insensitive search)
    import re
    username_pattern = re.compile(f"^{re.escape(login_data.username)}$", re.IGNORECASE)
    user = await users.find_one({"username": username_pattern})

    if not user:
        print(f"⚠️ Failed login attempt for non-existent user: {login_data.username} from IP: {client_ip}")
        
        # Track failed attempt
        await track_failed_login(client_ip, login_data.username)
        
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )

    # Step 3: Verify password
    if not verify_password(login_data.password, user["password_hash"]):
        print(f"⚠️ Failed login attempt for user: {login_data.username} (wrong password) from IP: {client_ip}")
        
        # Track failed attempt
        await track_failed_login(client_ip, login_data.username)
        
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )

    # Step 4: Check if user is active
    if not user.get("is_active", True):
        print(f"⚠️ Login attempt for deactivated user: {login_data.username}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated"
        )

    # Step 5: Generate JWT token
    token_data = {
        "sub": user["id"],
        "username": user["username"],
        "role": user["role"]
    }
    access_token = create_access_token(token_data)

    # Step 6: Update last_login
    await users.update_one(
        {"id": user["id"]},
        {"$set": {"last_login": datetime.now()}}
    )

    # Clear failed login attempts for this IP on successful login
    if client_ip in _failed_login_attempts:
        del _failed_login_attempts[client_ip]

    print(f"✅ User logged in: {user['username']} from IP: {client_ip}")

    # Step 7: Return response
    user_response = UserResponse(
        id=user["id"],
        username=user["username"],
        email=user["email"],
        full_name=user["full_name"],
        role=user["role"],
        is_active=user["is_active"],
        created_at=user["created_at"],
        last_login=datetime.now()
    )

    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_response
    )


# ===========================================
# LOGOUT ENDPOINT (NOW WITH TOKEN BLACKLIST!)
# ===========================================
@router.post("/logout", response_model=MessageResponse)
async def logout(
    current_user: dict = Depends(get_current_user),
    token: str = Depends(get_token_from_request)
):
    """
    Logout the user and invalidate their token.

    Security Features:
    - Adds token to blacklist database
    - Token cannot be used again even if not expired
    - Protects against token theft
    """
    username = current_user.get('username', 'unknown')
    user_id = current_user.get('sub', '')

    # Blacklist the token
    blacklist_success = await blacklist_token(
        token=token,
        user_id=user_id,
        reason="logout"
    )

    if blacklist_success:
        print(f"👋 User logged out (token blacklisted): {username}")
    else:
        # Even if blacklisting fails, we still return success
        # The token will eventually expire anyway
        print(f"⚠️ User logged out (blacklist failed, token will expire): {username}")

    return MessageResponse(message="Logged out successfully")


# ===========================================
# GET CURRENT USER ENDPOINT
# ===========================================
@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(current_user: dict = Depends(get_current_user)):
    """Get the current user's profile."""
    users = get_users_collection()

    user = await users.find_one({"id": current_user["sub"]})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    return UserResponse(
        id=user["id"],
        username=user["username"],
        email=user["email"],
        full_name=user["full_name"],
        role=user["role"],
        is_active=user["is_active"],
        created_at=user["created_at"],
        last_login=user.get("last_login")
    )


# ===========================================
# VERIFY PASSWORD ENDPOINT (Security Confirmation)
# ===========================================
from app.schemas.auth import PasswordVerifyRequest

@router.post("/verify-password", response_model=MessageResponse)
async def verify_password_endpoint(
    request: Request,
    verify_data: PasswordVerifyRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Verify the current user's password.
    Used before critical actions like VM reboot or shutdown.
    """
    users = get_users_collection()
    user = await users.find_one({"id": current_user["sub"]})

    if not user or not verify_password(verify_data.password, user["password_hash"]):
        print(f"⚠️ Failed password verification for user: {current_user.get('username')} from IP: {get_client_ip(request)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password"
        )

    return MessageResponse(message="Password verified")


# ===========================================
# FORGOT PASSWORD ENDPOINT (Rate Limited: 3/minute)
# ===========================================
@router.post("/forgot-password", response_model=MessageResponse)
@limiter.limit(settings.RATE_LIMIT_FORGOT_PASSWORD)
async def forgot_password(request: Request, forgot_data: ForgotPasswordRequest, background_tasks: BackgroundTasks):
    """
    Request a password reset email.

    Rate Limit: 3 attempts per minute per IP
    Requires reCAPTCHA v2 verification.
    """
    users = get_users_collection()
    db = get_database()

    # Step 1: Verify Math CAPTCHA
    verify_captcha(forgot_data.captcha_token, forgot_data.captcha_answer)

    # Step 2: Find user by email (case-insensitive)
    import re
    email_pattern = re.compile(f"^{re.escape(forgot_data.email)}$", re.IGNORECASE)
    user = await users.find_one({"email": email_pattern})

    # Always return success message (don't reveal if email exists)
    success_message = "If an account with that email exists, a password reset link has been sent."

    if not user:
        print(f"⚠️ Forgot password request for non-existent email: {forgot_data.email}")
        return MessageResponse(message=success_message)

    # Step 3: Generate reset token
    reset_token = generate_reset_token()
    token_data = create_reset_token_data(user["id"], reset_token)

    # Step 4: Store token in database
    await db.password_reset_tokens.insert_one(token_data)

    # Step 5: Create reset link
    reset_link = f"{settings.FRONTEND_URL}/reset-password?token={reset_token}"

    # Step 6: Send email asynchronously in the background
    async def send_email_wrapper(email: str, link: str, name: str):
        try:
            email_result = await send_email(
                to_email=email,
                subject="Password Reset Request - Password Portal",
                html_content=get_password_reset_email_html(link, name),
                text_content=get_password_reset_email_text(link, name)
            )
            if not email_result.get("success", False):
                print(f"⚠️ Failed to send async email to {email}: {email_result.get('error')}")
            else:
                print(f"📧 Async password reset email sent to: {email}")
        except Exception as e:
            print(f"⚠️ Exception sending async email to {email}: {e}")

    background_tasks.add_task(
        send_email_wrapper,
        user["email"],
        reset_link,
        user["full_name"]
    )
    print(f"🕒 Password reset email queued in background for {user['email']}")

    return MessageResponse(message=success_message)


# ===========================================
# RESET PASSWORD ENDPOINT
# ===========================================
@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(request: Request, reset_data: ResetPasswordRequest):
    """
    Reset password using the token from email.
    """
    users = get_users_collection()
    db = get_database()

    # Step 1: Find the reset token
    token_doc = await db.password_reset_tokens.find_one({
        "token": reset_data.token,
        "used": False
    })

    if not token_doc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )

    # Step 2: Check if token is expired
    if datetime.now() > token_doc["expires_at"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token has expired. Please request a new one."
        )

    # Step 3: Validate new password
    is_valid, error_msg = validate_password_strength(reset_data.new_password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg
        )

    # Step 4: Find the user
    user = await users.find_one({"id": token_doc["user_id"]})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Step 5: Update password
    new_password_hash = hash_password(reset_data.new_password)
    await users.update_one(
        {"id": user["id"]},
        {
            "$set": {
                "password_hash": new_password_hash,
                "updated_at": datetime.now()
            }
        }
    )

    # Step 6: Mark token as used
    await db.password_reset_tokens.update_one(
        {"token": reset_data.token},
        {"$set": {"used": True}}
    )

    # Step 7: Invalidate all other reset tokens for this user
    await db.password_reset_tokens.update_many(
        {"user_id": user["id"], "used": False},
        {"$set": {"used": True}}
    )

    print(f"✅ Password reset completed for user: {user['username']}")

    return MessageResponse(message="Password has been reset successfully. You can now login with your new password.")


# ===========================================
# VERIFY RESET TOKEN ENDPOINT
# ===========================================
@router.get("/verify-reset-token/{token}")
async def verify_reset_token(token: str):
    """
    Verify if a password reset token is valid.
    Used by frontend to check token before showing reset form.
    """
    db = get_database()

    token_doc = await db.password_reset_tokens.find_one({
        "token": token,
        "used": False
    })

    if not token_doc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )

    if datetime.now() > token_doc["expires_at"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token has expired"
        )

    return {"valid": True, "message": "Token is valid"}