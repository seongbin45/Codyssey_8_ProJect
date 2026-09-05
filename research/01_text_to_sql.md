# Related Work: Text-to-SQL / 자연어 기반 데이터베이스 질의 인터페이스 (NLIDB)

## 1. 개요

"내 데이터를 아는 AI 비서"의 핵심 문제는 결국 "사용자의 자연어 질문에 답하기 위해, LLM이 저장된 구조화 데이터에 어떻게 접근하는가"이다. 이 질문에 대한 가장 오래되고 가장 많이 연구된 학문적 답이 바로 Text-to-SQL, 더 넓게는 자연어 기반 데이터베이스 질의 인터페이스(Natural Language Interface to Databases, NLIDB) 연구다. NLIDB는 1970년대 LUNAR, 1980년대 CHAT-80 같은 규칙 기반 시스템부터 시작해, 2000년대 PRECISE·NaLIR 같은 통계·구문 매칭 기반 시스템, 2017년 이후 Seq2SQL·SQLNet 등 신경망 기반 시퀀스 생성 모델, 2019~2020년 RAT-SQL·IRNet 등 스키마를 그래프/관계로 인코딩하는 사전학습-미세조정(pretrain-finetune) 모델, 그리고 2022~2023년 이후 GPT 계열 LLM을 프롬프트만으로 활용하는 in-context learning(ICL) 방식까지, 자연어 질의를 "실행 가능한 구조화 쿼리"로 변환하는 문제를 반세기 가까이 다뤄왔다.

우리 프로젝트는 이 스펙트럼에서 극단적으로 단순한 지점에 있다. Text-to-SQL 계열 연구는 자연어 질문 → (스키마 정보 주입) → SQL 쿼리 생성 → DB 실행 → 결과 반환이라는 파이프라인을 거치며, 이 과정에서 스키마 링킹(schema linking), 실행 결과 피드백, 검색 기반 스키마 축소 등 정교한 중간 단계를 둔다. 반면 우리 시스템은 SQL을 전혀 생성하지 않는다. 백엔드가 Firestore 데이터를 이미 집계해 만든 요약 JSON(총합/평균/최대/최소/추세)을 파이썬 f-string으로 텍스트화해 시스템 프롬프트에 통째로 밀어 넣고, LLM은 그 텍스트를 "읽고 설명"만 한다. 즉 LLM에게 데이터에 대한 어떤 실행 권한도, 검색 권한도 주지 않고, 사람이 미리 계산한 결과만 컨텍스트로 제공하는 방식이다.

그럼에도 이 카테고리를 조사하는 의미는 크다. Text-to-SQL 연구가 지난 5~6년간 씨름해온 핵심 난제 — "스키마(=우리 경우엔 사용자의 원본 데이터 구조)를 LLM 컨텍스트에 어떻게 넣을 것인가", "얼마나 많은 정보를 검색해서 넣을 것인가", "생성된 결과를 어떻게 검증·피드백할 것인가" — 는 정확히 우리 프로젝트가 다음 단계로 나아갈 때 부딪힐 문제들이다. 우리의 "사전 계산된 요약 텍스트 주입" 방식은 사실상 Text-to-SQL 파이프라인에서 "SQL 생성과 실행" 단계를 통째로 생략하고 그 결과만 하드코딩한 것과 같아서, 이 분야의 기법들이 정확히 무엇을 대신 해주고 있었는지를 비교 기준으로 삼을 수 있다.

## 2. 조사 규모/트렌드

WebSearch로 "text-to-SQL survey", "NLIDB", "Spider/BIRD benchmark", "in-context learning SQL generation", "schema linking", "execution-guided decoding", "multi-agent text-to-SQL", "retrieval-augmented schema linking" 등 다양한 질의를 수행하고, 특히 GitHub의 대규모 큐레이션 목록인 `DEEP-PolyU/Awesome-LLM-based-Text2SQL`(TKDE 2025 서베이의 부속 저장소)을 활용해 논문 제목·연도·링크를 확보했다. 이를 통해 최종적으로 **약 130편**의 논문/벤치마크/서베이 제목을 목록화했다(아래 참고문헌 절 참고). 실제 논문 모집단은 이보다 훨씬 크며(연간 수백 편 규모), 여기서는 대표성이 있다고 판단되는 항목들을 우선 수집했다.

**연도별 흐름**은 뚜렷하다.
- **~2016년 이전 (규칙/통계 시대)**: LUNAR(1970s), CHAT-80(1980), PRECISE(2003), NaLIR(2014, SIGMOD) 등 자연어 파싱 규칙과 스키마 매칭 알고리즘에 의존하는 시스템이 주류였다.
- **2017~2020년 (신경망 seq2seq 시대)**: Seq2SQL(2017), SQLNet(2017), TypeSQL(2018) 등 WikiSQL 기반의 단일 테이블 질의 생성 모델이 등장했고, 2018년 Spider 데이터셋(EMNLP)이 발표되며 "복잡한 다중 테이블 조인 + 미지의 스키마 일반화"라는 훨씬 어려운 문제로 연구가 이동했다. RAT-SQL(2019/2020, ACL)로 대표되는 스키마 인코딩·링킹 전용 아키텍처가 이 시기의 정점이다.
- **2021~2022년 (강건성/일반화 연구)**: Spider-SYN, Spider-DK, Spider-Realistic, Dr.Spider 등 "같은 의미를 다르게 표현했을 때도 모델이 견디는가"를 검증하는 진단 벤치마크들이 쏟아졌다. 이는 모델이 스키마 이름과 자연어 표현 사이의 표면적 패턴에 과적합되어 있었다는 방증이다.
- **2023년 (LLM 전환점)**: GPT-3.5/GPT-4 등장 이후 fine-tuning 없이 프롬프트만으로 SQL을 생성하는 연구가 폭발적으로 늘었다. DIN-SQL, DAIL-SQL, C3(zero-shot ChatGPT) 등이 이 해에 집중적으로 나왔고, 동시에 BIRD 벤치마크(NeurIPS 2023)가 "지저분한 실제 DB 값 + 외부지식 + 실행 효율성"이라는 더 현실적인 도전 과제를 제시했다.
- **2024~2026년 (에이전트화·검색·자기수정 시대)**: 스키마가 수백~수천 컬럼에 달하는 실제 기업 DB를 다루기 위해 검색(retrieval) 기반으로 관련 테이블만 골라 넣는 기법(CHESS, RASL, SchemaRAG), 여러 LLM 에이전트가 스키마 링킹/생성/검증 역할을 나눠 맡는 멀티에이전트 프레임워크(MAC-SQL, AGENTIQL), 실행 결과를 강화학습·선호 최적화 신호로 되먹임하는 기법(SQL-R1, ExCoT, CSC-SQL)이 주류가 되었다. 2024~2025년 Spider 2.0은 아예 "단일 프롬프트 한 방"이 아니라 문서 검색·코드 실행·다중 턴 상호작용이 필요한 엔터프라이즈 워크플로우로 문제 정의 자체를 바꿔버렸다.

