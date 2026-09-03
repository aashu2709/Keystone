# backend/app/services/telemetry_service.py
"""
Telemetry Service
=================
Handles collection, storage, retrieval, and downsampling of VM telemetry data.

Fixes Applied:
  Fix 2 - VM order shuffled every cycle (already existed, kept)
  Fix 3 - Semaphore raised from 8 → 25 for 3x faster cycles
  Fix 3 - No VM cap (removed length=100, now fetches ALL active VMs)
  Fix 6 - Nightly downsampling: raw 30s data kept 24h, then compressed
           to 5-min averages in a separate collection for long-term history
"""

import asyncio
import logging
import time
import random
from datetime import datetime, timedelta
from typing import List, Dict, Any

from app.database import get_vms_collection, get_telemetry_collection, get_database
from app.utils.powershell import execute_telemetry_lite
from app.utils.security import decrypt_string

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────
# CONSTANTS
# ─────────────────────────────────────────────
SEMAPHORE_LIMIT   = 3           # Max 3 concurrent WinRM sessions. Windows default
                                # MaxShellsPerUser = 5. With 25 we were exceeding this
                                # on any timeout, causing cascading shell exhaustion.
                                # 3 is safe: even if all 3 timeout & leak, we're at 3 < 5.
RAW_RETENTION_HRS = 24          # Keep 30s raw data for 24 hours
COMPRESS_BUCKET_MIN = 5         # Compress into 5-minute average buckets

# ─────────────────────────────────────────────
# LIVE STATS — readable from the debug endpoint
# ─────────────────────────────────────────────
_loop_stats = {
    "cycle_count":        0,
    "last_cycle_start":   None,   # ISO string
    "last_cycle_end":     None,   # ISO string
    "last_duration_sec":  None,   # float
    "last_total_vms":     0,
    "last_success":       0,
    "last_errors":        0,
    "last_vm_errors":     [],     # list of failed VM names
}



