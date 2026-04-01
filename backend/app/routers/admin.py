# backend/app/routers/admin.py
"""
Admin Router
Admin-only endpoints for managing VMs, users, and mappings.

Updated: Added VM Health Check endpoints
Updated: Added Scheduler Management endpoints
"""

from fastapi import APIRouter, HTTPException, status, Depends, Query, Body, BackgroundTasks
from datetime import datetime, timedelta
from typing import Optional

from app.schemas import (
    VMCreateRequest, VMUpdateRequest, VMResponse, VMListResponse,
    MappingCreateRequest, MappingUpdateRequest, MappingResponse, MappingListResponse,
    MessageResponse
)
from app.utils.security import generate_uuid, encrypt_string, decrypt_string
from app.utils.powershell import test_vm_connection, check_password_expiry_ps
from app.database import (
    get_vms_collection,
    get_users_collection,
    get_mappings_collection,
    get_audit_logs_collection,
    get_notifications_collection
)
from app.middleware.auth import require_admin
from app.services.notification_service import notify_admins_vm_health_change

from app.scheduler import get_scheduler_status, trigger_job_manually

# Import the check function (make sure it's available)
from app.services.password_expiry_service import check_user_password_expiry
from app.database import get_mappings_collection



router = APIRouter(prefix="/admin", tags=["Admin"])


async def check_and_save_expiry(user_id: str, vm_id: str):
    """
    Background Task: Check password expiry for a newly mapped user and save to DB.
    """
    print(f"🔄 Auto-checking expiry for new mapping: {user_id} on {vm_id}")
    try:
        # Use the service function to get data
        result = await check_user_password_expiry(user_id, vm_id)
        
        if result and result.get("success"):
            days = result.get("days_until_expiry")
            # Update Mapping in DB
            await get_mappings_collection().update_one(
                {"user_id": user_id, "vm_id": vm_id},
                {"$set": {
                    "days_until_expiry": days,
                    "last_expiry_check": datetime.now()
                }}
            )
            print(f"✅ Auto-check complete: {days} days remaining")
        else:
            print(f"⚠️ Auto-check returned no success: {result}")
            
    except Exception as e:
        print(f"❌ Auto-check failed: {e}")


# ===========================================
# HELPER FUNCTION: AUDIT LOGGING
# ===========================================

async def log_admin_action(
    user_id: str,
    action: str,
    resource_type: str,
    resource_id: str,
    details: dict,
    ip_address: str = None,
    user_agent: str = None
):
    """Log an admin action for audit purposes. Now tracks IP and user agent."""
    audit_logs = get_audit_logs_collection()

    log_doc = {
        "id": generate_uuid(),
        "user_id": user_id,
        "action": action,
        "resource_type": resource_type,
        "resource_id": resource_id,
        "details": details,
        "ip_address": ip_address,
        "user_agent": user_agent,
        "timestamp": datetime.now()
    }

    await audit_logs.insert_one(log_doc)


# ===========================================
# VM MANAGEMENT
# ===========================================

@router.get("/vms", response_model=VMListResponse)
async def get_all_vms(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = None,
    current_user: dict = Depends(require_admin)
):
    """Get all VMs (admin only)."""
    vms_collection = get_vms_collection()

    # Build query
    query = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"ip_address": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]

    # Get total count
    total = await vms_collection.count_documents(query)

    # Get VMs with pagination
    cursor = vms_collection.find(query).skip(skip).limit(limit).sort("name", 1)
    vms = await cursor.to_list(length=limit)

    # Convert to response format
    vm_list = []
    for vm in vms:
        vm_list.append(VMResponse(
            id=vm["id"],
            name=vm["name"],
            ip_address=vm["ip_address"],
            description=vm.get("description"),
            os_version=vm.get("os_version", "Windows Server 2022"),
            winrm_port=vm.get("winrm_port", 5985),
            admin_username=vm.get("admin_username", "Administrator"),
            is_active=vm.get("is_active", True),
            health_status=vm.get("health_status", "unknown"),
            last_health_check=vm.get("last_health_check"),
            created_at=vm.get("created_at", datetime.now()),
            updated_at=vm.get("updated_at", datetime.now())
        ))

    return VMListResponse(vms=vm_list, total=total)


