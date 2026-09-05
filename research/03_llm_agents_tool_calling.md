# 관련 연구 (Related Work) — LLM 에이전트 + 도구 호출(Tool/Function Calling)·코드 생성 기반 데이터 분석 시스템

## 1. 개요

우리 프로젝트("내 데이터를 아는 AI 비서")의 현재 구조는 다음과 같다: 백엔드가 Firestore에 쌓인 시계열 데이터를 `GET /api/data/summary`에서 미리 집계(total/average/max/min/trend)하고, 이 요약을 파이썬 f-string으로 하나의 system prompt 텍스트에 통째로 끼워 넣은 뒤, `POST /api/chat`에서 사용자 메시지와 함께 LLM(gpt-5-mini)에 단발성(one-shot)으로 전달한다. LLM은 이 텍스트를 "읽고 답할" 뿐, 스스로 어떤 계산을 수행하거나 어떤 데이터를 더 조회할지 결정하지 않는다. 즉 계획(plan)도, 도구 호출(tool call)도, 관찰(observation) 피드백 루프도 없는 "정적 컨텍스트 주입형" 구조다.

이런 방식은 지난 3~4년간 LLM 기반 데이터 분석 연구가 수렴해 온 방향과 뚜렷하게 대비된다. 2022년 ReAct(추론+행동 상호작용 루프)와 2023년 Toolformer/Gorilla/OpenAI Function Calling을 기점으로, "LLM이 무엇을 계산할지 스스로 결정하고, 코드나 API 호출을 실제로 실행하고, 그 실행 결과(관찰)를 다시 컨텍스트에 넣어 다음 행동을 결정한다"는 에이전트 루프(plan → act → observe → repeat)가 데이터 분석 도메인 전반의 표준 설계 패턴이 되었다. Data-Copilot, TaskWeaver, Data Interpreter 같은 시스템들은 "LLM은 통계를 직접 암산하지 못하고 컨텍스트 길이도 제한적"이라는, 우리가 이미 요약을 미리 계산해서 넘기는 이유와 같은 문제의식에서 출발했지만, 해결책으로 "매번 새로 코드/도구를 호출해 실제 계산을 수행시키는" 방향을 택했다는 점이 다르다.

동시에 이 방향에는 비용(토큰/지연시간 증가), 무한 루프, 잘못된 도구 선택, 코드 실행 중 오류 등 새로운 실패 모드가 따라온다는 사실도 최근 벤치마크(InfiAgent-DABench, DataSciBench 등) 연구들이 정량적으로 보여주고 있다. 이 문서는 이러한 도구 호출/코드 실행 기반 에이전트 설계를 폭넓게 조사하고, 그중 대표적인 8편을 심층 비교한 뒤, 우리 프로젝트의 보너스 요구사항(Function Calling 확장)에 구체적으로 연결되는 시사점을 정리한다.

## 2. 조사 규모 및 트렌드

WebSearch로 "LLM agent data analysis", "tool calling LLM data science", "code generation agent pandas LLM", "autonomous data analysis agent survey", "LLM function calling survey", "ReAct agent survey", "multi-agent data analytics LLM 2024 2025", "text-to-SQL LLM agent", "spreadsheet/table agent", "Reflexion/AutoGPT/MetaGPT/CAMEL" 등 다양한 쿼리로 검색하여 총 **110여 편**의 논문/시스템/서베이 제목을 확인했다(§6 참고문헌 목록 참조). 대략적인 카테고리 분포는 다음과 같다.

- **범용 에이전트 설계 원형(2022~2023)**: ReAct, Toolformer, HuggingGPT, Reflexion, Tree of Thoughts, AutoGPT, ReWOO, ART, Chameleon 등 — "LLM이 스스로 도구/행동을 선택하는 루프"의 기초를 놓은 연구.
- **범용 도구 호출/Function Calling 자체에 대한 연구**: Gorilla, ToolLLM, ToolACE, MLLM-Tool, ToolVerifier, PLAY2PROMPT, LLM-Tool-Survey, Agentic Tool Use Survey — 도구를 어떻게 표현·검색·검증하는가에 집중.
- **데이터 분석/데이터 과학 전용 에이전트**: Data-Copilot, InsightPilot, TaskWeaver, Data Interpreter, DS-Agent, LAMBDA, AutoKaggle, DatawiseAgent, VDSAgents, DeepAnalyze, EvoDS, Auto-Analyst — pandas/시각화/모델링 코드를 직접 생성·실행.
- **시각화/BI 특화**: LIDA, Chat2VIS, Data Formulator, Data-to-Dashboard, GistVis, SheetCopilot/SheetAgent/SheetMind, TableGPT.
- **Text-to-SQL 계열(도구=SQL 실행기)**: DIN-SQL, DAIL-SQL, MAC-SQL, MAG-SQL, MCS-SQL, AGENTIQL, SDE-SQL, SQLFixAgent, PV-SQL, RoboPhD, DCMM-SQL, X-SQL 등 — 이 서브필드가 양적으로 가장 크며 "SQL 실행 = 도구 호출, 실행 결과/에러 = 관찰"이라는 패턴이 뚜렷하다.
- **코드 실행을 행동 공간 자체로 통일한 연구**: CodeAct(Executable Code Actions) — JSON tool call 대신 실행 가능한 코드를 행동으로 사용.
- **벤치마크/서베이**: InfiAgent-DABench, DataSciBench, ScienceAgentBench, BixBench, DabStep, DataGovBench, DataCross, LongDA, "LLM/Agent-as-Data-Analyst: A Survey", "LLM-Based Data Science Agents: A Survey", "A Survey on LLM-based Agents for Statistics and Data Science", "Evaluation and Benchmarking of LLM Agents: A Survey" 등 — 2024년 하반기부터 2025년에 서베이/벤치마크가 폭발적으로 증가.

