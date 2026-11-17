"""Pydantic data models for DevOps Task & Incident Tracker."""

from typing import Literal, Optional

from pydantic import BaseModel, Field

PriorityType = Literal["P0", "P1", "P2", "P3"]
CategoryType = Literal["General", "Incident", "Deployment", "Infrastructure", "Security", "Bug"]


class TodoCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200, description="Task title")
    description: Optional[str] = Field("", max_length=1000, description="Context or runbook")
    priority: PriorityType = Field("P2", description="Priority level P0 to P3")
    category: CategoryType = Field("General", description="Category classification")


class TodoUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    priority: Optional[PriorityType] = None
    category: Optional[CategoryType] = None
    done: Optional[bool] = None


class Todo(BaseModel):
    id: int
    title: str
    description: str = ""
    priority: str = "P2"
    category: str = "General"
    done: bool = False
    created_at: Optional[str] = None
    completed_at: Optional[str] = None


class ServiceProbeCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Service name")
    url: str = Field(..., min_length=4, max_length=500, description="HTTP/HTTPS endpoint URL")


class ServiceProbe(BaseModel):
    id: int
    name: str
    url: str
    status: str = "UNKNOWN"
    latency_ms: float = 0.0
    last_checked_at: Optional[str] = None
