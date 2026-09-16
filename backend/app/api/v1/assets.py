from fastapi import APIRouter
from typing import List
from app.models.schemas import AssetInfo
from app.services.data_fetcher import get_supported_assets

router = APIRouter(prefix="/assets", tags=["Assets"])

@router.get("", response_model=List[AssetInfo])
async def list_assets():
    """List supported multi-asset trading universe."""
    return get_supported_assets()
