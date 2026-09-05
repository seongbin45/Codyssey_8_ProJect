# AI Agent 개발 — 구현 태스크

## Phase 1: 백엔드 프로젝트 구조 + FastAPI 초기화
- [x] 백엔드 디렉토리 구조 생성
- [x] `requirements.txt` 작성
- [x] `main.py` — FastAPI 앱 + CORS 설정
- [x] `.env.example` 작성
- [x] 가상환경 생성 + 패키지 설치 (`backend/venv`, openai는 httpx 최신판 호환을 위해 3.8.0으로 갱신)

## Phase 2: Firebase 연동
- [x] `services/firebase_service.py` — Firestore 초기화 (이름 있는 DB를 쓰므로
      `FIRESTORE_DATABASE_ID` 환경변수로 database id를 지정하도록 수정 — 아래 참고)
- [x] Firebase 프로젝트(`com-example-myapplicatio-3bb36`)에 Firestore Native mode / Standard edition
      데이터베이스 생성 완료 (database id: `firestore-native-mode`, region: nam5). ⚠️ GCP 콘솔에서
      DB 생성 시 "Datastore 모드"나 "Enterprise/MongoDB 호환 모드"를 고르면 Firestore 클라이언트와
      호환되지 않고 재생성해야 하니 반드시 **Firestore Native mode + Standard edition**으로 만들 것.

## Phase 3: Pydantic 스키마
- [x] `schemas/data.py`
- [x] `schemas/conversation.py`
- [x] `schemas/chat.py`

## Phase 4: 데이터 API
- [x] `services/data_service.py` — CRUD + 요약 로직
- [x] `routers/data.py` — 5개 엔드포인트

## Phase 5: 대화 기록 API
- [x] `services/conversation_service.py` (update_conversation 추가로 이어서 대화 저장 지원)
- [x] `routers/conversations.py` — 4개 엔드포인트

## Phase 6: AI 챗봇 API
- [x] `services/chat_service.py` — GPT 호출 + 컨텍스트 주입 (Codyssey 게이트웨이 연결 확인 완료)
- [x] `routers/chat.py`
- [x] Codyssey OpenAI 호환 엔드포인트 연결 스모크 테스트 통과 (model=gpt-5-mini, base_url=https://copa.codyssey.kr/v1)
- [x] Firestore 연동 포함 전체 end-to-end 스모크 테스트 통과:
      데이터 추가 → summary 반영 → 챗봇이 실제 요약을 반영해 응답 → 대화 자동 저장 →
      `GET /api/conversations/{id}`로 재조회 → 같은 대화로 후속 메시지(컨텍스트 유지) → 정리(삭제)까지 확인.
      테스트로 남긴 더미 데이터/대화는 삭제해 DB를 깨끗한 상태로 되돌려둠.
- [x] ⚠️ 버그 수정: `gpt-5-mini`는 추론형 모델이라 `max_tokens`를 답변 전에 내부 추론에 먼저 씀 —
      500으로는 5번 중 2번꼴로 `finish_reason=length`에 content가 빈 문자열로 잘리는 걸 Playwright로 재현.
      `CHAT_MAX_TOKENS=1200`으로 올리고, 그래도 비면 2배로 한 번 재시도 + 최종 폴백 메시지 추가.

## Phase 7: 샘플 데이터
- [x] 시계열 데이터 120개 생성 (`generate_sample_data.py` → `data/sample_data.json`, 2026-05-09~2026-09-05,
      일별 매출액 테마, 주말 상승/증가 트렌드 반영)
- [x] 데이터 시딩 스크립트 (`backend/seed_data.py`, Firestore batch write) — 실행 완료, `GET /api/data/summary`로
      120건 정상 반영 확인

## Phase 8: 프론트엔드 개발
- [x] `index.html` — 4탭 구조 (채팅/데이터 관리/대화 기록/데이터 요약)
- [x] `css/style.css` — 다크 글래스모피즘 디자인
- [x] `js/api.js` — API 통신 모듈
- [x] `js/app.js` — 앱 초기화/탭 전환
- [x] `js/chat.js` — 채팅 UI
- [x] `js/data.js` — 데이터 관리 UI
- [x] `js/conversations.js` — 대화 기록 UI
- [x] ⚠️ 버그 수정: `.chat-panel { display: flex }`가 브라우저 기본 `[hidden] { display: none }`과
      동일 우선순위로 충돌해서, 다른 탭으로 전환해도 채팅 패널이 계속 겹쳐 보이던 문제.
      `[hidden] { display: none !important; }` 전역 규칙 추가로 해결 (Playwright 스크린샷으로 재현/확인).

## Phase 9: 로컬 통합 테스트
- [x] 백엔드 서버 실행 + Swagger 확인 (`http://localhost:8000/docs`)
- [x] 프론트 ↔ 백엔드 연동 테스트 — Playwright(Chromium)로 실제 화면 조작 후 스크린샷 증거 확보
      (`backend/e2e_capture.py`, 결과물: `screenshots/01~05*.png`)
      - 01: 채팅 화면 — 질문 + 데이터 요약 반영된 답변
      - 02: 데이터 관리 — 새 데이터 추가 동작 확인
      - 03: 대화 기록 목록
      - 04: 대화 불러오기 → 채팅 화면에 재표시
      - 05: 데이터 요약 화면
      과제 제출 스크린샷 요구사항(질문+답변 포함 채팅 화면 / CRUD 1개 동작 / 불러오기 동작)을 그대로 충족.

## Phase 10~12: 배포 + 문서화
- [ ] Render 배포
- [ ] Vercel 배포
- [ ] README.md 작성
