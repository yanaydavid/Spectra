from fastapi import APIRouter, HTTPException, UploadFile, File

from models.schemas import ExtractedParams
from services.pdf_parser import ExtractionError, extract_params_from_pdf

router = APIRouter()

MAX_PDF_SIZE = 20 * 1024 * 1024  # 20 MB


@router.post("/parse-datasheet", response_model=ExtractedParams)
async def parse_datasheet_endpoint(file: UploadFile = File(...)) -> ExtractedParams:
    if file.content_type not in ("application/pdf", "application/octet-stream"):
        # Some browsers send application/octet-stream for PDFs — check filename too
        if not (file.filename or "").lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="File must be a PDF")

    pdf_bytes = await file.read()

    if len(pdf_bytes) > MAX_PDF_SIZE:
        raise HTTPException(status_code=413, detail="PDF exceeds 20 MB limit")

    if len(pdf_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    try:
        return extract_params_from_pdf(pdf_bytes)
    except ExtractionError as e:
        msg = str(e)
        if "API key" in msg or "Authentication" in msg:
            raise HTTPException(status_code=503, detail="AI service not configured")
        if "timed out" in msg:
            raise HTTPException(status_code=504, detail="AI service timed out — try again")
        raise HTTPException(status_code=422, detail=f"Extraction failed: {msg}")
