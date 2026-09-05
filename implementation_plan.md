# AI Agent 개발: 나만의 AI 비서 구축 — 구현 계획

## 과제 요약

시계열 데이터를 분석하고, 그 결과를 Firestore에 저장하고, AI(GPT)가 이 데이터를 기반으로 맞춤형 대화를 제공하는 **풀스택 웹 서비스**를 구축합니다.

---

## 기술 스택 (과제에서 지정)

| 영역 | 기술 |
|---|---|
| 백엔드 | **FastAPI** + uvicorn |
| DB | **Firebase Firestore** |
| AI | **OpenAI GPT API** |
| 프론트엔드 | **HTML / CSS / JavaScript** (프레임워크 금지) |
| 백엔드 배포 | **Render** |
| 프론트엔드 배포 | **Vercel** |

---

## Open Questions

> [!IMPORTANT]
> 아래 질문들에 대한 답변을 주시면 구현에 반영하겠습니다.

1. **시계열 데이터 주제**: 어떤 종류의 시계열 데이터를 사용할까요? (예: 주식/환율, 날씨, 판매량, 운동 기록, 학습 시간 등) — 최소 100개 이상의 데이터 포인트가 필요합니다.
2. **Codyssey API 키**: 이미 보유하고 계신가요? 없다면 준비가 필요합니다. (`CODYSSEY_API_KEY_OPEN_AI`, `CODYSSEY_API_KEY_ANTHROPIC`)
3. **Firebase 프로젝트**: 이미 생성되어 있나요? 서비스 계정 키(JSON)가 준비되어 있나요?
4. **Render / Vercel 계정**: 이미 있나요?
5. **보너스 과제**: 선택 과제(Function Calling, 시각화, 다크모드 등)도 구현할까요?

---

## 프로젝트 구조

```
Codyssey_8_ProJect/
├── backend/                          # FastAPI 백엔드
│   ├── main.py                       # FastAPI 앱 진입점 (CORS 설정)
│   ├── requirements.txt              # Python 패키지 목록
│   ├── .env.example                  # 환경 변수 템플릿
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── data.py                   # 데이터 CRUD + summary 라우터
│   │   ├── conversations.py          # 대화 기록 라우터
│   │   └── chat.py                   # AI 챗봇 라우터
│   ├── services/
│   │   ├── __init__.py
│   │   ├── firebase_service.py       # Firestore 연결/초기화
│   │   ├── data_service.py           # 데이터 CRUD 비즈니스 로직
│   │   ├── conversation_service.py   # 대화 기록 비즈니스 로직
│   │   └── chat_service.py           # GPT API 호출 + 컨텍스트 주입
│   └── schemas/
│       ├── __init__.py
│       ├── data.py                   # 데이터 Pydantic 모델
│       ├── conversation.py           # 대화 Pydantic 모델
│       └── chat.py                   # 채팅 Pydantic 모델
│
├── frontend/                         # 바닐라 웹 프론트엔드
│   ├── index.html                    # 메인 페이지
│   ├── css/
│   │   └── style.css                 # 스타일시트
│   ├── js/
│   │   ├── app.js                    # 앱 초기화/라우팅
│   │   ├── api.js                    # API 호출 모듈
│   │   ├── chat.js                   # 채팅 UI 로직
│   │   ├── data.js                   # 데이터 관리 UI 로직
│   │   └── conversations.js          # 대화 기록 UI 로직
│   └── config.js                     # API URL 등 설정
│
├── data/
│   └── sample_data.json              # 초기 시계열 데이터 (100개+)
│
├── README.md                         # 프로젝트 문서
└── 과제_원문.html                      # 원본 과제 문서
```

---

## Proposed Changes

### Phase 1: 백엔드 기반 구축

#### [NEW] [requirements.txt](file:///c:/Users/SW교육22/Desktop/Codyssey_8_ProJect/backend/requirements.txt)
필요한 Python 패키지 목록:
- `fastapi`, `uvicorn[standard]`, `firebase-admin`, `openai`, `python-dotenv`, `pydantic`

#### [NEW] [main.py](file:///c:/Users/SW교육22/Desktop/Codyssey_8_ProJect/backend/main.py)
- FastAPI 앱 초기화
- CORS 설정 (ALLOWED_ORIGINS 환경변수 활용)
- 라우터 등록 (`/api/data`, `/api/conversations`, `/api/chat`)

