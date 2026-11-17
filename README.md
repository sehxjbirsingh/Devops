# OpsPulse: DevOps Incident & Reliability Command Center

A production-ready **Incident Management, SRE Health Prober & Observability Platform** built with **FastAPI**, **SQLite WAL persistence**, **Prometheus & Grafana**, packaged with **Docker**, and shipped through a **GitHub Actions CI/CD** pipeline.

---

## 🎯 Real-World Problem Solved

Traditional demo Todo apps are toy projects with in-memory state that vanishes on restart and lack security. 

**OpsPulse** bridges the gap between **SRE Incident Response**, **Deployment Runbooks**, and **Infrastructure Observability**:
1. **Incident & Task Triage**: Track operational tickets with priority levels (`P0 - Critical Outage`, `P1 - High`, `P2 - Medium`, `P3 - Low`) and domain categories (`Incident`, `Infrastructure`, `Deployment`, `Security`, `Bug`).
2. **Synthetic Health Probes (Uptime Monitoring)**: Actively pings internal and external HTTP/HTTPS services, recording response latencies and health status directly into Prometheus telemetry (`service_probe_duration_seconds`, `service_probe_up`).
3. **Reliable Persistence**: Uses an embedded SQLite database with **Write-Ahead Logging (WAL)** and transaction locks, ensuring zero data loss across container or server restarts.
4. **Traffic Simulation & Chaos Testing**: Built-in traffic generator fires bursts of API calls to evaluate Prometheus scrape targets and trigger Grafana alerts under load.
5. **Disaster Recovery**: One-click JSON backup export (`GET /export`) for operational postmortems and reporting.

---

## 🔒 Security & Privacy by Design

OpsPulse follows strict security and privacy standards to protect sensitive infrastructure:
- **Zero-Exposure Secrets**: All secrets and configurations are loaded via environment variables (`.env`). A `.env.example` template is provided; `.env` is strictly git-ignored.
- **API Key Protection**: Mutating endpoints (`POST`, `PUT`, `DELETE`, probe executions) can be protected by configuring `API_KEY` in `.env`. Clients supply `X-API-Key` header or enter it in the UI's built-in Security modal.
- **Protected Telemetry**: Optional `METRICS_TOKEN` allows restricting raw Prometheus metrics scraping to authorized monitoring agents only (`Authorization: Bearer <METRICS_TOKEN>`).
- **Database Privacy**: Database files (`*.db`, `data/`) are excluded from git commits and Docker context.
- **Security Response Headers**: Every response enforces `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, and `Referrer-Policy: strict-origin-when-cross-origin`.

---

## 🏛️ Architecture

```
 Developer ──push──▶ GitHub ──▶ GitHub Actions (ruff lint ➔ pytest ➔ Docker build & push)
                                  │
                                  ▼
                              Cloud / Server Deploy (Render / Docker Hub)

 Running Stack:
   User / Browser ──▶ OpsPulse UI & API (:8000) ──▶ SQLite WAL (data/devops.db)
                             │
                      /metrics (telemetry)
                             ▼
                         Prometheus (:9090) ──▶ Grafana Dashboard (:3000)
                             │
                             └── Alerts: AppDown, HighLatency, HighErrorRate
```

---

## 📁 Project Structure

```
.
├── app/
│   ├── config.py                # Environment variables & secret management
│   ├── database.py              # SQLite WAL persistence layer & queries
│   ├── models.py                # Pydantic schemas with P0-P3 priorities
│   ├── main.py                  # FastAPI app, security headers, endpoints
│   └── static/                  # Single Page Application
│       ├── index.html           # SRE Dashboard & Incident Hub UI
│       ├── style.css            # Dark-mode responsive interface
│       └── app.js               # Reactive client with health probes & simulation
├── tests/test_main.py           # Comprehensive pytest suite
├── Dockerfile                   # Non-root secure production image
├── docker-compose.yml           # Complete stack (App + Prometheus + Grafana)
├── render.yaml                  # 1-Click free cloud deployment configuration
├── .env.example                 # Configuration template for secrets
├── monitoring/
│   ├── prometheus/              # Prometheus scraping configuration & alert rules
│   └── grafana/                 # Pre-provisioned dashboards & datasource
└── .github/workflows/ci-cd.yml  # Automated CI/CD pipeline
```

---

## 🔌 API & UI Endpoints

| Method | Path                    | Auth Required | Description                                       |
|--------|-------------------------|---------------|---------------------------------------------------|
| GET    | `/`                     | No            | SRE Command Center Web UI                         |
| GET    | `/health`               | No            | Health check & liveness probe                     |
| GET    | `/metrics`              | Optional*     | Prometheus metrics (*protected if METRICS_TOKEN)  |
| GET    | `/todos`                | No            | List all incidents and tasks                      |
| POST   | `/todos`                | Yes*          | Create an incident/task (*if API_KEY configured)   |
| GET    | `/todos/{id}`           | No            | Retrieve a specific incident                      |
| PUT    | `/todos/{id}`           | Yes*          | Update priority, category, title, or status       |
| DELETE | `/todos/{id}`           | Yes*          | Delete an incident/task                           |
| GET    | `/probes`               | No            | List all synthetic service health probes          |
| POST   | `/probes`               | Yes*          | Add a new service probe                           |
| POST   | `/probes/{id}/check`    | Yes*          | Execute an immediate synthetic health ping        |
| DELETE | `/probes/{id}`          | Yes*          | Remove a service probe                            |
| GET    | `/export`               | Yes*          | Disaster recovery JSON backup export              |

Interactive Swagger Documentation: **http://localhost:8000/docs**

---

## 🚀 Getting Started

### 1. Local Development

```bash
# Clone the repository
git clone https://github.com/sehxjbirsingh/Devops.git
cd Devops

# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements-dev.txt

# (Optional) Configure environment
cp .env.example .env

# Run server
uvicorn app.main:app --reload
```
Open **http://localhost:8000** in your browser.

### 2. Run Tests & Linter

```bash
pytest -v
ruff check .
```

### 3. Run Full Observability Stack with Docker Compose

```bash
docker compose up --build
```

| Service        | URL                   | Credentials   |
|----------------|-----------------------|---------------|
| OpsPulse Web UI| http://localhost:8000 | (No login)    |
| Prometheus     | http://localhost:9090 | (No login)    |
| Grafana        | http://localhost:3000 | admin / admin |

---

## ☁️ 1-Click Cloud Deployment (Render)

1. Connect your repository `sehxjbirsingh/Devops` to **[Render.com](https://render.com)**.
2. Select **New +** ➔ **Blueprint**.
3. Render automatically provisions the web service using `render.yaml` with zero manual configuration.
