"""Application settings and configuration management."""

import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# Load local .env if present (never committed to git)
load_dotenv(BASE_DIR / ".env")

APP_ENV: str = os.getenv("APP_ENV", "development").lower()
API_KEY: str = os.getenv("API_KEY", "").strip()
METRICS_TOKEN: str = os.getenv("METRICS_TOKEN", "").strip()
DATABASE_PATH: str = os.getenv("DATABASE_PATH", str(BASE_DIR / "data" / "devops.db"))

# Ensure directory for database exists
db_dir = Path(DATABASE_PATH).parent
db_dir.mkdir(parents=True, exist_ok=True)