@router.post("/vms", response_model=VMResponse, status_code=status.HTTP_201_CREATED)
async def create_vm(
    request: VMCreateRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_admin)
):
    """Create a new VM (admin only)."""
    vms_collection = get_vms_collection()

    # Check if IP address already exists
    existing = await vms_collection.find_one({"ip_address": request.ip_address})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="VM with this IP address already exists"
        )

    # Check if name already exists
    existing_name = await vms_collection.find_one({"name": request.name})
    if existing_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="VM with this name already exists"
        )

    # Create VM document
    vm_id = generate_uuid()
    now = datetime.now()

    vm_doc = {
        "id": vm_id,
        "name": request.name,
        "ip_address": request.ip_address,
        "description": request.description,
        "os_version": request.os_version,
        "winrm_port": request.winrm_port,
        "admin_username": request.admin_username,
        "admin_password_encrypted": encrypt_string(request.admin_password),
        "is_active": True,
        "health_status": "unknown",
        "last_health_check": None,
        "created_at": now,
        "updated_at": now,
        "created_by": current_user["sub"]
    }

    await vms_collection.insert_one(vm_doc)

    # Log action
    await log_admin_action(
        user_id=current_user["sub"],
        action="create_vm",
        resource_type="vm",
        resource_id=vm_id,
        details={"vm_name": request.name, "ip_address": request.ip_address}
    )

    print(f"✅ VM created: {request.name} ({request.ip_address})")

    # ==========================================
    # Instant health check in background
    # ==========================================
    async def _instant_health_check():
        try:
            from app.utils.powershell import test_vm_connection
            result = await test_vm_connection(
                vm_ip=request.ip_address,
                vm_admin_username=request.admin_username,
                vm_admin_password=request.admin_password,
                winrm_port=request.winrm_port,
                timeout=30
            )
            new_status = "healthy" if result.get("reachable") else "unreachable"
            await get_vms_collection().update_one(
                {"id": vm_id},
                {"$set": {
                    "health_status": new_status,
                    "last_health_check": datetime.now()
                }}
            )
            print(f"🔍 Instant health check for '{request.name}': {new_status}")
        except Exception as e:
            print(f"⚠️ Instant health check failed for '{request.name}': {e}")

    background_tasks.add_task(_instant_health_check)

    return VMResponse(
        id=vm_id,
        name=request.name,
        ip_address=request.ip_address,
        description=request.description,
        os_version=request.os_version,
        winrm_port=request.winrm_port,
        admin_username=request.admin_username,
        is_active=True,
        health_status="unknown",
        last_health_check=None,
        created_at=now,
        updated_at=now
    )


@router.get("/vms/{vm_id}", response_model=VMResponse)
async def get_vm(
    vm_id: str,
    current_user: dict = Depends(require_admin)
):
    """Get a specific VM by ID (admin only)."""
    vms_collection = get_vms_collection()

    vm = await vms_collection.find_one({"id": vm_id})
    if not vm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="VM not found"
        )

    return VMResponse(
        id=vm["id"],
        name=vm["name"],
        ip_address=vm["ip_address"],
        description=vm.get("description"),
        os_version=vm.get("os_version", "Windows Server 2022"),
        winrm_port=vm.get("winrm_port", 5985),
        admin_username=vm.get("admin_username", "Administrator"),
        is_active=vm.get("is_active", True),
        health_status=vm.get("health_status", "unknown"),
        last_health_check=vm.get("last_health_check"),
        created_at=vm.get("created_at", datetime.now()),
        updated_at=vm.get("updated_at", datetime.now())
    )


@router.put("/vms/{vm_id}", response_model=VMResponse)
async def update_vm(
    vm_id: str,
    request: VMUpdateRequest,
    current_user: dict = Depends(require_admin)
):
    """Update a VM (admin only)."""
    vms_collection = get_vms_collection()

    # Find VM
    vm = await vms_collection.find_one({"id": vm_id})
    if not vm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="VM not found"
        )

    # Build update document
    update_data = {"updated_at": datetime.now()}

    if request.name is not None:
        # Check if name already exists (for other VMs)
        existing = await vms_collection.find_one({"name": request.name, "id": {"$ne": vm_id}})
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="VM with this name already exists"
            )
        update_data["name"] = request.name
        
    if request.description is not None:
        update_data["description"] = request.description
    if request.os_version is not None:
        update_data["os_version"] = request.os_version
    if request.winrm_port is not None:
        update_data["winrm_port"] = request.winrm_port
    if request.admin_username is not None:
        update_data["admin_username"] = request.admin_username
    if request.admin_password is not None:
        update_data["admin_password_encrypted"] = encrypt_string(request.admin_password)
    if request.is_active is not None:
        update_data["is_active"] = request.is_active

    # Update VM
    await vms_collection.update_one({"id": vm_id}, {"$set": update_data})

    # Get updated VM
    updated_vm = await vms_collection.find_one({"id": vm_id})

    # Log action
    await log_admin_action(
        user_id=current_user["sub"],
        action="update_vm",
        resource_type="vm",
        resource_id=vm_id,
        details={"fields_updated": list(update_data.keys())}
    )

    print(f"✅ VM updated: {updated_vm['name']}")

    return VMResponse(
        id=updated_vm["id"],
        name=updated_vm["name"],
        ip_address=updated_vm["ip_address"],
        description=updated_vm.get("description"),
        os_version=updated_vm.get("os_version", "Windows Server 2022"),
        winrm_port=updated_vm.get("winrm_port", 5985),
        admin_username=updated_vm.get("admin_username", "Administrator"),
        is_active=updated_vm.get("is_active", True),
        health_status=updated_vm.get("health_status", "unknown"),
        last_health_check=updated_vm.get("last_health_check"),
        created_at=updated_vm.get("created_at", datetime.now()),
        updated_at=updated_vm.get("updated_at", datetime.now())
    )


