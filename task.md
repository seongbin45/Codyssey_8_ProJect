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
- [x] 시계열 데이터 120개 생성 (`generate_sample_data.py` → `data/sample_data.json`, 합성 매출액 데이터,
      초기 개발/테스트 단계에서 사용)
- [x] 데이터 시딩 스크립트 (`backend/seed_data.py`, Firestore batch write)
- [x] ⚠️ 평가자 시연용으로 합성 데이터를 실제 데이터로 교체: 이 컴퓨터의 다른 프로젝트 폴더에서 발견한
      삼성전자 2023~2024 일별 종가 CSV(489건)를 `data/samsung_2023_2024.csv`로 복사해오고,
      `backend/import_samsung_data.py`(기존 data 컬렉션 삭제 후 CSV로 교체 시딩)를 새로 작성해 실행.
      local과 production이 같은 Firestore(`FIRESTORE_DATABASE_ID`)를 공유해서 한 번만 실행하면 됨.
      `GET /api/data/summary`로 489건(2023-01-02~2024-12-30, 평균 66,248, 최대 84,619, 최소 48,362)
      정상 반영 확인. 스크린샷도 이 데이터로 재캡처(`backend/e2e_capture.py`).

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

## Phase 8-2: 프론트엔드 재설계 (라이트 우선 + 보너스 반영)
- [x] 코드베이스 교차검증에서 요구사항 미충족 2건 발견: 콜드스타트 안내 문구가 README에만 있고 실제
      화면에는 없음 / 초기 데이터 로드 실패 시 `console.error`만 찍히고 화면은 무반응
- [x] `.dc.html` 디자인 시안(라이트 우선, oklch 색상, Public Sans + IBM Plex Mono) 검토
- [x] 별도로 준비된 구현 코드(zip)를 실제 API 계약과 한 줄씩 대조 검증 후 `frontend/`에 통합
      (api.js는 100% 동일 계약 + 헬스체크만 추가, 신규 파일: `js/theme.js`, `js/chart.js`)
- [x] 콜드스타트 배너(`API.health()`로 3초 초과 응답 감지) + 초기 로드/저장/삭제 실패 시 오류
      배너+재시도 버튼으로 교체 — 위 2건 모두 해결
- [x] 보너스 5개 중 4개를 프론트엔드에서 구현: 시각화(순수 SVG 라인차트), CSV/JSON 내보내기,
      다크모드 토글(localStorage 유지), 추가 지표(총합·표준편차 카드 포함 7카드).
      나머지 1개(Function Calling)는 UI에 고정 3단계 "TOOL CALL TRACE"만 표시 — 백엔드에 실제 도구
      호출 로직이 없어 완전한 구현은 아님 (정직하게 README에 명시)
- [x] 탭 접근성 보강: `role="tab"`/`aria-selected` + 좌우 화살표 키 이동 + `:focus-visible`
- [x] Playwright로 로컬 전체 재검증: 콜드스타트 없음 상태에서 배너 안 뜸, 다크모드 토글 정상,
      요약 카드 7개(TOTAL/STD DEV 포함) 정상, 탭 키보드 이동 정상, 콘솔 에러 없음

## Phase 9: 로컬 통합 테스트
- [x] 백엔드 서버 실행 + Swagger 확인 (`http://localhost:8000/docs`)
- [x] 프론트 ↔ 백엔드 연동 테스트 — Playwright(Chromium)로 실제 화면 조작 후 스크린샷 증거 확보
      (`backend/e2e_capture.py`, 결과물: `screenshots/01~06*.png`, 재설계 반영 최신본)
      - 01: 채팅 화면 — 질문 + 데이터 요약 반영된 답변 + 주입 컨텍스트 패널
      - 02: 데이터 관리 — 새 데이터 추가 동작 확인
      - 03: 대화 기록 목록
      - 04: 대화 불러오기 → 채팅 화면에 재표시 + 도구 호출 트레이스
      - 05: 데이터 요약 + 추이 차트 (7카드)
      - 06: 다크 모드 (보너스)
      과제 제출 스크린샷 요구사항(질문+답변 포함 채팅 화면 / CRUD 1개 동작 / 불러오기 동작)을 그대로 충족.

## Phase 10~12: 배포 + 문서화
- [x] git 저장소 초기화 + GitHub 푸시 (`github.com/seongbin45/Codyssey_8_ProJect`)
- [x] Render 백엔드 배포 — https://codyssey-8-project.onrender.com
      - ⚠️ 버그: Render가 기본 Python 3.14를 쓰는데 `pydantic-core==2.20.0`(pydantic 2.8.0 고정)이
        cp314 prebuilt wheel이 없어 Rust 소스 빌드 시도 → read-only 파일시스템에서 실패.
        `pydantic==2.13.5`(→ pydantic-core 2.46.5, cp314 wheel 존재)로 올려서 해결.
        (`render.yaml`의 `PYTHON_VERSION` 지정은 대시보드에서 수동 생성한 서비스엔 적용 안 됨 — 참고용)
- [x] Vercel 프론트엔드 배포 — https://codyssey-8-pro-ject.vercel.app
      - `frontend/build.js`가 빌드 시 `API_BASE_URL` 환경변수를 `config.js`에 주입
- [x] CORS 연동 확인 — Render `ALLOWED_ORIGINS`에 Vercel 도메인 추가 후 preflight/실제 요청 모두 200 확인
- [x] 프로덕션 end-to-end 검증 (`backend/e2e_prod_check.py`, Playwright) — 실배포 사이트에서 채팅 응답,
      데이터 120건 로드, 요약 카드까지 정상 동작 확인
- [x] README.md 작성 (배포 URL, 기술스택, 스크린샷, 로컬 실행법, 환경변수, 관련 연구 링크 포함)
- [ ] ⚠️ 프론트엔드 재설계(Phase 8-2) 이후 아직 Vercel 프로덕션에 재배포 안 됨 — 현재 프로덕션 URL은
      이전 다크 글래스모피즘 버전을 서빙 중. `git push` 후 Vercel 자동 재배포 확인 필요.
