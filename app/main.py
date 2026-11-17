"""DevOps Incident & Task Management API with Observability & Security."""

import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import List, Optional

import httpx
from fastapi import Depends, FastAPI, HTTPException, Request, Response, Security, status
from fastapi.responses import FileResponse
from fastapi.security import APIKeyHeader, APIKeyQuery
from fastapi.staticfiles import StaticFiles
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Gauge, Histogram, generate_latest

from app.config import API_KEY, METRICS_TOKEN
from app.database import (
    create_probe,
    create_todo,
    delete_probe,
    delete_todo,
    get_todo,
    init_db,
    list_probes,
    list_todos,
    reset_store,
    update_probe_result,
    update_todo,
)
from app.models import ServiceProbe, ServiceProbeCreate, Todo, TodoCreate, TodoUpdate

SERVER_START_TIME = time.time()
TOTAL_PROCESSED_REQUESTS = 0

# --- Lifespan for database initialization ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="DevOps Incident & Reliability Hub",
    description="Real-world incident & task tracker with SRE prober and telemetry",
    version="2.0.0",
    lifespan=lifespan,
)

# --- Static Files Configuration ---
STATIC_DIR = Path(__file__).resolve().parent / "static"
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# --- Security and Authentication Schemes ---
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)
api_key_query = APIKeyQuery(name="api_key", auto_error=False)


def verify_api_key(
    request: Request,
    header_key: Optional[str] = Security(api_key_header),
    query_key: Optional[str] = Security(api_key_query),
) -> None:
    """Validate API Key if configured in environment."""
    if not API_KEY:
        return  # Open for development / default mode

    auth_header = request.headers.get("Authorization", "")
    bearer_key = None
    if auth_header.startswith("Bearer "):
        bearer_key = auth_header.split(" ", 1)[1].strip()

    token = header_key or query_key or bearer_key
    if not token or token != API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Invalid or missing API Key. Pass 'X-API-Key' header.",
            headers={"WWW-Authenticate": "ApiKey"},
        )


# --- Prometheus Metrics ---
REQUEST_COUNT = Counter(
    "http_requests_total",
    "Total number of HTTP requests",
    ["method", "path", "status"],
)
REQUEST_LATENCY = Histogram(
    "http_request_duration_seconds",
    "HTTP request latency in seconds",
    ["method", "path"],
)
INCIDENT_COUNT = Counter(
    "devops_incidents_total",
    "Total incidents and tasks tracked",
    ["priority", "category"],
)
PROBE_LATENCY = Histogram(
    "service_probe_duration_seconds",
    "Synthetic probe latency in seconds",
    ["service_name"],
)
PROBE_STATUS = Gauge(
    "service_probe_up",
    "Service probe status: 1 for UP, 0 for DOWN",
    ["service_name"],
)


@app.middleware("http")
async def track_metrics_and_security(request: Request, call_next):
    """Enforce security response headers and track latency/request metrics."""
    global TOTAL_PROCESSED_REQUESTS
    TOTAL_PROCESSED_REQUESTS += 1

    start = time.perf_counter()
    response = await call_next(request)
    elapsed = time.perf_counter() - start

    # Security Headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

    # Route-aware Prometheus metrics
    route = request.scope.get("route")
    path = route.path if route else request.url.path

    if path != "/metrics":
        REQUEST_COUNT.labels(request.method, path, str(response.status_code)).inc()
        REQUEST_LATENCY.labels(request.method, path).observe(elapsed)

    return response


# --- Core Endpoints ---
@app.get("/", include_in_schema=False)
@app.get("/analytics", include_in_schema=False)
@app.get("/guide", include_in_schema=False)
@app.get("/uptime", include_in_schema=False)
@app.get("/settings", include_in_schema=False)
def index() -> FileResponse:
    """Serve the single-page frontend application."""
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/stats")
def get_system_stats() -> dict:
    """Provide layman-friendly real-time system analytics and health summary."""
    all_todos = list_todos()
    all_probes = list_probes()
    up_probes = [p for p in all_probes if p.get("status") == "UP"]
    uptime_sec = round(time.time() - SERVER_START_TIME, 1)
    hours, remainder = divmod(int(uptime_sec), 3600)
    minutes, seconds = divmod(remainder, 60)

    return {
        "status": "healthy",
        "uptime_seconds": uptime_sec,
        "uptime_formatted": f"{hours}h {minutes}m {seconds}s",
        "total_requests": TOTAL_PROCESSED_REQUESTS,
        "total_tasks": len(all_todos),
        "completed_tasks": len([t for t in all_todos if t.get("done")]),
        "active_tasks": len([t for t in all_todos if not t.get("done")]),
        "critical_tasks": len([
            t for t in all_todos
            if not t.get("done") and t.get("priority") in ("P0", "P1")
        ]),
        "total_probes": len(all_probes),
        "up_probes": len(up_probes),
        "system_health": (
            "All Systems Operational"
            if (not all_probes or len(up_probes) == len(all_probes))
            else "Partial Outage"
        ),
    }


