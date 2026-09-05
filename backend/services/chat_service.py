import os
from openai import OpenAI
from schemas.chat import ChatRequest, ChatResponse
from schemas.conversation import ConversationCreate, Message
from services.data_service import DataService
from services.conversation_service import ConversationService

# Codyssey가 발급하는 가상 키는 자체 게이트웨이(OpenAI 호환 엔드포인트)에서만 동작한다.
CODYSSEY_BASE_URL = os.getenv("CODYSSEY_BASE_URL", "https://copa.codyssey.kr/v1")
CHAT_MODEL = os.getenv("CHAT_MODEL", "gpt-5-mini")
# gpt-5-mini는 추론형 모델이라 max_tokens 예산을 답변 전에 내부 추론에 먼저 쓴다.
# 너무 낮게 잡으면 finish_reason=length에 content가 빈 문자열로 잘리는 경우가 실제로 발생해서 넉넉히 잡는다.
CHAT_MAX_TOKENS = int(os.getenv("CHAT_MAX_TOKENS", "1200"))

class ChatService:
    @staticmethod
    def get_client():
        # .env에 실제로 존재하는 변수명(CODYSSET_API_KEY_OPEN_AI)을 1순위로 읽는다.
        api_key = (
            os.getenv("CODYSSET_API_KEY_OPEN_AI")
            or os.getenv("CODYSSEY_API_KEY_OPEN_AI")
            or os.getenv("OPENAI_API_KEY")
        )

        if not api_key:
            raise ValueError("OpenAI API Key is not set in environment variables.")

        return OpenAI(api_key=api_key, base_url=CODYSSEY_BASE_URL)

    @staticmethod
    def generate_system_prompt() -> str:
        summary = DataService.get_summary()
        
        prompt = f"""당신은 데이터 분석 비서입니다.

[사용자 데이터 요약]
- 데이터 기간: {summary.get('period', 'N/A')}
- 총 레코드: {summary.get('count', 0)}개
- 주요 지표: 
  - 총합: {summary.get('metrics', {}).get('total', 0)}
  - 평균: {summary.get('metrics', {}).get('average', 0)}
  - 최대: {summary.get('metrics', {}).get('max', 0)}
  - 최소: {summary.get('metrics', {}).get('min', 0)}
- 최근 트렌드: {summary.get('trend', 'N/A')}

위 데이터를 기반으로 맞춤형 답변을 제공하세요.
데이터에 없는 내용에 대해서는 일반적인 정보를 제공하되, 사용자의 데이터 요약 맥락을 유지하세요.
친절하고 간결하게 답변해주세요.
"""
        return prompt

    @staticmethod
    def _complete(client, messages, max_tokens: int) -> str:
        response = client.chat.completions.create(
            model=CHAT_MODEL,
            messages=messages,
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content

    @staticmethod
    def chat(request: ChatRequest) -> ChatResponse:
        client = ChatService.get_client()

        messages = []
        existing_conversation_id = None

        # 기존 대화가 있으면 이어서, 없거나 조회 실패하면 새로 시작
        if request.conversation_id:
            try:
                conversation = ConversationService.get_conversation(request.conversation_id)
                messages = [{"role": m.role, "content": m.content} for m in conversation.messages]
                existing_conversation_id = request.conversation_id
            except ValueError:
                pass

        if not messages:
            messages.append({"role": "system", "content": ChatService.generate_system_prompt()})

        messages.append({"role": "user", "content": request.message})

        ai_reply = ChatService._complete(client, messages, CHAT_MAX_TOKENS)
        if not ai_reply:
            # 추론형 모델이 max_tokens 예산을 추론에 다 써버려 답변이 비는 경우가 있음 — 예산을 늘려 한 번 재시도
            ai_reply = ChatService._complete(client, messages, CHAT_MAX_TOKENS * 2)
        if not ai_reply:
            ai_reply = "죄송해요, 답변 생성에 문제가 있었어요. 다시 한 번 물어봐 주세요."

        messages.append({"role": "assistant", "content": ai_reply})

        save_messages = [Message(role=m["role"], content=m["content"]) for m in messages]

        if existing_conversation_id:
            ConversationService.update_conversation(existing_conversation_id, save_messages)
            conv_id = existing_conversation_id
        else:
            title = request.message[:20] + "..." if len(request.message) > 20 else request.message
            new_conv = ConversationCreate(title=title, messages=save_messages)
            saved = ConversationService.save_conversation(new_conv)
            conv_id = saved.id

        return ChatResponse(
            reply=ai_reply,
            conversation_id=conv_id,
        )
