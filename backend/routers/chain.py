from fastapi import APIRouter, HTTPException

from models.schemas import CascadeResult, ChainCalculationRequest
from services.cascade import calculate_chain

router = APIRouter()


@router.post("/calculate-chain", response_model=CascadeResult)
def calculate_chain_endpoint(request: ChainCalculationRequest) -> CascadeResult:
    if not request.stages:
        raise HTTPException(status_code=400, detail="stages must not be empty")
    try:
        return calculate_chain(request)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
