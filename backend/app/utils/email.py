# backend/app/utils/email.py
"""
Email Utility
Handles sending emails for password reset, notifications, etc.

Updated: Added password expiry email templates
"""

import smtplib
import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
import asyncio
from app.config import settings


async def send_email(
    to_email: str,
    subject: str,
    html_content: str,
    text_content: Optional[str] = None
) -> dict:
    """
    Send an email using SMTP.

    Args:
        to_email: Recipient email address
        subject: Email subject
        html_content: HTML body of the email
        text_content: Plain text body (optional fallback)
        
    Returns:
        dict: {"success": bool, "error": Optional[str]}
    """

    # Check if email is configured
    if not settings.SMTP_USERNAME or not settings.SMTP_PASSWORD:
        print("⚠️ Email not configured. Would have sent:")
        print(f"   To: {to_email}")
        print(f"   Subject: {subject}")
        return {"success": True, "error": None, "message": "Email not configured (dev mode)"}

    try:
        # Create message
        message = MIMEMultipart("alternative")
        message["Subject"] = subject
        message["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
        message["To"] = to_email
        
        # Add text and HTML parts
        if text_content:
            part1 = MIMEText(text_content, "plain")
            message.attach(part1)
        
        part2 = MIMEText(html_content, "html")
        message.attach(part2)
        
        # Send email in a thread pool to not block async
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _send_smtp_email, message, to_email)
        
        print(f"✅ Email sent to: {to_email}")
        return {"success": True, "error": None}
        
    except smtplib.SMTPAuthenticationError:
        return {"success": False, "error": "SMTP authentication failed. Check username/password."}
    except smtplib.SMTPException as e:
        return {"success": False, "error": f"SMTP error: {str(e)}"}
    except Exception as e:
        return {"success": False, "error": f"Failed to send email: {str(e)}"}


def _send_smtp_email(message: MIMEMultipart, to_email: str):
    """Synchronous SMTP send (runs in thread pool)."""
    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
        server.starttls()
        server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        server.sendmail(
            settings.SMTP_FROM_EMAIL,
            to_email,
            message.as_string()
        )


# ===========================================
# PASSWORD RESET EMAIL TEMPLATES
# ===========================================

def get_password_reset_email_html(reset_link: str, user_name: str) -> str:
    """Generate HTML content for password reset email."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header bar -->
          <tr>
            <td style="background-color:#1e40af;border-radius:8px 8px 0 0;padding:28px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.3px;">Password Portal</p>
                    <p style="margin:4px 0 0 0;color:#93c5fd;font-size:13px;font-weight:400;">Secure VM Password Management</p>
                  </td>
                  <td align="right">
                    <div style="background-color:#1d4ed8;border-radius:50%;width:44px;height:44px;text-align:center;line-height:44px;font-size:20px;">&#128274;</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body card -->
          <tr>
            <td style="background-color:#ffffff;padding:40px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">

              <h1 style="margin:0 0 6px 0;font-size:22px;font-weight:700;color:#0f172a;">Password Reset Request</h1>
              <p style="margin:0 0 28px 0;font-size:14px;color:#64748b;">This link is valid for 10 minutes.</p>

              <p style="margin:0 0 24px 0;font-size:15px;color:#334155;line-height:1.6;">
                Hello <strong style="color:#0f172a;">{user_name}</strong>,
              </p>

              <p style="margin:0 0 24px 0;font-size:15px;color:#334155;line-height:1.6;">
                We received a request to reset the password for your Password Portal account.
                Click the button below to set a new password. If you did not make this request,
                you can safely ignore this email — your account remains secure.
              </p>

              <!-- CTA button -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:32px auto;">
                <tr>
                  <td style="border-radius:6px;background-color:#1e40af;">
                    <a href="{reset_link}"
                       style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;letter-spacing:0.2px;">
                      Reset My Password
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0;">

              <!-- Fallback link -->
              <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.6;">
                If the button above does not work, copy and paste the following link into your browser:
              </p>
              <p style="margin:8px 0 0 0;font-size:12px;">
                <a href="{reset_link}" style="color:#1e40af;word-break:break-all;">{reset_link}</a>
              </p>

              <!-- Security note -->
              <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-left:3px solid #1e40af;border-radius:4px;padding:14px 16px;margin-top:28px;">
                <p style="margin:0;font-size:13px;color:#475569;line-height:1.5;">
                  <strong style="color:#0f172a;">Security Notice:</strong>
                  This link expires in <strong>10 minutes</strong>. Never share this link with anyone.
                  Password Portal staff will never ask you for your password.
                </p>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                This is an automated message. Please do not reply to this email.
              </p>
              <p style="margin:8px 0 0 0;font-size:12px;color:#cbd5e1;">
                &copy; {datetime.datetime.now().year} Password Portal &nbsp;&bull;&nbsp; All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def get_password_reset_email_text(reset_link: str, user_name: str) -> str:
    """Generate plain text content for password reset email."""
    return f"""Password Reset Request
