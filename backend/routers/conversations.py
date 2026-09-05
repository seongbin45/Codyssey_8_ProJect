from typing import List
from fastapi import APIRouter, HTTPException

from schemas.conversation import ConversationCreate, ConversationResponse
from services.conversation_service import ConversationService

router = APIRouter()

@router.post("", response_model=ConversationResponse)
def save_conversation(conversation: ConversationCreate):
    try:
        return ConversationService.save_conversation(conversation)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("", response_model=List[ConversationResponse])
def get_all_conversations():
    try:
        return ConversationService.get_all_conversations()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{doc_id}", response_model=ConversationResponse)
def get_conversation(doc_id: str):
    try:
        return ConversationService.get_conversation(doc_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{doc_id}")
def delete_conversation(doc_id: str):
    try:
        ConversationService.delete_conversation(doc_id)
        return {"status": "success", "message": f"Conversation {doc_id} deleted."}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
