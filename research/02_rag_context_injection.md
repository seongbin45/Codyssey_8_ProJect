# RAG(Retrieval-Augmented Generation) 및 구조화·시계열·표 데이터의 컨텍스트 주입 기법 조사

## 1. 개요

우리 프로젝트("내 데이터를 아는 AI 비서")는 Firestore에 저장된 시계열 데이터(date/value/memo)를 `GET /api/data/summary`에서 집계하여 `{period, count, metrics(total/average/max/min), trend}` 형태의 JSON 요약을 만들고, 이를 파이썬 f-string으로 텍스트 템플릿에 끼워 넣어 `POST /api/chat`의 system prompt 전체에 주입한 뒤, 사용자 메시지와 함께 gpt-5-mini에 chat completion을 요청하는 구조다. 벡터 임베딩도, 유사도 검색도, 청크 분할도, "질의에 따라 다른 정보를 골라 담는" retrieval 단계 자체도 없다. 대화가 길어지면 이전 대화 기록 전체를 다시 통째로 전송하는 것도 같은 철학의 연장이다. 한마디로 이는 "검색(retrieval) 없는 규칙 기반 전량 주입(rule-based full-context injection)"이며, 학계·업계에서 이야기하는 RAG 스펙트럼에서 가장 단순한 극단에 위치한다.

이 문서는 "LLM에 외부/구조화 데이터를 컨텍스트로 넣는" 연구들을 조사하여 우리 방식이 그 스펙트럼 어디에 있는지 근거를 대는 것을 목적으로 한다. 순수 텍스트 RAG의 원조 격인 REALM(2020), RAG(Lewis et al., 2020), RETRO(2021)부터, 구조화 데이터(테이블·지식그래프·시계열)를 다루기 위한 변형들, 사전 계산된 요약/그래프 커뮤니티 요약을 검색 단위로 쓰는 GraphRAG 계열, 자연어 질의를 형식 질의(SQL 유사)로 변환해 구조화 표현 위에서 답을 구하는 Structured-RAG 계열, 그리고 "검색 자체를 없애고 컨텍스트 창을 늘리자"는 long-context 진영까지 폭넓게 살펴보았다.

큰 그림에서 보면, RAG 연구는 "무엇을 검색 단위(retrieval unit)로 삼는가"라는 축과 "그 단위를 어떻게 선택하는가(임베딩 유사도 vs 규칙/전량 vs 형식 질의)"라는 축으로 나뉜다. 우리 프로젝트는 검색 단위가 "미리 계산된 요약 문자열 1개"이고, 선택 방식은 "무조건 전량 포함(선택 자체가 없음)"이라는 점에서, 이 스펙트럼의 "0번째 항" — 즉 RAG라기보다는 최소 형태의 프롬프트 엔지니어링/컨텍스트 엔지니어링에 해당한다. 다만 흥미롭게도 이는 뒤에서 다룰 "long-context 대 RAG" 논쟁에서 언급되는 "요약 기반 압축(summarization-based context)" 접근과 상당히 닮아 있다.

## 2. 조사 규모와 트렌드

WebSearch로 25개 이상의 검색 질의(RAG survey, RAG for structured/tabular data, table RAG, time-series LLM grounding, long-context vs RAG, text-to-SQL, data-to-text generation, EHR/clinical RAG, financial RAG, conversation memory, prompt compression, hallucination survey 등)를 수행하여 총 **130편 이상**의 논문·서베이·데이터셋·블로그 자료를 제목·연도·링크 단위로 수집했다(§6 참고문헌 참조). 서베이 논문("Retrieval-Augmented Generation for Large Language Models: A Survey", 2312.10997 등)이 언급하는 하위 갈래(Naive/Advanced/Modular RAG, Self-RAG, CRAG, GraphRAG, Adaptive-RAG 등)를 통해 대표 원본 논문을 추가로 역추적했다.

관찰된 트렌드:

- **2020~2022년**: REALM, RAG, RETRO 등 "학습 가능한 dense retriever + 파라메트릭 생성기"라는 기본 아키텍처가 확립됨. 이 시기 표/시계열 등 구조화 데이터는 아직 별도 취급되지 않고, HybridQA·ToTTo 같은 표+텍스트 데이터셋이 등장.
- **2023년**: LLM(GPT-3.5/4)의 등장으로 "학습(fine-tuning) 없이 프롬프트에 검색 결과를 넣는" 실용적 RAG가 폭발적으로 확산. Self-RAG, HyDE, LLMTime, Text-to-SQL 벤치마크 다수 등장.
- **2024년**: GraphRAG, CRAG, Adaptive-RAG, TableRAG, Time-LLM 등 "RAG를 구조화 데이터·시계열·전역 질의로 확장"하는 연구가 급증. 동시에 Gemini 1.5의 100만 토큰 컨텍스트 등장으로 "long-context vs RAG" 논쟁 촉발.
- **2025~2026년**: Structured-RAG(집계 질의), EHR-RAG(시계열+텍스트 임상 데이터), 시계열 QA 벤치마크(MTBench, MMTS-Bench), 프롬프트 압축(LLMLingua 계열), 대화 메모리 관리(SGMem 등) 연구가 이어지며, "검색이 필요 없을 만큼 데이터가 작다면 요약을 통째로 넣는 것도 합리적"이라는 실무적 타협안이 논의됨. 즉 우리 프로젝트류의 "요약 통째 주입"이 스펙트럼의 정당한 한 지점으로 재조명되는 흐름이 있다.

## 3. 대표 논문 심층 비교 (8편)

### 3.1 RAG — Lewis et al., "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks" (NeurIPS 2020)
https://arxiv.org/abs/2005.11401