**트렌드 요약**: (1) 2022~2023년은 "루프 설계"(ReAct, Reflexion) 자체가 논문 주제였다면, 2023년 말~2024년(TaskWeaver, Data Interpreter, InfiAgent-DABench)부터는 "데이터 분석"이라는 구체 도메인에 특화된 코드 실행 에이전트가 주류가 되었다. (2) 2024년 중반 CodeAct를 기점으로 "도구 호출을 JSON 스키마 함수 하나씩 부르는 것"보다 "코드를 통째로 실행시키는 것"이 더 유연하고 성능이 좋다는 방향으로 무게중심이 이동했다. (3) 2025년에는 단일 에이전트보다 역할을 나눈 멀티 에이전트(Planner/Coder/Reviewer, Selector/Decomposer/Refiner) 구조와, 신뢰성/실패 모드를 정량 평가하는 벤치마크 논문이 급증했다 — 이는 실무에서 이런 구조의 "휴먼 감독 없는 신뢰성"이 아직 해결되지 않은 문제임을 시사한다.

## 3. 대표 논문/시스템 심층 비교

### 3.1 ReAct: Synergizing Reasoning and Acting in Language Models (2022)
- **저자/연도/링크**: Shunyu Yao, Jeffrey Zhao, Dian Yu, Nan Du, Izhak Shafran, Karthik Narasimhan, Yuan Cao (2022, ICLR 2023) — https://arxiv.org/abs/2210.03629
- **핵심 아이디어/구조**: 이후 모든 데이터 분석 에이전트가 사실상 상속하는 원형. `Thought(추론) → Action(도구 호출) → Observation(도구 응답) → Thought → …`를 하나의 프롬프트 안에서 텍스트로 반복 생성시킨다. 별도의 학습 없이 few-shot 예시만으로 이 패턴을 유도한다.
- **도구 노출 방식**: 자유 텍스트 형식의 "Action: search[query]" 같은 명령어 파싱 방식(구조화된 JSON 스키마는 아님). 도구(Wikipedia API 등) 실행 결과 텍스트가 그대로 다음 턴의 프롬프트에 Observation으로 삽입된다.
- **우리 프로젝트와 비교**: 우리는 Observation이라는 개념 자체가 없다 — summary를 한 번 주입하고 끝. ReAct의 핵심 통찰은 "모델이 무엇을 모르는지 스스로 판단해 다음 행동(추가 조회)을 선택하게 하면 환각(hallucination)과 오류 전파가 줄어든다"는 것이며, 이는 우리처럼 데이터 요약을 통째로 미리 계산해 넣는 방식이 "모델이 어떤 값을 더 봐야 하는지 판단할 기회 자체를 차단"하고 있다는 점을 보여준다.

### 3.2 Data-Copilot: Bridging Billions of Data and Humans with Autonomous Workflow (2023)
- **저자/연도/링크**: Wenqi Zhang, Yongliang Shen, Zeqi Tan, Guiyang Hou, Weiming Lu, Yueting Zhuang (2023) — https://arxiv.org/abs/2306.07209
- **핵심 아이디어/전체 구조**: 2단계 구조. (1) **탐색(Exploration) 단계**: 오프라인에서 LLM이 다양한 사용자 요청 패턴을 스스로 시뮬레이션하며, 데이터 조회·가공·시각화를 위한 재사용 가능한 "인터페이스(함수)"들을 코드로 설계하고 컴파일 검증까지 마쳐 둔다. (2) **배포(Deployment) 단계**: 실제 사용자 요청이 오면 LLM은 처음부터 코드를 짜는 대신, 미리 검증된 인터페이스 중 적절한 것을 호출·조합한다.
- **도구 정의/노출/관찰**: 도구가 사람이 사전 정의한 고정 API가 아니라 **LLM 자신이 탐색 단계에서 설계·검증한 코드 인터페이스**라는 점이 독특하다. 관찰은 인터페이스 실행 결과(테이블/수치)이며, 이는 다시 다음 인터페이스의 입력이 된다.
- **우리 프로젝트와 비교**: 우리 `GET /api/data/summary`가 "미리 계산해 둔 고정 집계 함수" 하나뿐이라면, Data-Copilot은 이런 집계 함수 자체를 여러 개 만들고 LLM이 상황에 맞게 골라 조합하도록 설계했다. 우리가 Function Calling을 도입한다면 `get_summary(period)`, `get_raw_data(date_range)`, `compute_trend(metric)`처럼 "고정된 계산 로직을 여러 개의 선택 가능한 도구"로 쪼개는 것이 이 논문이 주는 직접적 시사점이다.