**주요 발표처**는 자연어처리 학회(ACL, EMNLP, NAACL, Findings, COLING)와 데이터베이스 학회(VLDB, SIGMOD, ICDE)가 양분하고 있으며, 최근에는 ML 학회(NeurIPS, ICLR, ICML)에도 벤치마크·에이전트 논문이 다수 발표된다. 저널로는 VLDBJ, TKDE, ACM Computing Surveys(CSUR)에 서베이가 다수 게재되었다.

## 3. 대표 논문 심층 비교

### 3.1 Spider — Yu et al., "Spider: A Large-Scale Human-Labeled Dataset for Complex and Cross-Domain Semantic Parsing and Text-to-SQL Task" (2018, EMNLP)
- 링크: https://arxiv.org/abs/1809.08887
- 핵심 아이디어: 10,181개 자연어 질문과 5,693개의 SQL 쿼리를 200개의 여러 도메인(138개) 다중 테이블 DB에 대해 사람이 직접 라벨링한 데이터셋. 훈련/테스트에 서로 다른 DB와 SQL 패턴을 배치해 "본 적 없는 스키마에 대한 일반화"를 강제한 최초의 대규모 벤치마크.
- 데이터-컨텍스트 주입 방식: 벤치마크 자체는 방법론이 아니라 평가 기준이지만, 이후 등장한 거의 모든 방법이 이 데이터셋 위에서 "스키마(테이블명·컬럼명·타입·외래키 관계)를 어떤 형태로 모델에 넣을 것인가"를 최우선 설계 문제로 삼게 만들었다. 즉 이 논문 이후 Text-to-SQL은 "질문만 보고 답하는 문제"가 아니라 "질문+스키마를 함께 인코딩하는 문제"로 정의가 바뀌었다.
- 우리 프로젝트와의 비교: 우리는 "스키마"에 해당하는 것이 애초에 사용자에게 노출되지 않는다(고정된 date/value/memo 구조 하나뿐). Spider가 해결하려는 "미지의 다중 테이블 스키마 일반화" 문제 자체가 우리 시스템에는 존재하지 않는다 — 이는 우리 시스템이 단순한 이유이자 동시에 확장성이 없는 이유이기도 하다(테이블이 늘어나는 순간 이 문제에 그대로 부딪힌다).

### 3.2 RAT-SQL — Wang, Shin, Liu, Polozov, Richardson, "RAT-SQL: Relation-Aware Schema Encoding and Linking for Text-to-SQL Parsers" (2019/2020, ACL)
- 링크: https://arxiv.org/abs/1911.04942
- 핵심 아이디어: 질문 토큰과 스키마 요소(테이블·컬럼) 사이의 관계를 관계 인식 셀프어텐션(relation-aware self-attention)으로 통합 인코딩해, Spider에서 정확일치(exact match) 정확도를 57.2%(BERT 결합 시 65.6%)까지 끌어올린 사전-LLM 시대의 대표작.
- 데이터를 컨텍스트에 넣는 방식: 스키마를 텍스트로 나열해 프롬프트에 넣는 방식이 아니라, 스키마 자체를 그래프(테이블-컬럼-외래키 관계)로 표현하고 이를 신경망 인코더 안에서 질문과 함께 공동 학습(fine-tuning)한다. 즉 "컨텍스트 주입"이 아니라 "구조를 모델 파라미터 안에 녹여 넣는" 방식이며, 프롬프트 엔지니어링이 개입할 여지가 없는 완전한 지도학습·미세조정 패러다임이다.
- 우리 프로젝트와의 비교: 우리는 정반대 극단에 있다. 우리는 어떤 파라미터도 학습하지 않고, 모든 "구조 이해"를 사람이 파이썬 코드로 미리 계산해 문자열로 박아 넣는다. RAT-SQL은 "모델이 구조를 이해하게 만드는" 데 논문 전체를 쓰는 반면, 우리는 애초에 모델이 구조를 이해할 필요가 없도록 구조를 없애버렸다(이미 요약된 숫자만 준다). 이는 일반화력은 전혀 없지만 구현 비용은 0에 가깝다는 트레이드오프를 보여준다.

### 3.3 BIRD — Li et al., "Can LLM Already Serve as A Database Interface? A BIg Bench for Large-Scale Database Grounded Text-to-SQLs" (2023, NeurIPS)
- 링크: https://arxiv.org/abs/2305.03111
- 핵심 아이디어: 12,751개 질문-SQL 쌍, 95개 DB(33.4GB, 37개 도메인)로 구성된 벤치마크로, Spider와 달리 "지저분한 실제 값", "질문과 DB 값 사이의 외부지식(external knowledge) 필요성", "쿼리 실행 효율성"까지 평가 대상에 포함시켰다. GPT-4조차 실행정확도 54.89%로 인간(92.96%)에 크게 못 미침을 보였다.
- 데이터를 컨텍스트에 넣는 방식: 스키마 텍스트 나열에 더해, 질문마다 사람이 작성한 "evidence"(외부지식 힌트, 예: "활성 사용자란 최근 30일 내 로그인한 사용자를 의미")를 프롬프트에 함께 주입한다. 즉 순수 스키마+질문만으로는 부족하다는 것을 실증적으로 보여주고, "도메인 지식을 텍스트로 명시적으로 주입"하는 것이 성능에 결정적임을 확인했다.
- 우리 프로젝트와의 비교: 이 지점이 가장 직접적으로 맞닿는 부분이다. 우리 시스템의 "요약 텍스트 주입"은 사실 BIRD가 강조한 "evidence 주입"과 정신적으로 유사하다 — 둘 다 "모델이 스스로 계산/추론하게 두지 않고, 사람(또는 코드)이 미리 만든 판단/집계를 텍스트로 떠먹여준다"는 점에서다. 차이는 BIRD의 evidence는 질문에 답하기 위한 "힌트"인 반면, 우리 요약은 아예 "답의 재료 전체"라는 점 — 즉 우리는 이 스펙트럼에서 한 걸음 더 나아가 SQL 생성/실행 자체를 생략했다.