# ─────────────────────────────────────────────
# FIX 3 + FIX 2: COLLECT ALL TELEMETRY
# No VM cap. Shuffled. 25 concurrent slots.
# ─────────────────────────────────────────────
async def collect_all_telemetry():
    """
    Background task: collect telemetry from ALL active VMs.
    Called by the loop runner in scheduler.py (Fix 1).
    
    Fix 2: Shuffles VM order every cycle — no VM is always last.
    Fix 3: Semaphore=25 — 3x faster than the old semaphore=8.
    Fix 3: No length cap — fetches every active VM regardless of count.
    """
    vms_collection      = get_vms_collection()
    telemetry_collection = get_telemetry_collection()

    # Fetch ALL active VMs — no arbitrary cap (Fix 3)
    active_vms = await vms_collection.find({"is_active": True}).to_list(length=None)

    if not active_vms:
        logger.info("📊 No active VMs found — skipping telemetry cycle.")
        return

    # Shuffle so no VM is always processed last (Fix 2)
    random.shuffle(active_vms)

    total = len(active_vms)
    _loop_stats["cycle_count"] += 1
    _loop_stats["last_cycle_start"] = datetime.now().isoformat()
    _loop_stats["last_total_vms"] = total
    _loop_stats["last_vm_errors"] = []   # reset per cycle
    logger.info(f"📊 Telemetry cycle #{_loop_stats['cycle_count']} starting — {total} VMs, semaphore={SEMAPHORE_LIMIT}")
    start_time = time.time()

    semaphore     = asyncio.Semaphore(SEMAPHORE_LIMIT)  # Fix 3
    success_count = 0
    error_count   = 0

    async def collect_single(vm):
        nonlocal success_count, error_count
        async with semaphore:
            vm_id = vm["id"]
            ip    = vm["ip_address"]
            name  = vm.get("name", ip)
            user  = vm.get("admin_username", "Administrator")

            try:
                enc_pass = vm.get("admin_password_encrypted", "")
                if not enc_pass:
                    logger.warning(f"⚠️ No credentials for {name} — skipping")
                    return

                pwd = decrypt_string(enc_pass)

                # Fast TCP pre-check on WinRM port 5985 (2s timeout)
                # If a VM is offline/unreachable, we skip it instantly instead of wasting a thread for 20s!
                try:
                    fut = asyncio.open_connection(ip, 5985)
                    reader, writer = await asyncio.wait_for(fut, timeout=2.0)
                    writer.close()
                    await writer.wait_closed()
                except Exception:
                    logger.warning(f"🔌 VM {name} ({ip}) is offline on WinRM port 5985 — skipped in 2s.")
                    error_count += 1
                    _loop_stats["last_vm_errors"].append(name)
                    return

                result = await execute_telemetry_lite(ip, user, pwd)

                if result.get("success") and result.get("data"):
                    data = result["data"]
                    record = {
                        "vm_id":        vm_id,
                        "epoch_ms":     int(time.time() * 1000),
                        "timestamp":    datetime.now(),
                        "cpu":          data["cpu"],
                        "memory":       data["memory"],
                        "disks":        data.get("disks", []),
                        "os_info":      data.get("os", {}),
                        "disk_io":      data.get("disk_io", {}),
                        "active_users": data.get("active_users", []),
                    }
                    await telemetry_collection.insert_one(record)
                    success_count += 1
                else:
                    msg = result.get("message", "Unknown error")
                    logger.warning(f"⚠️ Telemetry failed for {name} ({ip}): {msg}")
                    error_count += 1
                    _loop_stats["last_vm_errors"].append(name)

            except Exception as e:
                logger.error(f"❌ Exception for {name} ({ip}): {e}")
                error_count += 1
                _loop_stats["last_vm_errors"].append(name)

    await asyncio.gather(*[collect_single(vm) for vm in active_vms])

    duration = time.time() - start_time
    _loop_stats["last_cycle_end"]    = datetime.now().isoformat()
    _loop_stats["last_duration_sec"] = round(duration, 1)
    _loop_stats["last_success"]      = success_count
    _loop_stats["last_errors"]       = error_count
    _loop_stats["last_vm_errors"]    = _loop_stats["last_vm_errors"][-10:]  # keep last 10 only
    logger.info(
        f"📊 Telemetry cycle #{_loop_stats['cycle_count']} done in {duration:.1f}s — "
        f"✅ {success_count} ok  ❌ {error_count} failed  total={total}"
    )