#### [NEW] [firebase_service.py](file:///c:/Users/SW교육22/Desktop/Codyssey_8_ProJect/backend/services/firebase_service.py)
- Firebase Admin SDK 초기화 (환경변수에서 서비스 계정 키 로드)
- Firestore 클라이언트 인스턴스 제공

---

### Phase 2: Pydantic 스키마 정의

#### [NEW] [schemas/data.py](file:///c:/Users/SW교육22/Desktop/Codyssey_8_ProJect/backend/schemas/data.py)
```python
class DataCreate(BaseModel):
    date: str          # "2024-07-01" 형식
    value: float
    memo: Optional[str] = None

class DataResponse(DataCreate):
    id: str
    created_at: datetime
```

#### [NEW] [schemas/conversation.py](file:///c:/Users/SW교육22/Desktop/Codyssey_8_ProJect/backend/schemas/conversation.py)
```python
class Message(BaseModel):
    role: str          # "user" | "assistant"
    content: str

class ConversationCreate(BaseModel):
    title: str
    messages: List[Message]

class ConversationResponse(ConversationCreate):
    id: str
    created_at: datetime
```

#### [NEW] [schemas/chat.py](file:///c:/Users/SW교육22/Desktop/Codyssey_8_ProJect/backend/schemas/chat.py)
```python
class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None

class ChatResponse(BaseModel):
    reply: str
    conversation_id: str
```

---

### Phase 3: 데이터 API (CRUD + Summary)

#### [NEW] [routers/data.py](file:///c:/Users/SW교육22/Desktop/Codyssey_8_ProJect/backend/routers/data.py)
5개 엔드포인트 구현:
- `POST /api/data` — 새 데이터 추가
- `GET /api/data` — 데이터 목록 조회
- `PUT /api/data/{id}` — 데이터 수정
- `DELETE /api/data/{id}` — 데이터 삭제
- `GET /api/data/summary` — 데이터 요약 (기간, 개수, 통계, 트렌드)

#### [NEW] [services/data_service.py](file:///c:/Users/SW교육22/Desktop/Codyssey_8_ProJect/backend/services/data_service.py)
- Firestore `data` 컬렉션 CRUD 로직
- 요약 정보 계산 로직 (평균, 최대, 최소, 트렌드 판별)

---

### Phase 4: 대화 기록 API

#### [NEW] [routers/conversations.py](file:///c:/Users/SW교육22/Desktop/Codyssey_8_ProJect/backend/routers/conversations.py)
4개 엔드포인트 구현:
- `POST /api/conversations` — 대화 저장
- `GET /api/conversations` — 대화 목록 조회
- `GET /api/conversations/{id}` — 특정 대화 조회 (방식 A 선택)
- `DELETE /api/conversations/{id}` — 대화 삭제

#### [NEW] [services/conversation_service.py](file:///c:/Users/SW교육22/Desktop/Codyssey_8_ProJect/backend/services/conversation_service.py)
- Firestore `conversations` 컬렉션 CRUD 로직

---

### Phase 5: AI 챗봇 API (컨텍스트 주입)

#### [NEW] [routers/chat.py](file:///c:/Users/SW교육22/Desktop/Codyssey_8_ProJect/backend/routers/chat.py)
- `POST /api/chat` — AI 대화 API

#### [NEW] [services/chat_service.py](file:///c:/Users/SW교육22/Desktop/Codyssey_8_ProJect/backend/services/chat_service.py)
핵심 동작 흐름:
1. `/api/data/summary`로 데이터 요약 조회
2. 요약 정보를 **시스템 프롬프트에 삽입**
3. OpenAI GPT API 호출
4. 대화 내용을 `conversations` 컬렉션에 **자동 저장**
5. AI 응답 반환

---

### Phase 6: 샘플 데이터 준비

#### [NEW] [sample_data.json](file:///c:/Users/SW교육22/Desktop/Codyssey_8_ProJect/data/sample_data.json)
- 선정한 주제의 시계열 데이터 100개 이상
- 형식: `[{ "date": "2024-07-01", "value": 5200000, "memo": "정상 영업일" }, ...]`