- **핵심 아이디어**: 파라메트릭 메모리(seq2seq 생성기)와 비파라메트릭 메모리(위키피디아의 dense vector index)를 결합. 사전학습된 neural retriever(DPR)가 질의를 인코딩해 유사도 검색으로 문서를 가져오고, 생성기가 이를 조건으로 답을 생성.
- **검색 단위**: 위키피디아의 개별 "패시지(passage)". 문서 전체가 아니라 문단 단위로 쪼갠 청크.
- **검색 방식**: **임베딩 유사도 검색**(dense retriever, MIPS 근사 최근접 이웃 탐색). 질의마다 다른 패시지 top-k를 동적으로 선택.
- **컨텍스트/토큰 관리**: 매 생성 스텝 혹은 시퀀스 전체에 대해 top-k(보통 5~10개) 패시지만 사용 — 전체 코퍼스를 넣는 것이 물리적으로 불가능하므로 선택이 핵심.
- **우리 프로젝트와의 차이/시사점**: 우리는 "질의에 따라 달라지는 검색"이 전혀 없다 — 요약 하나가 모든 질문에 항상 통째로 들어간다. RAG의 핵심 발명은 "관련성에 따라 부분만 골라 넣는 것"인데, 우리는 이 단계 자체가 없다. 즉 우리 시스템은 RAG의 "R"이 빠진 "AG"에 가깝다.

### 3.2 REALM — Guu et al., "Retrieval-Augmented Language Model Pre-Training" (ICML 2020)
https://arxiv.org/abs/2002.08909

- **핵심 아이디어**: 사전학습 단계부터 latent knowledge retriever를 언어모델에 통합. Masked language modeling 신호로 retriever를 비지도 학습시키고, 수백만 문서에 대한 검색 스텝까지 역전파.
- **검색 단위**: 위키피디아 개별 문서(문단 단위).
- **검색 방식**: 임베딩 유사도 검색이며, 검색기 자체가 학습되어 "어떤 문서가 이 마스킹된 토큰 예측에 유용한가"를 스스로 익힘. 즉 검색 정책 자체가 학습 대상.
- **컨텍스트 관리**: 인코더가 처리 가능한 길이 내에서 문서를 붙여 넣고 attention.
- **우리 프로젝트와의 차이/시사점**: REALM은 "검색 정책의 학습 가능성"을 보여준 원조 논문이다. 반면 우리 요약 생성 로직은 규칙 기반(합계/평균/최댓값/최솟값 계산)이라 학습되지 않는다 — 이는 나쁜 것이 아니라, 우리 데이터가 애초에 구조화(스키마 고정)되어 있어 "무엇이 중요한 정보인가"를 학습할 필요 없이 결정론적으로 계산 가능하기 때문이다. 정형 데이터 RAG의 상당수(Text-to-SQL, TAT-QA 등)도 같은 이유로 "학습된 유사도 검색" 대신 "질의를 형식 언어로 변환"하는 쪽을 택한다(§3.6 참고).

### 3.3 RETRO — Borgeaud et al., "Improving Language Models by Retrieving from Trillions of Tokens" (DeepMind, ICML 2022)
https://arxiv.org/abs/2112.04426

- **핵심 아이디어**: 2조 토큰 규모의 코퍼스에서 검색한 문서 청크를 조건으로 자기회귀 생성을 수행. GPT-3와 비슷한 성능을 25배 적은 파라미터로 달성 — "파라미터를 늘리는 대신 검색 데이터베이스를 늘리자"는 주장.
- **검색 단위**: 64토큰 단위의 고정 크기 청크. 이전 토큰들과의 지역적(local) 유사도로 근사 최근접 이웃 검색.
- **검색 방식**: 고정된(frozen) BERT 인코더로 임베딩 후 근사 최근접 이웃(ANN) 검색. 청크 단위 교차어텐션(chunked cross-attention)으로 검색 결과를 모델 내부에 통합 — 프롬프트에 텍스트로 이어붙이는 게 아니라 아키텍처 수준에서 결합.
- **컨텍스트 관리**: 프롬프트 길이와 무관하게 계산 비용이 선형적으로만 늘어나도록 설계 — "프롬프트에 다 욱여넣기"의 대안으로 제시된 셈.
- **우리 프로젝트와의 차이/시사점**: 우리는 RETRO식 아키텍처 결합이 아니라 텍스트 이어붙이기(concatenation)만 사용한다. 이는 우리가 OpenAI 호환 API라는 블랙박스 LLM을 쓰기 때문에 불가피한 선택이지만, 동시에 "데이터가 커지면 프롬프트에 다 넣을 수 없다"는 RETRO의 문제의식이 우리에게도 그대로 적용된다는 걸 보여준다. 지금은 요약이 짧아 괜찮지만, 원본 시계열 레코드 수가 많아지면 같은 병목에 부딪힌다.

### 3.4 GraphRAG — Edge et al., "From Local to Global: A Graph RAG Approach to Query-Focused Summarization" (Microsoft Research, 2024)
https://arxiv.org/abs/2404.16130

- **핵심 아이디어**: "이 데이터셋의 주요 주제가 뭐야?" 같은 전역적(global) 질문은 청크 단위 유사도 검색으로는 답할 수 없다(질문과 유사한 청크 하나를 찾는 게 무의미하기 때문). 이를 해결하기 위해 LLM으로 문서에서 엔터티 지식그래프를 뽑고, 커뮤니티 탐지로 엔터티 그룹을 만든 뒤, 각 커뮤니티에 대해 **LLM이 미리 요약을 생성**해둔다.
- **검색 단위**: 원문 청크가 아니라 **사전 계산된 커뮤니티 요약(pre-computed community summary)**. 질의가 오면 관련 커뮤니티 요약들로 부분 답변을 만들고 이를 다시 취합(map-reduce 방식)한다.
- **검색 방식**: 전역 질의에는 사실상 "관련될 만한 커뮤니티 요약 전체(혹은 상당수)"를 사용 — 세밀한 유사도 검색이 아니라 미리 계산해 둔 압축 정보를 통째로 활용하는 방식에 가깝다.
- **컨텍스트 관리**: 원본이 100만 토큰이어도 커뮤니티 요약은 훨씬 짧으므로, 요약이라는 "손실 압축" 계층을 하나 더 둠으로써 컨텍스트 예산을 관리.
- **우리 프로젝트와의 차이/시사점**: 이 논문은 우리 프로젝트와 철학적으로 가장 가깝다 — **"미리 계산해 둔 요약을 검색/생성의 단위로 삼는다"**는 점이 동일하다. 차이는 GraphRAG가 (1) 요약을 여러 개의 계층적 단위(커뮤니티별)로 만들어 질의에 따라 그중 일부만 선택하는 반면, 우리는 단일 요약 하나만 만들어 무조건 전부 넣는다는 것, (2) GraphRAG는 그래프 구조·클러스터링이라는 비지도 학습 단계를 거치는 반면 우리는 "합계/평균/최댓값/최솟값/트렌드"라는 고정된 통계 스키마를 쓴다는 것이다. 즉 우리 요약은 GraphRAG의 "커뮤니티 요약"에서 클러스터링과 선택 단계를 제거한 극단적 단순화 버전이라 볼 수 있다.

