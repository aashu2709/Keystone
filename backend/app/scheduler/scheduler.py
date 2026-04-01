# backend/app/scheduler/scheduler.py
"""
APScheduler Configuration
=========================
Background job scheduler for:
- Password expiry check: Daily at 9:00 AM
- VM health check: Every 2 hours
"""

import logging
from datetime import datetime
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.events import EVENT_JOB_ERROR, EVENT_JOB_EXECUTED, EVENT_JOB_MISSED
import pytz

from app.config import settings

logger = logging.getLogger(__name__)

# Global scheduler instance
scheduler: AsyncIOScheduler = None


def _create_scheduler() -> AsyncIOScheduler:
    """Create and configure the scheduler."""
    
    # Get timezone from settings or default to UTC
    timezone = getattr(settings, 'TIMEZONE', 'UTC')
    
    return AsyncIOScheduler(
        timezone=pytz.timezone(timezone),
        job_defaults={
            'coalesce': True,          # Combine missed runs into one
            'max_instances': 1,         # Only one instance per job
            'misfire_grace_time': 3600  # 1 hour grace period
        }
    )


def _job_listener(event):
    """Listen to job events for logging."""
    job_id = event.job_id
    
    if event.exception:
        logger.error(
            f"❌ Job '{job_id}' failed with exception: {event.exception}",
            exc_info=True
        )
    else:
        logger.info(f"✅ Job '{job_id}' executed successfully at {datetime.now()}")


def _job_missed_listener(event):
    """Handle missed jobs."""
    logger.warning(f"⚠️ Job '{event.job_id}' missed at {datetime.now()}")


async def _password_expiry_job():
    """
    Wrapper for password expiry check job.
    Runs daily at 9:00 AM.
    """
    logger.info("🔐 Starting scheduled password expiry check...")
    
    try:
        from app.services.password_expiry_service import check_all_password_expiry
        
        result = await check_all_password_expiry()
        
        logger.info(
            f"🔐 Password expiry check completed: "
            f"Checked={result.get('users_checked', 0)}, "
            f"Expiring={result.get('expiring_count', 0)}, "
            f"Notifications={result.get('notifications_sent', 0)}, "
            f"Emails={result.get('emails_sent', 0)}, "
            f"Errors={len(result.get('errors', []))}"
        )
        
        if result.get('errors'):
            for error in result['errors'][:5]:  # Log first 5 errors
                logger.warning(f"   - {error}")
        
        return result
        
    except Exception as e:
        logger.error(f"❌ Password expiry check job failed: {e}", exc_info=True)
        raise


async def _vm_health_check_job():
    """
    Wrapper for VM health check job.
    Runs every 2 hours.
    """
    logger.info("🏥 Starting scheduled VM health check...")
    
    try:
        from app.services.health_check_service import check_all_vms_health
        
        result = await check_all_vms_health()
        
        logger.info(
            f"🏥 VM health check completed: "
            f"Total={result.get('total', 0)}, "
            f"Healthy={result.get('healthy', 0)}, "
            f"Unreachable={result.get('unreachable', 0)}"
        )
        
        return result
        
    except Exception as e:
        logger.error(f"❌ VM health check job failed: {e}", exc_info=True)
        raise


def start_scheduler():
    """
    Initialize and start the background scheduler.
    Should be called during application startup.
    """
    global scheduler
    
    if scheduler is not None and scheduler.running:
        logger.warning("Scheduler is already running")
        return
    
    scheduler = _create_scheduler()
    
    # Add event listeners
    scheduler.add_listener(_job_listener, EVENT_JOB_EXECUTED | EVENT_JOB_ERROR)
    scheduler.add_listener(_job_missed_listener, EVENT_JOB_MISSED)
    
    # =========================================
    # JOB 1: Password Expiry Check
    # Schedule: Daily at 9:00 AM
    # =========================================
    scheduler.add_job(
        _password_expiry_job,
        trigger=IntervalTrigger(hours=3),
        id='password_expiry_check',
        name='Password Expiry Check (Every 3 Hours)',
        replace_existing=True
    )
    logger.info("📅 Scheduled: Password Expiry Check (Daily at 9:00 AM)")
    
    # =========================================
    # JOB 2: VM Health Check
    # Schedule: Every 2 hours
    # =========================================
    scheduler.add_job(
        _vm_health_check_job,
        trigger=IntervalTrigger(hours=3),
        id='vm_health_check',
        name='VM Health Check (Every 3 Hours)',
        replace_existing=True
    )
    logger.info("📅 Scheduled: VM Health Check (Every 2 hours)")
    
    # Start the scheduler
    scheduler.start()
    logger.info("🚀 APScheduler started successfully")
    
    # Run initial health check on startup (after 30 seconds)
    scheduler.add_job(
        _vm_health_check_job,
        trigger='date',
        run_date=datetime.now() + timedelta(seconds=30),
        id='vm_health_check_startup',
        name='VM Health Check (Startup)',
        replace_existing=True
    )
    logger.info("📅 Scheduled: Initial VM health check (in 30 seconds)")


def shutdown_scheduler():
    """
    Gracefully shutdown the scheduler.
    Should be called during application shutdown.
    """
    global scheduler
    
    if scheduler is None:
        return
    
    if scheduler.running:
        scheduler.shutdown(wait=True)
        logger.info("🛑 APScheduler shutdown complete")
    
    scheduler = None


def get_scheduler_status() -> dict:
    """
    Get current scheduler status and job information.
    
    Returns:
        Dict with scheduler status and job details
    """
    global scheduler
    
    if scheduler is None or not scheduler.running:
        return {
            "status": "stopped",
            "jobs": []
        }
    
    jobs = []
    for job in scheduler.get_jobs():
        jobs.append({
            "id": job.id,
            "name": job.name,
            "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
            "trigger": str(job.trigger)
        })
    
    return {
        "status": "running",
        "job_count": len(jobs),
        "jobs": jobs
    }


async def trigger_job_manually(job_id: str) -> dict:
    """
    Manually trigger a scheduled job.
    
    Args:
        job_id: The job identifier ('password_expiry_check' or 'vm_health_check')
    
    Returns:
        Job execution result
    """
    if job_id == 'password_expiry_check':
        result = await _password_expiry_job()
        return {"job": job_id, "status": "completed", "result": result}
    
    elif job_id == 'vm_health_check':
        result = await _vm_health_check_job()
        return {"job": job_id, "status": "completed", "result": result}
    
    else:
        raise ValueError(f"Unknown job: {job_id}")


# Import timedelta for startup job
from datetime import timedelta