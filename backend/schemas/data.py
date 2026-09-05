from typing import Optional
from datetime import datetime
from pydantic import BaseModel

class DataCreate(BaseModel):
    date: str
    value: float
    memo: Optional[str] = None

class DataResponse(DataCreate):
    id: str
    created_at: datetime