### 3.3 TaskWeaver: A Code-First Agent Framework (2023, Microsoft Research)
- **저자/연도/링크**: Bo Qiao 외 18인 (Microsoft) (2023, arXiv 2311.17541) — https://arxiv.org/abs/2311.17541 , 코드: https://github.com/microsoft/TaskWeaver
- **핵심 아이디어/전체 구조**: **Planner**(요청을 하위 작업으로 분해하고 자기반성(self-reflection)으로 다음 단계를 결정) + **Code Generator/Code Interpreter**(각 하위 작업에 대해 실제 실행 코드를 생성)의 2계층 구조. Jupyter 노트북처럼 세션 전체에서 상태(변수, DataFrame)가 유지되는 **stateful 실행**이 핵심 차별점이다.
- **도구 정의/노출/관찰**: 플러그인은 "함수 이름 + 설명 + 인자 + 반환값" 스키마로 정의되어 LLM 프롬프트에 노출된다(OpenAI function calling의 JSON 스키마와 유사하되, 실제 실행은 코드 생성 방식). 코드 실행 결과는 Planner에게 다시 전달되어 다음 계획 단계를 결정하는 데 쓰인다(ReAct 패턴을 명시적으로 채택).
- **우리 프로젝트와 비교**: 우리는 "계획"이라는 개념이 없고 한 번의 system prompt 주입 + 한 번의 답변 생성으로 끝난다. TaskWeaver처럼 Planner를 도입하면, 사용자가 "지난달 대비 이번달 증가율은?" 같은 질문을 했을 때 모델이 "먼저 지난달 요약을 조회하고, 이번달 요약을 조회하고, 차이를 계산한다"는 다단계 계획을 세울 수 있다. 또한 pandas DataFrame 같은 "네이티브 데이터 구조"를 코드 실행 중 유지한다는 아이디어는, 우리가 Firestore 원시 데이터를 통째로 텍스트로 넣지 않고 필요할 때만 코드로 집계하게 만드는 데 참고할 수 있다.

### 3.4 Data Interpreter: An LLM Agent For Data Science (2024, MetaGPT 계열)
- **저자/연도/링크**: Sirui Hong, Yizhang Lin, Bang Liu, Bangbang Liu 외 다수(DeepWisdom/MetaGPT 팀) (2024, arXiv 2402.18679) — https://arxiv.org/abs/2402.18679
- **핵심 아이디어/전체 구조**: 세 가지 기법의 결합. (1) **동적 계획(hierarchical graph planning)**: 작업을 노드 그래프로 표현하고 실행 중 실시간으로 노드를 추가/재구성하여 중간 데이터 변화에 적응(단순 선형 plan-execute가 아니라 그래프가 실행 중 변형됨). (2) **도구의 동적 통합**: 실행 도중 필요한 도구(라이브러리 함수)를 그때그때 코드에 통합. (3) **피드백의 논리적 불일치 탐지 + 경험 기록**: 실행 결과가 이전 추론과 모순되면 이를 탐지해 재시도하고, 성공/실패 경험을 기록해 재사용.
- **도구 노출/관찰**: 도구는 고정 스키마가 아니라 "코드로 표현 가능한 모든 것"이며, 관찰은 코드 실행 결과(수치, 에러 메시지, 로그) 자체이다. InfiAgent-DABench에서 75.9%→94.9%로 정확도를 크게 끌어올렸다는 결과는 "그래프 기반 동적 재계획"의 효과를 보여준다.
- **우리 프로젝트와 비교**: 우리 시스템은 "계획이 실행 중 바뀐다"는 개념이 전혀 없다 — 한 번 주입된 요약이 대화 내내 고정된다. 만약 사용자가 요약에 없는 값(예: 특정 날짜의 memo 내용)을 물으면 모델은 답할 수 없거나 환각한다. Data Interpreter의 "실행 중 재계획" 아이디어는 우리 확장 방향에서 "1차 답변 생성 후 정보가 부족하면 추가 도구 호출로 재시도"하는 최소 버전으로 적용 가능하다.

### 3.5 InfiAgent-DABench: Evaluating Agents on Data Analysis Tasks (2024)
- **저자/연도/링크**: Xueyu Hu, Ziyu Zhao, Shuang Wei 외 (2024, ICML 2024, arXiv 2401.05507) — https://arxiv.org/abs/2401.05507
- **핵심 아이디어/전체 구조**: 데이터 분석 에이전트를 **평가하기 위한 벤치마크**이자, 그 자체로 참조 구현(DAAgent)을 제공. CSV 파일과 질문이 주어지면 에이전트는 ReAct 방식으로 "계획 → 파이썬 코드 작성 → Docker 기반 샌드박스에서 실행 → 결과/에러를 관찰 → 결론"을 반복한다.
- **도구 정의/노출/관찰**: 도구는 사실상 "파이썬 코드 실행" 하나이며 함수 스키마가 아니라 코드 스니펫 자체가 행동이다(TaskWeaver·CodeAct와 같은 계열). 특이한 기여는 **format-prompting**: 개방형 질문을 `@answer_name[answer]` 같은 폐쇄형 포맷으로 변환해, LLM 응답을 정규식으로 자동 채점 가능하게 만든 것.
- **실패 모드**: 논문이 명시한 오류 유형 — (1) 포맷 미준수(대부분 모델이 지정된 답변 포맷을 지키지 못해 별도 GPT-3.5 재포맷 단계가 필요했음), (2) 환각(실행하지 않고 결과를 지어냄 — "실행 없이 답하지 말라"는 명시적 지시가 필요했음), (3) 코드와 문제의 불일치, (4) 샌드박스 환경 이해 부족. GPT-4 78.99% vs Qwen-72B-Chat 59.92%처럼 모델 간 격차가 크다.
- **우리 프로젝트와 비교**: 이 벤치마크는 "도구 호출을 도입하면 자동으로 좋아진다"가 아니라 **모델과 파이프라인 설계에 따라 실패율이 크게 갈린다**는 것을 정량적으로 보여준다. 우리가 Function Calling을 붙일 때도 (a) 반환 포맷을 엄격히 강제하고, (b) "실행 결과 없이 추측하지 말라"는 지시를 명시하고, (c) 실패를 가정한 방어적 파싱이 필요하다는 실무적 교훈을 준다.

