# backend/app/routers/vm_health.py
from fastapi import APIRouter, HTTPException, Depends
from app.database import get_vms_collection
from app.utils.security import decrypt_string
from app.middleware.auth import require_admin
from app.services.health_service import get_vm_telemetry
from app.services.telemetry_service import get_all_telemetry, save_single_telemetry

router = APIRouter(prefix="/admin/vms/{vm_id}/health", tags=["VM Health"])

async def get_vm_credentials(vm_id: str):
    vm = await get_vms_collection().find_one({"id": vm_id})
    if not vm:
        raise HTTPException(status_code=404, detail="VM not found")
    try:
        admin_pass = decrypt_string(vm.get("admin_password_encrypted", ""))
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to decrypt VM credentials")
    return vm["ip_address"], vm.get("admin_username", "Administrator"), admin_pass

@router.get("/telemetry")
async def get_telemetry(vm_id: str, current_user: dict = Depends(require_admin)):
    """API endpoint to fetch real-time VM telemetry."""
    ip, user, pwd = await get_vm_credentials(vm_id)
    result = await get_vm_telemetry(ip, user, pwd)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message"))
    
    data = result.get("data", {})
    
    # Auto-save this point to history to keep the graph seamless
    if data:
        await save_single_telemetry(vm_id, data)
        
    return data


@router.get("/history")
async def get_history(
    vm_id: str,
    hours: float = None,   # Fix 4/6: frontend passes selected range (e.g. 1, 6, 24, 168, 720)
    current_user: dict = Depends(require_admin)
):
    """
    Returns telemetry history for a VM.
    Fix 6: Routes to raw collection for ≤24h, compressed collection for >24h.
    """
    return await get_all_telemetry(vm_id, hours=hours)
from pydantic import BaseModel

class PowerActionRequest(BaseModel):
    action: str
    password: str

@router.post("/power")
async def vm_power_action(
    vm_id: str,
    request: PowerActionRequest,
    current_user: dict = Depends(require_admin)
):
    """Reboot or Shutdown a VM."""
    if request.action not in ["reboot", "shutdown"]:
        raise HTTPException(status_code=400, detail="Invalid power action")
        
    # Verify admin password
    from app.database import get_users_collection
    from app.utils.security import verify_password
    users_collection = get_users_collection()
    user_doc = await users_collection.find_one({"id": current_user["sub"]})
    if not user_doc or not verify_password(request.password, user_doc["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect admin password. Action aborted.")
        
    ip, user, pwd = await get_vm_credentials(vm_id)
    
    from app.utils.powershell import execute_power_action
    result = await execute_power_action(ip, user, pwd, request.action)
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message"))
        
    return {"message": result.get("message")}

@router.get("/debug/telemetry-stats")
async def get_telemetry_debug(vm_id: str, current_user: dict = Depends(require_admin)):
    """Exposes statistics for the telemetry collection loop."""
    from app.services.telemetry_service import get_telemetry_loop_stats
    return await get_telemetry_loop_stats(vm_id)

@router.post("/rdp/sessions/{session_id}/action")
async def rdp_session_action(
    vm_id: str,
    session_id: int,
    action: str, # "logoff" or "disconnect"
    current_user: dict = Depends(require_admin)
):
    """Logoff or disconnect an active RDP session."""
    if action not in ["logoff", "disconnect"]:
        raise HTTPException(status_code=400, detail="Invalid session action")
        
    ip, user, pwd = await get_vm_credentials(vm_id)
    
    from app.utils.powershell import execute_rdp_action
    result = await execute_rdp_action(ip, user, pwd, action, session_id)
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message"))
        
    return {"message": result.get("message")}
