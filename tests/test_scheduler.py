import pytest
from src.core.scheduler import SchedulerService
import asyncio

@pytest.mark.asyncio
async def test_scheduler_singleton():
    s1 = SchedulerService()
    s2 = SchedulerService()
    assert s1 is s2
    assert s1.scheduler is s2.scheduler

from apscheduler.schedulers.base import STATE_STOPPED, STATE_RUNNING

@pytest.mark.asyncio
async def test_scheduler_start_stop():
    scheduler_service = SchedulerService()
    await scheduler_service.start()
    assert scheduler_service.scheduler.state == STATE_RUNNING
    await scheduler_service.shutdown()
    await asyncio.sleep(0.1) # Wait for state change
    assert scheduler_service.scheduler.state == STATE_STOPPED

@pytest.mark.asyncio
async def test_add_remove_job():
    scheduler_service = SchedulerService()
    await scheduler_service.start()
    
    workflow ="example_sync"
    job_id = "test_job_1"
    
    scheduler_service.add_interval_job(workflow, 60, job_id)
    assert scheduler_service.scheduler.get_job(job_id) is not None
    
    scheduler_service.remove_job(job_id)
    assert scheduler_service.scheduler.get_job(job_id) is None
    
    await scheduler_service.shutdown()
