from typing import List
from datetime import datetime
from firebase_admin import firestore
from schemas.conversation import ConversationCreate, ConversationResponse, Message
from services.firebase_service import db

CONVERSATION_COLLECTION = "conversations"

class ConversationService:
    @staticmethod
    def save_conversation(conversation: ConversationCreate) -> ConversationResponse:
        doc_ref = db.collection(CONVERSATION_COLLECTION).document()
        
        now = datetime.now()
        conv_dict = conversation.model_dump()
        conv_dict["created_at"] = now
        
        doc_ref.set(conv_dict)
        
        return ConversationResponse(
            id=doc_ref.id,
            title=conversation.title,
            messages=conversation.messages,
            created_at=now
        )

    @staticmethod
    def get_all_conversations() -> List[ConversationResponse]:
        docs = db.collection(CONVERSATION_COLLECTION).order_by("created_at", direction=firestore.Query.DESCENDING).stream()
        
        result = []
        for doc in docs:
            data = doc.to_dict()
            result.append(ConversationResponse(
                id=doc.id,
                title=data.get("title", ""),
                messages=data.get("messages", []),
                created_at=data.get("created_at")
            ))
        return result

    @staticmethod
    def get_conversation(doc_id: str) -> ConversationResponse:
        doc_ref = db.collection(CONVERSATION_COLLECTION).document(doc_id)
        doc = doc_ref.get()
        
        if not doc.exists:
            raise ValueError(f"Conversation with ID {doc_id} not found")
            
        data = doc.to_dict()
        return ConversationResponse(
            id=doc.id,
            title=data.get("title", ""),
            messages=data.get("messages", []),
            created_at=data.get("created_at")
        )

    @staticmethod
    def update_conversation(doc_id: str, messages: List[Message]) -> None:
        doc_ref = db.collection(CONVERSATION_COLLECTION).document(doc_id)
        if not doc_ref.get().exists:
            raise ValueError(f"Conversation with ID {doc_id} not found")

        doc_ref.update({"messages": [m.model_dump() for m in messages]})

    @staticmethod
    def delete_conversation(doc_id: str) -> bool:
        doc_ref = db.collection(CONVERSATION_COLLECTION).document(doc_id)
        if not doc_ref.get().exists:
            raise ValueError(f"Conversation with ID {doc_id} not found")
            
        doc_ref.delete()
        return True