### 3.5 TAT-QA — Zhu et al., "A Question Answering Benchmark on a Hybrid of Tabular and Textual Content in Finance" (ACL 2021)
https://arxiv.org/abs/2105.07624

- **핵심 아이디어**: 재무제표처럼 표(숫자)와 텍스트(문단)가 섞인 실제 문서에서, 덧셈/뺄셈/곱셈/나눗셈/개수세기/비교/정렬 등 수치 연산을 요구하는 QA 벤치마크. 베이스라인 모델 TAGOP은 (1) 시퀀스 태깅으로 표의 관련 셀·텍스트의 관련 스팬을 추출하고, (2) 사전 정의된 연산자 집합으로 기호적(symbolic) 추론을 수행해 최종 답을 계산.
- **검색 단위**: 표의 **개별 셀(cell)**과 텍스트의 **스팬(span)**. 우리처럼 전체를 넣는 게 아니라, 모델이 "이 질문에 필요한 셀이 어디인가"를 먼저 골라낸다.
- **검색 방식**: 임베딩 유사도 검색이 아니라 **시퀀스 태깅(분류) 기반 추출** — 지도학습된 모델이 "이 셀/스팬이 relevant한가"를 토큰 단위로 예측. 그다음 연산은 신경망이 아니라 규칙 기반 연산자(더하기, 평균 내기 등)로 수행.
- **컨텍스트 관리**: 표+문단 전체를 인코더에 넣되, 실제 정답 계산에는 추출된 소수의 셀/스팬만 사용 — "다 읽되, 다 쓰지는 않는다."
- **우리 프로젝트와의 차이/시사점**: 흥미로운 대칭점은, TAT-QA의 최종 연산(덧셈/평균/비교)이 바로 우리 `/api/data/summary`가 이미 파이썬으로 미리 계산해 두는 값들(total/average/max/min)과 같은 종류라는 것이다. 차이는 TAT-QA류 시스템은 "질문에 따라 어떤 셀을 골라 어떤 연산을 적용할지"를 모델이 매번 동적으로 결정하는 반면, 우리는 "모든 질문에 대해 미리 4가지 통계를 다 계산해서 넣어두고, 어떤 걸 쓸지는 LLM이 프롬프트 내에서 알아서 골라 읽게" 한다는 점이다. 즉 우리는 "검색/추출"을 LLM의 in-context 독해력에 통째로 위임하고 있다.

### 3.6 Structured RAG (S-RAG) — Koshorek et al., "Structured RAG for Answering Aggregative Questions" (2025)
https://arxiv.org/abs/2511.08505

- **핵심 아이디어**: "직원 1000명 이상인 남미 회사들의 평균 ARR은?" 같은 **집계(aggregative) 질의**는 문서 몇 개를 검색해서는 풀 수 없고, 코퍼스 전체에 대한 구조화된 질의(사실상 SQL과 유사)가 필요하다. S-RAG은 인덱싱 시점에 코퍼스로부터 **구조화된 표현(structured representation)**을 미리 구축해 두고, 추론 시점에 자연어 질의를 이 구조 위에서 실행 가능한 형식 질의로 변환한다.
- **검색 단위**: 벡터 청크가 아니라 **구조화된 레코드/필드** — 데이터베이스 테이블에 가까운 표현. 즉 "검색"이 아니라 "질의(query) 실행"에 가깝다.
- **검색 방식**: 임베딩 유사도 검색이 아니라 **자연어 → 형식 질의(formal query) 변환** 후 구조화 저장소에 대해 정확 매칭/집계 연산을 수행. 이는 본질적으로 Text-to-SQL과 RAG의 하이브리드다.
- **컨텍스트 관리**: LLM 프롬프트에는 원문 전체나 청크가 아니라 "질의 실행 결과(이미 집계된 값)"만 들어간다 — 우리 프로젝트의 `/api/data/summary`가 하는 일과 원리적으로 동일하다.
- **우리 프로젝트와의 차이/시사점**: 이 논문은 "롱-컨텍스트 LLM과 일반 RAG 모두를 능가한다"고 보고하는데, 그 이유가 바로 우리가 이미 하고 있는 방식 — **"자연어 질의가 아니라 미리 계산/집계된 구조화 결과를 LLM에 준다"** — 이 아키텍처적으로 타당함을 뒷받침한다. 차이는 S-RAG은 사용자의 자연어 질문마다 다른 형식 질의를 동적으로 생성해 다른 집계를 계산하는 반면, 우리는 질문과 무관하게 **고정된 4종 통계(합계/평균/최댓값/최솟값)만 미리 계산**해 둔다는 점이다. 사용자가 "3월 평균이 얼마였어?"처럼 우리가 미리 계산해두지 않은 세부 집계(예: 특정 부분 기간, 특정 조건의 필터링)를 물으면, S-RAG은 새로운 형식 질의를 만들어 정확히 답할 수 있지만 우리 시스템은 LLM이 텍스트로 주어진 요약 안에서 "눈대중"으로 추론하거나 아예 답하지 못한다.

### 3.7 Long-Context vs RAG — Li, Cao, Ma & Sun, "Long Context vs. RAG for LLMs: An Evaluation and Revisits" (2024/2025)
https://arxiv.org/abs/2501.01880

