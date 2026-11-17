"""Todo API with health check and Prometheus metrics."""

import time
from typing import Dict, List, Optional

from fastapi import FastAPI, HTTPException, Request, Response
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest
from pydantic import BaseModel, Field

app = FastAPI(title="Todo API", version="1.0.0")

# --- Prometheus metrics -----------------------------------------------------
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


@app.middleware("http")
async def track_metrics(request: Request, call_next):
    """Record request count and latency for every request."""
    start = time.perf_counter()
    response = await call_next(request)
    elapsed = time.perf_counter() - start

    # Use the route template (e.g. /todos/{todo_id}) instead of the raw URL
    # so metrics don't explode into one series per todo id.
    route = request.scope.get("route")
    path = route.path if route else request.url.path

    if path != "/metrics":
        REQUEST_COUNT.labels(request.method, path, str(response.status_code)).inc()
        REQUEST_LATENCY.labels(request.method, path).observe(elapsed)
    return response


# --- Data models --------------------------------------------------------------
class TodoCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)


class TodoUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    done: Optional[bool] = None


class Todo(BaseModel):
    id: int
    title: str
    done: bool = False


# In-memory store (swap for a real database as a bonus feature)
todos: Dict[int, Todo] = {}
_next_id = 1


def reset_store() -> None:
    """Clear all todos. Used by tests."""
    global _next_id
    todos.clear()
    _next_id = 1


# --- Endpoints ----------------------------------------------------------------
@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/metrics")
def metrics() -> Response:
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.post("/todos", response_model=Todo, status_code=201)
def create_todo(payload: TodoCreate) -> Todo:
    global _next_id
    todo = Todo(id=_next_id, title=payload.title)
    todos[todo.id] = todo
    _next_id += 1
    return todo


@app.get("/todos", response_model=List[Todo])
def list_todos() -> List[Todo]:
    return list(todos.values())


@app.get("/todos/{todo_id}", response_model=Todo)
def get_todo(todo_id: int) -> Todo:
    if todo_id not in todos:
        raise HTTPException(status_code=404, detail="Todo not found")
    return todos[todo_id]


@app.put("/todos/{todo_id}", response_model=Todo)
def update_todo(todo_id: int, payload: TodoUpdate) -> Todo:
    if todo_id not in todos:
        raise HTTPException(status_code=404, detail="Todo not found")
    todo = todos[todo_id]
    if payload.title is not None:
        todo.title = payload.title
    if payload.done is not None:
        todo.done = payload.done
    return todo


@app.delete("/todos/{todo_id}", status_code=204)
def delete_todo(todo_id: int) -> Response:
    if todo_id not in todos:
        raise HTTPException(status_code=404, detail="Todo not found")
    del todos[todo_id]
    return Response(status_code=204)
