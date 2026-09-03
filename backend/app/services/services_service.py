# backend/app/services/services_service.py
import asyncio
from typing import Dict, Any, List
from app.utils.powershell import execute_service_management

async def get_services(vm_ip: str, admin_user: str, admin_pass: str) -> Dict[str, Any]:
    return await execute_service_management("list", vm_ip, admin_user, admin_pass)

async def start_service(vm_ip: str, admin_user: str, admin_pass: str, service_name: str) -> Dict[str, Any]:
    return await execute_service_management("start", vm_ip, admin_user, admin_pass, service_name=service_name)

async def stop_service(vm_ip: str, admin_user: str, admin_pass: str, service_name: str) -> Dict[str, Any]:
    return await execute_service_management("stop", vm_ip, admin_user, admin_pass, service_name=service_name)

async def restart_service(vm_ip: str, admin_user: str, admin_pass: str, service_name: str) -> Dict[str, Any]:
    return await execute_service_management("restart", vm_ip, admin_user, admin_pass, service_name=service_name)
