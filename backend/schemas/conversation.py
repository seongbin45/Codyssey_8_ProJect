from typing import List
from datetime import datetime
from pydantic import BaseModel

class Message(BaseModel):
    role: str
    content: str

class ConversationCreate(BaseModel):
    title: str
    messages: List[Message]

class ConversationResponse(ConversationCreate):
    id: str
    created_at: datetime