@router.delete("/vms/{vm_id}", response_model=MessageResponse)
async def delete_vm(
    vm_id: str,
    current_user: dict = Depends(require_admin)
):
    """Delete a VM (admin only)."""
    vms_collection = get_vms_collection()
    mappings_collection = get_mappings_collection()

    # Find VM
    vm = await vms_collection.find_one({"id": vm_id})
    if not vm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="VM not found"
        )

    # Delete all mappings for this VM
    deleted_mappings = await mappings_collection.delete_many({"vm_id": vm_id})

    # Delete VM
    await vms_collection.delete_one({"id": vm_id})

    # Log action
    await log_admin_action(
        user_id=current_user["sub"],
        action="delete_vm",
        resource_type="vm",
        resource_id=vm_id,
        details={
            "vm_name": vm["name"], 
            "ip_address": vm["ip_address"],
            "mappings_deleted": deleted_mappings.deleted_count
        }
    )

    print(f"✅ VM deleted: {vm['name']} ({deleted_mappings.deleted_count} mappings removed)")

    return MessageResponse(message=f"VM '{vm['name']}' deleted successfully")


# ===========================================
# VM HEALTH CHECKS
# ===========================================

@router.post("/vms/{vm_id}/health-check")
async def check_vm_health(
    vm_id: str,
    current_user: dict = Depends(require_admin)
):
    """
    Check if a VM is reachable via WinRM.
    Updates health_status and last_health_check in database.
    Creates notification if status changes.
    """
    vms_collection = get_vms_collection()

    # Find VM
    vm = await vms_collection.find_one({"id": vm_id})
    if not vm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="VM not found"
        )

    # Get previous health status
    previous_status = vm.get("health_status", "unknown")

    # Decrypt admin password
    try:
        admin_password = decrypt_string(vm.get("admin_password_encrypted", ""))
    except Exception as e:
        print(f"❌ Failed to decrypt admin password for VM {vm['name']}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to decrypt VM credentials"
        )

    # Test connection
    print(f"🔍 Testing connection to VM: {vm['name']} ({vm['ip_address']})")

    result = await test_vm_connection(
        vm_ip=vm["ip_address"],
        vm_admin_username=vm.get("admin_username", "Administrator"),
        vm_admin_password=admin_password,
        winrm_port=vm.get("winrm_port", 5985),
        timeout=30
    )

    # Determine new status
    new_status = "healthy" if result.get("reachable", False) else "unreachable"
    now = datetime.now()

    # Update VM in database
    await vms_collection.update_one(
        {"id": vm_id},
        {
            "$set": {
                "health_status": new_status,
                "last_health_check": now,
                "updated_at": now
            }
        }
    )

    # Log action
    await log_admin_action(
        user_id=current_user["sub"],
        action="health_check",
        resource_type="vm",
        resource_id=vm_id,
        details={
            "vm_name": vm["name"],
            "ip_address": vm["ip_address"],
            "previous_status": previous_status,
            "new_status": new_status,
            "message": result.get("message", "")
        }
    )

    # Create notification if status changed (and not from unknown)
    if previous_status != new_status and previous_status != "unknown":
        await notify_admins_vm_health_change(
            vm_name=vm["name"],
            vm_ip=vm["ip_address"],
            vm_id=vm_id,
            old_status=previous_status,
            new_status=new_status
        )

    status_emoji = "🟢" if new_status == "healthy" else "🔴"
    print(f"{status_emoji} VM '{vm['name']}' health check complete: {new_status}")

    return {
        "vm_id": vm_id,
        "vm_name": vm["name"],
        "ip_address": vm["ip_address"],
        "health_status": new_status,
        "previous_status": previous_status,
        "status_changed": previous_status != new_status,
        "last_health_check": now.isoformat(),
        "message": result.get("message", "Health check completed")
    }


