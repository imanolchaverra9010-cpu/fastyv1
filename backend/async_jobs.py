"""Persistent async job queue backed by MySQL (with in-memory fallback)."""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timedelta
from typing import Any, Callable, Dict, Optional

from database import get_db

logger = logging.getLogger(__name__)

JobHandler = Callable[[dict], Any]

HANDLERS: Dict[str, JobHandler] = {}

_memory_jobs: dict[str, dict] = {}


def register_handler(task_type: str, handler: JobHandler) -> None:
    HANDLERS[task_type] = handler


def ensure_jobs_schema(db=None) -> None:
    own_db = db is None
    if own_db:
        db = get_db()
    if not db:
        return
    cursor = db.cursor()
    try:
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS async_jobs (
                id VARCHAR(36) PRIMARY KEY,
                task_type VARCHAR(100) NOT NULL,
                payload JSON NOT NULL,
                status ENUM('pending','processing','done','failed') NOT NULL DEFAULT 'pending',
                attempts INT NOT NULL DEFAULT 0,
                max_attempts INT NOT NULL DEFAULT 3,
                last_error TEXT NULL,
                run_after TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_async_jobs_status_run (status, run_after),
                INDEX idx_async_jobs_type (task_type)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
            """
        )
        db.commit()
    except Exception as exc:
        db.rollback()
        logger.warning("Could not ensure async_jobs schema: %s", exc)
    finally:
        cursor.close()
        if own_db:
            db.close()


def enqueue_job(
    task_type: str,
    payload: dict,
    *,
    run_after: Optional[datetime] = None,
    max_attempts: int = 3,
) -> str:
    if task_type not in HANDLERS:
        raise ValueError(f"Unknown async task type: {task_type}")

    job_id = str(uuid.uuid4())
    run_at = run_after or datetime.utcnow()
    payload_json = json.dumps(payload, default=str)

    db = get_db()
    if db:
        ensure_jobs_schema(db)
        cursor = db.cursor()
        try:
            cursor.execute(
                """
                INSERT INTO async_jobs (id, task_type, payload, max_attempts, run_after)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (job_id, task_type, payload_json, max_attempts, run_at),
            )
            db.commit()
            return job_id
        except Exception as exc:
            db.rollback()
            logger.error("enqueue_job DB failed, using memory fallback: %s", exc)
        finally:
            cursor.close()
            db.close()

    _memory_jobs[job_id] = {
        "id": job_id,
        "task_type": task_type,
        "payload": payload,
        "status": "pending",
        "attempts": 0,
        "max_attempts": max_attempts,
        "run_after": run_at,
        "last_error": None,
    }
    return job_id


def _fetch_job(job_id: str) -> Optional[dict]:
    db = get_db()
    if db:
        cursor = db.cursor(dictionary=True)
        try:
            cursor.execute("SELECT * FROM async_jobs WHERE id = %s", (job_id,))
            row = cursor.fetchone()
            if row and isinstance(row.get("payload"), str):
                row["payload"] = json.loads(row["payload"])
            return row
        finally:
            cursor.close()
            db.close()
    return _memory_jobs.get(job_id)


def _mark_job(job_id: str, *, status: str, attempts: int, last_error: Optional[str] = None) -> None:
    db = get_db()
    if db:
        cursor = db.cursor()
        try:
            cursor.execute(
                """
                UPDATE async_jobs
                SET status = %s, attempts = %s, last_error = %s
                WHERE id = %s
                """,
                (status, attempts, last_error, job_id),
            )
            db.commit()
        finally:
            cursor.close()
            db.close()
        return

    job = _memory_jobs.get(job_id)
    if job:
        job["status"] = status
        job["attempts"] = attempts
        job["last_error"] = last_error