- **핵심 아이디어**: 컨텍스트 창이 100만 토큰급으로 커진 LLM(Gemini 1.5 등) 시대에, "그냥 다 넣어버리기(long-context)"와 "검색해서 필요한 것만 넣기(RAG)" 중 무엇이 더 나은지 체계적으로 재평가.
- **검색 단위**: 이 논문 자체는 새로운 검색 단위를 제안하지 않고, 기존 방식들(청크 기반 RAG, 요약 기반 검색, 롱-컨텍스트)을 비교하는 메타 연구.
- **주요 발견**: 위키피디아 기반 QA처럼 사실 검색형 질문에서는 대체로 **롱-컨텍스트가 RAG를 능가**한다. 반면 대화형/개방형 질의에서는 RAG가 유리하다. 특히 **"요약 기반 검색(summarization-based retrieval)"은 롱-컨텍스트와 성능이 비슷했지만, 단순 청크 기반 검색은 둘 다에 크게 못 미쳤다** — 이 결과가 본 조사에서 가장 중요한 시사점이다. 또한 "컨텍스트 없이도 답할 수 있는 질문"을 걸러내지 않으면 평가가 왜곡된다는 방법론적 지적도 있다.
- **컨텍스트 관리**: 롱-컨텍스트는 예산 관리를 아예 포기하고 "다 넣는다"는 전략. 다만 저자들은 "lost-in-the-middle"(길고 방해 정보가 많은 컨텍스트의 중간에 있는 정보를 모델이 놓치는 현상, Liu et al. 2023)이 여전히 문제라고 지적.
- **우리 프로젝트와의 차이/시사점**: 우리 방식은 사실상 이 논문이 말하는 **"요약 기반 검색"과 거의 동일한 범주**에 속한다 — 원본 시계열 레코드를 전부 넣는 게 아니라 미리 요약해서 압축한 것을 프롬프트에 넣기 때문이다. 이 논문의 발견에 따르면 이 전략이 성능상 나쁘지 않은 선택일 수 있다는 근거가 된다. 다만 이 논문의 "요약 기반 검색"은 질의에 따라 어떤 문서/구간을 요약할지 동적으로 정하는 반면, 우리는 요약 자체가 정적(static)이고 질의와 무관하다는 차이가 있다.

### 3.8 Time-LLM — Jin et al., "Time-LLM: Time Series Forecasting by Reprogramming Large Language Models" (ICLR 2024)
https://arxiv.org/abs/2310.01728

- **핵심 아이디어**: LLM 백본은 그대로 얼린 채(frozen), 시계열 데이터를 텍스트 프로토타입으로 재프로그래밍(reprogramming)하여 시계열 예측을 수행. "Prompt-as-Prefix(PaP)" 기법으로 시계열의 통계적 특징을 서술하는 텍스트를 프롬프트 앞부분에 붙여 LLM의 이해를 돕는다.
- **검색 단위**: 검색이라는 개념 자체가 없다. **시계열 구간의 통계 요약(추세, 계절성 등)을 자연어 문장으로 변환해 프롬프트 접두사로 삽입**한다는 점에서, "검색"이 아니라 "요약 텍스트를 프롬프트에 규칙 기반으로 끼워 넣는" 방식 — 우리 프로젝트의 `/api/data/summary` → f-string 삽입과 원리적으로 동일하다.
- **검색 방식**: 없음. 정적인 통계 설명(예: "이 시계열은 평균 X, 추세는 상승")을 프롬프트 템플릿에 채워 넣는 방식으로, RAG의 유사도 검색과는 무관하다.
- **컨텍스트 관리**: 시계열 패치(patch)를 임베딩하고 이를 언어모델의 임베딩 공간에 정렬시키는 별도의 학습 가능한 레이어를 두어 토큰 예산을 관리 — 다만 이는 아키텍처 수정을 요구하므로 우리처럼 순수 프롬프트만으로 되는 방식은 아니다.
- **우리 프로젝트와의 차이/시사점**: Time-LLM은 "시계열 → 텍스트 통계 설명 → 프롬프트 삽입"이라는 점에서 우리 프로젝트가 하고 있는 일의 학술적 대응물이다. 차이는 Time-LLM이 예측(forecasting)이라는 정량적 출력을 얻기 위해 재프로그래밍 레이어를 추가 학습시키는 반면, 우리는 그런 학습 없이 이미 계산된 요약 텍스트만 프롬프트에 넣고 자연어 답변을 받는다는 것 — 즉 우리는 "예측"이 아니라 "설명/대화"만을 목표로 하므로 Time-LLM보다 훨씬 단순한 버전이라 할 수 있다.

## 4. Long-Context vs RAG 논쟁 정리

2023~2024년 Gemini 1.5 Pro(100만~200만 토큰), GPT-4 Turbo(128K) 등 컨텍스트 창이 급격히 커지면서 "이제 RAG가 필요 없는 게 아니냐"는 논쟁이 촉발되었다. 이 논쟁의 핵심 축은 다음과 같다.

- **롱-컨텍스트 옹호**: RAG의 검색 단계는 본질적으로 손실이 있다(청크 경계가 문서 구조와 무관하게 잘리고, top-k 선택이 관련 정보를 버릴 수 있음). 컨텍스트 창이 충분히 크면 이런 손실 없이 원문 전체를 그대로 넣을 수 있다. Needle-in-a-Haystack류 평가(Gemini 1.5 테크리포트, arxiv 2403.05530)는 100만 토큰 안에서도 특정 사실을 99% 이상 찾아낼 수 있음을 보였다.
- **RAG 옹호**: (1) 비용/지연시간 — 매 요청마다 100만 토큰을 처리하는 것은 비싸고 느리다. (2) "Lost in the middle" 현상(Liu et al., 2023) — 프롬프트 중간에 묻힌 정보를 모델이 잘 활용하지 못하는 위치 편향이 최신 모델에서도 완전히 해소되지 않았다(Needle Threading, arxiv 2411.05000). (3) 인용/출처 추적 — RAG는 "이 문장은 몇 번째 검색 결과에서 왔다"는 식의 근거 추적이 쉬운 반면, 롱-컨텍스트는 어디서 답이 나왔는지 설명하기 어렵다.
- **핵심 발견(Li et al., 2501.01880)**: 단순 "청크 기반 RAG"는 롱-컨텍스트에 확실히 뒤처지지만, **"요약 기반 검색"은 롱-컨텍스트와 성능이 비등**했다. 즉 논쟁의 실제 승자는 "RAG냐 롱-컨텍스트냐"라는 이분법이 아니라, "정보를 어떻게 압축해서 넣느냐"라는 문제로 수렴한다.
- **우리 프로젝트와의 연결**: 우리의 방식(원본 레코드 대신 사전 계산된 요약 통계를 프롬프트에 넣음)은 정확히 이 "요약 기반 압축 + 롱-컨텍스트" 접근에 해당한다. 우리는 데이터가 아직 작기 때문에(개인 시계열 데이터, 수십~수백 건 규모) 굳이 벡터 검색을 도입하지 않고도 이 절충안이 잘 맞는 상황이라고 볼 수 있다. 다만 대화 기록을 통째로 재전송하는 부분은 롱-컨텍스트 전략의 가장 순수한(그리고 가장 낭비가 큰) 형태이며, 이 논쟁에서 지적되는 비용·지연시간 문제를 그대로 안고 있다.

