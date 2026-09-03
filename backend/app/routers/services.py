# backend/app/routers/services.py
from fastapi import APIRouter, HTTPException, Depends
from app.database import get_vms_collection
from app.utils.security import decrypt_string
from app.middleware.auth import require_admin
from app.services.services_service import get_services, start_service, stop_service, restart_service

router = APIRouter(prefix="/admin/vms/{vm_id}/services", tags=["Services"])

async def get_vm_credentials(vm_id: str):
    vm = await get_vms_collection().find_one({"id": vm_id})
    if not vm:
        raise HTTPException(status_code=404, detail="VM not found")
    try:
        admin_pass = decrypt_string(vm.get("admin_password_encrypted", ""))
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to decrypt VM credentials")
    return vm["ip_address"], vm.get("admin_username", "Administrator"), admin_pass

@router.get("/")
async def list_services(vm_id: str, current_user: dict = Depends(require_admin)):
    ip, user, pwd = await get_vm_credentials(vm_id)
    result = await get_services(ip, user, pwd)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message"))
    return result.get("data", [])

@router.post("/{service_name}/start")
async def start_service_route(vm_id: str, service_name: str, current_user: dict = Depends(require_admin)):
    ip, user, pwd = await get_vm_credentials(vm_id)
    result = await start_service(ip, user, pwd, service_name)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message"))
    return result.get("data", {})

@router.post("/{service_name}/stop")
async def stop_service_route(vm_id: str, service_name: str, current_user: dict = Depends(require_admin)):
    ip, user, pwd = await get_vm_credentials(vm_id)
    result = await stop_service(ip, user, pwd, service_name)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message"))
    return result.get("data", {})

@router.post("/{service_name}/restart")
async def restart_service_route(vm_id: str, service_name: str, current_user: dict = Depends(require_admin)):
    ip, user, pwd = await get_vm_credentials(vm_id)
    result = await restart_service(ip, user, pwd, service_name)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message"))
    return result.get("data", {})