### 3.4 DIN-SQL — Pourreza & Rafiei, "DIN-SQL: Decomposed In-Context Learning of Text-to-SQL with Self-Correction" (2023, NeurIPS)
- 링크: https://arxiv.org/abs/2304.11015
- 핵심 아이디어: Text-to-SQL을 (1) 스키마 링킹, (2) 쿼리 난이도 분류 및 하위문제 분해, (3) SQL 생성, (4) 자기 수정(self-correction)의 4개 모듈로 쪼개고, 각 모듈마다 별도의 few-shot 프롬프트를 설계해 GPT-4에 순차적으로 호출한다. Spider 실행정확도를 85.3%까지 끌어올려 당시 SOTA를 경신했다.
- 데이터를 컨텍스트에 넣는 방식: (a) 스키마는 CREATE TABLE 형태의 텍스트로 프롬프트에 나열되고, (b) 각 모듈은 few-shot 예시(질문-SQL 쌍)를 함께 제공받는 순수 in-context learning이며, (c) 파인튜닝은 전혀 하지 않는다. (d) "자기 수정" 단계는 생성된 SQL을 다시 LLM에게 보여주며 문법·논리 오류를 스스로 고치도록 요청하는 것으로, 실제 DB 실행 결과를 되먹이는 것이 아니라 LLM 자체의 재검토에 의존한다는 점이 중요한 한계다.
- 우리 프로젝트와의 비교: DIN-SQL은 "하나의 거대한 프롬프트"가 아니라 "역할별로 쪼갠 여러 번의 LLM 호출"을 쓴다. 우리는 반대로 요약 계산(=스키마 링킹+생성+실행에 해당하는 모든 작업)을 LLM 호출 이전에 파이썬 코드로 100% 끝내고, LLM은 단 한 번, 결과를 설명하는 역할만 한다. DIN-SQL의 self-correction과 유사한 "결과 검증" 단계가 우리 시스템에는 아예 없다 — 요약 계산 로직 자체가 틀리면 그대로 LLM 답변에 반영된다는 취약점이 있다.

### 3.5 DAIL-SQL — Gao et al., "Text-to-SQL Empowered by Large Language Models: A Benchmark Evaluation" (2023, VLDB 2024)
- 링크: https://arxiv.org/abs/2308.15363
- 핵심 아이디어: 프롬프트 구성 요소(질문 표현 방식, few-shot 예시 선택 전략, 예시 배치 순서)를 체계적으로 비교해 최적 조합(DAIL-SQL)을 찾고, Spider에서 86.6% 실행정확도를 달성. 오픈소스 LLM에 대한 지도 미세조정(SFT) 효과도 함께 검증한 최초의 대규모 벤치마크형 연구.
- 데이터를 컨텍스트에 넣는 방식: 스키마는 여러 텍스트 표현(자연어 설명 vs. CREATE TABLE DDL vs. 코드 스타일 주석) 중 어떤 것이 가장 효율적인지를 직접 비교하고, few-shot 예시는 무작위가 아니라 질문 임베딩 유사도 기반으로 "가장 비슷한 과거 질문-SQL 쌍"을 동적으로 검색해 넣는 DAIL-Selection 기법을 제안한다. 토큰 효율성(비용)까지 정량적으로 비교한 것이 특징.
- 우리 프로젝트와의 비교: DAIL-SQL의 핵심 통찰 — "프롬프트에 무엇을, 어떤 형식으로, 얼마나 넣느냐가 정확도와 비용을 동시에 좌우한다" — 는 우리 시스템에도 그대로 적용된다. 우리는 f-string으로 요약을 통째로 밀어넣지만, DAIL-SQL 식으로 보면 이는 "one-shot, 고정 포맷, 예시 선택 없음"에 해당하는 가장 초보적인 프롬프트 전략이다. few-shot 예시나 동적 선택이 전혀 없다는 점에서 개선 여지가 크다.

### 3.6 CHESS — Talaei, Pourreza, Chang, Mirhoseini, Saberi, "CHESS: Contextual Harnessing for Efficient SQL Synthesis" (2024)
- 링크: https://arxiv.org/abs/2405.16755
- 핵심 아이디어: 대규모 실제 DB(수백~수천 컬럼)에서 전체 스키마를 프롬프트에 다 넣는 것이 불가능하다는 문제의식에서 출발, Information Retriever(관련 값/컬럼 검색) → Schema Selector(불필요한 스키마 가지치기, 토큰 사용량 약 5배 절감) → Candidate Generator(SQL 후보 생성) → Unit Tester(자연어 단위테스트로 후보 검증)의 4개 에이전트 파이프라인을 구성.
- 데이터를 컨텍스트에 넣는 방식: 전체 스키마를 텍스트로 나열하는 대신, 질문과 관련된 테이블/컬럼/값만 임베딩 유사도 등으로 검색(retrieval)해 필요한 부분만 프롬프트에 삽입한다 — 우리가 조사한 범주 중 "retrieval로 관련 테이블만 골라서 주입"에 정확히 해당하는 사례. 검증은 실제 DB 실행이 아니라 LLM이 생성한 자연어 단위테스트에 의존한다.
- 우리 프로젝트와의 비교: CHESS의 문제의식 — "모든 데이터를 다 넣을 수 없으니 관련된 것만 선별해서 넣는다" — 은 우리 프로젝트가 데이터 규모가 커질 경우 반드시 마주칠 문제다. 현재 우리는 이미 요약(집계)이라는 형태로 "선별"을 하고 있지만, 이는 검색이 아니라 고정된 통계 함수(합/평균/최대/최소/추세)에 불과해, 사용자가 "3월 15일에 무슨 일이 있었어?"처럼 구체적 레코드를 묻는 순간 대응할 수 없다. CHESS류의 검색 기반 스키마/레코드 선별은 우리 시스템이 "요약을 넘어선 질의"를 지원하려 할 때 참고할 다음 단계다.

