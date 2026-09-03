# backend/app/scheduler/scheduler.py
"""
APScheduler Configuration
=========================
Background job scheduler.

Fixes Applied:
  Fix 1 - Telemetry uses loop model (run → wait 30s → run) via asyncio task,
           NOT a fixed-interval APScheduler job. This prevents skipped cycles
           when collection takes longer than 30 seconds.
  Fix 5 - Startup burst: telemetry collection fires 5s after boot,
           so a backend restart causes only a 5s gap, not a 30+ min gap.
  Fix 6 - Nightly 3:00 AM job compresses raw telemetry older than 24h
           into 5-minute averages in telemetry_compressed collection.

Other jobs (health check, password expiry) remain APScheduler-managed
because they are infrequent and duration doesn't matter.
"""

import asyncio
import logging
from datetime import datetime, timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.events import EVENT_JOB_ERROR, EVENT_JOB_EXECUTED, EVENT_JOB_MISSED
import pytz

from app.config import settings

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────
# GLOBALS
# ─────────────────────────────────────────────
scheduler: AsyncIOScheduler = None
_telemetry_loop_task: asyncio.Task = None   # Fix 1: asyncio task handle


# ─────────────────────────────────────────────
# FIX 1: LOOP-BASED TELEMETRY RUNNER
# "run → wait 30s → run" — never skips a cycle.
# ─────────────────────────────────────────────
async def _telemetry_loop():
    """
    Fix 1: Loop-based telemetry collection.

    Replaces the APScheduler IntervalTrigger(seconds=30) approach.
    The loop waits 30 seconds AFTER the previous run finishes,
    so a slow cycle (e.g. 80s for 500 VMs) never causes a skip.

    Fix 5: First run fires after only 5 seconds (startup burst).
    """
    from app.services.telemetry_service import collect_all_telemetry

    logger.info("🔁 Telemetry loop started — first run in 5 seconds (Fix 5)")

    # Fix 5: Wait only 5s on startup so the first data arrives quickly
    await asyncio.sleep(5)

    while True:
        try:
            await collect_all_telemetry()
        except asyncio.CancelledError:
            logger.info("🛑 Telemetry loop cancelled — shutting down")
            break
        except Exception as e:
            # Log but don't crash the loop — next iteration will retry
            logger.error(f"❌ Telemetry loop iteration failed: {e}", exc_info=True)

        # Wait 15s AFTER the run completes. With lite script (~18s per cycle),
        # total interval is ~33s per VM data point — dense enough for gap-free graphs.
        await asyncio.sleep(15)


def start_telemetry_loop():
    """
    Launch the telemetry loop as an asyncio background task.
    Must be called from within a running asyncio event loop (i.e. inside lifespan).
    """
    global _telemetry_loop_task
    _telemetry_loop_task = asyncio.create_task(_telemetry_loop())
    logger.info("✅ Telemetry loop task created")


def stop_telemetry_loop():
    """Cancel the telemetry loop on shutdown."""
    global _telemetry_loop_task
    if _telemetry_loop_task and not _telemetry_loop_task.done():
        _telemetry_loop_task.cancel()
        logger.info("🛑 Telemetry loop task cancelled")


# ─────────────────────────────────────────────
# APScheduler JOBS (infrequent, fixed schedule)
# ─────────────────────────────────────────────

def _create_scheduler() -> AsyncIOScheduler:
    """Create and configure the APScheduler instance."""
    timezone = getattr(settings, "TIMEZONE", "UTC")
    return AsyncIOScheduler(
        timezone=pytz.timezone(timezone),
        job_defaults={
            "coalesce": True,           # Combine missed runs into one
            "max_instances": 1,          # Only one instance per job at a time
            "misfire_grace_time": 3600   # 1-hour grace period for missed jobs
        }
    )


def _job_listener(event):
    """Log job execution results."""
    if event.exception:
        logger.error(f"❌ Job '{event.job_id}' failed: {event.exception}", exc_info=True)
    else:
        logger.info(f"✅ Job '{event.job_id}' executed successfully at {datetime.now()}")


def _job_missed_listener(event):
    """Log missed jobs."""
    logger.warning(f"⚠️ Job '{event.job_id}' missed its scheduled time at {datetime.now()}")


async def _password_expiry_job():
    """Password expiry check — runs every 3 hours."""
    logger.info("🔐 Starting scheduled password expiry check...")
    try:
        from app.services.password_expiry_service import check_all_password_expiry
        result = await check_all_password_expiry()
        logger.info(
            f"🔐 Password expiry check done: "
            f"Checked={result.get('users_checked', 0)}, "
            f"Expiring={result.get('expiring_count', 0)}, "
            f"Notifications={result.get('notifications_sent', 0)}, "
            f"Emails={result.get('emails_sent', 0)}, "
            f"Errors={len(result.get('errors', []))}"
        )
        if result.get("errors"):
            for err in result["errors"][:5]:
                logger.warning(f"   - {err}")
        return result
    except Exception as e:
        logger.error(f"❌ Password expiry job failed: {e}", exc_info=True)
        raise


async def _vm_health_check_job():
    """VM connectivity health check — runs every 3 hours."""
    logger.info("🏥 Starting scheduled VM health check...")
    try:
        from app.services.health_check_service import check_all_vms_health
        result = await check_all_vms_health()
        logger.info(
            f"🏥 VM health check done: "
            f"Total={result.get('total', 0)}, "
            f"Healthy={result.get('healthy', 0)}, "
            f"Unreachable={result.get('unreachable', 0)}"
        )
        return result
    except Exception as e:
        logger.error(f"❌ VM health check job failed: {e}", exc_info=True)
        raise


