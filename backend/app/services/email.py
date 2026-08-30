import os
import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", "noreply@stocksphere.com")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")


def generate_reset_email_html(recipient_name: str, reset_link: str) -> str:
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>StockSphere Password Reset</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #FAFAF8; margin: 0; padding: 30px; color: #1A1A18;">
  <div style="max-width: 540px; margin: 0 auto; background-color: #FFFFFF; border: 1px solid #E7E5DF; border-radius: 12px; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.04);">
    <div style="margin-bottom: 24px;">
      <h2 style="margin: 0; color: #3B6E5E; font-size: 20px; font-weight: 700; letter-spacing: -0.02em;">StockSphere</h2>
      <p style="margin: 4px 0 0 0; color: #6B6A63; font-size: 13px;">Inventory & Financial Management</p>
    </div>
    <div style="border-top: 1px solid #E7E5DF; padding-top: 20px; margin-bottom: 24px;">
      <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #1A1A18;">Password Reset Request</h3>
      <p style="font-size: 14px; line-height: 1.5; color: #4A4943; margin-bottom: 20px;">
        Hello <strong>{recipient_name}</strong>,<br><br>
        We received a request to reset your password for your StockSphere account. Click the button below to set a new password:
      </p>
      <div style="text-align: center; margin: 28px 0;">
        <a href="{reset_link}" style="background-color: #3B6E5E; color: #FFFFFF; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 600; display: inline-block;">
          Reset Your Password
        </a>
      </div>
      <p style="font-size: 12px; line-height: 1.5; color: #8C8A81;">
        If you did not request a password reset, you can safely ignore this email. This password reset link will expire in <strong>15 minutes</strong>.
      </p>
      <p style="font-size: 11px; word-break: break-all; color: #A8A597; margin-top: 20px;">
        Or copy and paste this link in your browser:<br>
        <a href="{reset_link}" style="color: #3B6E5E;">{reset_link}</a>
      </p>
    </div>
    <div style="border-top: 1px solid #E7E5DF; padding-top: 16px; font-size: 11px; color: #A8A597; text-align: center;">
      &copy; StockSphere SMB Inventory System. All rights reserved.
    </div>
  </div>
</body>
</html>"""


async def send_password_reset_email(to_email: str, recipient_name: str, reset_token: str) -> bool:
    reset_link = f"{FRONTEND_URL}/reset-password?token={reset_token}"
    html_content = generate_reset_email_html(recipient_name, reset_link)

    # In development or when SMTP is not configured, log to console
    if not SMTP_HOST or not SMTP_USER:
        logger.info(
            f"\n======================================================\n"
            f"[DEV EMAIL LOG] Password Reset Requested\n"
            f"To: {to_email} ({recipient_name})\n"
            f"Reset Link: {reset_link}\n"
            f"======================================================\n"
        )
        print(
            f"\n======================================================\n"
            f"[DEV EMAIL LOG] Password Reset Requested\n"
            f"To: {to_email} ({recipient_name})\n"
            f"Reset Link: {reset_link}\n"
            f"======================================================\n"
        )
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "StockSphere - Password Reset Request"
        msg["From"] = SMTP_FROM_EMAIL
        msg["To"] = to_email

        part = MIMEText(html_content, "html")
        msg.attach(part)

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_FROM_EMAIL, to_email, msg.as_string())
        logger.info(f"Password reset email sent to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send password reset email to {to_email}: {e}")
        # Even if SMTP connection fails, print link in local server log so dev workflow is never blocked
        print(
            f"\n[DEV FALLBACK] Password Reset Link: {reset_link}\n"
        )
        return False