### 3.7 Spider 2.0 — Lei, Chen, et al., "Spider 2.0: Evaluating Language Models on Real-World Enterprise Text-to-SQL Workflows" (2024, ICLR 2025 Oral)
- 링크: https://arxiv.org/abs/2411.07763
- 핵심 아이디어: 기존 벤치마크가 "단일 SQL 한 방으로 답 나오는" 문제에 국한된 것을 비판하며, BigQuery/Snowflake/DuckDB/PostgreSQL 등 실제 기업 DB 환경에서 메타데이터 문서 검색, 여러 SQL 방언 처리, 100줄이 넘는 다중 쿼리 워크플로우까지 요구하는 632개 과제를 제시. 최고 성능 모델(o1-preview)도 성공률 21.3%에 그쳐 Spider 1.0(91.2%)과 극명한 대비를 이룸.
- 데이터를 컨텍스트에 넣는 방식: 스키마를 프롬프트에 텍스트로 나열하는 것 자체가 불가능한 규모(컬럼 700~3,000개)이므로, 에이전트가 스스로 메타데이터를 검색하고, 코드를 실행하고, 여러 턴에 걸쳐 정보를 수집하며 SQL을 반복 수정하는 "에이전틱(agentic) 워크플로우"를 전제로 한다. 즉 컨텍스트 주입 자체를 모델의 행동(도구 호출)으로 위임한다.
- 우리 프로젝트와의 비교: Spider 2.0은 우리 시스템과 정반대 극단을 보여주는 좋은 대조군이다. 우리는 "정적 컨텍스트 한 번 주입 + 단일 호출"인 반면, Spider 2.0이 요구하는 것은 "동적 다중 턴 탐색 + 도구 실행"이다. 우리 프로젝트 규모(단일 사용자의 시계열 데이터 하나)에서는 Spider 2.0 수준의 복잡도가 전혀 필요 없지만, 이는 우리 접근법이 "복잡도가 낮은 특수 사례에서만 정당화되는 단순화"임을 명확히 보여준다.

### 3.8 LEVER — Ni, Yin, et al., "LEVER: Learning to Verify Language-to-Code Generation with Execution" (2023, ICML)
- 링크: https://arxiv.org/abs/2302.08468
- 핵심 아이디어: LLM이 생성한 프로그램(SQL 포함)을 실제로 실행한 뒤, 그 실행 결과(반환 타입, 값의 범위, 에러 여부 등)를 별도로 학습된 검증기(verifier)에 입력해 "이 프로그램이 맞을 확률"을 재점수화하고, 이를 LLM의 생성 확률과 결합해 최종 후보를 재순위화(rerank)한다. 테이블 QA, 수학 QA, 파이썬 코드 등 4개 도메인에서 4.6~10.9%p 개선.
- 데이터를 컨텍스트에 넣는 방식: 스키마나 few-shot 예시를 프롬프트에 넣는 통상적 방식에 더해, "실행 결과"라는 완전히 새로운 종류의 정보를 파이프라인에 추가한다 — 우리가 조사 대상으로 삼은 "실행 결과를 피드백 루프로 다시 넣는가"에 정확히 해당하는 사례. LLM이 생성한 답이 맞는지 여부를 사후적으로, 실행이라는 객관적 신호로 검증한다는 점이 핵심.
- 우리 프로젝트와의 비교: 우리 시스템에는 이런 사후 검증이 전무하다. `GET /api/data/summary`가 계산한 통계치가 맞는지, LLM이 그 통계치를 프롬프트에서 잘못 읽고 엉뚱한 숫자를 답했는지 확인할 방법이 없다(예: LLM이 "평균이 50"이라는 텍스트를 보고도 "평균은 45입니다"라고 잘못 말해도 이를 잡아낼 장치가 없음). LEVER류의 "생성물(여기서는 LLM의 답변 텍스트)을 실행/검증 가능한 형태로 재확인하는 단계"가 우리 시스템에 가장 손쉽게 추가할 수 있는 안전장치 중 하나다.

## 4. 한계/실패 유형

Text-to-SQL/NLIDB 연구에서 반복적으로 지적되는 실패 유형은 다음과 같다.

- **스키마 링킹 오류(schema linking errors)**: 자연어 질문의 단어(예: "학생")를 실제 테이블/컬럼명(예: `student_info.name`)에 정확히 매칭하지 못하는 문제. 최근 오류 분석 연구들은 LLM 기반 Text-to-SQL 실패의 60% 이상이 스키마 링킹 단계, 특히 "관련 컬럼을 아예 식별하지 못하는" 실패에서 기인한다고 보고한다.
- **복잡한 조인/중첩 쿼리 실패**: Spider의 난이도 분류(Easy/Medium/Hard/Extra Hard)가 보여주듯, 다중 테이블 조인, 중첩 서브쿼리, GROUP BY+HAVING 조합 등 구조가 복잡해질수록 정확도가 급격히 떨어진다. BIRD, Spider 2.0 등 후속 벤치마크는 이 격차를 더 극명하게 드러낸다(GPT-4가 BIRD에서 54.89%, Spider 2.0에서 최고 모델도 20%대에 그침).
- **강건성 부족(과적합된 표면 패턴)**: Spider-SYN(동의어 치환), Spider-DK(도메인 지식 요구), Dr.Spider(다각도 교란) 등은 모델이 실제로 스키마 구조를 "이해"하기보다 훈련 데이터의 표면적 어휘 패턴에 의존했음을 보여준다. 질문의 단어만 살짝 바꿔도 정확도가 크게 떨어진다.
- **환각(hallucination)**: 존재하지 않는 컬럼/테이블을 참조하거나, DB에 없는 값을 조건절에 사용하는 등 LLM이 그럴듯하지만 실행 불가능하거나 의미상 틀린 SQL을 생성하는 문제. 정답(gold SQL)이 없는 실제 운영 환경에서는 이런 오류를 검증하기가 특히 어렵다(최근 메타모픽 테스팅 기반 환각 탐지 연구들이 이 문제를 다룸).
- **실행 결과 신뢰의 한계**: 실행 결과가 있다고 해서(즉 SQL이 문법적으로 돌아간다고 해서) 그것이 사용자의 "의도"와 일치한다는 보장은 없다 — 문법적으로는 유효하지만 논리적으로 틀린 쿼리(잘못된 집계 함수, 잘못된 필터 조건)가 실행 결과 기반 검증만으로는 걸러지지 않는다는 점이 여러 논문에서 지적된다.

## 5. 종합 시사점

이 조사를 바탕으로 볼 때, 우리 프로젝트("사전 계산된 요약 텍스트를 시스템 프롬프트에 통째로 삽입")는 Text-to-SQL/NLIDB 스펙트럼에서 다음과 같이 위치한다.

