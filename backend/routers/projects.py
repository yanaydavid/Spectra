"""
Projects router — server-side project storage.

Saves RF chain designs to a local SQLite database (spectra_projects.db)
so they survive browser storage clearing and are accessible from any browser.

Endpoints:
  GET    /projects          — list all projects (name + saved_at)
  POST   /projects          — save / overwrite a project
  GET    /projects/{name}   — load one project
  DELETE /projects/{name}   — delete one project
"""

import json
import sqlite3
import time
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/projects", tags=["projects"])

DB_PATH = Path(__file__).parent.parent / "spectra_projects.db"


# ── DB init ───────────────────────────────────────────────────────────────────

def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _init_db() -> None:
    with _get_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS projects (
                name      TEXT PRIMARY KEY,
                data      TEXT NOT NULL,
                saved_at  INTEGER NOT NULL
            )
        """)
        conn.commit()


_init_db()


# ── Schemas ───────────────────────────────────────────────────────────────────

class ProjectSave(BaseModel):
    name: str
    data: dict          # ChainExport structure from the frontend


# ── Routes ───────────────────────────────────────────────────────────────────

@router.get("/")
def list_projects():
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT name, saved_at FROM projects ORDER BY saved_at DESC"
        ).fetchall()
    return [{"name": r["name"], "saved_at": r["saved_at"]} for r in rows]


@router.post("/")
def save_project(project: ProjectSave):
    if not project.name.strip():
        raise HTTPException(400, "Project name cannot be empty.")
    ts = int(time.time() * 1000)
    with _get_conn() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO projects (name, data, saved_at) VALUES (?, ?, ?)",
            (project.name.strip(), json.dumps(project.data), ts),
        )
        conn.commit()
    return {"ok": True, "saved_at": ts}


@router.get("/{name}")
def load_project(name: str):
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT data, saved_at FROM projects WHERE name = ?", (name,)
        ).fetchone()
    if not row:
        raise HTTPException(404, f"Project '{name}' not found.")
    return {"name": name, "data": json.loads(row["data"]), "saved_at": row["saved_at"]}


@router.delete("/{name}")
def delete_project(name: str):
    with _get_conn() as conn:
        conn.execute("DELETE FROM projects WHERE name = ?", (name,))
        conn.commit()
    return {"ok": True}
