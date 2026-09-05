from fastapi import APIRouter, HTTPException

from schemas.chat import ChatRequest, ChatResponse
from services.chat_service import ChatService

router = APIRouter()

@router.post("/chat", response_model=ChatResponse)
def chat_endpoint(request: ChatRequest):
    try:
        return ChatService.chat(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