@router.post("/vms/health-check-all")
async def check_all_vms_health(
    current_user: dict = Depends(require_admin)
):
    """
    Check health of all active VMs.
    Returns summary of results.
    """
    vms_collection = get_vms_collection()

    # Get all active VMs
    vms = await vms_collection.find({"is_active": True}).to_list(length=500)

    if not vms:
        return {
            "message": "No active VMs to check",
            "total": 0,
            "results": []
        }

    print(f"🔍 Starting health check for {len(vms)} VMs...")

    results = []
    healthy_count = 0
    unreachable_count = 0
    error_count = 0

    for vm in vms:
        try:
            # Decrypt admin password
            admin_password = decrypt_string(vm.get("admin_password_encrypted", ""))
            
            # Get previous status
            previous_status = vm.get("health_status", "unknown")
            
            # Test connection
            result = await test_vm_connection(
                vm_ip=vm["ip_address"],
                vm_admin_username=vm.get("admin_username", "Administrator"),
                vm_admin_password=admin_password,
                winrm_port=vm.get("winrm_port", 5985),
                timeout=30
            )
            
            # Determine status
            new_status = "healthy" if result.get("reachable", False) else "unreachable"
            now = datetime.now()
            
            # Update VM
            await vms_collection.update_one(
                {"id": vm["id"]},
                {
                    "$set": {
                        "health_status": new_status,
                        "last_health_check": now,
                        "updated_at": now
                    }
                }
            )
            
            # Count results
            if new_status == "healthy":
                healthy_count += 1
            else:
                unreachable_count += 1
            
            # Notify if status changed
            if previous_status != new_status and previous_status != "unknown":
                await notify_admins_vm_health_change(
                    vm_name=vm["name"],
                    vm_ip=vm["ip_address"],
                    vm_id=vm["id"],
                    old_status=previous_status,
                    new_status=new_status
                )
            
            results.append({
                "vm_id": vm["id"],
                "vm_name": vm["name"],
                "ip_address": vm["ip_address"],
                "health_status": new_status,
                "previous_status": previous_status,
                "status_changed": previous_status != new_status,
                "message": result.get("message", "")
            })
            
            status_emoji = "🟢" if new_status == "healthy" else "🔴"
            print(f"  {status_emoji} {vm['name']}: {new_status}")
            
        except Exception as e:
            error_count += 1
            print(f"  ❌ {vm['name']}: Error - {str(e)}")
            results.append({
                "vm_id": vm["id"],
                "vm_name": vm["name"],
                "ip_address": vm["ip_address"],
                "health_status": "error",
                "previous_status": vm.get("health_status", "unknown"),
                "status_changed": False,
                "message": str(e)
            })

    # Log action
    await log_admin_action(
        user_id=current_user["sub"],
        action="health_check_all",
        resource_type="vm",
        resource_id="all",
        details={
            "total_vms": len(vms),
            "healthy": healthy_count,
            "unreachable": unreachable_count,
            "errors": error_count
        }
    )

    print(f"✅ Health check complete: {healthy_count} healthy, {unreachable_count} unreachable, {error_count} errors")

    return {
        "message": f"Health check completed for {len(vms)} VMs",
        "total": len(vms),
        "healthy": healthy_count,
        "unreachable": unreachable_count,
        "errors": error_count,
        "results": results
    }


# ===========================================
# SCHEDULER MANAGEMENT
# ===========================================

@router.get("/scheduler/status")
async def get_scheduler_status_endpoint(
    current_user: dict = Depends(require_admin)
):
    """
    Get background scheduler status and job information.
    
    Returns:
        - status: "running" or "stopped"
        - job_count: Number of scheduled jobs
        - jobs: List of jobs with next run times
    """
    try:
        from app.scheduler import get_scheduler_status
        
        status = get_scheduler_status()
        
        print(f"📅 Scheduler status requested by {current_user.get('username', 'admin')}")
        
        return status
        
    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Scheduler module not available"
        )
    except Exception as e:
        print(f"❌ Error getting scheduler status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get scheduler status: {str(e)}"
        )


