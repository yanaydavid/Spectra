from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routers import chain, datasheet, ai_assist, projects

app = FastAPI(title="Spectra API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chain.router)
app.include_router(datasheet.router)
app.include_router(ai_assist.router)
app.include_router(projects.router)


@app.get("/health")
def health():
    return {"status": "ok"}
