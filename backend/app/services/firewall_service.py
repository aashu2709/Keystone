# backend/app/services/firewall_service.py
import asyncio
from typing import Dict, Any, List
from app.utils.powershell import execute_firewall_management

async def get_firewall_rules(vm_ip: str, admin_user: str, admin_pass: str) -> Dict[str, Any]:
    return await execute_firewall_management("list", vm_ip, admin_user, admin_pass)

async def add_firewall_rule(vm_ip: str, admin_user: str, admin_pass: str, rule_data: Dict[str, Any]) -> Dict[str, Any]:
    # Check if this is a predefined rule activation
    if rule_data.get("predefined_group") and rule_data.get("predefined_group") != "":
        return await execute_firewall_management("enable-group", vm_ip, admin_user, admin_pass, **rule_data)
    
    return await execute_firewall_management("add", vm_ip, admin_user, admin_pass, **rule_data)

async def delete_firewall_rule(vm_ip: str, admin_user: str, admin_pass: str, rule_name: str) -> Dict[str, Any]:
    return await execute_firewall_management("delete", vm_ip, admin_user, admin_pass, rule_name=rule_name)

async def toggle_firewall_rule(vm_ip: str, admin_user: str, admin_pass: str, rule_name: str) -> Dict[str, Any]:
    return await execute_firewall_management("toggle", vm_ip, admin_user, admin_pass, rule_name=rule_name)

async def update_firewall_rule(vm_ip: str, admin_user: str, admin_pass: str, rule_data: Dict[str, Any]) -> Dict[str, Any]:
    return await execute_firewall_management("update", vm_ip, admin_user, admin_pass, **rule_data)

async def bulk_add_firewall_rule(vm_targets: List[Dict[str, Any]], rule_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Run add_firewall_rule on multiple VMs in parallel.
    vm_targets: List of dicts with {id: str, ip: str, user: str, pwd: str}
    """
    tasks = []
    for vm in vm_targets:
        tasks.append(add_firewall_rule(vm["ip"], vm["user"], vm["pwd"], rule_data))
    
    # Run all tasks in parallel
    raw_results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Process results into a standard format
    processed_results = []
    for i, res in enumerate(raw_results):
        vm = vm_targets[i]
        if isinstance(res, Exception):
            processed_results.append({
                "vm_id": vm["id"],
                "success": False,
                "message": str(res)
            })
        else:
            processed_results.append({
                "vm_id": vm["id"],
                "success": res.get("success", False),
                "message": res.get("message", "Unknown result")
            })
            
    return processed_results
