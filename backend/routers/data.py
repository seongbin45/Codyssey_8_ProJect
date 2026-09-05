from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException

from schemas.data import DataCreate, DataResponse
from services.data_service import DataService

router = APIRouter()

@router.post("", response_model=DataResponse)
def add_data(data: DataCreate):
    try:
        return DataService.add_data(data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("", response_model=List[DataResponse])
def get_all_data():
    try:
        return DataService.get_all_data()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/summary", response_model=Dict[str, Any])
def get_summary():
    try:
        return DataService.get_summary()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{doc_id}", response_model=DataResponse)
def update_data(doc_id: str, data: DataCreate):
    try:
        return DataService.update_data(doc_id, data)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{doc_id}")
def delete_data(doc_id: str):
    try:
        DataService.delete_data(doc_id)
        return {"status": "success", "message": f"Document {doc_id} deleted."}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