### 3.6 Executable Code Actions Elicit Better LLM Agents (CodeAct) (2024, ICML)
- **저자/연도/링크**: Xingyao Wang, Yangyi Chen, Lifan Yuan, Yizhe Zhang, Yunzhu Li, Hao Peng, Heng Ji (2024, ICML 2024, arXiv 2402.01030) — https://arxiv.org/abs/2402.01030
- **핵심 아이디어/전체 구조**: "LLM 에이전트의 행동(action)을 무엇으로 표현할 것인가"에 대한 논문. 기존 방식(JSON 함수 호출 하나씩, 혹은 고정 텍스트 포맷)과 달리, **행동 공간 전체를 실행 가능한 파이썬 코드로 통일**한다. 루프: 코드 생성 → 샌드박스 실행 → stdout/stderr/예외를 관찰 → 필요하면 새 코드로 이전 행동을 수정하거나 이어감.
- **도구 노출/관찰**: 도구(API)는 파이썬 함수로 노출되고, LLM은 이 함수들을 자유롭게 조합하는 코드를 작성한다(반복문, 조건문, 변수 재사용 가능) — 한 번에 하나의 함수만 호출 가능한 JSON function calling보다 표현력이 크다. API-Bank/M3ToolEval에서 텍스트/JSON 방식 대비 최대 20%p 높은 성공률을 보였다.
- **우리 프로젝트와 비교**: 우리가 고려 중인 "Function Calling"이 OpenAI의 JSON 스키마 방식이라면, CodeAct는 그보다 한 단계 더 유연한 대안(코드 실행)이 있다는 것을 보여준다. 다만 코드 실행 샌드박스 구축 비용이 크므로, 학교 과제 범위에서는 "정해진 함수 몇 개(get_summary, get_raw_records, compute_stat)를 JSON function calling으로 노출"하는 정도가 현실적이며, CodeAct는 향후 확장(사용자가 임의 통계를 요청할 때 pandas 코드를 직접 실행)의 참고 모델로 남겨둘 만하다.

### 3.7 LIDA: A Tool for Automatic Generation of Grammar-Agnostic Visualizations and Infographics using LLMs (2023, ACL Demo)
- **저자/연도/링크**: Victor Dibia (Microsoft Research) (2023, ACL 2023 Demo Track, arXiv 2303.02927) — https://arxiv.org/abs/2303.02927
- **핵심 아이디어/전체 구조**: 4개 모듈의 파이프라인. **Summarizer**(원본 데이터를 자연어 요약으로 압축 — 우리 `/api/data/summary`와 목적이 유사) → **Goal Explorer**(데이터로부터 가능한 시각화/분석 목표를 LLM이 스스로 여러 개 열거) → **VisGenerator**(각 목표에 대해 시각화 코드를 생성·실행·검증·필터링) → **Infographer**(이미지 생성 모델로 스타일 적용).
- **도구 노출/관찰**: "도구"는 시각화 라이브러리 코드 생성 + 실제 실행/검증이며, 실행이 실패하면 필터링되어 재시도된다. 목표 자체도 고정이 아니라 LLM이 데이터를 보고 스스로 여러 후보를 만든다는 점이 특징.
- **우리 프로젝트와 비교**: 우리의 summary 생성은 LIDA의 Summarizer 단계와 목적이 같지만, 이후 "이 요약으로 어떤 질문에 답할지"를 사람이 아니라 LLM이 코드를 실행해 검증하는 단계가 우리에겐 없다. LIDA처럼 "요약 → LLM이 스스로 추가 분석 목표를 제안 → 코드 실행/검증"하는 흐름은 우리 챗봇이 "이런 것도 물어볼 수 있어요" 식 제안 기능을 만들 때 참고할 수 있다.

### 3.8 MAC-SQL: A Multi-Agent Collaborative Framework for Text-to-SQL (2024, COLING 2025)
- **저자/연도/링크**: Bing Wang, Changyu Ren, Jian Yang 외 (2023/2024, COLING 2025 Oral, arXiv 2312.11242) — https://arxiv.org/abs/2312.11242
- **핵심 아이디어/전체 구조**: 하나의 거대 프롬프트로 SQL을 한 번에 생성하는 대신, 역할이 분리된 3-에이전트 구조. **Selector**(전체 DB 스키마 중 질문과 관련된 부분만 골라 압축), **Decomposer**(복잡한 질문을 few-shot chain-of-thought로 하위 질문으로 분해하며 SQL 생성), **Refiner**(생성된 SQL을 실제 DB에 실행해 결과/에러를 확인하고 잘못되었으면 자동 수정).
- **도구 노출/관찰**: 여기서 "도구"는 **SQL 실행기(DB 엔진) 자체**이며, 실행 결과(레코드) 또는 에러 메시지가 Refiner에게 관찰로 주어져 SQL을 고쳐 다시 실행하는 self-correction 루프가 핵심이다. BIRD 벤치마크에서 vanilla GPT-4(46.35 정확도) 대비 MAC-SQL+GPT-4가 59.59로 크게 향상됨을 보였다.
- **우리 프로젝트와 비교**: 우리는 Firestore 쿼리 로직이 백엔드에 고정되어 있고 LLM은 그 결과(요약)만 받는다. MAC-SQL의 구조를 빌리면, LLM에게 "Firestore에서 조건에 맞는 데이터를 조회하는 함수"를 도구로 노출하고, 조회 결과가 비어있거나 이상하면 스스로 조건을 바꿔 재조회(Refiner 역할)하게 만들 수 있다 — 이는 과제 보너스 항목("필요시 데이터 요약/대화 조회 등을 도구로 호출")과 정확히 일치하는 패턴이다.

## 4. 실패 모드와 한계

