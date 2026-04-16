# backend/app/services/certificate_service.py
from typing import Dict, Any
from app.utils.powershell import execute_certificate_check

async def get_certificates(vm_ip: str, admin_user: str, admin_pass: str) -> Dict[str, Any]:
    return await execute_certificate_check(vm_ip, admin_user, admin_pass)
