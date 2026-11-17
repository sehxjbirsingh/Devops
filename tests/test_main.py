import pytest
from fastapi.testclient import TestClient

from app.main import app, reset_store

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_store():
    reset_store()
    yield
    reset_store()


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_create_and_get_todo():
    created = client.post("/todos", json={"title": "Learn Docker"})
    assert created.status_code == 201
    body = created.json()
    assert body["title"] == "Learn Docker"
    assert body["done"] is False

    fetched = client.get(f"/todos/{body['id']}")
    assert fetched.status_code == 200
    assert fetched.json() == body


def test_list_todos():
    client.post("/todos", json={"title": "one"})
    client.post("/todos", json={"title": "two"})
    response = client.get("/todos")
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_update_todo():
    todo_id = client.post("/todos", json={"title": "Write tests"}).json()["id"]
    response = client.put(f"/todos/{todo_id}", json={"done": True})
    assert response.status_code == 200
    assert response.json()["done"] is True


def test_delete_todo():
    todo_id = client.post("/todos", json={"title": "Temp"}).json()["id"]
    assert client.delete(f"/todos/{todo_id}").status_code == 204
    assert client.get(f"/todos/{todo_id}").status_code == 404


def test_missing_todo_returns_404():
    assert client.get("/todos/999").status_code == 404


def test_empty_title_is_rejected():
    response = client.post("/todos", json={"title": ""})
    assert response.status_code == 422


def test_metrics_endpoint_exposes_request_counter():
    client.get("/health")
    response = client.get("/metrics")
    assert response.status_code == 200
    assert "http_requests_total" in response.text
    assert "http_request_duration_seconds" in response.text
