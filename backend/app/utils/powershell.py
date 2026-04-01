# backend/app/utils/powershell.py
"""
PowerShell Utility
Execute PowerShell commands on remote Windows VMs via WinRM.

Note: Uses synchronous subprocess with ThreadPoolExecutor for Windows compatibility.
Updated: Added check_password_expiry_ps (using external script) and simplified test_vm_connection.
"""

import asyncio
import os
import subprocess
import traceback
import json
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

from app.config import settings


# Thread pool for running subprocess (Windows compatibility)
_executor = ThreadPoolExecutor(max_workers=4)


def _run_powershell_sync(
    script_path: str,
    vm_ip: str,
    target_username: str,
    old_password: str,
    new_password: str,
    vm_admin_username: str,
    vm_admin_password: str,
    working_dir: str,
    timeout: int = 120
) -> dict:
    """
    Synchronous PowerShell execution for PASSWORD RESET.
    This runs in a thread pool to not block the async event loop.
    """

    cmd = [
        "powershell.exe",
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-File",
        script_path,
        vm_ip,
        target_username,
        old_password,
        new_password,
        vm_admin_username,
    ]

    try:
        print(f"▶️ Starting PowerShell process...")
        
        # Use subprocess.Popen for more control
        process = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=working_dir,
            text=False,  # Use bytes
        )
        
        print(f"✅ Process created with PID: {process.pid}")
        print(f"📤 Sending admin password via stdin...")
        
        # Send admin password via stdin
        admin_input = (vm_admin_password + "\n").encode("utf-8")
        
        try:
            stdout, stderr = process.communicate(input=admin_input, timeout=timeout)
        except subprocess.TimeoutExpired:
            print(f"❌ Process timed out after {timeout} seconds")
            process.kill()
            process.wait()
            return {
                "success": False,
                "message": "Command timed out",
                "error": f"Connection to VM {vm_ip} timed out after {timeout} seconds",
            }
        
        # Decode output
        stdout_text = stdout.decode("utf-8", errors="replace").strip() if stdout else ""
        stderr_text = stderr.decode("utf-8", errors="replace").strip() if stderr else ""
        
        print(f"\n📊 POWERSHELL OUTPUT:")
        print(f"   Return code: {process.returncode}")
        
        if stdout_text:
            print(f"\n📤 STDOUT:\n{stdout_text}")
        else:
            print(f"\n📤 STDOUT: (empty)")
            
        if stderr_text:
            print(f"\n📥 STDERR:\n{stderr_text}")
        else:
            print(f"\n📥 STDERR: (empty)")
        
        # Determine success
        if process.returncode == 0:
            success_markers = [
                "password reset successful",
                "successfully",
                "password changed",
            ]
            
            output_lower = stdout_text.lower()
            is_success = any(marker in output_lower for marker in success_markers)
            
            if is_success or process.returncode == 0:
                print(f"\n✅ PASSWORD RESET SUCCESSFUL!")
                return {
                    "success": True,
                    "message": "Password reset successful on VM",
                    "error": None,
                }
        
        # Failure case
        print(f"\n❌ SCRIPT FAILED (exit code: {process.returncode})")
        error_msg = stderr_text or stdout_text or f"Script failed with exit code {process.returncode}"
        error_msg = translate_powershell_error(error_msg)
        
        return {
            "success": False,
            "message": "Password reset failed",
            "error": error_msg,
        }
        
    except FileNotFoundError:
        return {
            "success": False,
            "message": "Password reset failed",
            "error": "PowerShell not found on server",
        }
    except PermissionError as e:
        return {
            "success": False,
            "message": "Password reset failed",
            "error": f"Permission denied: {e}",
        }
    except Exception as e:
        print(f"❌ Exception in _run_powershell_sync: {type(e).__name__}: {e}")
        traceback.print_exc()
        return {
            "success": False,
            "message": "Password reset failed",
            "error": str(e) if str(e) else f"Unexpected error: {type(e).__name__}",
        }


async def execute_password_reset(
    vm_ip: str,
    vm_admin_username: str,
    vm_admin_password: str,
    target_username: str,
    old_password: str,
    new_password: str,
    winrm_port: int = 5985,
    timeout: int = 120
) -> dict:
    """
    Execute password reset on a remote Windows VM.
    Uses ThreadPoolExecutor to run subprocess on Windows.
    """

    print("=" * 60)
    print("🔧 POWERSHELL EXECUTION STARTED")
    print("=" * 60)

    # Dev-mode shortcut
    if settings.DEBUG and os.environ.get("SKIP_VM_CONNECTION", "false").lower() == "true":
        print(f"⚠️ DEV MODE: Skipping actual VM connection to {vm_ip}")
        return {
            "success": True,
            "message": "Password reset simulated (DEV MODE)",
            "error": None,
        }

    # Path resolution
    backend_dir = Path(__file__).resolve().parent.parent.parent
    script_path = backend_dir / "scripts" / "reset_password.ps1"

    if not script_path.exists():
        error_msg = f"PowerShell script not found at {script_path}"
        print(f"❌ {error_msg}")
        return {
            "success": False,
            "message": "Password reset failed",
            "error": error_msg,
        }

    try:
        # Run synchronous subprocess in thread pool
        loop = asyncio.get_event_loop()
        
        result = await loop.run_in_executor(
            _executor,
            _run_powershell_sync,
            str(script_path),
            vm_ip,
            target_username,
            old_password,
            new_password,
            vm_admin_username,
            vm_admin_password,
            str(backend_dir),
            timeout,
        )
        
        return result
        
    except Exception as e:
        print(f"❌ Unexpected error: {type(e).__name__}: {e}")
        traceback.print_exc()
        return {
            "success": False,
            "message": "Password reset failed",
            "error": str(e) if str(e) else f"Unexpected error: {type(e).__name__}",
        }

    finally:
        print("\n" + "=" * 60)
        print("🔧 POWERSHELL EXECUTION ENDED")
        print("=" * 60 + "\n")