## 5. 종합 시사점 — 우리 프로젝트는 스펙트럼 어디에 있는가

RAG/구조화 데이터 컨텍스트 주입 스펙트럼을 하나의 축으로 그려보면 대략 다음과 같다.

```
[전량 규칙 기반 주입]  →  [사전 계산 요약 주입]  →  [형식 질의/구조화 검색]  →  [임베딩 유사도 검색(RAG)]  →  [학습된 검색+생성 결합(RETRO/REALM)]  →  [자기반성형 적응적 검색(Self-RAG/CRAG/Adaptive-RAG)]
   (우리 프로젝트)         (Time-LLM, 우리와 유사)      (S-RAG, Text-to-SQL, TAT-QA)         (Lewis RAG, HyDE)                  (RETRO, REALM)                        (2023~2024 최신 기법)
```

- **우리 프로젝트의 위치**: "전량 규칙 기반 주입" ~ "사전 계산 요약 주입" 사이. 검색 단계가 없다는 점에서 순수 RAG의 정의(질의에 따라 달라지는 검색)를 충족하지 못하지만, "미리 계산된 압축 정보를 프롬프트에 넣는다"는 점에서는 GraphRAG의 커뮤니티 요약, Time-LLM의 프롬프트 접두사, "long-context vs RAG" 논쟁에서 성능이 준수하다고 확인된 "요약 기반 검색"과 같은 계열에 속한다. 데이터 규모가 작은 지금 단계에서는 이 방식이 근거 없는 임시방편이 아니라, 문헌에서도 합리적이라고 뒷받침되는 선택이다.
- **한계**: (1) 질의에 따라 달라지는 정보가 없으므로, S-RAG나 TAT-QA처럼 "이번 질문에 필요한 특정 구간/조건의 집계"는 답할 수 없다 — 미리 계산해둔 4종 통계(합계/평균/최댓값/최솟값) 밖의 질문에는 근본적으로 약하다. (2) 데이터가 늘어나면(수천~수만 건) 요약이 정보 손실을 일으키거나, 대화 기록 전체 재전송 방식이 토큰 비용/지연시간 문제를 일으킨다. (3) 대화가 길어질수록 시스템 프롬프트+전체 히스토리를 매번 재전송하는 것은 "Lost-in-the-middle"과 비용 문제를 동시에 안는, 논쟁에서 지적된 가장 순진한(naive) 형태의 롱-컨텍스트 전략이다.

**개선 방향 제안 (2~4가지):**

1. **질의 인식형 동적 집계 도입(S-RAG/Text-to-SQL 방향)**: 사용자의 질문을 분석해 필요한 기간·조건에 맞는 집계를 그때그때 계산(예: "지난주 평균"을 물으면 전체 요약이 아니라 지난주만 필터링해 계산)하는 얇은 레이어를 추가하면, 고정된 4종 통계의 한계를 넘어설 수 있다. 이는 벡터 검색이 아니라 규칙 기반 쿼리 파서만으로도 충분히 구현 가능하다.
2. **데이터 규모 증가 시 semantic search 도입(RAG 본연의 방향)**: 데이터가 수천 건 이상으로 늘어나면, 요약 하나에 다 담을 수 없는 세부 사항(개별 메모의 내용 등)이 늘어난다. 이때는 개별 레코드(또는 메모 텍스트)를 임베딩해 벡터 스토어에 저장하고, 질문과 유사한 레코드만 top-k로 검색해 요약과 함께 넣는 하이브리드(GraphRAG류 "요약+세부 검색 병행") 구조로 전환하는 것이 자연스러운 다음 단계다.
3. **대화 기록 관리 개선(메모리 요약)**: 매번 전체 히스토리를 재전송하는 대신, "Recursively Summarizing Enables Long-Term Dialogue Memory"(2308.15022)류의 재귀적 대화 요약이나 최근 N턴만 유지 + 오래된 부분은 요약본으로 대체하는 전략을 적용하면 토큰 비용과 지연시간을 크게 줄일 수 있다.
4. **인용/근거 추적 추가**: 지금은 LLM이 요약 문자열 어디를 근거로 답했는지 알 수 없다. RAG 계열이 강조하는 "출처 추적"처럼, 요약 JSON의 각 필드에 태그를 달아 답변에 "어떤 지표를 근거로 했는지" 명시하게 하면 GraphRAG/Self-RAG류가 강조하는 신뢰성·검증 가능성을 낮은 비용으로 일부 확보할 수 있다.

## 6. 참고문헌 목록