도구 호출/코드 실행 기반 에이전트 구조는 정적 요약 주입보다 표현력이 크지만, 문헌에서 반복적으로 보고되는 실패 모드가 있다.

- **무한 루프/미종료(non-termination)**: Planner-Executor 루프(TaskWeaver, Data Interpreter, ReAct 계열)는 "언제 멈출지"를 LLM 스스로 판단해야 한다. 판단이 틀리면 같은 도구를 반복 호출하거나 결론을 내리지 못하고 턴 수/토큰 예산을 소진한다. 실무 구현은 대개 max_turns나 max_tool_calls 같은 하드 상한을 강제한다.
- **잘못된 도구 선택/스키마 오해**: 도구가 여러 개로 늘어날수록(ToolLLM의 16000+ API 등) LLM이 이름/설명이 비슷한 도구를 혼동하거나, 인자를 잘못된 타입/형식으로 채우는 오류가 늘어난다. Gorilla/ToolLLM/ToolACE 계열 연구는 이를 줄이기 위해 검색 기반 도구 선택, 파인튜닝(자체 API 호출 데이터로 학습)까지 동원한다.
- **코드 실행 오류 처리**: CodeAct, Data Interpreter, InfiAgent-DABench 모두 "실행이 실패했을 때(문법 오류, 타입 오류, 존재하지 않는 컬럼 참조 등) 어떻게 복구시킬 것인가"를 핵심 문제로 다룬다. 자기수정(self-debug) 루프를 넣어도 반복 실패 시 사용자에게 그대로 에러를 노출하거나 무의미한 재시도를 반복하는 경우가 보고된다.
- **환각과 미실행 결과 서술**: InfiAgent-DABench가 명시적으로 지적하듯, 일부 모델은 코드를 실제로 실행하지 않고도 실행한 것처럼 결과를 지어낸다(특히 실행 도구 호출 자체를 생략하고 그럴듯한 숫자를 만들어내는 경우). 이는 "도구를 노출하기만 하면 안전해진다"는 순진한 가정을 반박한다 — 프롬프트로 "실행 없이 답하지 말라"를 명시하거나, 서버 측에서 도구 호출 여부를 강제해야 한다.
- **비용과 지연시간**: 매 턴마다 추론(Thought)-행동(Action)-관찰(Observation)을 반복하면 API 호출 횟수와 토큰 사용량이 단일 프롬프트 대비 수 배로 늘어난다. TaskWeaver/Data Interpreter류 멀티 에이전트 구조는 역할별로 별도 LLM 호출이 추가되어 지연시간이 더 커진다. 벤치마크 논문들(DataSciBench, Evaluation and Benchmarking of LLM Agents Survey)은 정확도 향상과 비용/지연시간 증가 사이의 트레이드오프를 공통적으로 지적한다.
- **평가의 어려움**: 데이터 분석 질문은 대개 개방형(open-ended)이라 정답을 자동 채점하기 어렵다. InfiAgent-DABench의 format-prompting처럼 별도의 "채점 가능하게 만드는" 엔지니어링이 필요할 정도로, 에이전트 구조는 평가 인프라 자체의 복잡도도 키운다.

## 5. 종합 시사점 — 우리 프로젝트에 Function Calling을 추가한다면

과제 보너스 항목인 "Function Calling으로 LLM이 필요시 데이터 요약/대화 조회 등을 도구로 호출"을 구현할 때, 위 조사에서 참고할 만한 구체적 패턴 4가지를 제안한다.

1. **고정 요약 하나가 아니라, 선택 가능한 여러 개의 얇은 도구로 쪼갠다 (Data-Copilot / TaskWeaver 패턴).** 현재 `GET /api/data/summary`가 계산하는 것을 하나의 함수로 통째로 프롬프트에 박아 넣는 대신, `get_summary(period)`, `get_raw_records(start_date, end_date)`, `search_memo(keyword)`처럼 여러 개의 작은 함수로 나누고 OpenAI function calling의 JSON 스키마(`name`, `description`, `parameters`)로 노출한다. LLM이 질문에 따라 필요한 도구만 골라 부르게 하면, 지금처럼 "요약에 없는 정보는 아예 답할 수 없는" 한계를 줄일 수 있다.

2. **실행 결과(관찰)를 다시 LLM 컨텍스트에 넣는 최소 루프를 만든다 (ReAct / MAC-SQL 패턴).** 지금 구조는 "요약 주입 → 1회 답변"으로 끝나 관찰(observation) 개념이 없다. `/api/chat`을 "LLM이 tool_calls를 반환하면 → 백엔드가 실제로 Firestore/summary 함수를 실행 → 결과를 tool 메시지로 다시 넣어 재호출"하는 2단계(혹은 최대 N단계) 루프로 바꾸면, MAC-SQL의 Refiner처럼 "빈 결과나 이상한 값이 나오면 다른 조건으로 재조회"하는 최소한의 자기수정도 가능해진다. 다만 무한 루프 실패 모드(§4)를 피하기 위해 반드시 `max_tool_calls`(예: 3~5회) 상한을 코드로 강제해야 한다.

3. **함수 스키마와 반환 포맷을 엄격하게 강제한다 (InfiAgent-DABench 패턴).** 벤치마크가 보여주듯 모델은 포맷을 잘 안 지키고, 도구를 실행하지 않고도 실행한 척 답을 지어내는 경우가 있다. system prompt에 "먼저 도구를 호출해 실제 값을 확인하기 전에는 수치를 언급하지 말라"를 명시하고, 함수의 `parameters`를 pydantic/JSON schema로 엄격히 정의해 백엔드에서 인자 검증 후 실행하도록 구현하면 이 실패 모드를 상당히 줄일 수 있다. 우리 과제 규모(단일 사용자, 소규모 시계열 데이터)에서는 CodeAct처럼 임의 코드를 실행하는 샌드박스까지 만들 필요는 없고, 3~4개의 고정 함수만 정의해도 "Function Calling" 보너스 요건을 충분히 만족한다.