@router.post("/scheduler/trigger/{job_id}")
async def trigger_scheduled_job(
    job_id: str,
    current_user: dict = Depends(require_admin)
):
    """
    Manually trigger a scheduled job.
    """
    valid_jobs = ["password_expiry_check", "vm_health_check"]
    
    if job_id not in valid_jobs:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid job_id. Must be one of: {valid_jobs}"
        )
    
    # CALL DIRECTLY (Import is now at top of file)
    print(f"🚀 Manually triggering job '{job_id}' by {current_user.get('username', 'admin')}")
    
    try:
        result = await trigger_job_manually(job_id)
        
        # Log action
        await log_admin_action(
            user_id=current_user["sub"],
            action="trigger_scheduled_job",
            resource_type="scheduler",
            resource_id=job_id,
            details={
                "job_id": job_id,
                "result_summary": {
                    "status": result.get("status"),
                    "job": result.get("job")
                }
            }
        )
        
        print(f"✅ Job '{job_id}' completed successfully")
        return result

    except Exception as e:
        print(f"❌ Error triggering job '{job_id}': {e}")
        # traceback.print_exc() # Optional: print full trace
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to execute job: {str(e)}"
        )


@router.get("/scheduler/jobs")
async def list_scheduler_jobs(
    current_user: dict = Depends(require_admin)
):
    """
    Get detailed list of all scheduled jobs.
    
    Returns:
        List of jobs with:
        - id: Job identifier
        - name: Human-readable name
        - next_run: Next scheduled run time
        - trigger: Trigger type and schedule
    """
    try:
        from app.scheduler import get_scheduler_status
        
        status = get_scheduler_status()
        
        return {
            "scheduler_status": status.get("status"),
            "jobs": status.get("jobs", []),
            "total_jobs": status.get("job_count", len(status.get("jobs", [])))
        }
        
    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Scheduler module not available"
        )
    except Exception as e:
        print(f"❌ Error listing scheduler jobs: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list jobs: {str(e)}"
        )


# ===========================================
# USER-VM MAPPINGS
# ===========================================

@router.get("/mappings", response_model=MappingListResponse)
async def get_all_mappings(
    skip: int = Query(0, ge=0),
    limit: int = Query(500, ge=1, le=1000),
    user_id: Optional[str] = None,
    vm_id: Optional[str] = None,
    current_user: dict = Depends(require_admin)
):
    """Get all user-VM mappings (admin only)."""
    mappings_collection = get_mappings_collection()
    users_collection = get_users_collection()
    vms_collection = get_vms_collection()

    # Build query
    query = {}
    if user_id:
        query["user_id"] = user_id
    if vm_id:
        query["vm_id"] = vm_id

    # Get total count
    total = await mappings_collection.count_documents(query)

    # Get mappings with pagination
    cursor = mappings_collection.find(query).skip(skip).limit(limit)
    mappings = await cursor.to_list(length=limit)

    # Enrich with user and VM info
    mapping_list = []
    for mapping in mappings:
        # Get user info
        user = await users_collection.find_one({"id": mapping["user_id"]})
        # Get VM info
        vm = await vms_collection.find_one({"id": mapping["vm_id"]})
        
        if user and vm:
            mapping_list.append(MappingResponse(
                id=mapping["id"],
                user_id=mapping["user_id"],
                user_username=user["username"],
                user_full_name=user["full_name"],
                vm_id=mapping["vm_id"],
                vm_name=vm["name"],
                vm_ip_address=vm["ip_address"],
                local_username=mapping["local_username"],
                can_reset_password=mapping.get("can_reset_password", True),
                can_view_history=mapping.get("can_view_history", False),
                notes=mapping.get("notes"),
                created_at=mapping.get("created_at", datetime.now()),
                created_by=mapping.get("created_by")
            ))

    return MappingListResponse(mappings=mapping_list, total=total)


@router.post("/mappings", response_model=MappingResponse, status_code=status.HTTP_201_CREATED)
async def create_mapping(
    request: MappingCreateRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_admin)
):
    """Create a user-VM mapping (admin only)."""
    mappings_collection = get_mappings_collection()
    users_collection = get_users_collection()
    vms_collection = get_vms_collection()

    # Verify user exists
    user = await users_collection.find_one({"id": request.user_id})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Verify VM exists
    vm = await vms_collection.find_one({"id": request.vm_id})
    if not vm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="VM not found"
        )

    # Check if mapping already exists
    existing = await mappings_collection.find_one({
        "user_id": request.user_id,
        "vm_id": request.vm_id
    })
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mapping already exists for this user and VM"
        )

    # Create mapping
    mapping_id = generate_uuid()
    now = datetime.now()

    mapping_doc = {
        "id": mapping_id,
        "user_id": request.user_id,
        "vm_id": request.vm_id,
        "local_username": request.local_username,
        "can_reset_password": request.can_reset_password,
        "can_view_history": request.can_view_history,
        "notes": request.notes,
        "created_at": now,
        "created_by": current_user["sub"],
        "days_until_expiry": None,  
        "last_expiry_check": None 
    }

    await mappings_collection.insert_one(mapping_doc)

    background_tasks.add_task(check_and_save_expiry, request.user_id, request.vm_id)

    # Log action
    await log_admin_action(
        user_id=current_user["sub"],
        action="create_mapping",
        resource_type="mapping",
        resource_id=mapping_id,
        details={
            "user_username": user["username"],
            "vm_name": vm["name"],
            "local_username": request.local_username
        }
    )

    print(f"✅ Mapping created: {user['username']} → {vm['name']} ({request.local_username})")

    return MappingResponse(
        id=mapping_id,
        user_id=request.user_id,
        user_username=user["username"],
        user_full_name=user["full_name"],
        vm_id=request.vm_id,
        vm_name=vm["name"],
        vm_ip_address=vm["ip_address"],
        local_username=request.local_username,
        can_reset_password=request.can_reset_password,
        can_view_history=request.can_view_history,
        notes=request.notes,
        created_at=now,
        created_by=current_user["sub"]
    )


