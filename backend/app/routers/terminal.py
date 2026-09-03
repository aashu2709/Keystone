# backend/app/routers/terminal.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, status
from typing import Optional
from datetime import datetime
import asyncio
import base64
import json
import logging

try:
    from winpty import PTY
except ImportError:
    PTY = None

from app.utils.security import verify_access_token, decrypt_string
from app.database import get_vms_collection, get_audit_logs_collection
from app.utils.security import generate_uuid

router = APIRouter(prefix="/admin/terminal", tags=["Terminal"])
logger = logging.getLogger(__name__)

# Track active sessions to properly close them
active_terminals = {}

@router.websocket("/{vm_id}")
async def websocket_terminal(
    websocket: WebSocket, 
    vm_id: str, 
    token: str = Query(...)
):
    await websocket.accept()
    
    if PTY is None:
        await websocket.send_text("Error: pywinpty is not installed on the server.\r\n")
        await websocket.close()
        return

    # Validate token
    token_data = verify_access_token(token)
    if not token_data:
        logger.error(f"Token validation failed for token: {token[:10]}...")
        await websocket.send_text(f"Error: Invalid or expired token.\r\n")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
        
    if token_data.get("role") not in ["admin", "superadmin"]:
        logger.error(f"Role validation failed: {token_data.get('role')}")
        await websocket.send_text(f"Error: Unauthorized. Admin access required. (Role: {token_data.get('role')})\r\n")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
        
    admin_id = token_data.get("sub")
    
    vms_collection = get_vms_collection()
    vm = await vms_collection.find_one({"id": vm_id})
    if not vm:
        await websocket.send_text("Error: VM not found.\r\n")
        await websocket.close()
        return

    admin_user = vm.get("admin_username")
    try:
        admin_pass = decrypt_string(vm.get("admin_password_encrypted"))
    except Exception as e:
        await websocket.send_text(f"Error decrypting VM password: {e}\r\n")
        await websocket.close()
        return

    vm_ip = vm.get("ip_address")
    vm_name = vm.get("name", "Unknown VM")

    # Build the PowerShell command to start a remote session
    ps_script = f"""
$secPass = ConvertTo-SecureString '{admin_pass}' -AsPlainText -Force
$cred = New-Object System.Management.Automation.PSCredential ('{admin_user}', $secPass)
try {{
    Write-Host "Connecting to {vm_ip}..." -ForegroundColor Cyan
    Enter-PSSession -ComputerName '{vm_ip}' -Credential $cred -ErrorAction Stop
}} catch {{
    Write-Host "Failed to connect to {vm_ip}: $_" -ForegroundColor Red
}}
"""
    
    # Encode the command to base64 for safe passing
    encoded_cmd = base64.b64encode(ps_script.encode('utf-16-le')).decode('utf-8')
    
    # Start the PTY process
    cols = 80
    rows = 24
    try:
        pty_process = PTY(cols, rows)
        pty_process.spawn(f'powershell.exe -NoProfile -NoExit -EncodedCommand {encoded_cmd}')
    except Exception as e:
        logger.error(f"Failed to spawn PTY: {e}")
        await websocket.send_text(f"Error starting terminal process: {e}\r\n")
        await websocket.close()
        return

    # Log session start
    audit_collection = get_audit_logs_collection()
    await audit_collection.insert_one({
        "id": generate_uuid(),
        "user_id": admin_id,
        "action": "terminal_session_start",
        "details": f"Started interactive terminal session on VM {vm_name} ({vm_ip})",
        "ip_address": websocket.client.host,
        "timestamp": datetime.now()
    })

    # Lock to prevent concurrent C-level access to pywinpty
    pty_lock = asyncio.Lock()
    
    # Buffer for command logging
    command_buffer = ""

    async def read_from_pty():
        try:
            while True:
                async with pty_lock:
                    if not pty_process.isalive():
                        break
                    data = pty_process.read()
                
                if data:
                    await websocket.send_text(data)
                else:
                    await asyncio.sleep(0.05)
        except Exception as e:
            if not isinstance(e, asyncio.CancelledError):
                logger.error(f"PTY read error: {e}")

    async def read_from_ws():
        nonlocal command_buffer
        try:
            while True:
                data = await websocket.receive_text()
                
                # Check for resize event (sent as JSON from frontend)
                if data.startswith('{') and 'cols' in data and 'rows' in data:
                    try:
                        size = json.loads(data)
                        async with pty_lock:
                            pty_process.set_size(size['cols'], size['rows'])
                        continue
                    except:
                        pass
                
                # Command auditing
                for char in data:
                    if char in ('\\r', '\\n'):
                        if command_buffer.strip():
                            # Log command asynchronously
                            asyncio.create_task(audit_collection.insert_one({
                                "id": generate_uuid(),
                                "user_id": admin_id,
                                "action": "terminal_command_executed",
                                "details": f"Executed on {vm_name}: {command_buffer.strip()}",
                                "ip_address": websocket.client.host,
                                "timestamp": datetime.now()
                            }))
                        command_buffer = ""
                    elif char == '\\x03': # Ctrl+C
                        command_buffer = ""
                    elif char == '\\x08' or char == '\\x7f': # Backspace
                        command_buffer = command_buffer[:-1]
                    else:
                        command_buffer += char

                async with pty_lock:
                    pty_process.write(data)
        except Exception as e:
            if not isinstance(e, asyncio.CancelledError):
                logger.error(f"WS read error: {e}")

    # Run both tasks concurrently
    read_task = asyncio.create_task(read_from_pty())
    ws_task = asyncio.create_task(read_from_ws())

    done, pending = await asyncio.wait(
        [read_task, ws_task], 
        return_when=asyncio.FIRST_COMPLETED
    )

    for task in pending:
        task.cancel()
        
    # Wait for tasks to actually finish their cancellation to avoid accessing 
    # the pty_process concurrently while it's being closed
    if pending:
        try:
            await asyncio.wait(pending)
        except:
            pass
        
    # Safely clean up resources once
    try:
        if pty_process:
            # Force cleanup of the C-extension agent
            del pty_process
    except:
        pass
        
    try:
        await websocket.close()
    except:
        pass

    # Log session end
    await audit_collection.insert_one({
        "id": generate_uuid(),
        "user_id": admin_id,
        "action": "terminal_session_end",
        "details": f"Ended interactive terminal session on VM {vm_name} ({vm_ip})",
        "ip_address": websocket.client.host,
        "timestamp": datetime.now()
    })