4. **역할을 완전히 나누지 않더라도, 최소한 "계획 → 도구 선택 → 응답 생성"의 3단계 개념은 분리한다 (TaskWeaver Planner/CodeGenerator, LIDA Summarizer/Goal Explorer 패턴).** 지금은 요약 계산(백엔드)과 응답 생성(LLM)이 한 번에 묶여 있다. Function Calling을 붙이면 자연히 "LLM이 어떤 도구를 부를지 계획 → 백엔드가 실행 → LLM이 결과를 바탕으로 최종 응답 생성"이라는 최소 3단계 흐름이 생기는데, 이 개념적 분리를 명확히 문서화해 두면(우리 README/보고서에서) 조사한 선행 연구들과의 비교도 쉬워지고, 추후 InfiAgent-DABench류 벤치마크 방식으로 우리 챗봇의 정확도를 자체 평가하는 것도 가능해진다.

## 6. 참고문헌 목록

### 데이터 분석/데이터 과학 전용 에이전트
- Data-Copilot: Bridging Billions of Data and Humans with Autonomous Workflow (2023) - https://arxiv.org/abs/2306.07209
- Demonstration of InsightPilot: An LLM-Empowered Automated Data Exploration System (2023) - https://arxiv.org/abs/2304.00477
- TaskWeaver: A Code-First Agent Framework (2023) - https://arxiv.org/abs/2311.17541
- Data Interpreter: An LLM Agent For Data Science (2024) - https://arxiv.org/abs/2402.18679
- DS-Agent: Automated Data Science by Empowering LLMs with Case-Based Reasoning (2024) - https://arxiv.org/abs/2402.17453
- LAMBDA: A Large Model Based Data Agent (2024) - https://arxiv.org/pdf/2407.17535
- AutoKaggle: A Multi-Agent Framework for Autonomous Data Science Competitions (2024/2025) - https://m-a-p.ai/AutoKaggle.github.io/
- DatawiseAgent: A Notebook-Centric LLM Agent Framework (2025) - https://arxiv.org/pdf/2503.07044
- VDSAgents: A PCS-Guided Multi-Agent System for Veridical Data Science Automation (2025) - https://arxiv.org/html/2510.24339
- DeepAnalyze: Agentic Large Language Models for Autonomous Data Science (2025) - https://arxiv.org/html/2510.16872v1
- EvoDS: Self-Evolving Autonomous Data Science Agent with Skill Learning and Context Management (2025) - https://arxiv.org/pdf/2606.03841
- Auto-Analyst (DSPy-powered multi-agent data science platform) (2024/2025) - https://github.com/FireBird-Technologies/Auto-Analyst
- AutoML-Agent: A Multi-Agent LLM Framework for Full-Pipeline AutoML (2024) - https://arxiv.org/abs/2410.02958
- LLM-Based Multi-Agent Blackboard System for Information Discovery in Data Science (2025) - https://arxiv.org/pdf/2510.01285
- A Multimodal Conversational Agent for Tabular Data Analysis (2025) - https://arxiv.org/pdf/2511.18405
- Data-to-Dashboard: Multi-Agent LLM Framework for Insightful Visualization in Enterprise Analytics (2025) - https://arxiv.org/html/2505.23695v1
- Rethinking the AI Scientist: Interactive Multi-Agent Workflows for Scientific Discovery (2026) - https://arxiv.org/pdf/2601.12542
- Can We Predict Before Executing Machine Learning Agents? (2026) - https://arxiv.org/pdf/2601.05930
- PIVOT: Bridging Planning and Execution in LLM Agents via Trajectory Refinement (2026) - https://arxiv.org/pdf/2605.11225
- Verified Multi-Agent Orchestration: A Plan-Execute-Verify Framework (2026) - https://arxiv.org/pdf/2603.11445
- Traceability and Accountability in Role-Specialized Multi-Agent LLM Pipelines (2025) - https://arxiv.org/pdf/2510.07614

### 벤치마크 및 서베이 (데이터 분석/데이터 과학 에이전트)
- InfiAgent-DABench: Evaluating Agents on Data Analysis Tasks (2024) - https://arxiv.org/abs/2401.05507
- DataSciBench: An LLM Agent Benchmark for Data Science (2025) - https://arxiv.org/html/2502.13897v1
- LongDA: Benchmarking LLM Agents for Long-Document Data Analysis (2026) - https://arxiv.org/pdf/2601.02598
- LLM-Based Data Science Agents: A Survey of Capabilities, Challenges, and Future Directions (2025) - https://arxiv.org/pdf/2510.04023
- Large Language Model-based Data Science Agent: A Survey (2025) - https://arxiv.org/pdf/2508.02744
- LLM/Agent-as-Data-Analyst: A Survey (2025) - https://arxiv.org/html/2509.23988v3
- A Survey on Large Language Model-based Agents for Statistics and Data Science (2025, The American Statistician) - https://www.tandfonline.com/doi/full/10.1080/00031305.2025.2561140
- DataGovBench: Benchmarking LLM Agents for Real-World Data Governance Workflows (2025) - https://arxiv.org/pdf/2512.04416
- DataCross: A Unified Benchmark and Agent Framework for Cross-Modal Heterogeneous Data Analysis (2026) - https://arxiv.org/pdf/2601.21403
- BixBench: computational biology/bioinformatics LLM agent benchmark (2025)
- DabStep: multi-step data agent reasoning benchmark (2025)
- ScienceAgentBench: scientific data analysis programming benchmark (2024, ACL)
- Reading List of LLM-Based Data Science Agent (GitHub curated list) - https://github.com/Stephen-SMJ/Reading-List-of-Large-Language-Model-Based-Data-Science-Agent

