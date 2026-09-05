"""
AI Agent 백엔드 — FastAPI 메인 진입점
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# .env 파일 로드 — 아래 routers import가 firebase_service를 통해 Firestore를
# 즉시 초기화하므로, 반드시 그 전에 환경 변수를 읽어들여야 한다.
load_dotenv()

from routers import data, conversations, chat

app = FastAPI(
    title="AI Agent API",
    description="나만의 AI 비서 — 시계열 데이터 기반 맞춤형 AI 챗봇",
    version="1.0.0",
)

# ──────────────────────────────────────────────
# CORS 설정
# ──────────────────────────────────────────────
allowed_origins_str = os.getenv("ALLOWED_ORIGINS", "http://localhost:5500,http://127.0.0.1:5500")
allowed_origins = [origin.strip() for origin in allowed_origins_str.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ──────────────────────────────────────────────
# 라우터 등록
# ──────────────────────────────────────────────
app.include_router(data.router, prefix="/api/data", tags=["Data"])
app.include_router(conversations.router, prefix="/api/conversations", tags=["Conversations"])
app.include_router(chat.router, prefix="/api", tags=["Chat"])


@app.get("/", tags=["Health"])
async def health_check():
    """서버 상태 확인"""
    return {"status": "ok", "message": "AI Agent API is running!"}