def _fetch_pending(limit: int = 20) -> list[dict]:
    db = get_db()
    rows: list[dict] = []
    if db:
        cursor = db.cursor(dictionary=True)
        try:
            cursor.execute(
                """
                SELECT * FROM async_jobs
                WHERE status = 'pending'
                  AND run_after <= UTC_TIMESTAMP()
                  AND attempts < max_attempts
                ORDER BY created_at ASC
                LIMIT %s
                """,
                (limit,),
            )
            rows = cursor.fetchall() or []
            for row in rows:
                if isinstance(row.get("payload"), str):
                    row["payload"] = json.loads(row["payload"])
        finally:
            cursor.close()
            db.close()
    else:
        now = datetime.utcnow()
        rows = [
            job
            for job in _memory_jobs.values()
            if job["status"] == "pending"
            and job["attempts"] < job["max_attempts"]
            and job["run_after"] <= now
        ][:limit]
    return rows


async def process_job(job_id: str) -> dict:
    job = _fetch_job(job_id)
    if not job:
        return {"job_id": job_id, "status": "missing"}

    if job["status"] in {"done", "processing"}:
        return {"job_id": job_id, "status": job["status"]}

    task_type = job["task_type"]
    handler = HANDLERS.get(task_type)
    if not handler:
        _mark_job(job_id, status="failed", attempts=job.get("attempts", 0) + 1, last_error="Handler not found")
        return {"job_id": job_id, "status": "failed", "error": "Handler not found"}

    attempt = int(job.get("attempts") or 0) + 1
    _mark_job(job_id, status="processing", attempts=attempt)

    try:
        import asyncio

        payload = job["payload"] if isinstance(job["payload"], dict) else json.loads(job["payload"])
        if asyncio.iscoroutinefunction(handler):
            await handler(payload)
        else:
            handler(payload)
        _mark_job(job_id, status="done", attempts=attempt)
        return {"job_id": job_id, "status": "done", "task_type": task_type}
    except Exception as exc:
        logger.exception("Async job %s failed: %s", job_id, exc)
        max_attempts = int(job.get("max_attempts") or 3)
        if attempt >= max_attempts:
            _mark_job(job_id, status="failed", attempts=attempt, last_error=str(exc))
            status = "failed"
        else:
            retry_at = datetime.utcnow() + timedelta(seconds=min(60 * attempt, 300))
            db = get_db()
            if db:
                cursor = db.cursor()
                try:
                    cursor.execute(
                        """
                        UPDATE async_jobs
                        SET status = 'pending', attempts = %s, last_error = %s, run_after = %s
                        WHERE id = %s
                        """,
                        (attempt, str(exc), retry_at, job_id),
                    )
                    db.commit()
                finally:
                    cursor.close()
                    db.close()
            elif job_id in _memory_jobs:
                _memory_jobs[job_id]["status"] = "pending"
                _memory_jobs[job_id]["attempts"] = attempt
                _memory_jobs[job_id]["last_error"] = str(exc)
                _memory_jobs[job_id]["run_after"] = retry_at
            status = "retry"
        return {"job_id": job_id, "status": status, "error": str(exc), "task_type": task_type}


async def process_pending_jobs(limit: int = 20) -> dict:
    jobs = _fetch_pending(limit)
    results = []
    for job in jobs:
        results.append(await process_job(job["id"]))
    processed = sum(1 for r in results if r.get("status") == "done")
    failed = sum(1 for r in results if r.get("status") == "failed")
    retried = sum(1 for r in results if r.get("status") == "retry")
    return {
        "queued": len(jobs),
        "processed": processed,
        "failed": failed,
        "retried": retried,
        "results": results,
    }


def get_job_status(job_id: str) -> Optional[dict]:
    job = _fetch_job(job_id)
    if not job:
        return None
    return {
        "id": job["id"],
        "task_type": job["task_type"],
        "status": job["status"],
        "attempts": job.get("attempts", 0),
        "max_attempts": job.get("max_attempts", 3),
        "last_error": job.get("last_error"),
    }
