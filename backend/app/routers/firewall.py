# backend/app/routers/firewall.py
from fastapi import APIRouter, HTTPException, status, Depends, Body
from app.database import get_vms_collection
from app.utils.security import decrypt_string
from app.middleware.auth import require_admin
from app.services.firewall_service import get_firewall_rules, add_firewall_rule, delete_firewall_rule, toggle_firewall_rule, update_firewall_rule

router = APIRouter(prefix="/admin/vms/{vm_id}/firewall", tags=["Firewall"])

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
async def list_firewall_rules(vm_id: str, current_user: dict = Depends(require_admin)):
    ip, user, pwd = await get_vm_credentials(vm_id)
    result = await get_firewall_rules(ip, user, pwd)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message"))
    return result.get("data", {})

@router.post("/")
async def create_firewall_rule(vm_id: str, rule_data: dict = Body(...), current_user: dict = Depends(require_admin)):
    ip, user, pwd = await get_vm_credentials(vm_id)
    result = await add_firewall_rule(ip, user, pwd, rule_data)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message"))
    return {"message": result.get("message")}

@router.delete("/{rule_name}")
async def delete_rule(vm_id: str, rule_name: str, current_user: dict = Depends(require_admin)):
    ip, user, pwd = await get_vm_credentials(vm_id)
    result = await delete_firewall_rule(ip, user, pwd, rule_name)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message"))
    return {"message": result.get("message")}

@router.put("/{rule_name}/toggle")
async def toggle_rule(vm_id: str, rule_name: str, current_user: dict = Depends(require_admin)):
    ip, user, pwd = await get_vm_credentials(vm_id)
    result = await toggle_firewall_rule(ip, user, pwd, rule_name)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message"))
    return {"message": result.get("message")}

@router.put("/{rule_name}")
async def update_rule(vm_id: str, rule_name: str, rule_data: dict = Body(...), current_user: dict = Depends(require_admin)):
    ip, user, pwd = await get_vm_credentials(vm_id)
    # Ensure rule_name is in the data so the script knows which rule to update
    rule_data["rule_name"] = rule_name
    result = await update_firewall_rule(ip, user, pwd, rule_data)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message"))
    return {"message": result.get("message")}
