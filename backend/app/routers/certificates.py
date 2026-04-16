# backend/app/routers/certificates.py
from fastapi import APIRouter, HTTPException, Depends
from app.database import get_vms_collection
from app.utils.security import decrypt_string
from app.middleware.auth import require_admin
from app.services.certificate_service import get_certificates

router = APIRouter(prefix="/admin/vms/{vm_id}/certificates", tags=["Certificates"])

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
async def list_certificates(vm_id: str, current_user: dict = Depends(require_admin)):
    ip, user, pwd = await get_vm_credentials(vm_id)
    result = await get_certificates(ip, user, pwd)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message"))
    return result.get("data", {})
