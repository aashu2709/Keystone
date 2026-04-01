# backend/app/services/health_check_service.py
"""
VM Health Check Service
=======================
Checks health status of all VMs using native Python Sockets.
This is faster and more reliable than spawning PowerShell subprocesses.
"""

import asyncio
import logging
from datetime import datetime
from typing import Dict, Any

from app.database import (
    get_vms_collection, 
    get_mappings_collection, 
    get_users_collection
)
from app.services.notification_service import notify_vm_unreachable, notify_vm_recovered

logger = logging.getLogger(__name__)

async def check_all_vms_health() -> Dict[str, Any]:
    vms_collection = get_vms_collection()
    
    result = {
        "total": 0, "healthy": 0, "unreachable": 0, "details": []
    }
    
    vms = await vms_collection.find({"is_active": True}).to_list(length=500)
    result["total"] = len(vms)
    
    # Process concurrent checks
    semaphore = asyncio.Semaphore(20) # Can be higher with sockets
    async def check_wrapper(vm):
        async with semaphore:
            return await _check_single_vm_health(vm)

    tasks = [check_wrapper(vm) for vm in vms]
    check_results = await asyncio.gather(*tasks, return_exceptions=True)
    
    for vm, check_result in zip(vms, check_results):
        if isinstance(check_result, Exception):
            check_result = {"is_healthy": False, "error": str(check_result)}
        
        previous_status = vm.get("health_status", "unknown")
        new_status = "healthy" if check_result["is_healthy"] else "unreachable"
        
        # Update DB
        await vms_collection.update_one(
            {"id": vm["id"]},
            {
                "$set": {
                    "health_status": new_status,
                    "last_health_check": datetime.now(),
                    "updated_at": datetime.now()
                }
            }
        )
        
        # Notifications logic
        if check_result["is_healthy"]:
            result["healthy"] += 1
            if previous_status == "unreachable":
                logger.info(f"✅ VM recovered: {vm['name']} ({vm['ip_address']})")
                await _notify_users_of_status_change(vm, "recovered")
        else:
            result["unreachable"] += 1
            if previous_status == "healthy":
                logger.warning(f"❌ VM became unreachable: {vm['name']} ({vm['ip_address']})")
                await _notify_users_of_status_change(vm, "unreachable")
    
    return result


async def _check_single_vm_health(vm: dict) -> Dict[str, Any]:
    """
    Check connection using Python asyncio.open_connection (TCP Socket).
    """
    ip = vm["ip_address"]
    port = vm.get("winrm_port", 5985)
    start = datetime.now()
    
    try:
        # Try to open a TCP connection with a 5-second timeout
        # This is exactly what Test-NetConnection does, but native in Python
        future = asyncio.open_connection(ip, port)
        reader, writer = await asyncio.wait_for(future, timeout=5)
        
        # If we get here, connection succeeded!
        writer.close()
        await writer.wait_closed()
        
        return {
            "is_healthy": True,
            "response_time_ms": (datetime.now() - start).total_seconds() * 1000
        }
    except (asyncio.TimeoutError, ConnectionRefusedError, OSError) as e:
        # Connection failed
        return {
            "is_healthy": False, 
            "error": f"Socket Error: {str(e)}",
            "response_time_ms": (datetime.now() - start).total_seconds() * 1000
        }
    except Exception as e:
        return {"is_healthy": False, "error": str(e)}


async def _notify_users_of_status_change(vm: dict, type: str):
    """
    Helper to notify ONLY ADMINS about VM status changes.
    """
    try:
        # Fetch ONLY admins and superadmins
        admins = await get_users_collection().find({
            "role": {"$in": ["admin", "superadmin"]},
            "is_active": True
        }).to_list(None)
        
        if not admins:
            return

        for admin in admins:
            admin_id = admin["id"]
            
            if type == "unreachable":
                await notify_vm_unreachable(
                    user_id=admin_id, 
                    vm_name=vm["name"], 
                    vm_ip=vm["ip_address"], 
                    vm_id=vm["id"]
                )
            elif type == "recovered":
                await notify_vm_recovered(
                    user_id=admin_id, 
                    vm_name=vm["name"], 
                    vm_ip=vm["ip_address"], 
                    vm_id=vm["id"]
                )
                
        logger.info(f"📢 Sent VM status notification to {len(admins)} admins")
        
    except Exception as e:
        logger.error(f"Error sending status notifications: {e}")

# Helper for manual API check
async def check_single_vm_health(vm_id: str):
    vm = await get_vms_collection().find_one({"id": vm_id})
    if not vm: return None
    return await _check_single_vm_health(vm)