### RAG 원조·서베이
- Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks (Lewis et al., 2020) - https://arxiv.org/abs/2005.11401
- REALM: Retrieval-Augmented Language Model Pre-Training (Guu et al., 2020) - https://arxiv.org/abs/2002.08909
- Improving Language Models by Retrieving from Trillions of Tokens / RETRO (Borgeaud et al., 2021) - https://arxiv.org/abs/2112.04426
- Retrieval-Augmented Generation for Large Language Models: A Survey (2023) - https://arxiv.org/abs/2312.10997
- A Survey on Retrieval-Augmented Text Generation for Large Language Models (2024) - https://arxiv.org/abs/2404.10981
- Retrieval-Augmented Generation: A Comprehensive Survey of Architectures, Enhancements, and Robustness Frontiers (2025) - https://arxiv.org/html/2506.00054v1
- A Survey on RAG Meeting LLMs: Towards Retrieval-Augmented Large Language Models (2024) - https://dl.acm.org/doi/10.1145/3637528.3671470
- Retrieval Augmented Generation Evaluation in the Era of Large Language Models: A Comprehensive Survey (2025) - https://arxiv.org/pdf/2504.14891
- Retrieval-Augmented Generation for Natural Language Processing: A Survey (2024) - https://arxiv.org/pdf/2407.13193
- RAG and RAU: A Survey on Retrieval-Augmented Language Model in Natural Language Processing (2024) - https://arxiv.org/pdf/2404.19543
- A Systematic Review of Key Retrieval-Augmented Generation (RAG) Systems (2025) - https://arxiv.org/html/2507.18910v1
- Evaluation of Retrieval-Augmented Generation: A Survey (2024) - https://arxiv.org/html/2405.07437v2
- Dense Text Retrieval based on Pretrained Language Models: A Survey (2022) - https://arxiv.org/pdf/2211.14876
- Improving the Domain Adaptation of RAG Models for Open Domain Question Answering (2022) - https://arxiv.org/pdf/2210.02627
- Surface-Based Retrieval Reduces Perplexity of Retrieval-Augmented Language Models (2023) - https://arxiv.org/pdf/2305.16243
- On the Generalization Ability of Retrieval-Enhanced Transformers (2023) - https://arxiv.org/pdf/2302.12128
- SMART-RAG: Selection using Determinantal Matrices for Augmented Retrieval (2024) - https://arxiv.org/pdf/2409.13992
- LinearRAG: Linear Graph Retrieval Augmented Generation on Large-scale Corpora (2025) - https://arxiv.org/pdf/2510.10114
- Optimizing Retrieval for RAG via Reinforcement Learning (2025) - https://arxiv.org/pdf/2510.24652
- Precise Zero-Shot Dense Retrieval without Relevance Labels / HyDE (Gao et al., 2022) - https://arxiv.org/abs/2212.10496
- Self-RAG: Learning to Retrieve, Generate, and Critique through Self-Reflection (Asai et al., 2023) - https://arxiv.org/abs/2310.11511
- Corrective Retrieval Augmented Generation / CRAG (2024) - https://arxiv.org/abs/2401.15884
- Open-Source Reproduction and Explainability Analysis of CRAG (2026) - https://arxiv.org/abs/2603.16169
- Unified Active Retrieval for Retrieval Augmented Generation (2024) - https://arxiv.org/pdf/2406.12534
- AutoRAG: Automated Framework for Optimization of RAG Pipeline (2024) - https://arxiv.org/pdf/2410.20878
- Question-Based Retrieval using Atomic Units for Enterprise RAG (2024) - https://arxiv.org/pdf/2405.12363
- RAGVA: Engineering Retrieval Augmented Generation-based Virtual Assistants in Practice (2025) - https://arxiv.org/pdf/2502.14930
- A Systematic Investigation of Document Chunking Strategies and Embedding Sensitivity (2026) - https://arxiv.org/html/2603.06976
- Uncertainty-Aware Hybrid Retrieval for Long-Document RAG (2026) - https://arxiv.org/pdf/2606.13550
- Predictive Prefetching for Retrieval-Augmented Generation (2026) - https://arxiv.org/pdf/2605.17989
- Rethinking the Necessity of Adaptive RAG through Adaptive Listwise Ranking (2026) - https://arxiv.org/pdf/2604.15621
- AB-RAG: Adaptive Budgeted Retrieval-Augmented Generation for Reliable QA (2026) - https://arxiv.org/html/2606.29090
- RAGRouter-Bench: A Dataset and Benchmark for Adaptive RAG Routing (2026) - https://arxiv.org/pdf/2602.00296

### 그래프/전역 요약 기반 RAG
- From Local to Global: A Graph RAG Approach to Query-Focused Summarization (Edge et al., 2024) - https://arxiv.org/abs/2404.16130
- Graph Retrieval-Augmented Generation: A Survey (2024) - https://arxiv.org/abs/2408.08921
- Graph-based Approaches and Functionalities in Retrieval-Augmented Generation: A Comprehensive Survey (2025) - https://arxiv.org/pdf/2504.10499
- RAG vs. GraphRAG: A Systematic Evaluation and Key Insights (2025) - https://arxiv.org/pdf/2502.11371
- StructuGraphRAG: Structured Document-Informed Knowledge Graphs for RAG (2024) - https://par.nsf.gov/servlets/purl/10564941
- A Survey on Knowledge-Oriented Retrieval-Augmented Generation (2025) - https://arxiv.org/pdf/2503.10677
- A Pilot Empirical Study on When and How to Use Knowledge Graphs as Retrieval Augmented Generation (2025) - https://arxiv.org/pdf/2502.20854
- RGL: A Graph-Centric, Modular Framework for Efficient RAG on Graphs (2025) - https://arxiv.org/pdf/2503.19314
- DGRAG: Distributed Graph-based Retrieval-Augmented Generation in Edge-Cloud Systems (2025) - https://arxiv.org/pdf/2505.19847