### 시각화/스프레드시트/테이블 특화
- LIDA: A Tool for Automatic Generation of Grammar-Agnostic Visualizations and Infographics using LLMs (2023) - https://arxiv.org/abs/2303.02927
- Chat2VIS: Generating Data Visualisations via Natural Language using ChatGPT, Codex and GPT-3 (2023) - https://arxiv.org/abs/2302.02094
- Automated Data Visualization from Natural Language via LLMs: An Exploratory Study (2024) - https://arxiv.org/pdf/2404.17136
- Automated Visualization Makeovers with LLMs (2025) - https://arxiv.org/pdf/2508.05637
- GistVis: Automatic Generation of Word-scale Visualizations from Data-rich Documents (2025) - https://arxiv.org/pdf/2502.03784
- Data Formulator / Data Formulator 2 (Microsoft, concept-driven visualization authoring) (2024)
- SheetCopilot: Bringing Software Productivity to the Next Level through LLMs (2023) - https://sheetcopilot.github.io/
- SheetAgent: Towards a Generalist Agent for Spreadsheet Reasoning and Manipulation (2024/2025) - https://arxiv.org/html/2403.03636v3
- SheetMind: An End-to-End LLM-Powered Multi-Agent Framework for Spreadsheet Automation (2025) - https://arxiv.org/html/2506.12339v2
- Spreadsheet-RL: Advancing LLM Agents on Realistic Spreadsheet Tasks via RL (2026) - https://arxiv.org/html/2605.22642v1
- Toward real-world Table Agents: capabilities, workflows, and design principles (2025) - https://link.springer.com/article/10.1007/s11280-025-01399-z
- TableGPT (fine-tuned LLM for table understanding via external functions)

### Text-to-SQL 에이전트 (SQL 실행기를 도구로 사용)
- DIN-SQL: Decomposed In-Context Learning of Text-to-SQL with Self-Correction (2023) - https://openreview.net/forum?id=p53QDxSIc5
- DAIL-SQL: prompting engineering methodology comparison for Text-to-SQL (2023/2024)
- MAC-SQL: A Multi-Agent Collaborative Framework for Text-to-SQL (2023/2024, COLING 2025) - https://arxiv.org/abs/2312.11242
- MAG-SQL: Multi-Agent Generative Approach with Soft Schema Linking and Iterative Sub-SQL Refinement (2024) - https://arxiv.org/pdf/2408.07930
- MCS-SQL: Leveraging Multiple Prompts and Multiple-Choice Selection for Text-to-SQL (2024) - https://arxiv.org/pdf/2405.07467
- Decomposition for Enhancing Attention: Improving LLM-based Text-to-SQL through Workflow Paradigm (2024) - https://arxiv.org/html/2402.10671v1
- Multi-Turn Interactions for Text-to-SQL with LLMs (2024) - https://arxiv.org/pdf/2408.11062
- Tool-Assisted Agent on SQL Inspection and Refinement in Real-World Scenarios (2024) - https://arxiv.org/pdf/2408.16991
- Cooperative SQL Generation for Segmented Databases by Using Multi-functional LLM Agents (2024) - https://arxiv.org/pdf/2412.05850
- SQLFixAgent: Towards Semantic-Accurate Text-to-SQL Parsing via Consistency-Enhanced Multi-Agent Collaboration (2024) - https://arxiv.org/pdf/2406.13408
- AGENTIQL: An Agent-Inspired Multi-Expert Framework for Text-to-SQL Generation (2025) - https://arxiv.org/pdf/2510.10661
- SDE-SQL: Enhancing Text-to-SQL via Self-Driven Exploration with SQL Probes (2025) - https://arxiv.org/pdf/2506.07245
- LitE-SQL: Lightweight and Efficient Text-to-SQL Framework (2025) - https://arxiv.org/pdf/2510.09014
- X-SQL: Expert Schema Linking and Understanding of Text-to-SQL with Multi-LLMs (2025) - https://arxiv.org/pdf/2509.05899
- DCMM-SQL: Automated Data-Centric Pipeline and Multi-Model Collaboration Training for Text-to-SQL (2025) - https://arxiv.org/pdf/2510.23284
- PV-SQL: Synergizing Database Probing and Rule-based Verification for Text-to-SQL Agents (2026) - https://arxiv.org/pdf/2604.17653
- RoboPhD: Self-Improving Text-to-SQL Through Autonomous Agent Evolution (2026) - https://arxiv.org/pdf/2601.01126
- MARS-SQL: A multi-agent reinforcement learning framework for Text-to-SQL (2025) - https://arxiv.org/pdf/2511.01008
- Every Step Counts: Step-Level Credit Assignment for Tool-Integrated Text-to-SQL (2026) - https://arxiv.org/pdf/2605.04719
- Both Ends Count! Just How Good are LLM Agents at "Text-to-Big SQL"? (2026) - https://arxiv.org/pdf/2602.21480
- Beyond Static Pipelines: Learning Dynamic Workflows for Text-to-SQL (2026) - https://arxiv.org/pdf/2602.15564
- A Survey on Employing Large Language Models for Text-to-SQL Tasks (2024) - https://arxiv.org/pdf/2407.15186
- Next-Generation Database Interfaces: A Survey of LLM-based Text-to-SQL (2024) - https://arxiv.org/pdf/2406.08426
- Spider 1.0 text-to-SQL benchmark (Yale, 2018) — 크로스 도메인 SQL 벤치마크의 기준점
- BIRD text-to-SQL benchmark — 실세계 데이터 값/도메인 지식 반영 벤치마크