======================

Hello {user_name},

We received a request to reset the password for your Password Portal account.

Use the link below to reset your password (valid for 10 minutes):

  {reset_link}

If you did not request a password reset, please ignore this email. Your account remains secure.

---
This is an automated message from Password Portal.
Do not reply to this email.
"""


# ===========================================
# PASSWORD EXPIRY EMAIL TEMPLATES
# ===========================================

def get_password_expiry_email_html(
    user_name: str,
    vm_name: str,
    local_username: str,
    days_until_expiry: int,
    portal_url: str
) -> str:
    """Generate HTML content for password expiry warning email."""

    # Urgency band configuration
    if days_until_expiry <= 0:
        band_color    = "#dc2626"
        band_bg       = "#fef2f2"
        band_border   = "#fecaca"
        status_label  = "EXPIRED"
        status_color  = "#dc2626"
        headline      = "Your VM Password Has Expired"
        summary       = (f"The password for <strong>{local_username}</strong> on "
                         f"<strong>{vm_name}</strong> has expired. "
                         f"Please change it immediately to restore access.")
        time_display  = "Expired"
    elif days_until_expiry == 1:
        band_color    = "#dc2626"
        band_bg       = "#fef2f2"
        band_border   = "#fecaca"
        status_label  = "EXPIRES TOMORROW"
        status_color  = "#dc2626"
        headline      = "Your VM Password Expires Tomorrow"
        summary       = (f"The password for <strong>{local_username}</strong> on "
                         f"<strong>{vm_name}</strong> expires tomorrow. "
                         f"Please change it now to avoid losing access.")
        time_display  = "1 day remaining"
    elif days_until_expiry <= 3:
        band_color    = "#ea580c"
        band_bg       = "#fff7ed"
        band_border   = "#fed7aa"
        status_label  = f"EXPIRES IN {days_until_expiry} DAYS"
        status_color  = "#ea580c"
        headline      = f"Your VM Password Expires in {days_until_expiry} Days"
        summary       = (f"The password for <strong>{local_username}</strong> on "
                         f"<strong>{vm_name}</strong> will expire in "
                         f"<strong>{days_until_expiry} days</strong>. Please change it soon.")
        time_display  = f"{days_until_expiry} days remaining"
    else:
        band_color    = "#ca8a04"
        band_bg       = "#fefce8"
        band_border   = "#fef08a"
        status_label  = f"EXPIRES IN {days_until_expiry} DAYS"
        status_color  = "#ca8a04"
        headline      = f"Upcoming VM Password Expiry — {days_until_expiry} Days"
        summary       = (f"The password for <strong>{local_username}</strong> on "
                         f"<strong>{vm_name}</strong> will expire in "
                         f"<strong>{days_until_expiry} days</strong>. Consider changing it now.")
        time_display  = f"{days_until_expiry} days remaining"

    reset_link = f"{portal_url}/vm-password-reset"

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{headline}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background-color:#1e40af;border-radius:8px 8px 0 0;padding:24px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.3px;">Password Portal</p>
                    <p style="margin:4px 0 0 0;color:#93c5fd;font-size:13px;">Secure VM Password Management</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body card -->
          <tr>
            <td style="background-color:#ffffff;padding:40px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">

              <h1 style="margin:0 0 20px 0;font-size:21px;font-weight:700;color:#0f172a;line-height:1.3;">{headline}</h1>

              <p style="margin:0 0 24px 0;font-size:15px;color:#334155;line-height:1.6;">
                Hello <strong style="color:#0f172a;">{user_name}</strong>,
              </p>
              <p style="margin:0 0 28px 0;font-size:15px;color:#334155;line-height:1.6;">
                {summary}
              </p>

              <!-- Details table -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                     style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;margin-bottom:28px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 14px 0;font-size:12px;font-weight:600;color:#64748b;letter-spacing:1px;text-transform:uppercase;">Account Details</p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:6px 0;font-size:13px;color:#64748b;width:140px;">VM Name</td>
                        <td style="padding:6px 0;font-size:13px;color:#0f172a;font-weight:500;">{vm_name}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:13px;color:#64748b;">Local Username</td>
                        <td style="padding:6px 0;font-size:13px;color:#0f172a;font-weight:500;">{local_username}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:13px;color:#64748b;">Status</td>
                        <td style="padding:6px 0;font-size:13px;color:{status_color};font-weight:600;">{time_display}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA button -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 28px auto;">
                <tr>
                  <td style="border-radius:6px;background-color:#1e40af;">
                    <a href="{reset_link}"
                       style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;">
                      Change Password Now
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Steps -->
              <div style="background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:18px 24px;margin-bottom:24px;">
                <p style="margin:0 0 10px 0;font-size:13px;font-weight:600;color:#1e40af;">How to change your password</p>
                <ol style="margin:0;padding-left:18px;color:#1e3a8a;font-size:13px;line-height:1.8;">
                  <li>Click <strong>Change Password Now</strong> above</li>
                  <li>Sign in to the Password Portal if prompted</li>
                  <li>Select <strong>{vm_name}</strong> from the dropdown</li>
                  <li>Enter your current password and your new password</li>
                  <li>Click <strong>Reset Password</strong> to confirm</li>
                </ol>
              </div>

              <!-- Warning -->
              <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-left:3px solid {band_color};border-radius:4px;padding:14px 16px;">
                <p style="margin:0;font-size:13px;color:#475569;line-height:1.5;">
                  <strong style="color:#0f172a;">Important:</strong>
                  If your password expires without being changed, you may lose access to this VM
                  until an administrator manually resets it.
                </p>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                This is an automated alert from Password Portal. Please do not reply to this email.
              </p>
              <p style="margin:8px 0 0 0;font-size:12px;color:#cbd5e1;">
                &copy; {datetime.datetime.now().year} Password Portal &nbsp;&bull;&nbsp; All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def get_password_expiry_email_text(
    user_name: str,
    vm_name: str,
    local_username: str,
    days_until_expiry: int,
    portal_url: str
) -> str:
    """Generate plain text content for password expiry warning email."""

    if days_until_expiry <= 0:
        status_line  = "STATUS: EXPIRED"
        action_line  = "Your password has expired. Please change it immediately to restore access."
    elif days_until_expiry == 1:
        status_line  = "STATUS: EXPIRES TOMORROW"
        action_line  = "Your password expires tomorrow. Please change it now."
    else:
        status_line  = f"STATUS: EXPIRES IN {days_until_expiry} DAYS"
        action_line  = f"Your password expires in {days_until_expiry} days. Please change it soon."

    reset_link = f"{portal_url}/vm-password-reset"

    return f"""Password Portal — VM Password Expiry Alert
==========================================

Hello {user_name},

{status_line}

{action_line}

Account Details
---------------
VM Name        : {vm_name}
Local Username : {local_username}
Days Remaining : {max(days_until_expiry, 0)} day(s)

Change your password here:
  {reset_link}

Steps:
  1. Open the link above and sign in if prompted
  2. Select '{vm_name}' from the dropdown
  3. Enter your current password and a new password
  4. Click 'Reset Password'

Important: If your password expires, you may lose VM access until an
administrator resets it manually.

---
This is an automated message from Password Portal.
Do not reply to this email. Contact your system administrator if you need help.
"""