async def _nightly_downsampling_job():
    """
    Fix 6: Nightly 3:00 AM job.
    Compresses raw telemetry older than 24h into 5-minute averaged buckets.
    """
    logger.info("🗜️  Starting nightly telemetry downsampling...")
    try:
        from app.services.telemetry_service import downsample_old_telemetry
        await downsample_old_telemetry()
        logger.info("🗜️  Nightly downsampling complete.")
    except Exception as e:
        logger.error(f"❌ Nightly downsampling job failed: {e}", exc_info=True)
        raise


# ─────────────────────────────────────────────
# SCHEDULER LIFECYCLE
# ─────────────────────────────────────────────

def start_scheduler():
    """
    Initialize and start the APScheduler for infrequent jobs.
    The telemetry loop is started separately via start_telemetry_loop().
    Should be called during application startup (inside lifespan).
    """
    global scheduler

    if scheduler is not None and scheduler.running:
        logger.warning("Scheduler is already running")
        return

    scheduler = _create_scheduler()

    # Listeners
    scheduler.add_listener(_job_listener, EVENT_JOB_EXECUTED | EVENT_JOB_ERROR)
    scheduler.add_listener(_job_missed_listener, EVENT_JOB_MISSED)

    # ── Job 1: Password Expiry Check (every 3 hours) ──────────────
    scheduler.add_job(
        _password_expiry_job,
        trigger=IntervalTrigger(hours=3),
        id="password_expiry_check",
        name="Password Expiry Check (Every 3 Hours)",
        replace_existing=True,
    )
    logger.info("📅 Scheduled: Password Expiry Check (every 3 hours)")

    # ── Job 2: VM Health Check (every 3 hours) ────────────────────
    scheduler.add_job(
        _vm_health_check_job,
        trigger=IntervalTrigger(hours=3),
        id="vm_health_check",
        name="VM Health Check (Every 3 Hours)",
        replace_existing=True,
    )
    logger.info("📅 Scheduled: VM Health Check (every 3 hours)")

    # ── Job 3: Fix 6 — Nightly Downsampling at 3:00 AM ───────────
    scheduler.add_job(
        _nightly_downsampling_job,
        trigger=CronTrigger(hour=3, minute=0),  # Every night at 3:00 AM
        id="nightly_telemetry_downsampling",
        name="Nightly Telemetry Downsampling (3:00 AM)",
        replace_existing=True,
    )
    logger.info("📅 Scheduled: Nightly Telemetry Downsampling (3:00 AM daily)")

    # ── Startup health check (30s after boot) ─────────────────────
    scheduler.add_job(
        _vm_health_check_job,
        trigger="date",
        run_date=datetime.now() + timedelta(seconds=30),
        id="vm_health_check_startup",
        name="VM Health Check (Startup)",
        replace_existing=True,
    )
    logger.info("📅 Scheduled: Initial VM health check in 30 seconds")

    scheduler.start()
    logger.info("🚀 APScheduler started successfully")


def shutdown_scheduler():
    """Gracefully shut down APScheduler."""
    global scheduler
    if scheduler is None:
        return
    if scheduler.running:
        scheduler.shutdown(wait=True)
        logger.info("🛑 APScheduler shutdown complete")
    scheduler = None


# ─────────────────────────────────────────────
# STATUS & MANUAL TRIGGER
# ─────────────────────────────────────────────

def get_scheduler_status() -> dict:
    """Return current APScheduler status and job list."""
    global scheduler, _telemetry_loop_task

    telemetry_loop_running = (
        _telemetry_loop_task is not None and not _telemetry_loop_task.done()
    )

    if scheduler is None or not scheduler.running:
        return {
            "status": "stopped",
            "telemetry_loop": "running" if telemetry_loop_running else "stopped",
            "jobs": [],
        }

    jobs = [
        {
            "id":       job.id,
            "name":     job.name,
            "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
            "trigger":  str(job.trigger),
        }
        for job in scheduler.get_jobs()
    ]

    return {
        "status":         "running",
        "telemetry_loop": "running" if telemetry_loop_running else "stopped",
        "job_count":      len(jobs),
        "jobs":           jobs,
    }


async def trigger_job_manually(job_id: str) -> dict:
    """Manually trigger a scheduled job by ID."""
    if job_id == "password_expiry_check":
        result = await _password_expiry_job()
        return {"job": job_id, "status": "completed", "result": result}

    elif job_id == "vm_health_check":
        result = await _vm_health_check_job()
        return {"job": job_id, "status": "completed", "result": result}

    elif job_id == "vm_telemetry_collection":
        from app.services.telemetry_service import collect_all_telemetry
        await collect_all_telemetry()
        return {"job": job_id, "status": "completed", "result": "Telemetry collection triggered"}

    elif job_id == "nightly_telemetry_downsampling":
        await _nightly_downsampling_job()
        return {"job": job_id, "status": "completed", "result": "Downsampling triggered manually"}

    else:
        raise ValueError(f"Unknown job_id: '{job_id}'. Valid: password_expiry_check, vm_health_check, vm_telemetry_collection, nightly_telemetry_downsampling")