### 구조화 데이터 / 표(Table) RAG
- TableRAG: A Retrieval Augmented Generation Framework for Heterogeneous Document Reasoning (2025) - https://arxiv.org/html/2506.10380v1
- TableRAG: Million-Token Table Understanding with Language Models (2024) - https://arxiv.org/pdf/2410.04739
- TabRAG: Improving Tabular Document QA for RAG via Structured Representations (2025) - https://arxiv.org/abs/2511.06582
- DocTabQA: Answering Questions from Long Documents Using Tables (2024) - https://arxiv.org/pdf/2408.11490
- Towards Complex Table Question Answering Over Tabular Data Lakes (2025) - https://link.springer.com/article/10.1007/s13222-025-00513-9
- Evaluation of Table Representations to Answer Questions from Tables in Documents (2024) - https://arxiv.org/pdf/2408.17008
- Structured RAG for Answering Aggregative Questions / S-RAG (Koshorek et al., 2025) - https://arxiv.org/abs/2511.08505
- TACT: Advancing Complex Aggregative Reasoning with Information Extraction Tools (2024) - https://arxiv.org/pdf/2406.03618
- A Hybrid RAG System with Comprehensive Enhancement on Complex Reasoning (2024) - https://arxiv.org/abs/2408.05141
- mmRAG: A Modular Benchmark for RAG over Text, Tables, and Knowledge Graphs (2025) - https://arxiv.org/pdf/2505.11180
- TableGPT: A Novel Table Understanding Method (2024) - https://link.springer.com/article/10.1007/s10489-024-05937-6
- TableLlama: Towards Open Large Generalist Models for Tables (2024) - https://osu-nlp-group.github.io/TableLlama/
- TableLoRA: Low-rank Adaptation on Table Structure Understanding for LLMs (2025) - https://arxiv.org/pdf/2503.04396
- Tree-of-Table: Unleashing the Power of LLMs for Enhanced Large-Scale Table Understanding (2024) - https://arxiv.org/pdf/2411.08516
- Large Language Models are Complex Table Parsers (2023) - https://arxiv.org/pdf/2312.11521
- Table Header Recognition Based on Large Language Models (2025) - https://www.vldb.org/2025/Workshops/VLDB-Workshops-2025/TaDA/TaDA25_14.pdf
- Large Language Models on Tabular Data -- A Survey (2024, GitHub 저장소) - https://github.com/tanfiona/LLM-on-Tabular-Data-Prediction-Table-Understanding-Data-Generation

### 표+텍스트 하이브리드 QA 데이터셋
- HybridQA: A Dataset of Multi-Hop Question Answering over Tabular and Textual Data (Chen et al., 2020) - https://arxiv.org/abs/2004.07347
- TAT-QA: A QA Benchmark on a Hybrid of Tabular and Textual Content in Finance (Zhu et al., 2021) - https://arxiv.org/abs/2105.07624
- FinQA: A Dataset of Numerical Reasoning over Financial Data (Chen et al., 2021) - https://arxiv.org/abs/2109.00122
- NAPG: Non-Autoregressive Program Generation for Hybrid Tabular-Textual QA (2022) - https://arxiv.org/pdf/2211.03462
- TACR: A Table-alignment-based Cell-selection and Reasoning Model for Hybrid QA (2023) - https://arxiv.org/pdf/2305.14682
- HRoT: Hybrid Prompt Strategy and Retrieval of Thought for Table-Text Hybrid QA (2023) - https://arxiv.org/pdf/2309.12669
- DyRRen: A Dynamic Retriever-Reranker-Generator Model for Numerical Reasoning over Tabular and Textual Data (2022) - https://arxiv.org/pdf/2211.12668
- FinanceReasoning: Benchmarking Financial Numerical Reasoning (2025) - https://arxiv.org/pdf/2506.05828

### Text-to-SQL / 자연어-구조화 질의
- Next-Generation Database Interfaces: A Survey of LLM-based Text-to-SQL (2024) - https://arxiv.org/pdf/2406.08426
- A Survey on Employing Large Language Models for Text-to-SQL Tasks (2024) - https://arxiv.org/pdf/2407.15186
- Text-to-SQL Empowered by Large Language Models: A Benchmark Evaluation (2023) - https://arxiv.org/pdf/2308.15363
- E-SQL: Direct Schema Linking via Question Enrichment in Text-to-SQL (2024) - https://arxiv.org/pdf/2409.16751
- CodeS: Towards Building Open-source Language Models for Text-to-SQL (2024) - https://arxiv.org/pdf/2402.16347
- Reboost LLM-based Text-to-SQL, Text-to-Python, and Text-to-Function (2023) - https://arxiv.org/pdf/2310.18752

### 데이터-to-텍스트 생성 (Data-to-Text)
- Innovations in Neural Data-to-text Generation: A Survey (2022) - https://arxiv.org/abs/2207.12571
- A Survey on Neural Data-to-Text Generation (2022) - https://openreview.net/pdf/95a9cde4b2ba8b9088c2f65824b6f3899a4bce7d.pdf
- Neural Methods for Data-to-text Generation (2024) - https://dl.acm.org/doi/full/10.1145/3660639
- ToTTo: A Controlled Table-To-Text Generation Dataset (Parikh et al., 2020) - https://arxiv.org/abs/2004.14373
- Chart-to-Text: Generating Natural Language Descriptions for Charts (2020) - https://arxiv.org/pdf/2010.09142
- MURMUR: Modular Multi-Step Reasoning for Semi-Structured Data-to-Text Generation (2022) - https://arxiv.org/pdf/2212.08607
- Neural Data-to-Text Generation: Pipeline vs End-to-End Architectures (2019) - https://arxiv.org/pdf/1908.09022
- Neural Data-to-Text Generation via Jointly Learning the Segmentation and Correspondence (2020) - https://arxiv.org/pdf/2005.01096
- End-to-End Content and Plan Selection for Data-to-Text Generation (2018) - https://arxiv.org/pdf/1810.04700
- Improving Factual Accuracy of Neural Table-to-Text Output in ToTTo (2024) - https://arxiv.org/pdf/2404.04103
- Table-to-Text Generation with Pretrained Diffusion Models (2024) - https://arxiv.org/pdf/2409.13739
- Towards More Effective Table-to-Text Generation: In-Context Learning and Self-Evaluation (2024) - https://arxiv.org/pdf/2410.12878

### 시계열 + LLM
- Time-LLM: Time Series Forecasting by Reprogramming Large Language Models (Jin et al., 2024) - https://arxiv.org/abs/2310.01728
- Large Language Models Are Zero-Shot Time Series Forecasters / LLMTime (Gruver et al., 2023) - https://arxiv.org/abs/2310.07820
- Large Language Models for Time Series: A Survey (2024) - https://dl.acm.org/doi/10.24963/ijcai.2024/921
- Empowering Time Series Analysis with Large Language Models: A Survey (2024) - https://www.ijcai.org/proceedings/2024/0895.pdf
- Semantic-Enhanced Time-Series Forecasting via Large Language Models (2025) - https://arxiv.org/pdf/2508.07697
- Rethinking the Role of LLMs in Time Series Forecasting (2026) - https://arxiv.org/pdf/2602.14744
- Time Series Forecasting with LLMs: Understanding and Enhancing Model Capabilities (2025) - https://dl.acm.org/doi/10.1145/3715073.3715083
- TsLLM: Augmenting LLMs for General Time Series Understanding and Prediction (2025) - https://arxiv.org/html/2510.01111v2
- From Time Series Analysis to Question Answering: A Survey in the LLM Era (2025) - https://arxiv.org/html/2506.11512v2
- MMTS-BENCH: A Comprehensive Benchmark for Time Series Understanding and Reasoning (2026) - https://arxiv.org/html/2602.08588
- MTBench: A Multimodal Time Series Benchmark for Temporal Reasoning and QA (2025) - https://arxiv.org/abs/2503.16858
- TS-Agent: Understanding and Reasoning Over Raw Time Series via Iterative Insight Gathering (2025) - https://arxiv.org/pdf/2510.07432
- TimeSeriesExamAgent: Creating Time Series Reasoning Benchmarks at Scale (2026) - https://arxiv.org/html/2604.10291v1
- Can LLM Coding Agents Reason About Time Series? (2026) - https://arxiv.org/pdf/2606.16545