- **스펙트럼 상의 위치**: 스키마 인코딩(RAT-SQL), 프롬프트 내 스키마 텍스트 나열+few-shot ICL(DIN-SQL, DAIL-SQL), 검색 기반 스키마/레코드 선별(CHESS, RASL), 실행 피드백 기반 자기수정(LEVER, DIN-SQL의 self-correction), 에이전틱 다중 턴 탐색(Spider 2.0)이라는 축 위에서, 우리는 이 모든 단계 이전, 즉 "SQL 생성이라는 문제 자체를 두지 않고 정적 집계 결과만 텍스트로 제공"하는 가장 좌측 극단에 있다. BIRD의 "evidence 주입"과 정신은 비슷하지만, BIRD의 evidence는 SQL 생성을 돕는 힌트인 반면 우리 요약은 SQL 없이 답의 전부를 대신한다는 점에서 한 단계 더 단순화되어 있다.
- **개선 방향 1 — 검증/피드백 루프 추가**: LEVER, DIN-SQL의 self-correction처럼, LLM이 생성한 답변의 숫자가 실제 요약 JSON의 값과 일치하는지 사후적으로 대조하는 검증 단계를 추가할 수 있다. 지금은 프롬프트에 넣은 숫자를 LLM이 잘못 인용해도 걸러낼 장치가 없다.
- **개선 방향 2 — 검색 기반 컨텍스트 축소/확장**: 데이터 양이 늘어나면 "전체 요약"만으로는 부족해진다. CHESS/RASL류의 검색 기법을 참고해, 사용자의 질문에 따라 필요한 기간/항목만 동적으로 계산해 넣거나, 반대로 원본 레코드 중 관련된 몇 건을 추가로 검색해 프롬프트에 넣는 하이브리드(요약+검색) 방식으로 확장할 수 있다.
- **개선 방향 3 — 질의 구조를 부분적으로 되살리기**: 현재는 `summary` 엔드포인트가 미리 정해둔 통계(합/평균/최대/최소/추세)만 계산하므로, "특정 날짜의 메모가 뭐였어?" 같은 질문에는 답할 수 없다. DIN-SQL의 "분해" 아이디어를 단순화해, LLM이 질문을 보고 "요약이 아니라 특정 레코드 조회가 필요하다"고 판단하면 별도의 좁은 범위 쿼리(예: 날짜 필터)를 코드가 수행해 그 결과만 추가로 주입하는 절충안을 고려할 수 있다.
- **개선 방향 4 — 프롬프트 포맷 자체의 최적화**: DAIL-SQL이 보여주듯 스키마(우리 경우 요약 데이터)를 어떤 텍스트 형식으로 표현하느냐도 성능에 영향을 준다. 현재의 f-string 방식이 임의로 짜여 있다면, few-shot 예시를 곁들이거나 구조화된 포맷(JSON을 그대로 넣기 vs. 자연어 문장으로 풀어쓰기)을 비교해보는 것도 저비용 개선책이다.

결론적으로, 우리 시스템은 Text-to-SQL 연구가 지난 수년간 해결하려 애써온 "스키마 이해·검색·검증" 문제들을 애초에 회피함으로써 극단적인 단순성과 낮은 구현/운영 비용을 얻었지만, 그 대가로 일반화력(새로운 종류의 질문에 대응하지 못함)과 신뢰성(검증 장치 부재)을 포기하고 있다. 이는 "나쁜 설계"라기보다, 데이터 스키마가 단일하고 고정적인 우리 프로젝트의 규모에서는 합리적인 트레이드오프이지만, 확장 시 이 분야의 검증된 기법(특히 검색 기반 컨텍스트 관리와 실행/사후 검증)을 참고할 여지가 크다는 것이 핵심 시사점이다.

## 6. 참고문헌

아래는 조사 과정에서 수집한 Text-to-SQL / NLIDB 관련 논문·벤치마크·서베이 목록이다 (제목 (연도) - 링크 형식).

### 서베이/리뷰
1. Next-Generation Database Interfaces: A Survey of LLM-based Text-to-SQL (2024) - https://arxiv.org/abs/2406.08426
2. A Survey on Employing Large Language Models for Text-to-SQL Tasks (2024) - https://arxiv.org/abs/2407.15186
3. Large Language Model Enhanced Text-to-SQL Generation: A Survey (2024) - https://arxiv.org/abs/2410.06011
4. A Survey of Text-to-SQL in the Era of LLMs: Where are we, and where are we going? (2024) - https://arxiv.org/abs/2408.05109
5. A Survey on Text-to-SQL Parsing: Concepts, Methods, and Future Directions (2022) - https://arxiv.org/abs/2208.13629
6. Recent Advances in Text-to-SQL: A Survey of What We Have and What We Expect (2022) - https://arxiv.org/pdf/2208.10099
7. A Survey on Deep Learning Approaches for Text-to-SQL (2023, VLDBJ) - https://link.springer.com/article/10.1007/s00778-022-00776-8
8. Natural Language Interfaces for Databases with Deep Learning (2023, VLDB) - https://www.vldb.org/pvldb/vol16/p3878-katsogiannis-meimarakis.pdf
9. Natural Language Interfaces for Tabular Data Querying and Visualization: A Survey (2024, TKDE) - https://ieeexplore.ieee.org/document/11112886
10. NLI4DB: A Systematic Review of Natural Language Interfaces for Databases (2025) - https://arxiv.org/abs/2503.02435
11. Neural Approaches for Natural Language Interfaces to Databases: A Survey (2020, COLING) - https://aclanthology.org/2020.coling-main.34/
12. A Comparative Survey of Recent Natural Language Interfaces for Databases (2019, VLDB Journal) - https://arxiv.org/pdf/1906.08990
13. Frameworks for Querying Databases Using Natural Language: A Literature Review (2019) - https://arxiv.org/abs/1909.01822
14. Natural Language Data Interfaces: A Data Access Odyssey (2024, ICDT) - https://drops.dagstuhl.de/storage/00lipics/lipics-vol290-icdt2024/LIPIcs.ICDT.2024.1/LIPIcs.ICDT.2024.1.pdf
15. Recent Advances in SQL Query Generation: A Survey (2020) - https://arxiv.org/abs/2005.07667
16. The Prompt Report: A Systematic Survey of Prompt Engineering Techniques (2024) - https://arxiv.org/abs/2406.06608
17. LLM/Agent-as-Data-Analyst: A Survey (2025) - https://arxiv.org/abs/2509.23988

