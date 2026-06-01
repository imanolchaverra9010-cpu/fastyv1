"""Helpers to schedule background async jobs from FastAPI routes."""

from __future__ import annotations

from typing import Optional

from fastapi import BackgroundTasks

from async_jobs import enqueue_job, process_job


def schedule_async(
    background_tasks: BackgroundTasks,
    task_type: str,
    payload: dict,
) -> str:
    """Persist job and process it asynchronously after the HTTP response."""
    job_id = enqueue_job(task_type, payload)
    background_tasks.add_task(process_job, job_id)
    return job_id


def schedule_async_many(
    background_tasks: BackgroundTasks,
    task_type: str,
    payloads: list[dict],
) -> list[str]:
    return [schedule_async(background_tasks, task_type, payload) for payload in payloads]