### Long-Context vs RAG 논쟁
- Long Context vs. RAG for LLMs: An Evaluation and Revisits (2024/2025) - https://arxiv.org/abs/2501.01880
- A Comprehensive Survey on Long Context Language Modeling (2025) - https://arxiv.org/pdf/2503.17407
- Lost in the Middle: How Language Models Use Long Contexts (Liu et al., 2023) - https://arxiv.org/abs/2307.03172
- Gemini 1.5: Unlocking Multimodal Understanding Across Millions of Tokens of Context (2024) - https://arxiv.org/pdf/2403.05530
- Needle Threading: Can LLMs Follow Threads through Near-Million-Scale Haystacks? (2024) - https://arxiv.org/pdf/2411.05000
- Evaluating Language Model Context Windows: A "Working Memory" Test and Inference-time Correction (2024) - https://arxiv.org/pdf/2407.03651

### 프롬프트 압축 / 컨텍스트 엔지니어링
- LongLLMLingua: Accelerating and Enhancing LLMs in Long Context Scenarios via Prompt Compression (2023) - https://arxiv.org/pdf/2310.06839
- Compress the Context, Keep the Commitments: A Formal Framework for Verifiable LLM Context Compression (2026) - https://arxiv.org/pdf/2605.17304
- From Similarity to Structure: Training-free LLM Context Compression with Hybrid Graph Priors (2026) - https://arxiv.org/pdf/2604.23277

### 대화 메모리 관리 (긴 대화 기록 처리)
- Keep Me Updated! Memory Management in Long-term Conversations (2022) - https://arxiv.org/pdf/2210.08750
- Recursively Summarizing Enables Long-Term Dialogue Memory in Large Language Models (2023) - https://arxiv.org/abs/2308.15022
- On Memory Construction and Retrieval for Personalized Conversational Agents (2025) - https://arxiv.org/pdf/2502.05589
- SGMem: Sentence Graph Memory for Long-Term Conversational Agents (2025) - https://arxiv.org/pdf/2509.21212
- Beyond Static Summarization: Proactive Memory Extraction for LLM Agents (2026) - https://arxiv.org/pdf/2601.04463

### 개인 데이터 / 헬스·웨어러블 LLM 어시스턴트 (우리 프로젝트와 도메인 유사)
- Transforming Wearable Data into Personal Health Insights using LLM Agents / PHIA (2025) - https://www.nature.com/articles/s41467-025-67922-y
- PhysioLLM: Supporting Personalized Health Insights with Wearables and LLMs (2024, MIT Media Lab) - https://www.media.mit.edu/publications/physiollm-supporting-personalized-health-insights-with-wearables-and-large-language-models/
- Exploring Personalized Health Support through Data-Driven, Theory-Guided LLMs: Sleep Health Case Study (2025) - https://arxiv.org/pdf/2502.13920
- Exploring Self-Tracking Practices of Older Adults with CVD to Inform LLM-Enabled Health Data Sensemaking (2026) - https://arxiv.org/pdf/2603.23733
- GPTCoach: Towards LLM-Based Physical Activity Coaching (2024) - https://arxiv.org/pdf/2405.06061
- A Natural Language Query Interface for Searching Personal Information on Smartwatches (2016) - https://arxiv.org/pdf/1611.07139

### 전자의무기록(EHR) / 임상 시계열 RAG
- EHR-RAG: Bridging Long-Horizon Structured EHR and LLMs via Enhanced RAG (2026) - https://arxiv.org/abs/2601.21340
- EMERGE: Enhancing Multimodal EHR Predictive Modeling with RAG (2024) - https://arxiv.org/abs/2406.00036
- EHR-RAGp: Retrieval-Augmented Prototype-Guided Foundation Model for EHR (2026) - https://arxiv.org/html/2605.12335
- CLI-RAG: A Retrieval-Augmented Framework for Clinically Structured and Context-Aware Text Generation (2025) - https://arxiv.org/pdf/2507.06715
- Applying Generative AI with RAG to Summarize and Extract Key Clinical Information from EHR (2024) - https://www.sciencedirect.com/science/article/pii/S1532046424000807

### 재무/금융 데이터 RAG
- Enhancing Financial Report Question-Answering: A RAG System with Reranking Analysis (2026) - https://arxiv.org/pdf/2603.16877
- Analysis of Large Language Models for Company Annual Reports Based on RAG (2025) - https://www.mdpi.com/2078-2489/16/9/786

### 환각(Hallucination) / 근거 기반 생성(Grounding) 관련
- A Comprehensive Taxonomy of Hallucinations in Large Language Models (2025) - https://arxiv.org/pdf/2508.01781
- Large Language Models Hallucination: A Comprehensive Survey (2025) - https://arxiv.org/pdf/2510.06265
- Mitigating Hallucination in LLMs: An Application-Oriented Survey on RAG, Reasoning, and Agentic Systems (2025) - https://arxiv.org/html/2510.24476v1
- The FACTS Grounding Leaderboard: Benchmarking LLMs' Ability to Ground Responses to Long-Form Input (2025) - https://arxiv.org/html/2501.03200v1
- Trustful LLMs: Customizing and Grounding Text Generation with Knowledge Bases and Dual Decoders (2024) - https://arxiv.org/pdf/2411.07870