### 고전/규칙 기반 NLIDB
18. NaLIR: An Interactive Natural Language Interface for Querying Relational Databases (2014, SIGMOD) - http://dbgroup.eecs.umich.edu/files/SIGMOD14LFb.pdf
19. Literature Survey: Natural Language Interfaces for Data Bases (NLIDB) (2020) - https://medium.com/mytake/literature-survey-natural-language-interfaces-for-data-bases-nlidb-6a86504f72c3

### 벤치마크/데이터셋
20. Spider: A Large-Scale Human-Labeled Dataset for Complex and Cross-Domain Semantic Parsing and Text-to-SQL Task (2018, EMNLP) - https://arxiv.org/abs/1809.08887
21. BIRD: Can LLM Already Serve as A Database Interface? A BIg Bench for Large-Scale Database Grounded Text-to-SQLs (2023, NeurIPS) - https://arxiv.org/abs/2305.03111
22. Spider 2.0: Evaluating Language Models on Real-World Enterprise Text-to-SQL Workflows (2024, ICLR 2025) - https://arxiv.org/abs/2411.07763
23. Seq2SQL: Generating Structured Queries from Natural Language using Reinforcement Learning (WikiSQL) (2017) - https://arxiv.org/abs/1709.00103
24. CoSQL: A Conversational Text-to-SQL Challenge (2019, EMNLP) - https://aclanthology.org/D19-1204.pdf
25. SParC: Cross-Domain Semantic Parsing in Context (2019, EMNLP) - https://aclanthology.org/P19-1443.pdf
26. DuSQL: A Large-Scale and Pragmatic Chinese Text-to-SQL Dataset (2020, EMNLP) - https://aclanthology.org/2020.emnlp-main.562.pdf
27. SQUALL: On the Potential of Lexico-logical Alignments for Semantic Parsing (2020) - https://aclanthology.org/2020.findings-emnlp.167.pdf
28. KaggleDBQA: Realistic Evaluation of Text-to-SQL Parsers (2021, ACL) - https://aclanthology.org/2021.acl-long.176.pdf
29. Dr.Spider: A Diagnostic Evaluation Benchmark towards Text-to-SQL Robustness (2023, ICLR) - https://arxiv.org/abs/2301.08881
30. ADVETA: Towards Robustness Against Natural Adversarial Table Perturbation (2022, ACL) - https://aclanthology.org/2022.acl-long.142.pdf
31. Spider-SS&CG: Measuring Compositional Generalization via Component Alignment (2022) - https://aclanthology.org/2022.findings-naacl.62.pdf
32. Spider-DK: Exploring Underexplored Limitations of Cross-Domain Generalization (2021, EMNLP) - https://aclanthology.org/2021.emnlp-main.702.pdf
33. Spider-SYN: Towards Robustness Against Synonym Substitution (2021, ACL) - https://aclanthology.org/2021.acl-long.195.pdf
34. Spider-Vietnamese: A Pilot Study of Text-to-SQL for Vietnamese (2020) - https://aclanthology.org/2020.findings-emnlp.364.pdf
35. Spider-Realistic: Structure-Grounded Pretraining for Text-to-SQL (2021, NAACL) - https://zenodo.org/records/5205322
36. CSpider: A Pilot Study for Chinese SQL Semantic Parsing (2019, EMNLP) - https://aclanthology.org/D19-1377.pdf
37. AraSpider: Democratizing Arabic-to-SQL (2024) - https://arxiv.org/abs/2402.07448
38. Dialect2SQL: A Novel Text-to-SQL Dataset for Arabic Dialects (2025) - https://arxiv.org/abs/2501.11498
39. Spider4SPARQL: A Complex Benchmark for KGQA (2023) - https://arxiv.org/abs/2309.16248
40. Spider 2.0-AIFunc: Extending Real-World Text-to-SQL to AI-Native SQL Workflows (2025) - https://arxiv.org/abs/2607.06229
41. Multilingual Text-to-SQL: Benchmarking the Limits of Language Models (2025) - https://arxiv.org/abs/2509.24405
42. BIRD-INTERACT: Re-imagining Text-to-SQL Evaluation via Dynamic Interactions (2025, ICLR) - https://openreview.net/pdf?id=nHrYBGujps
43. BIRD-CRITIC: Can LLMs Fix User Issues in Real-World Database Applications? (2025, NeurIPS) - https://openreview.net/pdf?id=yRxXTdElLv

### 신경망 시대 (사전-LLM)
44. SQLNet: Generating Structured Queries From Natural Language Without Reinforcement Learning (2017) - https://arxiv.org/abs/1711.04436
45. TypeSQL: Knowledge-based Type-Aware Neural Text-to-SQL Generation (2018) - https://arxiv.org/abs/1804.09769
46. RAT-SQL: Relation-Aware Schema Encoding and Linking for Text-to-SQL Parsers (2019/2020, ACL) - https://arxiv.org/abs/1911.04942
47. Robust Text-to-SQL Generation with Execution-Guided Decoding (2018) - https://arxiv.org/abs/1807.03100
48. RESDSQL-3B + NatSQL (2023, AAAI) - https://arxiv.org/abs/2302.05965
49. Hybrid Ranking Network for Text-to-SQL (2020) - https://arxiv.org/abs/2008.04759