### 범용 에이전트 원형 / 추론+행동 루프
- ReAct: Synergizing Reasoning and Acting in Language Models (2022) - https://arxiv.org/abs/2210.03629
- Reflexion: Language Agents with Verbal Reinforcement Learning (2023)
- Tree of Thoughts: Deliberate Problem Solving with Large Language Models (2023) - https://proceedings.neurips.cc/paper_files/paper/2023/file/271db9922b8d1f4dd7aaef84ed5ac703-Paper-Conference.pdf
- HuggingGPT: Solving AI Tasks with ChatGPT and its Friends in HuggingFace (2023) - https://huggingface.co/papers/2303.17580
- AutoGPT (오픈소스 자율 에이전트 proof-of-concept) (2023)
- MetaGPT: Meta Programming for A Multi-Agent Collaborative Framework (2023) - https://arxiv.org/pdf/2308.00352
- CAMEL: Communicative Agents for "Mind" Exploration of Large Language Model Society (2023)
- ReWOO: decoupling planning from execution to reduce interaction overhead (2023)
- ART: Automatic Reasoning and Tool-use (2023)
- Chameleon: Plug-and-Play Compositional Reasoning with Large Language Models (2023)
- Meta-Prompting: Enhancing Language Models with Task-Agnostic Scaffolding (2024) - https://arxiv.org/pdf/2401.12954
- Igniting Language Intelligence: The Hitchhiker's Guide From Chain-of-Thought Reasoning to Language Agents (2023) - https://arxiv.org/pdf/2311.11797
- Large Language Model based Multi-Agents: A Survey of Progress and Challenges (2024) - https://arxiv.org/pdf/2402.01680
- From Agent Loops to Deterministic Graphs: Execution Lineage for Reproducible AI-Native Work (2026) - https://arxiv.org/pdf/2605.06365
- LLM Powered Autonomous Agents (Lilian Weng 블로그 서베이, 2023) - https://lilianweng.github.io/posts/2023-06-23-agent/
- Awesome-Agent-Harness (110+ 논문/23개 시스템 정리 큐레이션) - https://github.com/Gloriaameng/Awesome-Agent-Harness
- Awesome Foundation Agents (큐레이션 리스트) - https://github.com/FoundationAgents/awesome-foundation-agents

### 도구/함수 호출(Function Calling) 자체에 대한 연구
- Toolformer: Language Models Can Teach Themselves to Use Tools (2023)
- Gorilla: Large Language Model Connected with Massive APIs (2023) - https://github.com/ShishirPatil/gorilla
- ToolLLM: Facilitating Large Language Models to Master 16000+ Real-world APIs (2023) - https://arxiv.org/pdf/2307.16789
- ToolACE: Winning the Points of LLM Function Calling (2024) - https://arxiv.org/html/2409.00920v1
- Executable Code Actions Elicit Better LLM Agents (CodeAct) (2024, ICML) - https://arxiv.org/abs/2402.01030
- MLLM-Tool: A Multimodal Large Language Model For Tool Agent Learning (2024) - https://arxiv.org/pdf/2401.10727
- TOOLVERIFIER: Generalization to New Tools via Self-Verification (2024) - https://arxiv.org/pdf/2402.14158
- PLAY2PROMPT: Zero-shot Tool Instruction Optimization for LLM Agents via Tool Play (2025) - https://arxiv.org/pdf/2503.14432
- Agentic Tool Use in Large Language Models: A Survey (2026) - https://arxiv.org/pdf/2604.00835
- LLM-Tool-Survey (Qu et al., Tool Learning survey, 2024) - https://github.com/quchangle1/LLM-Tool-Survey
- LLM-Based Agents for Tool Learning: A Survey (Data Science and Engineering, Springer, 2025) - https://link.springer.com/article/10.1007/s41019-025-00296-9
- awesome-tool-llm (큐레이션 리스트) - https://github.com/zorazrw/awesome-tool-llm
- AgentDojo (도구 사용 에이전트 보안/평가 벤치마크) (2024) - https://dl.acm.org/doi/10.5555/3737916.3740552
- Generative AI Toolkit: a framework for increasing the quality of LLM-based applications over their whole life cycle (2024) - https://arxiv.org/pdf/2412.14215

### 에이전트 평가/신뢰성 서베이
- A Survey on Evaluation of LLM-based Agents (2025) - https://arxiv.org/html/2503.16416v2
- Evaluation and Benchmarking of LLM Agents: A Survey (2025, KDD) - https://arxiv.org/html/2507.21504v1
- Survey of Emerging Trends in LLM Agent Benchmarking (2025) - https://dl.acm.org/doi/10.1145/3784013.3784018
- A Survey of LLM-Based Agents (CoLing 2025) - https://github.com/xinzhel/LLM-Agent-Survey
- A Survey on Large Language Models for Code Generation (2024) - https://arxiv.org/pdf/2406.00515
- The Reliability Gap: Agent Benchmarks for Enterprise (2025, 블로그) - https://simmering.dev/blog/agent-benchmarks/

### 상용 시스템 (참고 사례)
- ChatGPT Code Interpreter / Advanced Data Analysis (OpenAI, 2023~) — 코드 실행 샌드박스 기반 상용 데이터 분석 어시스턴트의 대표 사례
- OpenAI Function Calling / Tools API 공식 문서 — https://developers.openai.com/api/docs/guides/function-calling