def translate_powershell_error(error_msg: str) -> str:
    """Translate PowerShell errors to user-friendly messages."""
    error_lower = error_msg.lower()

    if "access is denied" in error_lower:
        return "Old password is incorrect"
    elif "network path was not found" in error_lower:
        return "VM is unreachable. Check network connection."
    elif "user name could not be found" in error_lower or "user does not exist" in error_lower:
        return "User does not exist on this VM"
    elif "winrm" in error_lower and "not" in error_lower:
        return "VM is not configured for remote management (WinRM)"
    elif "password does not meet" in error_lower:
        return "Password does not meet Windows password policy requirements"
    elif "password history" in error_lower:
        return "Cannot reuse recent passwords (Windows policy)"
    elif "account is currently locked" in error_lower:
        return "Account is locked. Contact administrator."
    elif "rpc server is unavailable" in error_lower:
        return "VM is unreachable. Check if VM is running."
    elif "connection refused" in error_lower:
        return "Connection refused. Check WinRM service on VM."
    elif "old password is incorrect" in error_lower:
        return "Old password is incorrect"
    elif "cannot reach" in error_lower or "unreachable" in error_lower:
        return "VM is unreachable. Check network connection."
    elif "the user name or password is incorrect" in error_lower:
        return "Old password is incorrect"
    else:
        # Return first 200 chars of error
        return error_msg[:200] if len(error_msg) > 200 else error_msg


# ===========================================
# NEW FUNCTIONS FOR SCHEDULER & HEALTH CHECK
# ===========================================

def _run_expiry_check_sync(
    script_path: str,
    vm_ip: str,
    admin_user: str,
    admin_password: str,
    target_user: str
) -> dict:
    """
    Synchronous execution of the check_expiry.ps1 script.
    """
    cmd = [
        "powershell.exe",
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-File", script_path,
        "-target_user", target_user
    ]

    # Pass sensitive data via Environment Variables (Safer)
    env = os.environ.copy()
    env["VM_IP"] = vm_ip
    env["ADMIN_USER"] = admin_user

    try:
        process = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=env
        )
        
        # Send password via Stdin
        stdout, stderr = process.communicate(input=admin_password + "\n", timeout=45)
        
        output = stdout.strip()
        
        # Try to parse JSON
        try:
            start = output.find('{')
            end = output.rfind('}') + 1
            if start != -1 and end != -1:
                return json.loads(output[start:end])
            return {"success": False, "error": f"Invalid output: {output}"}
        except json.JSONDecodeError:
            return {"success": False, "error": f"JSON Parse Error: {output}"}

    except subprocess.TimeoutExpired:
        process.kill()
        return {"success": False, "error": "Connection timed out"}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def check_password_expiry_ps(
    vm_ip: str,
    vm_admin_username: str,
    vm_admin_password: str,
    target_username: str
) -> dict:
    """
    Async wrapper for checking password expiry using external script.
    """
    # Resolve script path
    backend_dir = Path(__file__).resolve().parent.parent.parent
    script_path = backend_dir / "scripts" / "check_expiry.ps1"
    
    if not script_path.exists():
        return {"success": False, "error": f"Script not found: {script_path}"}

    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        _executor,
        _run_expiry_check_sync,
        str(script_path),
        vm_ip,
        vm_admin_username,
        vm_admin_password,
        target_username
    )


async def test_vm_connection(
    vm_ip: str,
    vm_admin_username: str,
    vm_admin_password: str,
    winrm_port: int = 5985,
    timeout: int = 15
) -> dict:
    """
    Test connectivity using native Python sockets.
    This avoids event loop pipe bugs on Windows when spawning subprocesses under Uvicorn.
    """
    try:
        # Native TCP ping is significantly faster and more reliable than spawning powershell
        future = asyncio.open_connection(vm_ip, winrm_port)
        reader, writer = await asyncio.wait_for(future, timeout=timeout)
        
        # If we reach here, the port is open and listening
        writer.close()
        await writer.wait_closed()
        
        return {
            "reachable": True,
            "message": "Connection successful"
        }
    except Exception as e:
        return {"reachable": False, "message": str(e)}