### In-Context Learning / 프롬프트 엔지니어링 (LLM 시대)
50. DIN-SQL: Decomposed In-Context Learning of Text-to-SQL with Self-Correction (2023, NeurIPS) - https://arxiv.org/abs/2304.11015
51. Text-to-SQL Empowered by Large Language Models: A Benchmark Evaluation (DAIL-SQL) (2023, VLDB) - https://arxiv.org/abs/2308.15363
52. C3: Zero-shot Text-to-SQL with ChatGPT (2023) - https://arxiv.org/abs/2307.07306
53. Divide and Prompt: Chain of Thought Prompting for Text-to-SQL (2023) - https://arxiv.org/abs/2304.11556
54. Exploring Chain-of-Thought Style Prompting for Text-to-SQL (2023, EMNLP) - https://arxiv.org/abs/2305.14215
55. ACT-SQL: Automatically-Generated Chain-of-Thought (2023) - https://aclanthology.org/2023.findings-emnlp.227.pdf
56. Selective Demonstrations for Cross-domain Text-to-SQL (2023) - https://aclanthology.org/2023.findings-emnlp.944.pdf
57. Enhancing Text-to-SQL Capabilities: A Study on Prompt Design (2023) - https://aclanthology.org/2023.findings-emnlp.996.pdf
58. StructGPT: General Framework for Reasoning Over Structured Data (2023, EMNLP) - https://aclanthology.org/2023.emnlp-main.574.pdf
59. Prompting GPT-3.5 with De-semanticization and Skeleton Retrieval (2023) - https://link.springer.com/chapter/10.1007/978-981-99-7022-3_23
60. Retrieval-augmented GPT-3.5 with Sample-aware Prompting (2023) - https://link.springer.com/chapter/10.1007/978-981-99-8076-5_25
61. Teaching Large Language Models to Self-Debug (2024, ICLR) - https://openreview.net/pdf?id=KuPixIqPiq
62. SQL-PaLM: Improved Adaptation for Text-to-SQL (2024, TMLR) - https://openreview.net/pdf?id=rlloVZoKrX
63. DeepEye-SQL: A Software-Engineering-Inspired Framework (2025) - https://arxiv.org/abs/2510.17586
64. Agentar-Scale-SQL: Advancing Through Orchestrated Test-Time Scaling (2025) - https://arxiv.org/abs/2509.24403
65. LinkAlign: Scalable Schema Linking for Real-World Databases (2025, EMNLP) - https://arxiv.org/abs/2503.18596
66. ReFoRCE: Self-Refinement with Consensus Enforcement (2025) - https://openreview.net/pdf?id=OuFIfDBwQd
67. CSC-SQL: Corrective Self-Consistency via Reinforcement Learning (2025) - https://arxiv.org/abs/2505.13271
68. SAFE-SQL: Self-Augmented Learning with Fine-grained Selection (2025) - https://arxiv.org/abs/2502.11438
69. Gen-SQL: Efficient Bridging with Pseudo-Schema (2025, COLING) - https://aclanthology.org/2025.coling-main.256.pdf
70. In-Context Reinforcement Learning for Text-to-SQL (2025, COLING) - https://aclanthology.org/2025.coling-main.692.pdf
71. RSL-SQL: Robust Schema Linking in Generation (2024) - https://arxiv.org/abs/2411.00073
72. CHASE-SQL: Multi-Path Reasoning with Preference Optimization (2025, ICLR) - https://openreview.net/pdf?id=CvGqMD5OtX
73. E-SQL: Direct Schema Linking via Question Enrichment (2024) - https://arxiv.org/abs/2409.16751
74. Death of Schema Linking? Text-to-SQL in Well-Reasoned Models (2024) - https://openreview.net/pdf?id=fglyh5pa7d
75. The Dawn of Natural Language to SQL: Are We Fully Ready? (2024, VLDB) - https://www.vldb.org/pvldb/vol17/p3318-luo.pdf
76. CHESS: Contextual Harnessing for Efficient SQL Synthesis (2024) - https://arxiv.org/abs/2405.16755
77. MCS-SQL: Multiple Prompts with Multiple-Choice Selection (2025, COLING) - https://aclanthology.org/2025.coling-main.24.pdf
78. TA-SQL: Align Before Generation to Mitigate Hallucinations (2024, Findings ACL) - https://aclanthology.org/2024.findings-acl.324.pdf
79. Dubo-SQL: Diverse Retrieval-Augmented Generation and Fine Tuning (2024) - https://arxiv.org/abs/2404.12560
80. MAGIC: Generating Self-Correction Guideline (2025, AAAI) - https://arxiv.org/abs/2406.12692
81. YORO: Learning to Internalize Database Knowledge (2025, NAACL) - https://aclanthology.org/2025.naacl-long.94.pdf
82. PURPLE: Making Language Models Better SQL Writers (2024, ICDE) - https://ieeexplore.ieee.org/abstract/document/10597914
83. PET-SQL: Prompt-Enhanced Two-Round Refinement (2024) - https://arxiv.org/abs/2403.09732
84. MetaSQL: Generate-then-Rank Framework (2024, ICDE) - https://ieeexplore.ieee.org/abstract/document/10597742
85. Middleware for LLMs: Tools for Language Agents (2024, EMNLP) - https://aclanthology.org/2024.emnlp-main.436.pdf
86. SQL-CRAFT: Interactive Refinement and Enhanced Reasoning (2024) - https://arxiv.org/abs/2402.14851
87. Structure-Guided Large Language Models for Text-to-SQL (2025, ICML) - https://openreview.net/pdf?id=gT8JSEFqaS
88. Knowledge-to-SQL: Enhancing with Data Expert LLM (2024, Findings ACL) - https://aclanthology.org/2024.findings-acl.653.pdf
89. Improving Demonstration Diversity by Human-Free Fusing (2024) - https://aclanthology.org/2024.findings-emnlp.65.pdf
90. DEA-SQL: Decomposition for Enhancing Attention (2024, Findings ACL) - https://aclanthology.org/2024.findings-acl.641.pdf
91. Auto Prompt SQL: A Resource-Efficient Architecture for Text-to-SQL (2025) - https://arxiv.org/abs/2506.03598
92. SQL-Exchange: Transforming SQL Queries Across Domains (2025) - https://arxiv.org/abs/2508.07087
93. Uncovering the Impact of Chain-of-Thought Reasoning for DPO in Text-to-SQL (2025) - https://arxiv.org/abs/2502.11656
94. STRuCT-LLM: Unifying Tabular and Graph Reasoning with RL (2025) - https://arxiv.org/abs/2506.21575
95. Interactive Text-to-SQL via Expected Information Gain for Disambiguation (2025) - https://arxiv.org/abs/2507.06467
96. Insights into Natural Language Database Query Errors (2024) - https://arxiv.org/abs/2402.07304

### 실행 기반/검증 방법
97. LEVER: Learning to Verify Language-to-Code Generation with Execution (2023, ICML) - https://arxiv.org/abs/2302.08468
98. Coder Reviewer Reranking for Code Generation (2023, ICML) - https://openreview.net/pdf?id=tgXxVlWkmb
99. Natural Language to Code Translation with Execution (2022, EMNLP) - https://aclanthology.org/2022.emnlp-main.231.pdf
100. ExCoT: Optimizing Reasoning for Text-to-SQL with Execution Feedback (2025) - https://arxiv.org/abs/2503.19988
101. ReEx-SQL: Reasoning with Execution-Aware Reinforcement Learning for Text-to-SQL (2025) - https://arxiv.org/abs/2505.12768
102. SQL-of-Thought: Multi-agentic Text-to-SQL with Guided Error Correction (2025) - https://arxiv.org/abs/2509.00581
103. SQL-R1: Training Natural Language to SQL Reasoning Model by Reinforcement Learning (2025) - (arXiv, 검색결과 스니펫 기준)
104. SQLO1: A Self-Reward Heuristic Dynamic Search Method for Text-to-SQL (2025) - (arXiv, 검색결과 스니펫 기준)

