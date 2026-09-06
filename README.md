# 내 데이터를 아는 AI 비서

일반적인 ChatGPT는 여러분의 데이터를 모릅니다. "이번 달 실적이 어때?"라고 물어도 일반적인 답변만
돌아옵니다. 이 프로젝트는 사용자가 직접 쌓은 시계열 데이터를 분석하고, 그 요약을 AI에게 컨텍스트로
주입해서, **내 상황을 실제로 아는 AI 비서**와 대화할 수 있게 해주는 풀스택 웹 서비스입니다.

## 배포 URL

| 구분 | URL |
|---|---|
| 프론트엔드 (Vercel) | https://codyssey-8-pro-ject.vercel.app |
| 백엔드 API (Render) | https://codyssey-8-project.onrender.com |
| Swagger UI | https://codyssey-8-project.onrender.com/docs |

> ⚠️ 백엔드는 Render 무료 티어라 일정 시간 요청이 없으면 슬립 상태로 들어갑니다. 슬립 후 첫 요청은
> 콜드 스타트로 10~30초 정도 걸릴 수 있으니, 첫 응답이 늦더라도 잠시 기다려주세요.

## 기술 스택

| 영역 | 기술 |
|---|---|
| 백엔드 | FastAPI, uvicorn |
| 데이터베이스 | Firebase Firestore (Native mode) |
| AI | OpenAI 호환 API (Codyssey 게이트웨이, `gpt-5-mini`) |
| 프론트엔드 | 바닐라 HTML / CSS / JavaScript (프레임워크 미사용) |
| 백엔드 배포 | Render |
| 프론트엔드 배포 | Vercel |
| E2E 검증 | Playwright |

## 주요 기능

1. **데이터 기반 AI 채팅** — 저장된 시계열 데이터의 요약(기간/개수/통계/트렌드)을 시스템 프롬프트에
   주입한 뒤 GPT가 답변. 로딩 표시 포함.
2. **데이터 관리(CRUD)** — `(date, value, memo)` 형태의 데이터 추가/수정/삭제, 목록 실시간 갱신.
3. **대화 기록 저장 및 불러오기** — 모든 대화가 자동 저장되며, 목록에서 선택해 이어서 대화 가능.
4. **데이터 요약** — 기간/개수/평균/최대/최소/최근 트렌드를 카드 형태로 표시.

## 스크린샷

Playwright로 실제 배포 화면을 조작해 확보한 증거입니다 (`screenshots/` 폴더).

| 데이터 요약이 보이는 채팅 화면 (질문+답변) | 데이터 관리 (CRUD 동작) |
|---|---|
| ![chat](screenshots/01_chat_summary_qna.png) | ![data](screenshots/02_data_management_add.png) |

| 대화 기록 목록 | 대화 불러오기 |
|---|---|
| ![conversations](screenshots/03_conversations_list.png) | ![loaded](screenshots/04_conversation_loaded_in_chat.png) |

| 데이터 요약 화면 |
|---|
| ![summary](screenshots/05_data_summary.png) |

## 로컬 실행 방법

### 백엔드

```bash
cd backend
python -m venv venv
./venv/Scripts/activate    # Windows
pip install -r requirements.txt

# 프로젝트 루트에 .env 파일 준비 (.env.example 참고)

uvicorn main:app --reload --port 8000
```

`http://localhost:8000/docs`에서 Swagger UI 확인 가능.

### 샘플 데이터 시딩 (최초 1회)

```bash
cd backend
python generate_sample_data.py   # 프로젝트 루트에서 실행, data/sample_data.json 생성
python seed_data.py              # Firestore data 컬렉션에 업로드
```

### 프론트엔드

```bash
cd frontend
python -m http.server 5500
```

`http://localhost:5500`에서 접속. (`.env`의 `ALLOWED_ORIGINS`에 `http://localhost:5500`이 포함되어 있어야 CORS가 통과합니다.)

## 환경 변수 (최소 세트)

`.env.example` 참고. 주요 변수:

| 변수 | 설명 |
|---|---|
| `CODYSSET_API_KEY_OPEN_AI` | Codyssey가 발급하는 OpenAI 프로토콜 호환 키 |
| `CHAT_MODEL` | 챗봇이 호출할 모델 (기본 `gpt-5-mini`) |
| `CODYSSEY_BASE_URL` | Codyssey OpenAI 호환 게이트웨이 base URL |
| `CHAT_MAX_TOKENS` | 챗봇 응답 최대 토큰 (기본 1200 — 추론형 모델이 내부 추론에 토큰을 먼저 쓰므로 넉넉히 설정) |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Firebase 서비스 계정 키 (JSON 전체를 한 줄로) |
| `FIRESTORE_DATABASE_ID` | Firestore 데이터베이스 ID (`(default)`가 아닌 이름 있는 DB를 쓸 경우 필수) |
| `ALLOWED_ORIGINS` | CORS 허용 도메인 (콤마 구분) |
| `API_BASE_URL` (Vercel) | 프론트엔드가 호출할 백엔드 주소. `frontend/build.js`가 빌드 시 `config.js`에 주입 |

## 배포 메모

- **Render**: Root Directory `backend`, Build Command `pip install -r requirements.txt`,
  Start Command `uvicorn main:app --host 0.0.0.0 --port $PORT`. Render 기본 Python 버전(3.14)에서
  `pydantic-core`의 구버전이 prebuilt wheel 없이 소스 빌드를 시도해 실패하는 이슈가 있어
  `pydantic==2.13.5`로 고정했습니다.
- **Vercel**: Root Directory `frontend`, Build Command `npm run build`, Output Directory `.`,
  환경변수 `API_BASE_URL`에 Render 배포 URL 지정.

## 관련 연구 (Related Work)

"미리 계산된 데이터 요약을 LLM의 system prompt에 통째로 주입한다"는 이 프로젝트의 핵심 설계가
학계·업계의 넓은 스펙트럼에서 어디에 위치하는지, Text-to-SQL·RAG·LLM 에이전트/도구 호출·대화형
BI/시각화·평가 및 신뢰성 5개 분야에 걸쳐 약 659편의 논문·시스템을 조사하고 그중 40편을 심층
분석했습니다. 전체 내용은 [research/README.md](research/README.md)에서 확인할 수 있습니다.

## 프로젝트 구조

```
Codyssey_8_ProJect/
├── backend/                 # FastAPI 백엔드
│   ├── main.py
│   ├── routers/              # data / conversations / chat
│   ├── services/              # 비즈니스 로직 + Firestore 연동
│   ├── schemas/                # Pydantic 모델
│   ├── seed_data.py            # 샘플 데이터 Firestore 시딩 스크립트
│   └── e2e_capture.py, e2e_prod_check.py  # Playwright E2E 검증 스크립트
├── frontend/                 # 바닐라 프론트엔드 (채팅/데이터관리/대화기록/요약 4탭)
├── data/sample_data.json      # 시계열 샘플 데이터 (120건)
├── research/                  # 관련 연구 조사 자료
├── screenshots/                # 제출용 스크린샷
├── task.md                     # 구현 진행 상황 체크리스트
└── render.yaml                 # Render 배포 블루프린트
```
