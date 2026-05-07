from fastapi import APIRouter

from models.schemas import ExtractedParams

router = APIRouter()


@router.post("/parse-datasheet", response_model=ExtractedParams)
async def parse_datasheet_endpoint() -> ExtractedParams:
    # Implemented in TASK-009
    raise NotImplementedError