@app.get("/health")
def health() -> dict:
    """Liveness probe endpoint."""
    return {"status": "ok", "timestamp": time.time()}


@app.get("/metrics")
def metrics(request: Request) -> Response:
    """Expose Prometheus telemetry (protected if METRICS_TOKEN is set)."""
    if METRICS_TOKEN:
        auth_header = request.headers.get("Authorization", "")
        token = request.query_params.get("token")
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1].strip()
        if token != METRICS_TOKEN:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unauthorized: Invalid or missing metrics token.",
            )
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


# --- Task & Incident Endpoints ---
@app.post("/todos", response_model=Todo, status_code=201)
def create_new_todo(payload: TodoCreate, _: None = Depends(verify_api_key)) -> Todo:
    """Create a new task or incident (secured by API Key when configured)."""
    created = create_todo(
        title=payload.title,
        description=payload.description or "",
        priority=payload.priority,
        category=payload.category,
    )
    INCIDENT_COUNT.labels(priority=payload.priority, category=payload.category).inc()
    return Todo(**created)


@app.get("/todos", response_model=List[Todo])
def get_all_todos() -> List[Todo]:
    """Retrieve all tasks and incidents."""
    return [Todo(**item) for item in list_todos()]


@app.get("/todos/{todo_id}", response_model=Todo)
def get_one_todo(todo_id: int) -> Todo:
    """Retrieve details for a single task."""
    item = get_todo(todo_id)
    if not item:
        raise HTTPException(status_code=404, detail="Todo not found")
    return Todo(**item)


@app.put("/todos/{todo_id}", response_model=Todo)
def update_existing_todo(
    todo_id: int,
    payload: TodoUpdate,
    _: None = Depends(verify_api_key),
) -> Todo:
    """Update task title, description, priority, category, or completion status."""
    updated = update_todo(
        todo_id=todo_id,
        title=payload.title,
        description=payload.description,
        priority=payload.priority,
        category=payload.category,
        done=payload.done,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Todo not found")
    return Todo(**updated)


@app.delete("/todos/{todo_id}", status_code=204)
def delete_existing_todo(todo_id: int, _: None = Depends(verify_api_key)) -> Response:
    """Delete a task."""
    deleted = delete_todo(todo_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Todo not found")
    return Response(status_code=204)


# --- Service Health Prober Endpoints ---
@app.get("/probes", response_model=List[ServiceProbe])
def get_probes() -> List[ServiceProbe]:
    """List all registered service health probes."""
    return [ServiceProbe(**p) for p in list_probes()]


@app.post("/probes", response_model=ServiceProbe, status_code=201)
def add_probe(payload: ServiceProbeCreate, _: None = Depends(verify_api_key)) -> ServiceProbe:
    """Register a new service to monitor."""
    probe = create_probe(name=payload.name, url=payload.url)
    return ServiceProbe(**probe)


@app.post("/probes/{probe_id}/check", response_model=ServiceProbe)
async def check_probe(probe_id: int, _: None = Depends(verify_api_key)) -> ServiceProbe:
    """Execute a live HTTP synthetic health probe against the target URL."""
    probes = list_probes()
    target = next((p for p in probes if p["id"] == probe_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Service probe not found")

    start = time.perf_counter()
    status_str = "DOWN"
    try:
        async with httpx.AsyncClient(timeout=5.0, follow_redirects=True) as client:
            resp = await client.get(target["url"])
            latency = (time.perf_counter() - start) * 1000.0
            status_str = "UP" if resp.status_code < 400 else "DEGRADED"
    except Exception:
        latency = (time.perf_counter() - start) * 1000.0
        status_str = "DOWN"

    PROBE_LATENCY.labels(service_name=target["name"]).observe(latency / 1000.0)
    PROBE_STATUS.labels(service_name=target["name"]).set(1 if status_str == "UP" else 0)

    updated = update_probe_result(probe_id, status_str, round(latency, 2))
    return ServiceProbe(**updated)  # type: ignore[arg-type]


@app.delete("/probes/{probe_id}", status_code=204)
def remove_probe(probe_id: int, _: None = Depends(verify_api_key)) -> Response:
    """Delete a service probe."""
    deleted = delete_probe(probe_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Service probe not found")
    return Response(status_code=204)


# --- Backup & Export ---
@app.get("/export")
def export_data(_: None = Depends(verify_api_key)) -> dict:
    """Export tasks and probes for disaster recovery or reporting."""
    return {
        "exported_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "todos": list_todos(),
        "probes": list_probes(),
    }


# Export reset_store for test fixtures
__all__ = ["app", "reset_store"]