#### [NEW] 데이터 시딩 스크립트
- 샘플 데이터를 Firestore에 일괄 업로드하는 유틸리티

---

### Phase 7: 프론트엔드 개발

#### [NEW] [index.html](file:///c:/Users/SW교육22/Desktop/Codyssey_8_ProJect/frontend/index.html)
SPA 구조의 메인 페이지. 4개 섹션/탭:
1. **채팅 인터페이스** — 메시지 입력, 대화 표시, 로딩 표시
2. **데이터 관리** — 새 데이터 추가, 목록 표시, 수정/삭제
3. **대화 기록** — 이전 대화 목록, 대화 불러오기
4. **데이터 요약** — 현재 요약 정보 표시 (기간/개수/트렌드)

#### [NEW] [css/style.css](file:///c:/Users/SW교육22/Desktop/Codyssey_8_ProJect/frontend/css/style.css)
- 프리미엄 다크 모드 기반 디자인
- 글래스모피즘 효과
- 반응형 레이아웃
- 채팅 버블 스타일
- 로딩 애니메이션

#### [NEW] JavaScript 모듈들
- `api.js` — 백엔드 API 호출 공통 모듈
- `chat.js` — 채팅 UI 렌더링/이벤트 처리
- `data.js` — 데이터 CRUD UI
- `conversations.js` — 대화 기록 관리 UI
- `app.js` — 앱 초기화, 탭 전환 로직

---

### Phase 8: 환경 설정 및 문서화

#### [NEW] [.env.example](file:///c:/Users/SW교육22/Desktop/Codyssey_8_ProJect/backend/.env.example)
```
CODYSSEY_API_KEY_OPEN_AI=your-codyssey-openai-api-key-here
CODYSSEY_API_KEY_ANTHROPIC=your-codyssey-anthropic-api-key-here
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
ALLOWED_ORIGINS=http://localhost:5500,https://your-frontend.vercel.app
```

#### [NEW] [README.md](file:///c:/Users/SW교육22/Desktop/Codyssey_8_ProJect/README.md)
포함 내용:
- 서비스 소개
- 기술 스택
- 배포 URL (프론트, 백엔드 API, Swagger)
- 로컬 실행 방법
- 환경 변수 목록
- 스크린샷 (채팅 화면, 데이터 관리, 대화 기록)

---

## 구현 순서

| 단계 | 내용 | 예상 |
|:---:|---|---|
| 1 | 백엔드 프로젝트 구조 생성 + FastAPI 초기화 + CORS | 기반 |
| 2 | Firebase 연동 설정 | 기반 |
| 3 | Pydantic 스키마 정의 | 기반 |
| 4 | 데이터 CRUD API + Summary API | 핵심 |
| 5 | 대화 기록 API | 핵심 |
| 6 | AI 챗봇 API (컨텍스트 주입) | 핵심 |
| 7 | 샘플 데이터 준비 + 시딩 | 데이터 |
| 8 | 프론트엔드 개발 (4개 화면) | UI |
| 9 | 로컬 통합 테스트 | 검증 |
| 10 | 백엔드 Render 배포 | 배포 |
| 11 | 프론트엔드 Vercel 배포 | 배포 |
| 12 | README 작성 + 스크린샷 | 문서화 |

---

## Verification Plan

### 로컬 테스트
- FastAPI 서버 실행 후 Swagger UI(`/docs`)에서 모든 API 엔드포인트 테스트
- 프론트엔드에서 채팅/데이터 관리/대화 기록/요약 기능 동작 확인

### 배포 테스트
- Render 배포 URL에서 Swagger UI 접근 확인
- Vercel 배포 URL에서 프론트엔드 정상 동작 확인
- 프론트엔드 → 백엔드 API 통신 정상 확인

### 기능 확인 체크리스트
- [ ] 데이터 CRUD (추가/조회/수정/삭제) 정상 동작
- [ ] 데이터 요약 API 정상 응답
- [ ] AI 채팅 — 데이터 기반 맞춤 답변 생성
- [ ] 대화 자동 저장 + 불러오기
- [ ] CORS 정상 동작
- [ ] 환경 변수로 키 관리 (코드에 노출 없음)
