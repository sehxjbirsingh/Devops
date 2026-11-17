# Monitored FastAPI App with CI/CD

A small Todo REST API built with **FastAPI**, packaged with **Docker**, monitored with **Prometheus + Grafana**, and shipped through a **GitHub Actions** CI/CD pipeline.

## Architecture

```
 Developer ──push──▶ GitHub ──▶ GitHub Actions
                                  │ 1. ruff lint
                                  │ 2. pytest
                                  │ 3. build Docker image
                                  │ 4. push to Docker Hub
                                  ▼
                              (optional) SSH deploy to server

 Running stack (docker compose):

   client ──▶ FastAPI app :8000 ──/metrics──▶ Prometheus :9090 ──▶ Grafana :3000
                                                   │
                                                   └── alert rules (AppDown, HighErrorRate, HighLatency)
```

## Project structure

```
.
├── app/
│   ├── main.py                  # FastAPI app, /health and /metrics endpoints
│   └── static/                  # Responsive web frontend UI (HTML, CSS, JS)
│       ├── index.html
│       ├── style.css
│       └── app.js
├── tests/test_main.py           # pytest tests
├── Dockerfile                   # production image (non-root, healthcheck)
├── docker-compose.yml           # app + Prometheus + Grafana
├── monitoring/
│   ├── prometheus/              # scrape config + alert rules
│   └── grafana/                 # auto-provisioned datasource + dashboard
└── .github/workflows/ci-cd.yml  # CI/CD pipeline
```

## API & UI endpoints

| Method | Path          | Description                    |
|--------|---------------|--------------------------------|
| GET    | `/`           | Web Frontend (Single Page App) |
| GET    | `/health`     | Health check                   |
| GET    | `/metrics`    | Prometheus metrics     |
| POST   | `/todos`      | Create a todo          |
| GET    | `/todos`      | List todos             |
| GET    | `/todos/{id}` | Get one todo           |
| PUT    | `/todos/{id}` | Update title / done    |
| DELETE | `/todos/{id}` | Delete a todo          |

Interactive docs: http://localhost:8000/docs

## Run locally (without Docker)

```bash
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt

uvicorn app.main:app --reload
```

## Run tests and lint

```bash
pytest -v
ruff check .
```

## Run the full stack with Docker Compose

```bash
docker compose up --build
```

| Service    | URL                    | Login         |
|------------|------------------------|---------------|
| API        | http://localhost:8000  |               |
| Prometheus | http://localhost:9090  |               |
| Grafana    | http://localhost:3000  | admin / admin |

Open Grafana and go to **Dashboards → Todo App Overview**. Generate some traffic:

```bash
for i in $(seq 1 50); do
  curl -s -X POST localhost:8000/todos -H "Content-Type: application/json" \
       -d "{\"title\": \"task $i\"}" > /dev/null
  curl -s localhost:8000/todos > /dev/null
done
```

### Test the downtime alert

```bash
docker compose stop app
```

After about 30 seconds, open http://localhost:9090/alerts and you will see `AppDown` firing. Start it again with `docker compose start app`.

> Alerts are visible in the Prometheus UI. To get Slack or email notifications, add an **Alertmanager** service (a good bonus feature).

## CI/CD pipeline setup

The workflow in `.github/workflows/ci-cd.yml` has three jobs:

1. **test**: installs dependencies, runs `ruff` and `pytest` on every push and pull request.
2. **build-and-push**: on pushes to `main` only, builds the Docker image and pushes it to Docker Hub tagged `latest` and with the commit SHA.
3. **deploy** (optional): SSHes into a server, pulls the new image and restarts the container.

### Required GitHub secrets

Go to **Settings → Secrets and variables → Actions → Secrets** and add:

| Secret               | Value                                                        |
|----------------------|--------------------------------------------------------------|
| `DOCKERHUB_USERNAME` | Your Docker Hub username                                     |
| `DOCKERHUB_TOKEN`    | A Docker Hub access token (Account Settings → Security)      |

For the optional deploy job also add `SERVER_HOST`, `SERVER_USER`, `SERVER_SSH_KEY`, then create a repository **variable** `DEPLOY_ENABLED` set to `true`.

## Deploying to a server (AWS EC2 free tier or any VPS)

1. Launch an Ubuntu instance and open ports 22 and 8000 in the security group.
2. Install Docker: `curl -fsSL https://get.docker.com | sh`
3. Add the SSH key and server details as GitHub secrets (above).
4. Push to `main`. The pipeline tests, builds, pushes and deploys automatically.
5. Visit `http://<server-ip>:8000/docs`.

## Ideas to extend it (pick one for a standout bonus)

- Replace the in-memory store with PostgreSQL (add it to docker-compose)
- Add Alertmanager with Slack or email notifications
- Provision the EC2 server with Terraform
- Add a security scan step (Trivy) to the pipeline
- Deploy to Kubernetes (minikube or kind) with a Deployment and Service manifest

## What to be ready to explain in interviews

- Difference between a Docker image and a container, and why the Dockerfile copies `requirements.txt` first (layer caching)
- What each pipeline stage does and why the image is only pushed from `main`
- What Prometheus scrapes, what a counter and a histogram are, and what p95 latency means
- Why metrics use the route template (`/todos/{todo_id}`) and not the raw URL (label cardinality)
- Why the container runs as a non-root user