# ─────────────────────────────────────────────
# FIX 6: NIGHTLY DOWNSAMPLING JOB
# Called by scheduler at 3:00 AM every night.
# ─────────────────────────────────────────────
async def downsample_old_telemetry():
    """
    Fix 6: Compress raw telemetry older than 24 hours into 5-minute averages.

    Raw records (30s each) → 1 compressed record per 5-minute bucket.
    Keeps max/min/avg for CPU and RAM.
    Raw records are deleted after compression to keep DB lean.

    Run nightly — safe to re-run (idempotent per bucket).
    """
    db                   = get_database()
    telemetry_collection = get_telemetry_collection()
    compressed_col       = db.telemetry_compressed

    cutoff = datetime.now() - timedelta(hours=RAW_RETENTION_HRS)

    logger.info(f"🗜️  Downsampling: compressing raw telemetry older than {cutoff.strftime('%Y-%m-%d %H:%M')}")

    # Find all distinct vm_ids that have old data
    old_vm_ids = await telemetry_collection.distinct("vm_id", {"timestamp": {"$lt": cutoff}})

    if not old_vm_ids:
        logger.info("🗜️  Nothing to compress — all data is within 24h window.")
        return

    total_raw_deleted  = 0
    total_buckets_saved = 0

    for vm_id in old_vm_ids:
        # Fetch all old raw records for this VM
        cursor = telemetry_collection.find(
            {"vm_id": vm_id, "timestamp": {"$lt": cutoff}},
            sort=[("timestamp", 1)]
        )
        raw_records = await cursor.to_list(length=None)

        if not raw_records:
            continue

        # Group records into 5-minute buckets
        buckets: Dict[datetime, List[Dict]] = {}
        for record in raw_records:
            ts = record["timestamp"]
            # Snap to nearest 5-minute floor
            bucket_minute = (ts.minute // COMPRESS_BUCKET_MIN) * COMPRESS_BUCKET_MIN
            bucket_start  = ts.replace(minute=bucket_minute, second=0, microsecond=0)
            buckets.setdefault(bucket_start, []).append(record)

        ids_to_delete = [r["_id"] for r in raw_records]

        # Build compressed records
        compressed_docs = []
        for bucket_start, records in buckets.items():
            cpu_vals = []
            ram_vals = []
            for r in records:
                try:
                    cpu_vals.append(r["cpu"]["loadPercent"])
                    ram_vals.append(r["memory"]["usedPercent"])
                except (KeyError, TypeError):
                    pass

            if not cpu_vals:
                continue

            compressed_docs.append({
                "vm_id":        vm_id,
                "bucket_start": bucket_start,
                "bucket_end":   bucket_start + timedelta(minutes=COMPRESS_BUCKET_MIN),
                # CPU
                "avg_cpu": round(sum(cpu_vals) / len(cpu_vals), 2),
                "max_cpu": round(max(cpu_vals), 2),
                "min_cpu": round(min(cpu_vals), 2),
                # RAM
                "avg_ram": round(sum(ram_vals) / len(ram_vals), 2) if ram_vals else None,
                "max_ram": round(max(ram_vals), 2) if ram_vals else None,
                "min_ram": round(min(ram_vals), 2) if ram_vals else None,
                # Meta
                "sample_count": len(records),
                "compressed_at": datetime.now(),
            })

        # Save compressed + delete raw (in that order — safe if interrupted)
        if compressed_docs:
            await compressed_col.insert_many(compressed_docs)
            total_buckets_saved += len(compressed_docs)

        if ids_to_delete:
            result = await telemetry_collection.delete_many({"_id": {"$in": ids_to_delete}})
            total_raw_deleted += result.deleted_count

    logger.info(
        f"🗜️  Downsampling done — "
        f"🗑️  {total_raw_deleted} raw records deleted, "
        f"📦 {total_buckets_saved} compressed buckets saved, "
        f"VMs processed: {len(old_vm_ids)}"
    )


# ─────────────────────────────────────────────
# FIX 4 SUPPORT: SMART WINDOWED FETCH
# Reads raw collection for ≤24h windows,
# reads compressed collection for older windows.
# ─────────────────────────────────────────────
async def get_all_telemetry(vm_id: str, hours: float = None) -> List[Dict[str, Any]]:
    """
    Fetch telemetry for a VM, smart-routing to the right collection:
      - hours ≤ 24  (or None/unspecified) → raw 30s records
      - hours > 24                         → compressed 5-min records

    Frontend passes the selected time range (e.g. 1, 6, 24, 168, 720).
    """
    db                   = get_database()
    telemetry_collection = get_telemetry_collection()
    compressed_col       = db.telemetry_compressed

    now = datetime.now()

    # ── Short window: use raw collection ──────────────────────────
    if hours is None or hours <= RAW_RETENTION_HRS:
        cutoff = now - timedelta(hours=(hours or RAW_RETENTION_HRS))
        cursor = telemetry_collection.find(
            {"vm_id": vm_id, "timestamp": {"$gte": cutoff}},
            sort=[("timestamp", 1)]
        )
        raw_records = await cursor.to_list(length=None)

        formatted = []
        for r in raw_records:
            epoch_ms = r.get("epoch_ms") or int(r["timestamp"].timestamp() * 1000)
            try:
                formatted.append({
                    "timestamp": epoch_ms,
                    "cpu":       r["cpu"]["loadPercent"],
                    "ram":       r["memory"]["usedPercent"],
                    "details": {
                        "usedRamGb":  r["memory"]["usedGB"],
                        "totalRamGb": r["memory"]["totalGB"],
                        "uptime":     r["os_info"].get("uptimeSeconds"),
                    },
                    "source": "raw",
                })
            except (KeyError, TypeError):
                continue
        return formatted

    # ── Long window: use compressed collection ────────────────────
    cutoff = now - timedelta(hours=hours)
    cursor = compressed_col.find(
        {"vm_id": vm_id, "bucket_start": {"$gte": cutoff}},
        sort=[("bucket_start", 1)]
    )
    compressed_records = await cursor.to_list(length=None)

    # Also append any recent raw data (last 24h) to fill in the tail
    raw_cursor = telemetry_collection.find(
        {"vm_id": vm_id, "timestamp": {"$gte": now - timedelta(hours=RAW_RETENTION_HRS)}},
        sort=[("timestamp", 1)]
    )
    raw_records = await raw_cursor.to_list(length=None)

    formatted = []

    # Compressed portion
    for r in compressed_records:
        epoch_ms = int(r["bucket_start"].timestamp() * 1000)
        formatted.append({
            "timestamp": epoch_ms,
            "cpu":       r["avg_cpu"],
            "ram":       r.get("avg_ram"),
            "details": {
                "max_cpu": r["max_cpu"],
                "min_cpu": r["min_cpu"],
                "max_ram": r.get("max_ram"),
                "min_ram": r.get("min_ram"),
                "samples": r["sample_count"],
            },
            "source": "compressed",
        })

    # Raw tail portion
    for r in raw_records:
        epoch_ms = r.get("epoch_ms") or int(r["timestamp"].timestamp() * 1000)
        try:
            formatted.append({
                "timestamp": epoch_ms,
                "cpu":       r["cpu"]["loadPercent"],
                "ram":       r["memory"]["usedPercent"],
                "details": {
                    "usedRamGb":  r["memory"]["usedGB"],
                    "totalRamGb": r["memory"]["totalGB"],
                    "uptime":     r["os_info"].get("uptimeSeconds"),
                },
                "source": "raw",
            })
        except (KeyError, TypeError):
            continue

    return formatted


# ─────────────────────────────────────────────
# SAVE SINGLE POINT (called from live API hit)
# ─────────────────────────────────────────────
async def save_single_telemetry(vm_id: str, data: Dict[str, Any]):
    """
    Save one telemetry point fetched via the real-time dashboard API.
    Keeps the graph seamless when the admin is watching live.
    """
    try:
        telemetry_collection = get_telemetry_collection()
        record = {
            "vm_id":        vm_id,
            "epoch_ms":     int(time.time() * 1000),
            "timestamp":    datetime.now(),
            "cpu":          data["cpu"],
            "memory":       data["memory"],
            "disks":        data.get("disks", []),
            "os_info":      data.get("os", {}),
            "disk_io":      data.get("disk_io", {}),
            "active_users": data.get("active_users", []),
        }
        await telemetry_collection.insert_one(record)
    except Exception as e:
        logger.error(f"Failed to auto-save live telemetry: {e}")


# ─────────────────────────────────────────────
# DEBUG: LOOP HEALTH STATS
# ─────────────────────────────────────────────
async def get_telemetry_loop_stats(vm_id: str) -> Dict[str, Any]:
    """
    Return loop health info for the debug endpoint.
    Shows: cycle count, last cycle duration, success/error breakdown,
    and how many DB records exist for this VM in the last hour.
    """
    telemetry_collection = get_telemetry_collection()
    one_hour_ago = datetime.now() - timedelta(hours=1)

    recent_count = await telemetry_collection.count_documents({
        "vm_id": vm_id,
        "timestamp": {"$gte": one_hour_ago}
    })

    return {
        "loop_stats": {**_loop_stats},
        "vm_id": vm_id,
        "records_last_1h": recent_count,
        "expected_per_hour": "~72 (every 50s average)",
        "diagnosis": (
            "OK — data flowing well" if recent_count >= 50
            else f"SPARSE — only {recent_count} records in last 1h. "
                 f"Background loop may be slow or VM is unreachable."
        )
    }

