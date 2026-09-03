# backend/app/services/health_service.py
from typing import Dict, Any
from app.utils.powershell import execute_health_telemetry

async def get_vm_telemetry(vm_ip: str, admin_user: str, admin_pass: str) -> Dict[str, Any]:
    """Fetches real-time telemetry from the target VM."""
    return await execute_health_telemetry(vm_ip, admin_user, admin_pass)