### 검색(Retrieval) 기반 스키마 링킹/컨텍스트 관리
105. RASL: Retrieval Augmented Schema Linking for Massive Database Text-to-SQL (2025) - https://arxiv.org/abs/2507.23104
106. SchemaRAG: A Schema-aware Retrieval-Augmented Generation Framework for Text-to-SQL (2025/2026, ACM) - https://dl.acm.org/doi/10.1145/3786696
107. Improving Retrieval-augmented Text-to-SQL with AST-based Ranking and Schema Pruning (ASTReS) (2024) - https://arxiv.org/abs/2407.03227
108. Rethinking Schema Linking: A Context-Aware Bidirectional Retrieval Approach (2025) - https://arxiv.org/abs/2510.14296
109. Schema-First Retrieval: Embedding Catalogs for Natural Language Analytics (2026) - https://arxiv.org/abs/2606.28387
110. Retrieval-augmented Chinese Text-to-SQL Generation for Conversational Bibliographic Search (2025) - https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12558495/
111. Reflect-SQL: A Self-Reflection Based Framework for Text-to-SQL (2026) - https://arxiv.org/abs/2609.02944
112. Knapsack Optimization-based Schema Linking (2025, ICDE) - https://arxiv.org/abs/2502.12911
113. X-SQL: Expert Schema Linking and Understanding of Text-to-SQL with Multi-LLMs (2025) - https://arxiv.org/abs/2509.05899
114. DFIN-SQL: Integrating Focused Schema with DIN-SQL for Superior Accuracy in Large-Scale Databases (2024) - https://arxiv.org/abs/2403.00872
115. PSM-SQL: Progressive Schema Learning with Multi-granularity Semantics (2025) - https://arxiv.org/abs/2502.05237

### 멀티에이전트 프레임워크
116. MAC-SQL: A Multi-Agent Collaborative Framework for Text-to-SQL (2023/2025, COLING) - https://arxiv.org/abs/2312.11242
117. AGENTIQL: An Agent-Inspired Multi-Expert Framework for Text-to-SQL Generation (2025) - https://arxiv.org/abs/2510.10661
118. MAG-SQL: A Multi-Agent Generative Approach for Text-to-SQL (2024) - https://www.marktechpost.com/2024/08/19/mag-sql-a-multi-agent-generative-approach-achieving-61-accuracy-on-bird-dataset-using-gpt-4-for-enhanced-text-to-sql-query-refinement/
119. R³: Consensus-Based Multi-Agent System for Text-to-SQL (2025) - https://aclanthology.org/2025.trl-1.4.pdf
120. MARS-SQL: Multi-agent Reinforcement Learning Framework (2025) - https://arxiv.org/abs/2511.01008
121. LLM and Agent-Driven Data Analysis: A Systematic Approach for Enterprise Applications (2025) - https://arxiv.org/abs/2511.17676
122. Rethinking Text-to-SQL: Dynamic Multi-turn SQL Interaction for Real-world Database Exploration (2025) - https://arxiv.org/abs/2510.26495
123. Data Intelligence Agents: Interpreting via Autonomous Coding (2026) - https://arxiv.org/abs/2606.19319
124. Tursio Database Search: How Far Are We from ChatGPT? (2026) - https://arxiv.org/abs/2603.18835

### 미세조정/소형 모델
125. CodeS: Building Open-source Language Models for Text-to-SQL (2024, SIGMOD) - https://dl.acm.org/doi/10.1145/3654930
126. StructLM: Building Generalist Models for Structured Knowledge Grounding (2024, COLM) - https://openreview.net/pdf?id=EKBPn7no4y
127. Symbol-LLM: Foundational Symbol-centric Interface (2024, ACL) - https://aclanthology.org/2024.acl-long.707.pdf
128. CLLMs: Consistency Large Language Models (2024, ICML) - https://openreview.net/pdf?id=8uzBOVmh8H
129. DTS-SQL: Decomposed Text-to-SQL with Small LLMs (2024) - https://aclanthology.org/2024.findings-emnlp.481.pdf
130. SLM-SQL: An Exploration of Small Language Models for Text-to-SQL (2025) - https://arxiv.org/abs/2507.22478
131. OmniSQL: Synthesizing High-quality Data at Scale (2025, VLDB) - https://dl.acm.org/doi/10.14778/3749646.3749723
132. XiYan-SQL: Multi-Generator Ensemble Framework (2024) - https://arxiv.org/abs/2411.08599
133. MSc-SQL: Multi-Sample Critiquing Small Language Models (2025, NAACL) - https://aclanthology.org/2025.naacl-long.107.pdf
134. ROUTE: Robust Multitask Tuning and Collaboration (2025, ICLR) - https://openreview.net/pdf?id=BAglD6NGy0
135. SHARE: SLM-based Hierarchical Action Correction Assistant (2025, ACL) - https://aclanthology.org/2025.acl-long.552.pdf
136. BASE-SQL: A Powerful Open Source Text-to-SQL Baseline Approach (2025) - https://arxiv.org/abs/2502.10739
137. Text-to-SQL based on Large Language Models and Database Keyword Search (2025) - https://arxiv.org/abs/2501.13594

### 오류/한계/환각 분석
138. Error Detection for Text-to-SQL Semantic Parsing (2023) - https://arxiv.org/abs/2305.13683
139. Hallucination Detection for LLM-based Text-to-SQL Generation via Two-Stage Metamorphic Testing (2025) - https://arxiv.org/abs/2512.22250
140. Can the Rookies Cut the Tough Cookie? Exploring LLMs for SQL Equivalence Checking (2024) - https://arxiv.org/abs/2412.05561

### 도메인 특화
141. FinSQL: Model-Agnostic Framework for Financial Analysis Text-to-SQL (2025, SIGMOD) - https://arxiv.org/abs/2401.10506

---
*본 문서는 학교 과제("내 데이터를 아는 AI 비서") README의 Related Work 섹션 초안을 위한 조사 자료로, 2026년 9월 기준 웹 검색 결과를 바탕으로 작성되었다.*