@router.put("/mappings/{mapping_id}", response_model=MappingResponse)
async def update_mapping(
    mapping_id: str,
    request: MappingUpdateRequest,
    current_user: dict = Depends(require_admin)
):
    """Update a user-VM mapping (admin only)."""
    mappings_collection = get_mappings_collection()
    users_collection = get_users_collection()
    vms_collection = get_vms_collection()

    # Find mapping
    mapping = await mappings_collection.find_one({"id": mapping_id})
    if not mapping:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mapping not found"
        )

    # Build update document
    update_data = {}

    if request.local_username is not None:
        update_data["local_username"] = request.local_username
    if request.can_reset_password is not None:
        update_data["can_reset_password"] = request.can_reset_password
    if request.can_view_history is not None:
        update_data["can_view_history"] = request.can_view_history
    if request.notes is not None:
        update_data["notes"] = request.notes

    if update_data:
        await mappings_collection.update_one({"id": mapping_id}, {"$set": update_data})

    # Get updated mapping with user and VM info
    updated_mapping = await mappings_collection.find_one({"id": mapping_id})
    user = await users_collection.find_one({"id": updated_mapping["user_id"]})
    vm = await vms_collection.find_one({"id": updated_mapping["vm_id"]})

    # Log action
    await log_admin_action(
        user_id=current_user["sub"],
        action="update_mapping",
        resource_type="mapping",
        resource_id=mapping_id,
        details={"fields_updated": list(update_data.keys())}
    )

    return MappingResponse(
        id=updated_mapping["id"],
        user_id=updated_mapping["user_id"],
        user_username=user["username"],
        user_full_name=user["full_name"],
        vm_id=updated_mapping["vm_id"],
        vm_name=vm["name"],
        vm_ip_address=vm["ip_address"],
        local_username=updated_mapping["local_username"],
        can_reset_password=updated_mapping.get("can_reset_password", True),
        can_view_history=updated_mapping.get("can_view_history", False),
        notes=updated_mapping.get("notes"),
        created_at=updated_mapping.get("created_at", datetime.now()),
        created_by=updated_mapping.get("created_by")
    )


@router.delete("/mappings/{mapping_id}", response_model=MessageResponse)
async def delete_mapping(
    mapping_id: str,
    current_user: dict = Depends(require_admin)
):
    """Delete a user-VM mapping (admin only)."""
    mappings_collection = get_mappings_collection()
    users_collection = get_users_collection()
    vms_collection = get_vms_collection()

    # Find mapping
    mapping = await mappings_collection.find_one({"id": mapping_id})
    if not mapping:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mapping not found"
        )

    # Get user and VM info for logging
    user = await users_collection.find_one({"id": mapping["user_id"]})
    vm = await vms_collection.find_one({"id": mapping["vm_id"]})

    # Delete mapping
    await mappings_collection.delete_one({"id": mapping_id})

    # Log action
    await log_admin_action(
        user_id=current_user["sub"],
        action="delete_mapping",
        resource_type="mapping",
        resource_id=mapping_id,
        details={
            "user_username": user["username"] if user else "unknown",
            "vm_name": vm["name"] if vm else "unknown"
        }
    )

    print(f"✅ Mapping deleted: {user['username'] if user else 'unknown'} → {vm['name'] if vm else 'unknown'}")

    return MessageResponse(message="Mapping deleted successfully")


# ===========================================
# USER MANAGEMENT
# ===========================================

