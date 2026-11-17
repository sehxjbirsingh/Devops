import pytest
from fastapi.testclient import TestClient

from app.database import init_db
from app.main import app, reset_store

init_db()
client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_store():
    reset_store()
    yield
    reset_store()


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_index_serves_html():
    response = client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "OpsPulse" in response.text


def test_security_headers_present():
    response = client.get("/health")
    assert response.headers.get("X-Content-Type-Options") == "nosniff"
    assert response.headers.get("X-Frame-Options") == "SAMEORIGIN"
    assert response.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"


def test_create_and_get_todo():
    created = client.post(
        "/todos",
        json={
            "title": "Migrate database to PostgreSQL",
            "priority": "P1",
            "category": "Infrastructure",
            "description": "Run alembic upgrade head",
        },
    )
    assert created.status_code == 201
    body = created.json()
    assert body["title"] == "Migrate database to PostgreSQL"
    assert body["priority"] == "P1"
    assert body["category"] == "Infrastructure"
    assert body["done"] is False

    fetched = client.get(f"/todos/{body['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["title"] == body["title"]


def test_list_todos():
    client.post("/todos", json={"title": "task one", "priority": "P2"})
    client.post("/todos", json={"title": "task two", "priority": "P0"})
    response = client.get("/todos")
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_update_todo():
    todo_id = client.post("/todos", json={"title": "Write incident postmortem"}).json()["id"]
    response = client.put(f"/todos/{todo_id}", json={"done": True, "priority": "P3"})
    assert response.status_code == 200
    assert response.json()["done"] is True
    assert response.json()["priority"] == "P3"
    assert response.json()["completed_at"] is not None


def test_delete_todo():
    todo_id = client.post("/todos", json={"title": "Temporary triage note"}).json()["id"]
    assert client.delete(f"/todos/{todo_id}").status_code == 204
    assert client.get(f"/todos/{todo_id}").status_code == 404


def test_missing_todo_returns_404():
    assert client.get("/todos/999").status_code == 404


def test_empty_title_is_rejected():
    response = client.post("/todos", json={"title": ""})
    assert response.status_code == 422


def test_service_probe_lifecycle():
    probe = client.post(
        "/probes",
        json={"name": "Local Health", "url": "http://localhost:8000/health"},
    )
    assert probe.status_code == 201
    probe_id = probe.json()["id"]

    probes_list = client.get("/probes")
    assert probes_list.status_code == 200
    assert len(probes_list.json()) == 1

    del_res = client.delete(f"/probes/{probe_id}")
    assert del_res.status_code == 204


def test_export_data():
    client.post("/todos", json={"title": "Backup task"})
    export_res = client.get("/export")
    assert export_res.status_code == 200
    data = export_res.json()
    assert "todos" in data
    assert "probes" in data
    assert len(data["todos"]) == 1


def test_metrics_endpoint_exposes_request_counter():
    client.get("/health")
    response = client.get("/metrics")
    assert response.status_code == 200
    assert "http_requests_total" in response.text
    assert "http_request_duration_seconds" in response.text