@router.get("/users")
async def get_all_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = None,
    role: Optional[str] = None,
    current_user: dict = Depends(require_admin)
):
    """Get all users (admin only)."""
    users_collection = get_users_collection()

    # Build query
    query = {}
    if search:
        query["$or"] = [
            {"username": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"full_name": {"$regex": search, "$options": "i"}}
        ]
    if role:
        query["role"] = role

    # Get total count
    total = await users_collection.count_documents(query)

    # Get users with pagination
    cursor = users_collection.find(query).skip(skip).limit(limit).sort("username", 1)
    users = await cursor.to_list(length=limit)

    # Convert to response format (exclude password_hash)
    user_list = []
    for user in users:
        user_list.append({
            "id": user["id"],
            "username": user["username"],
            "email": user["email"],
            "full_name": user["full_name"],
            "role": user["role"],
            "is_active": user.get("is_active", True),
            "created_at": user.get("created_at"),
            "last_login": user.get("last_login")
        })

    return {"users": user_list, "total": total}


@router.put("/users/{user_id}/role", response_model=MessageResponse)
async def update_user_role(
    user_id: str,
    role: str = Query(..., description="New role"),
    current_user: dict = Depends(require_admin)
):
    """Update a user's role (admin only)."""
    users_collection = get_users_collection()

    # Validate role
    valid_roles = ["user", "admin", "superadmin"]
    if role not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role. Must be one of: {valid_roles}"
        )

    # Find user
    user = await users_collection.find_one({"id": user_id})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Prevent self-demotion
    if user_id == current_user["sub"] and role != current_user["role"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change your own role"
        )

    # Update role
    await users_collection.update_one(
        {"id": user_id},
        {"$set": {"role": role, "updated_at": datetime.now()}}
    )

    # Log action
    await log_admin_action(
        user_id=current_user["sub"],
        action="update_user_role",
        resource_type="user",
        resource_id=user_id,
        details={"old_role": user["role"], "new_role": role}
    )

    print(f"✅ User role updated: {user['username']} → {role}")

    return MessageResponse(message=f"User role updated to '{role}'")


@router.put("/users/{user_id}/status", response_model=MessageResponse)
async def update_user_status(
    user_id: str,
    is_active: bool = Query(..., description="Active status"),
    current_user: dict = Depends(require_admin)
):
    """Activate or deactivate a user (admin only)."""
    users_collection = get_users_collection()

    # Find user
    user = await users_collection.find_one({"id": user_id})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Prevent self-deactivation
    if user_id == current_user["sub"] and not is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate your own account"
        )

    # Update status
    await users_collection.update_one(
        {"id": user_id},
        {"$set": {"is_active": is_active, "updated_at": datetime.now()}}
    )

    status_text = "activated" if is_active else "deactivated"

    # Log action
    await log_admin_action(
        user_id=current_user["sub"],
        action="update_user_status",
        resource_type="user",
        resource_id=user_id,
        details={"is_active": is_active}
    )

    print(f"✅ User {status_text}: {user['username']}")

    return MessageResponse(message=f"User {status_text} successfully")


# ===========================================
# AUDIT LOGS
# ===========================================

@router.get("/audit-logs")
async def get_audit_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    action: Optional[str] = None,
    user_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(require_admin)
):
    """
    Get audit logs (admin only).
    Enhanced: Now supports date range filtering and returns IP/user agent.
    """
    audit_logs = get_audit_logs_collection()
    users_collection = get_users_collection()

    # Build query
    query = {}
    if action:
        query["action"] = action
    if user_id:
        query["user_id"] = user_id

    # Date range filtering
    if start_date or end_date:
        date_query = {}
        if start_date:
            try:
                date_query["$gte"] = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
            except (ValueError, TypeError):
                pass
        if end_date:
            try:
                date_query["$lte"] = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
            except (ValueError, TypeError):
                pass
        if date_query:
            query["timestamp"] = date_query

    # Get total count
    total = await audit_logs.count_documents(query)

    # Get logs with pagination (newest first)
    cursor = audit_logs.find(query).skip(skip).limit(limit).sort("timestamp", -1)
    logs = await cursor.to_list(length=limit)

    # Get unique actions for filter dropdown
    all_actions = await audit_logs.distinct("action")

    # Enrich with user info
    log_list = []
    for log in logs:
        user = await users_collection.find_one({"id": log["user_id"]})
        log_list.append({
            "id": log["id"],
            "user_id": log["user_id"],
            "user_username": user["username"] if user else "unknown",
            "user_full_name": user["full_name"] if user else "Unknown User",
            "action": log["action"],
            "resource_type": log.get("resource_type", ""),
            "resource_id": log.get("resource_id", ""),
            "details": log.get("details", {}),
            "ip_address": log.get("ip_address"),
            "user_agent": log.get("user_agent"),
            "timestamp": log["timestamp"]
        })

    return {
        "logs": log_list,
        "total": total,
        "available_actions": sorted(all_actions)
    }


# ===========================================
# ADMIN STATISTICS
# ===========================================

@router.get("/stats")
async def get_admin_stats(
    current_user: dict = Depends(require_admin)
):
    """
    Get system-wide statistics for admin dashboard.
    Returns counts of users, VMs, mappings, password resets, and recent activity.
    """
    users_collection = get_users_collection()
    vms_collection = get_vms_collection()
    mappings_collection = get_mappings_collection()
    audit_logs = get_audit_logs_collection()

    now = datetime.now()

    # ===== User Stats =====
    total_users = await users_collection.count_documents({})
    active_users = await users_collection.count_documents({"is_active": True})
    admin_count = await users_collection.count_documents({
        "role": {"$in": ["admin", "superadmin"]}
    })

    # ===== VM Stats =====
    total_vms = await vms_collection.count_documents({})
    active_vms = await vms_collection.count_documents({"is_active": True})
    healthy_vms = await vms_collection.count_documents({"health_status": "healthy"})
    unreachable_vms = await vms_collection.count_documents({"health_status": "unreachable"})
    unknown_vms = total_vms - healthy_vms - unreachable_vms

    # ===== Mapping Stats =====
    total_mappings = await mappings_collection.count_documents({})

    # ===== Password Reset Stats =====
    resets_24h = await audit_logs.count_documents({
        "action": "password_reset",
        "timestamp": {"$gte": now - timedelta(hours=24)}
    })
    resets_7d = await audit_logs.count_documents({
        "action": "password_reset",
        "timestamp": {"$gte": now - timedelta(days=7)}
    })
    resets_30d = await audit_logs.count_documents({
        "action": "password_reset",
        "timestamp": {"$gte": now - timedelta(days=30)}
    })

    # ===== Recent Activity (last 10 logs) =====
    recent_cursor = audit_logs.find({}).sort("timestamp", -1).limit(10)
    recent_logs = await recent_cursor.to_list(length=10)

    recent_activity = []
    for log in recent_logs:
        user = await users_collection.find_one({"id": log["user_id"]})
        recent_activity.append({
            "id": log["id"],
            "action": log["action"],
            "user_username": user["username"] if user else "unknown",
            "user_full_name": user["full_name"] if user else "Unknown User",
            "resource_type": log.get("resource_type", ""),
            "details": log.get("details", {}),
            "timestamp": log["timestamp"]
        })

    return {
        "users": {
            "total": total_users,
            "active": active_users,
            "inactive": total_users - active_users,
            "admins": admin_count
        },
        "vms": {
            "total": total_vms,
            "active": active_vms,
            "healthy": healthy_vms,
            "unreachable": unreachable_vms,
            "unknown": unknown_vms
        },
        "mappings": {
            "total": total_mappings
        },
        "password_resets": {
            "last_24h": resets_24h,
            "last_7d": resets_7d,
            "last_30d": resets_30d
        },
        "recent_activity": recent_activity
    }



@router.post("/vms/{vm_id}/check-user-expiry")
async def check_specific_user_expiry(
    vm_id: str,
    local_username: str = Body(..., embed=True),
    current_user: dict = Depends(require_admin)
):
    """
    Manually check password expiry for a SPECIFIC local user on a VM.
    Useful for debugging or checking unmapped users.
    """
    vms_collection = get_vms_collection()

    # 1. Get VM Details
    vm = await vms_collection.find_one({"id": vm_id})
    if not vm:
        raise HTTPException(status_code=404, detail="VM not found")

    # 2. Decrypt Admin Password
    try:
        admin_password = decrypt_string(vm.get("admin_password_encrypted", ""))
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to decrypt VM admin password")

    print(f"🔍 Manual Expiry Check: Checking user '{local_username}' on '{vm['name']}'...")

    # 3. Run PowerShell Check
    result = await check_password_expiry_ps(
        vm_ip=vm["ip_address"],
        vm_admin_username=vm.get("admin_username", "Administrator"),
        vm_admin_password=admin_password,
        target_username=local_username
    )

    # 4. Return Results
    if not result.get("success"):
        return {
            "status": "error",
            "vm_name": vm["name"],
            "local_username": local_username,
            "error": result.get("error", "Unknown error")
        }

    return {
        "status": "success",
        "vm_name": vm["name"],
        "local_username": local_username,
        "days_until_expiry": result.get("days_until_expiry"),
        "expires_at": result.get("expires_at"),
        "never_expires": result.get("never_expires", False),
        "raw_data": result
    }


