# 대화형 BI / 자연어 기반 데이터 시각화 및 인사이트 생성 시스템 (Related Work)

## 1. 개요

"내 데이터를 아는 AI 비서"는 시계열 데이터를 집계한 요약 JSON(`period`, `count`, `metrics`, `trend`)을 시스템 프롬프트에 넣고, LLM이 이를 바탕으로 자연어로 답하는 구조를 취하고 있다. 이는 학계·업계에서 "대화형 BI(Conversational BI)" 또는 "자연어 인터페이스(NLI, Natural Language Interface)"라 불리는 훨씬 큰 연구 분야의 한 조각에 해당한다. 이 분야는 크게 두 갈래로 발전해왔다. 하나는 2000년대~2010년대 중반의 고전적 NLIDB(Natural Language Interface to Databases)·시각화 추천 시스템 계열로, DataTone, FlowSense, Voyager처럼 규칙·문법·통계적 랭킹에 기반해 자연어를 시각화 명세로 변환하고 모호성을 명시적으로 다뤘다. 다른 하나는 2023년 이후 LLM이 촉발한 물결로, Chat2VIS·LIDA·Data Formulator·ChartGPT처럼 LLM에게 "자연어 → 실행 가능한 시각화 코드/명세"를 통째로 맡기거나, 최소한 파이프라인의 여러 단계(의도 파싱, 차트 타입 선택, 데이터 변환)에 깊이 개입시키는 방식이다.

우리 프로젝트의 `POST /api/chat`은 이 스펙트럼에서 "가장 텍스트에 가까운 지점"에 위치한다. 즉 파이프라인의 "시각적 매핑(visual mapping)"과 "렌더링(rendering)" 단계가 아예 존재하지 않고, LLM은 이미 계산된 숫자 요약을 자연어 문장으로 재서술하는 역할만 한다. 이는 안전하고 구현이 단순하다는 장점이 있지만, 동시에 이 분야 연구가 지적하는 핵심 가치—"사용자가 차트를 보며 패턴을 직접 발견하게 한다", "모호한 질문의 해석을 사용자가 확인/수정할 수 있게 한다", "차트 위에서 반복적으로 다듬는(refine) 대화가 가능하게 한다"—를 아직 구현하지 못하고 있다는 뜻이기도 하다.

이 문서는 (1) 이 분야의 연구 지형을 폭넓게 스캔하고, (2) LLM이 파이프라인의 어느 단계에 개입하는지를 기준으로 대표 시스템 8개를 심층 비교하며, (3) LLM 기반 시각화 생성이 실제로 겪는 정량적 실패 양상을 정리하고, (4) 보너스 과제로 고려 중인 "시각화 1개 추가"에 이 연구들이 어떤 구체적 시사점을 주는지—특히 프레임워크 없는 바닐라 JS 환경이라는 제약 하에서—를 제안한다.

## 2. 조사 규모/트렌드

WebSearch를 통해 약 15개의 서로 다른 질의(대화형 BI 서베이, NL2VIS 생성, 차트 추천, NLIDB/text-to-SQL, 벤치마크, 인사이트 생성, 에이전트형 데이터 분석, 산업계 NLQ 도구, 컴패니언 서베이 등)로 수집한 결과, 논문·시스템·서베이·벤치마크·업계 도구를 합쳐 **약 100편**의 제목을 목록화했다 (§6 참고문헌 참조). 눈에 띄는 트렌드는 다음과 같다.

- **패러다임 전환의 분기점은 2023년**: Chat2VIS(2302.02094), LIDA(2303.02927), Data Formulator(2309.10094), ChartGPT/ChartLlama 등 "LLM에게 시각화 코드/명세 생성을 통째로 맡기는" 시스템이 2023년에 집중적으로 등장했다. 그 이전(DataTone 2015, FlowSense 2019, Voyager 2015/2017, NL4DV 2020, nvBench 2021)은 규칙·문법·소규모 신경망 기반이었다.
- **2024~2025년은 "검증과 한계 규명"의 시기**: VisEval(2024), DracoGPT(2024), ChartQAPro(2025), "Losing the Plot"(2025) 등 LLM 기반 시각화 생성의 실패 양상을 정량적으로 벤치마킹하는 논문이 급증했다. 이는 생성 자체보다 "생성된 결과를 신뢰할 수 있는가"로 연구의 무게중심이 이동했음을 보여준다.
- **에이전트화(Agentic) 경향**: PlotGen(2025, 멀티에이전트+시각 피드백), nvAgent(2025, 협업 에이전트), CoDA(2025), Data Formulator의 "에이전트 모드"(2025)처럼 단일 LLM 호출이 아니라 계획-생성-검증-수정을 반복하는 다단계/멀티에이전트 구조가 표준이 되고 있다.
- **텍스트-only 대화형 인사이트 생성이 별도 하위분야로 성장**: MDSF, DataNarrative, KAHAN, QUIS, "Hybrid LLM/Rule-based Approaches to Business Insights Generation" 등은 정확히 우리 프로젝트처럼 "요약/서사 텍스트만 생성"하는 접근을 다루며, 최근 1~2년 사이 급증했다.
- **산업계는 이미 상용화, 학계는 사후 분석**: Tableau Ask Data(2019), Power BI Q&A(2019), Amazon QuickSight Q(2021), ThoughtSpot Sage 등은 이미 자연어 질의→차트 자동 생성을 제품화했고, 학계 논문들은 이런 상용 시스템의 설계 원리를 사후적으로 분석하거나 벤치마킹하는 경향을 보인다.
- **평가 방법론 자체가 연구 주제화**: nvBench → VisEval → Dial-NVBench로 이어지는 벤치마크 계보, 그리고 ChartQA → ChartQAPro → Chart-R1로 이어지는 "차트 이해" 벤치마크 계보가 각각 독립적으로 발전하며 성숙해지고 있다.

## 3. 대표 논문/시스템 심층 비교 (8편)

아래 8개는 "자연어 질문 → (의도 파싱 → 차트 타입 선택 → 데이터 매핑 → 렌더링)" 파이프라인에서 LLM이 개입하는 위치와 방식이 서로 다른 대표 사례로 선정했다.

### 3.1 Chat2VIS
- **제목/저자/연도/링크**: *Chat2VIS: Generating Data Visualisations via Natural Language using ChatGPT, Codex and GPT-3 Large Language Models*, Paula Maddigan & Teo Susnjak (2023, IEEE Access) — https://arxiv.org/abs/2302.02094
- **핵심 아이디어**: 자연어 인터페이스 구축의 전통적 난제(모호하고 불완전한 질의 해석)를 별도 NLP 파서 없이 LLM 프롬프트 엔지니어링만으로 해결. GPT-3/Codex/ChatGPT를 비교.
- **파이프라인 구조**: 의도 파싱 → 차트 타입 선택 → 데이터 매핑의 세 단계가 사실상 **단일 LLM 호출**로 붕괴되어 있다. 데이터 스키마와 몇 개의 예시를 포함한 프롬프트를 LLM에 주면, matplotlib/seaborn/plotly 코드를 통째로 반환하고 그 코드를 그대로 실행해 렌더링한다. 별도의 검증/보정 단계는 없다. 사용자가 "다른 차트 타입으로", "색깔 바꿔줘" 같은 후속 발화로 반복 수정 가능.
- **비교/시사점**: 우리 프로젝트와 가장 가까운 대조군이다. 우리는 LLM이 "텍스트"만 생성하지만 Chat2VIS는 LLM이 "실행 가능한 시각화 코드"까지 생성한다 — 딱 한 단계 더 나아간 것. 다만 검증 단계 부재로 인한 실패율은 뒤에 나올 VisEval에서 정량적으로 드러난다(§4).

### 3.2 LIDA
- **제목/저자/연도/링크**: *LIDA: A Tool for Automatic Generation of Grammar-Agnostic Visualizations and Infographics using Large Language Models*, Victor Dibia (2023, ACL Demo, Microsoft Research) — https://arxiv.org/abs/2303.02927 / https://github.com/microsoft/lida
- **핵심 아이디어**: 시각화 생성을 4개 모듈의 다단계 파이프라인으로 명시적으로 분해. 특정 시각화 문법(matplotlib/seaborn/altair/d3 등)에 종속되지 않음("grammar-agnostic").
- **파이프라인 구조** (LLM 개입 지점을 명시):
  1. **SUMMARIZER**: 먼저 pandas로 규칙 기반 통계(컬럼 타입, 분포, 샘플값)를 추출하고, 그 다음 **LLM(또는 사용자)이 이를 자연어 의미 설명으로 보강**한다. (데이터 이해 단계, LLM은 "보강"에만 개입)
  2. **GOAL EXPLORER**: 사용자가 질문을 하지 않아도 **LLM이 데이터 요약을 보고 스스로 여러 개의 "탐색 목표"(질문+차트+근거)를 JSON으로 생성**한다.
  3. **VISGENERATOR**: 코드 스캐폴딩 구성 → **LLM이 실제 시각화 코드를 작성** → 결정론적 코드 실행/렌더링 → 오류 발생 시 **LLM 기반 리페어 루프** → 필터링·평가.
  4. **INFOGRAPHER**: 이미지 생성 모델(IGM)로 스타일이 입혀진 인포그래픽 생성 (렌더링 이후 단계, 코드가 아닌 이미지 생성 모델 사용).
  즉 "의도 파싱→차트 선택→데이터 매핑"의 거의 모든 단계에 LLM이 관여하되, **실행과 렌더링만은 결정론적 코드**가 담당한다.
- **비교/시사점**: 우리의 `GET /api/data/summary`는 이미 LIDA의 SUMMARIZER와 유사한 역할(집계 요약)을 수행 중이다. 반면 LIDA의 GOAL EXPLORER처럼 "사용자가 묻지 않아도 시스템이 먼저 흥미로운 관찰을 제안"하는 기능은 우리 챗봇에는 없다 — 확장 시 참고할 만한 지점.

### 3.3 Data Formulator
- **제목/저자/연도/링크**: *Data Formulator: AI-powered Concept-driven Visualization Authoring*, Chenglong Wang, John Thompson, Bongshin Lee (2023, IEEE VIS, Best Paper Honorable Mention; 2025년 "에이전트 모드" 확장) — https://arxiv.org/abs/2309.10094 (Microsoft Research)
- **핵심 아이디어**: "concept binding" 패러다임 — 시각화 의도(고수준: 무엇을 보고 싶은가)와 데이터 변환(저수준: 어떻게 데이터를 가공할 것인가)을 분리. 사용자는 자연어/예시로 새로운 "개념"(예: "분기별 성장률")을 정의하고, 이를 시각적 채널(x/y/색상/크기)에 직접 바인딩한다.
- **파이프라인 구조**: 사용자가 자연어로 새 개념 정의 → 채널에 바인딩(직접 조작 UI) → **LLM이 그 개념을 실제로 만들어내는 데이터 변환 코드를 생성·실행** → 변환된 표와 시각화를 동시에 제시하여 사용자가 검증. 2025년 에이전트 모드에서는 고수준 설명만 주면 에이전트가 계획-변환-정제-시각화를 자동 반복한다. LLM은 "데이터 변환" 단계에 집중적으로 개입하고, 차트 자체의 렌더링은 별도 시각화 라이브러리가 담당한다.
- **비교/시사점**: 우리 시스템은 사용자가 데이터 "개념"을 새로 만들 수 없고 고정된 summary 필드(total/average/max/min/trend)만 다룬다. Data Formulator는 사용자가 자연어로 "전월 대비 증감률" 같은 파생 지표를 즉석에서 정의하게 하는 확장 방향을 보여준다.

### 3.4 Draco & DracoGPT
- **제목/저자/연도/링크**: *Draco: Formalizing Visualization Design Knowledge as Constraints*, Moritz et al. (2018, IEEE TVCG) — https://idl.uw.edu/draco ; *DracoGPT: Extracting Visualization Design Preferences from Large Language Models*, Wang, Gordon, Battle, Heer (2024, IEEE VIS) — https://arxiv.org/abs/2408.06845
- **핵심 아이디어**: Draco는 ~230개의 hard/soft 제약(Answer Set Programming, Clingo 솔버)으로 "좋은 시각화 설계 원칙"을 형식화한 순수 규칙 기반 지식베이스(LLM 없음). DracoGPT는 이 지식베이스를 "잣대(ruler)"로 삼아 LLM의 시각화 설계 선호가 실제 인간 지각 연구 결과와 얼마나 일치하는지를 정량 측정한다.
- **파이프라인 구조 (DracoGPT)**: 두 개의 인코딩 후보(예: 막대 vs. 선 그래프)를 LLM에 쌍으로 제시 → "더 나은 디자인을 고르라"(Rank) 또는 "부분 스펙을 완성하라"(Recommend) 요청 → 응답을 Draco의 논리적 사실(fact)/제약 만족 벡터로 변환 → RankSVM으로 LLM이 실제로 어떤 soft-constraint에 얼마의 가중치를 두는지 역산.
- **핵심 발견**: GPT4-Turbo는 "값 비교(value)" 과제에서는 인간 실험 결과와 어느 정도 일치(r=0.69)했지만, "요약(summary/집계)" 과제에서는 상관이 거의 없거나 음의 상관(r=-0.18)을 보였다. 크기(size) 인코딩 선호는 인간 연구와 **반대 방향**이었고, facet(다중 뷰) 차트는 순위 매길 때는 선호하면서 실제 추천 생성 시엔 거의 쓰지 않는 모순을 보였다. GPT-3.5는 제시 순서를 바꾸면 72.48%가 응답이 뒤집혔고, GPT4-Turbo도 23.09%가 불일치했다.
- **비교/시사점**: "차트 타입 선택을 LLM에게 그냥 물어보면 되지 않나"라는 안일한 접근에 대한 강력한 반증이다. 특히 **집계·요약 성격의 시각화**(우리 프로젝트의 summary가 정확히 이 범주)에서 LLM의 디자인 선호는 신뢰도가 가장 낮은 영역으로 확인되었다. 규칙 기반 fallback(Draco류)이 병행되어야 함을 시사.

### 3.5 VisEval
- **제목/저자/연도/링크**: *VisEval: A Benchmark for Data Visualization in the Era of Large Language Models*, Nan Chen, Yuge Zhang, Jiahang Xu, Kan Ren, Yuqing Yang (2024/2025, IEEE TVCG, Microsoft) — https://arxiv.org/abs/2407.00981 / https://github.com/microsoft/VisEval
- **핵심 아이디어**: LLM이 생성한 NL2VIS 결과를 **validity(코드 실행 가능 여부)·legality(질의 요구사항 준수 여부)·readability(가독성)**의 3축으로 완전 자동 채점하는 벤치마크. nvBench를 재가공해 2,524개 질의-시각화 쌍, 146개 데이터베이스로 구성.
- **평가 방법**: validity는 코드를 샌드박스에서 실행해 렌더링 여부 확인, legality는 생성된 SVG를 역분석(deconstruction)해 차트 타입/데이터/정렬 순서를 추출한 뒤 정답 메타정보와 비교, readability는 레이아웃 오버플로/겹침 검사, 축·눈금 검증, GPT-4V의 1~5점 평가(사람 평가와 스피어만 상관 0.843으로 검증됨)를 종합한다.
- **구체적 실패 사례**: `barplot()`에 잘못된 위치 인자 전달, 존재하지 않는 데이터 컬럼 참조(할루시네이션), 중복 행 미제거로 인한 이중 집계, `sum` 대신 `count` 사용, 지정된 컬럼("Location") 대신 값(sum) 기준 정렬, 연도가 소수점 형태로 표시, 제목/텍스트가 캔버스 밖으로 넘침, y축이 관례와 반대로 뒤집힘.
- **정량 결과 (matplotlib 기준)**: GPT-4 — Invalid 3.29% / Illegal 21.44% / 최종 Pass 75.27% / 품질점수 2.89; GPT-3.5 — Pass 61.79%; Gemini-Pro — Pass 51.59%; CodeLlama-7B — Pass 28.17%. Seaborn 라이브러리를 쓰면 전 모델에서 성능이 더 나빠졌다(GPT-4도 58.70%로 하락).
- **비교/시사점**: 우리가 "차트 자동 생성"을 그대로 LLM에게 맡기면 최상급 모델(GPT-4)조차 4개 중 1개꼴로 실패한다는 뜻이다. 렌더링을 결정론적 라이브러리(Chart.js 등)로 고정하고 LLM에는 좁은 역할(필드→채널 매핑 결정)만 맡기는 것이 훨씬 안전함을 뒷받침하는 가장 직접적인 근거.

### 3.6 DataTone (LLM 이전 시대의 대조군)
- **제목/저자/연도/링크**: *DataTone: Managing Ambiguity in Natural Language Interfaces for Data Visualization*, Tong Gao, Mira Dontcheva, Eytan Adar, Zhicheng Liu, Karrie Karahalios (2015, ACM UIST) — https://www.cond.org/datatone.html / https://dl.acm.org/doi/10.1145/2807442.2807478
- **핵심 아이디어**: LLM 없이도 자연어 질의의 모호성(컬럼명 매칭, 집계 방식, 차트 유형 등)을 명시적으로 모델링하고, 사용자가 그 모호성을 직접 확인·수정할 수 있게 하는 "혼합주도(mixed-initiative)" 설계 철학.
- **파이프라인 구조**: 규칙/문법 기반 파서가 질의를 구조화 → 각 슬롯(컬럼, 집계 함수, 필터, 차트 유형)마다 후보와 신뢰도를 계산 → 신뢰도가 낮은 슬롯만 **"모호성 위젯"**(예: "revenue"가 어느 컬럼을 의미하는지 고르는 드롭다운)으로 사용자에게 노출 → 사용자의 선택은 제약으로 저장되어 이후 질의 해석에도 계속 반영됨.
- **비교/시사점**: 지금의 LLM 시대에도 여전히 유효한 설계 철학이다. 우리 챗봇은 질문이 모호해도(예: "최근 실적 어때?"에서 "최근"의 기간이 불명확) LLM이 임의로 해석해 텍스트로만 답하고, 사용자는 그 해석이 맞는지 확인할 방법이 없다. DataTone식 "이 기간으로 해석했습니다" 확인 위젯은 신뢰성 개선에 직접 참고할 수 있다.

### 3.7 Shen et al. 서베이 — "Towards Natural Language Interfaces for Data Visualization: A Survey"
- **제목/저자/연도/링크**: Leixian Shen, Enya Shen, Yuyu Luo 외 (2021 arXiv / 2022 IEEE TVCG) — https://arxiv.org/abs/2109.03506
- **핵심 아이디어**: 55개의 V-NLI(Visualization-oriented Natural Language Interface) 시스템을 조사하여, 고전적 시각화 파이프라인을 확장한 **7단계 프레임워크**로 체계적으로 분류: ① 질의 해석(query interpretation) → ② 데이터 변환(data transformation) → ③ 시각적 매핑(visual mapping) → ④ 뷰 변환(view transformation) → ⑤ 인간 상호작용(human interaction) → ⑥ 대화 관리(dialogue management) → ⑦ 표현(presentation).
- **파이프라인/시사점**: 이 프레임워크가 특히 유용한 이유는 **"대화 관리"를 파이프라인의 정식 단계로 명시**했다는 점이다 — 멀티턴 대화에서 "그럼 작년은?" 같은 후속 질문이 이전 맥락(어떤 컬럼, 어떤 기간, 어떤 차트)을 유지해야 함을 별도 단계로 취급한다. 서베이는 또한 개방형 시각화 질의는 정답이 여러 개일 수 있어 평가 방법론 자체가 어렵다는 점도 지적한다.
- **비교/시사점**: 이 7단계 프레임워크에 우리 프로젝트를 대입하면, 우리는 사실상 "①질의 해석"(LLM이 질문을 이해)과 "⑦표현"(자연어 문장 생성)만 있고, ②~④(데이터 변환→시각적 매핑→뷰 변환)이 통째로 빠져 있다는 것이 명확히 드러난다. 즉 우리 챗봇은 V-NLI라기보다는 "숫자 요약의 언어화(NLG for a fixed summary)"에 가깝다 — 향후 확장이 정확히 어느 단계부터 필요한지 이 프레임워크가 좌표를 제공한다.

### 3.8 "Data Has Entered the Chat" — 대화형 GenAI 에이전트의 실사용 연구
- **제목/저자/연도/링크**: *Data Has Entered the Chat: How Data Workers Conduct Exploratory Visual Analytic Conversations with GenAI Agents* (2025, ACM Transactions on Interactive Intelligent Systems) — https://dl.acm.org/doi/10.1145/3744750 (관련 선행 연구: *Conversational AI Threads for Visualizing Multidimensional Datasets*, 2023, https://arxiv.org/abs/2311.05590)
- **핵심 아이디어**: 이론적 시스템 제안이 아니라, 코드 생성 능력을 가진 GenAI 에이전트를 "기술 프로브(technology probe)"로 배치해 총 50명의 데이터 실무자가 실제로 어떻게 대화하며 탐색적 시각 분석(EVA)을 수행하는지를 관찰한 실증 연구. 502개의 발화-응답 쌍을 주석화하여 공개.
- **파이프라인/구조 관찰**: 사용자의 발화를 4개 상태(분석 과제(Analytic Tasks), 편집 조작(Editing Operations), 정교화/보강(Elaborations and Enrichments), 지시형 명령(Directive Commands))로, 에이전트의 응답을 2개 상태(**시각화**, **텍스트**)로 분류한 상태 전이 다이어그램을 도출했다. 그리고 이 상태들 사이의 흐름을 "분석 정교화(analysis elaboration)", "정제(refinement)", "설명(explanation)"의 세 순환 루프로 정리했다.
- **비교/시사점**: 이 연구가 우리 프로젝트에 주는 시사점이 가장 직접적이다 — 실사용자는 시각화 응답과 텍스트 응답을 **서로 다른 목적**으로 오간다. 특히 "정제(refinement)" 루프(차트를 보며 "그 부분만 확대해서", "색을 다르게" 식으로 반복 조정하는 과정)는 응답이 텍스트만으로 주어지면 성립 자체가 불가능하다. 즉 우리처럼 텍스트 전용 응답만 제공하는 구조는 이 연구가 관찰한 사용자 행동 패턴의 상당 부분(정제 루프)을 원천적으로 지원하지 못한다는 실증적 근거를 준다.

## 4. 알려진 한계

이 분야의 연구들이 공통적으로 지적하는 한계는 다음과 같다.

- **잘못된 차트 타입/인코딩 선택**: DracoGPT가 보여주듯 LLM의 시각화 설계 선호는 특히 "요약/집계" 과제에서 인간 지각 연구 결과와 크게 어긋난다(상관 -0.18까지 하락). 크기(size) 인코딩처럼 아예 반대 방향으로 선호하는 경우도 있다.
- **축/스케일/정렬 오류**: VisEval이 정량화한 바와 같이, 연도가 소수점으로 표시되거나(예: 2023.5), y축이 관례와 반대로 뒤집히거나, 사용자가 지정한 컬럼 대신 값(합계) 기준으로 잘못 정렬하는 등의 오류가 최상급 모델(GPT-4)에서도 21% 이상 발생한다.
- **데이터 매핑/할루시네이션 오류**: 존재하지 않는 컬럼을 참조하거나, 중복 행을 제거하지 않아 이중 집계가 발생하거나, `sum`을 요구했는데 `count`를 계산하는 등 데이터 자체를 잘못 다루는 오류가 빈번하다.
- **사용자 의도 오해와 모호성 처리 미흡**: 고전 시스템(DataTone)은 모호성을 명시적으로 모델링하고 사용자 확인을 거치도록 설계했지만, 현대 LLM 기반 시스템 상당수는 이 단계를 생략하고 "가장 그럴듯한 해석"으로 바로 진행 — 오해가 발생해도 사용자가 알아차리기 어렵다.
- **응답 일관성 부족**: DracoGPT 실험에서 같은 질문도 제시 순서를 바꾸면 GPT-3.5는 72%, GPT-4조차 23%가 답을 바꿨다. 이는 LLM 기반 시각화 추천이 결정론적이지 않고 재현성이 낮음을 의미한다.
- **평가 방법론 자체의 어려움**: Shen 서베이가 지적하듯 개방형 시각화 질의는 "정답"이 하나가 아닐 수 있어, 무엇을 "성공"으로 볼지 정의하는 것부터 난제다. VisEval처럼 다차원 자동 평가 프레임워크가 등장한 것도 이 어려움에 대한 대응이다.
- **텍스트-시각화 전환의 단절**: "Data Has Entered the Chat" 연구가 보여주듯, 텍스트 전용 응답으로는 사용자가 자연스럽게 요구하는 "차트를 보며 반복 조정하는" 정제 루프 자체가 성립하지 않는다.

## 5. 종합 시사점 — 우리 프로젝트에 시각화 1개를 추가한다면

우리 과제는 프레임워크 없는 바닐라 HTML/CSS/JS 프론트엔드이고, 백엔드는 이미 `GET /api/data/summary`에서 `period/count/metrics/trend`를 계산해두고 있다. 위 연구들을 종합하면 다음 4가지 접근을 제안한다.

1. **LLM은 "렌더링"이 아니라 "매핑 결정"에만 좁게 사용하고, 렌더링은 결정론적 라이브러리로 고정한다.** VisEval(§3.5)과 DracoGPT(§3.4)가 공통으로 보여주듯, LLM에게 시각화 코드/디자인 생성을 통째로 맡기면 GPT-4급 모델도 4개 중 1개꼴로 실패하고, 특히 집계 성격의 데이터(우리의 summary가 정확히 이 유형)에서 디자인 선호가 가장 신뢰할 수 없다. 따라서 Chart.js처럼 CDN 한 줄로 붙일 수 있는 결정론적 차트 라이브러리(또는 순수 `<canvas>`/SVG로 직접 그리는 sparkline)를 렌더링에 쓰고, "trend가 상승/하강이면 line chart, metrics 4종을 비교하면 bar chart"처럼 Draco류의 **간단한 if-else 규칙표**를 백엔드에 하드코딩해 차트 타입을 결정하는 편이, LLM에게 차트 코드를 생성시키는 것보다 훨씬 안전하고 바닐라 JS 제약에도 잘 맞는다.

2. **LIDA의 GOAL EXPLORER처럼, 요청 없이도 "주목할 관찰"을 함께 생성해 차트 옆에 캡션으로 붙인다.** 이미 존재하는 `/api/chat`의 LLM 호출을 재사용하여, summary를 넘길 때 "이번 달이 관측 기간 중 최고치입니다" 같은 한 줄 인사이트를 함께 요청하면, 별도의 대화 없이도 차트에 자동 하이라이트를 얹을 수 있다. 새 엔드포인트나 프레임워크 없이 프롬프트 한 줄 추가와 프론트 DOM 삽입만으로 구현 가능하다.

3. **DataTone식 "해석 확인" 칩(chip)을 텍스트 챗봇 응답에 붙인다.** "최근 실적 어때?"처럼 모호한 질문에 LLM이 특정 period(예: "최근 30일")로 해석했다면, 그 해석을 응답 텍스트 안에 구조화된 형태로 포함시키고(예: 응답 JSON에 `interpreted_period` 필드 추가), 프론트 JS가 이를 클릭 가능한 칩으로 렌더링해 사용자가 기간을 재확인/수정할 수 있게 한다. 이는 Shen 서베이(§3.7)가 지적한 "우리 시스템에는 데이터 변환→시각적 매핑 단계가 없다"는 공백을 메우는 가장 저비용의 첫걸음이다.

4. **"Data Has Entered the Chat"(§3.8)이 관찰한 정제(refinement) 루프를 미니멀하게 지원한다.** 채팅 응답 텍스트 안에 백엔드가 특정 마커(예: 응답에 `chartData` 필드를 함께 반환)를 포함시키고, 프론트 JS가 이를 감지해 채팅 말풍선 바로 아래에 인라인 미니 차트(예: 최근 N개 값의 sparkline)를 그리도록 하면, 별도 프레임워크나 대시보드 페이지 없이도 "텍스트 답변 → 그 자리에서 바로 시각적 확인"이라는 최소한의 정제 경험을 제공할 수 있다. 이는 보너스 요구사항인 "시각화 1개 추가"를 채팅 UX와 자연스럽게 결합하는 가장 구현 비용이 낮은 방식이다.

## 6. 참고문헌 목록

### 6.1 LLM 기반 NL2VIS / 시각화 생성 시스템
- Chat2VIS: Generating Data Visualisations via Natural Language using ChatGPT, Codex and GPT-3 Large Language Models (2023) - https://arxiv.org/abs/2302.02094
- LIDA: A Tool for Automatic Generation of Grammar-Agnostic Visualizations and Infographics using Large Language Models (2023) - https://arxiv.org/abs/2303.02927
- Data Formulator: AI-powered Concept-driven Visualization Authoring (2023) - https://arxiv.org/abs/2309.10094
- Data Formulator (에이전트 모드 확장 소개) (2025) - https://www.marktechpost.com/2025/02/14/microsoft-research-introduces-data-formulator-an-ai-application-that-leverages-llms-to-transform-data-and-create-rich-visualizations/
- ChartGPT: Leveraging LLMs to Generate Charts from Abstract Natural Language (2023/2024) - https://arxiv.org/html/2311.01920v2
- ChartLlama: A Multimodal LLM for Chart Understanding and Generation (2023) - https://arxiv.org/html/2311.16483
- ChartGen-Agent: A Three-Stage Framework for Automated High-Quality Chart Generation (2025) - https://link.springer.com/chapter/10.1007/978-981-95-3462-3_2
- Prompt4Vis: Prompting Large Language Models with Example Mining and Schema Filtering for Tabular Data Visualization (2024) - https://arxiv.org/pdf/2402.07909
- PlotGen: Multi-Agent LLM-based Scientific Data Visualization via Multimodal Feedback (2025) - (arXiv, 2411.xxxxx 계열; Prompt4Vis 인용 검색 결과 확인)
- VisPath: Automated Visualization Code Synthesis via Multi-Path Reasoning and Feedback-Driven Optimization (2025) - https://arxiv.org/html/2502.11140
- Text2Vis: A Challenging and Diverse Benchmark for Generating Visualizations from Text (2025) - https://arxiv.org/pdf/2507.19969
- MultiVis-Agent: A Multi-Agent Framework with Logic Rules for Reliable and Comprehensive Cross-Modal Data Visualization (2026) - https://arxiv.org/html/2601.18320v1
- Aligning Text, Code, and Vision: A Multi-Objective Reinforcement Learning Framework for Text-to-Visualization (2026) - https://arxiv.org/html/2601.04582v1
- ChatVis: Large Language Model Agent for Generating Scientific Visualizations (2025) - https://arxiv.org/pdf/2507.23096
- DataVisT5: A Pre-trained Language Model for Jointly Understanding Text and Data Visualization (2024) - https://arxiv.org/pdf/2408.07401
- nvAgent: Automated Data Visualization from Natural Language via Collaborative Agent Workflow (2025) - https://arxiv.org/pdf/2502.05036
- Automated Data Visualization from Natural Language via Large Language Models: An Exploratory Study (2024) - https://arxiv.org/pdf/2404.17136
- Text-to-TrajVis: Enabling Trajectory Data Visualizations from Natural Language Questions (2025) - https://arxiv.org/pdf/2504.16358
- ChartifyText: Automated Chart Generation from Data-Involved Texts via LLM (2024) - https://arxiv.org/html/2410.14331v1
- DeepVIS: Bridging Natural Language and Data Visualization Through Step-wise Reasoning (2025) - https://arxiv.org/abs/2508.01700
- Text-to-Viz: Automatic Generation of Infographics from Proportion-Related Natural Language Statements (2019) - https://www.researchgate.net/publication/335416283
- Talk Me Through It: Developing Effective Systems for Chart Authoring (2026) - https://arxiv.org/pdf/2601.14707
- CoDA: Agentic Systems for Collaborative Data Visualization (2025) - https://arxiv.org/html/2510.03194v1
- Debugging Defective Visualizations: Empirical Insights Informing a Human-AI Co-Debugging System (2024) - https://arxiv.org/pdf/2412.07673

### 6.2 고전(pre-LLM) NLIDB / 시각화 추천·자동생성 시스템
- Show Me: Automatic Presentation for Visual Analysis (Mackinlay, Hanrahan, Stolte, 2007, IEEE TVCG) - 참조: Voyager 논문들 내 인용
- Voyager: Exploratory Analysis via Faceted Browsing of Visualization Recommendations (2015) - https://idl.cs.washington.edu/files/2015-Voyager-InfoVis.pdf
- Voyager 2: Augmenting Visual Analysis with Partial View Specifications (2017) - https://dl.acm.org/doi/10.1145/3025453.3025768
- DataTone: Managing Ambiguity in Natural Language Interfaces for Data Visualization (2015) - https://www.cond.org/datatone.html
- FlowSense: A Natural Language Interface for Visual Data Exploration within a Dataflow System (2019) - https://arxiv.org/pdf/1908.00681
- NL4DV: A Toolkit for Generating Analytic Specifications for Data Visualization from Natural Language Queries (2020) - https://arxiv.org/pdf/2008.10723
- Lux: A Python API for Intelligent Visual Data Discovery (2020/2021) - https://lux-api.readthedocs.io/
- Lodestar: Supporting Independent Learning and Rapid Experimentation Through Data-Driven Analysis Recommendations (2022) - https://arxiv.org/pdf/2204.07876
- Draco: Formalizing Visualization Design Knowledge as Constraints (2018/2019) - https://idl.cs.washington.edu/files/2019-Draco-InfoVis.pdf
- Draco 2: An Extensible Platform to Model Visualization Design (2023) - https://arxiv.org/pdf/2308.14247
- Visual Analytics for Understanding Draco's Knowledge Base (2023) - https://arxiv.org/pdf/2307.12866
- DracoGPT: Extracting Visualization Design Preferences from Large Language Models (2024) - https://arxiv.org/abs/2408.06845
- MultiVision: Designing Analytical Dashboards with Deep Learning Based Recommendation (2021) - https://arxiv.org/abs/2107.07823
- Table2Charts: Recommending Charts by Learning Shared Table Representations (2021) - https://www.researchgate.net/publication/353908002
- ASTA: Learning Analytical Semantics over Tables for Intelligent Data Analysis and Visualization (2022) - https://arxiv.org/pdf/2208.01043
- HAIChart: Human and AI Paired Visualization System (2024, VLDB) - https://dl.acm.org/doi/10.14778/3681954.3681992
- Deconstructing Categorization in Visualization Recommendation: A Taxonomy and Comparative Study (2021) - https://arxiv.org/pdf/2102.07070
- A survey on automatic infographics and visualization recommendations (2020) - https://sciencedirect.com/science/article/pii/S2468502X20300292
- Machine Learning for Visualization Recommendation Systems: Open Challenges and Future Directions (2023) - https://arxiv.org/pdf/2302.00569
- Data visualization recommendation: Literature review and future perspectives (2026) - https://doi.org/10.1177/14738716251409351
- CrossData: Leveraging Text-Data Connections for Authoring Data Documents (2023) - https://arxiv.org/pdf/2310.11639

### 6.3 벤치마크 / 데이터셋
- nvBench: A Large-Scale Synthesized Dataset for Cross-Domain Natural Language to Visualization Task (2021) - https://arxiv.org/abs/2112.12926
- VisEval: A Benchmark for Data Visualization in the Era of Large Language Models (2024) - https://arxiv.org/abs/2407.00981
- Dial-NVBench (Marrying Dialogue Systems with Data Visualization 논문 내 데이터셋) (2024) - https://arxiv.org/pdf/2307.16013
- ChartQA: A Benchmark for Question Answering about Charts with Visual and Logical Reasoning (2022) - https://arxiv.org/abs/2203.10244
- ChartQAPro: A More Diverse and Challenging Benchmark for Chart Question Answering (2025) - https://arxiv.org/pdf/2504.05506
- Chart-R1: Chain-of-Thought Supervision and Reinforcement for Advanced Chart Reasoner (2025) - https://arxiv.org/pdf/2507.15509
- ChartLens: Fine-grained Visual Attribution in Charts (2025) - https://arxiv.org/pdf/2505.19360
- Charting the Future: Using Chart Question-Answering for Scalable Evaluation of LLM-Driven Data Visualizations (2024) - https://arxiv.org/pdf/2409.18764
- Charts-of-Thought: Enhancing LLM Visualization Literacy Through Structured Data Extraction (2025) - https://arxiv.org/pdf/2508.04842
- Chart Question Answering: State of the Art and Future Directions (2022) - https://arxiv.org/pdf/2205.03966
- Evaluating LLMs for Visualization Generation and Understanding (2025) - https://arxiv.org/html/2507.22890v1
- Losing the Plot: How VLM responses degrade on imperfect charts (2025) - https://arxiv.org/html/2509.18425
- SpreadsheetBench 2: Evaluating Agents on End-to-End Business Spreadsheet Workflows (2025/2026) - https://www.alphaxiv.org/abs/2606.29955

### 6.4 서베이/타당성 리뷰
- Towards Natural Language Interfaces for Data Visualization: A Survey (Shen et al., 2021/2022) - https://arxiv.org/abs/2109.03506
- A Survey on Natural Language Interaction in Visualization (2022, NAACL) - https://aclanthology.org/2022.naacl-main.27.pdf
- AI4VIS: Survey on Artificial Intelligence Approaches for Data Visualization (2021) - https://arxiv.org/pdf/2102.01330
- Natural Language Generation for Visualizations: State of the Art, Challenges and Future Directions (Hoque et al., 2025, Computer Graphics Forum) - https://onlinelibrary.wiley.com/doi/full/10.1111/cgf.15266
- Rethinking NL2VIS: A Comparative Survey of LLM-Based Natural-Language-to-Visualisation Frameworks (2025) - https://link.springer.com/chapter/10.1007/978-981-92-2014-4_12
- Natural Language Interfaces for Tabular Data Querying and Visualization: A Survey (2024) - https://www.researchgate.net/publication/380581799
- Human-Computer Interaction and Visualization in Natural Language Generation Models: Applications, Challenges, and Opportunities (2024) - https://arxiv.org/pdf/2410.08723
- A systematic review of natural language interfaces for databases (2025) - https://journal.hep.com.cn/fcs/EN/PDF/10.1007/s11704-025-50592-w
- Natural Language Interfaces for Databases: What Do Users Think? (2025) - https://arxiv.org/html/2511.14718v1
- A Survey on Large Language Model-based Agents for Statistics and Data Science (2024/2025) - https://arxiv.org/html/2412.14222v2

### 6.5 대화형/멀티턴 시스템
- Marrying Dialogue Systems with Data Visualization: Interactive Data Visualization Generation from Natural Language Conversations (CoVis, MMCoVisNet) (2024, KDD) - https://arxiv.org/pdf/2307.16013
- Talk2Data: A Natural Language Interface for Exploratory Visual Analysis via Question Decomposition (2021/2024) - https://arxiv.org/pdf/2107.14420
- Conversational AI Threads for Visualizing Multidimensional Datasets (2023) - https://arxiv.org/pdf/2311.05590
- Data Has Entered the Chat: How Data Workers Conduct Exploratory Visual Analytic Conversations with GenAI Agents (2025) - https://dl.acm.org/doi/10.1145/3744750
- On Chatbots for Visual Exploratory Data Analysis (2023/2024) - https://ieeexplore.ieee.org/document/10386335/
- A Multimodal Conversational Agent for Tabular Data Analysis (2025) - https://arxiv.org/pdf/2511.18405
- XNLI: Explaining and Diagnosing NLI-based Visual Data Analysis (2023) - https://arxiv.org/pdf/2301.10385
- Hey Dashboard!: Supporting Voice, Text, and Pointing Modalities in Dashboard Onboarding (2025) - https://arxiv.org/pdf/2510.12386
- Embodied Natural Language Interaction (NLI): Speech Input Patterns in Immersive Analytics (2025) - https://arxiv.org/pdf/2510.12156
- A Comparative Evaluation of Natural Language and Dashboard Interfaces (2026) - https://cs.uwaterloo.ca/~dvogel/gi2026/papers/1054b.pdf

### 6.6 대시보드 생성 / 산업계 시스템 분석
- NL2Dashboard: A Lightweight and Controllable Framework for Generating Dashboards with LLMs (2026) - https://arxiv.org/html/2601.06126
- DashChat: Interactive Authoring of Industrial Dashboard Design Prototypes through Conversation with LLM-Powered Agents (2025) - https://arxiv.org/abs/2504.12865
- Conversational BI: Natural Language Interface to Business Dashboards (IJERT) - https://www.ijert.org/conversational-bi-natural-language-interface-to-business-dashboards
- Amazon QuickSight Q: Natural Language for Business Intelligence (AWS blog) (2021) - https://aws.amazon.com/blogs/aws/amazon-quicksight-q-to-answer-ad-hoc-business-questions/
- Helping People Ask Data Questions (Tableau Ask Data 소개) (2019) - https://www.tableau.com/blog/helping-people-ask-data-questions
- Tableau Metrics and Natural Language Query Evolve with Tableau Pulse - https://www.tableau.com/blog/tableau-metrics-and-natural-language-query-evolve-tableau-pulse
- Semantic Layers for Reliable LLM-Powered Data Analytics: A Paired Benchmark of Accuracy and Hallucination Across Three Frontier Models (2026) - https://arxiv.org/pdf/2604.25149
- LLM and Agent-Driven Data Analysis: A Systematic Approach for Enterprise Applications and System-level Deployment (2025) - https://arxiv.org/pdf/2511.17676

### 6.7 인사이트 생성 / 데이터 스토리텔링
- MDSF: Context-Aware Multi-Dimensional Data Storytelling Framework based on Large Language Model (2025) - https://arxiv.org/html/2501.01014
- Hybrid LLM/Rule-based Approaches to Business Insights Generation from Structured Data (2024) - https://arxiv.org/pdf/2404.15604
- An LLM-Based Approach for Insight Generation in Data Analysis (2025) - https://www.researchgate.net/publication/392505011
- Research on an Automated Data Insight Generation Method Based on Large Language Models (2025) - https://www.academia.edu/145355148
- KAHAN: Knowledge-Augmented Hierarchical Analysis and Narration for Financial Data Narration (2025) - https://arxiv.org/pdf/2509.17037
- DataNarrative: Automated Data-Driven Storytelling with Visualizations and Texts (2024, EMNLP) - https://aclanthology.org/2024.emnlp-main.1073/
- QUIS: Question-guided Insights Generation for Automated Exploratory Data Analysis (2024) - https://arxiv.org/pdf/2410.10270
- Semantically Aligned Question and Code Generation for Automated Insight Generation (2024) - https://arxiv.org/pdf/2405.01556
- Text2Insight: Transform natural language text into insights seamlessly using multi-model architecture (2024) - https://arxiv.org/pdf/2412.19718
- NLG in Finance / Natural Language Generation and AI in Financial Reporting (2024) - https://www.academia.edu/117016941

### 6.8 에이전트형 데이터 분석 / 스프레드시트 자동화
- SheetCopilot: Bringing Software Productivity to the Next Level through Large Language Models (2023, NeurIPS) - https://arxiv.org/abs/2305.19308
- Data Interpreter: An LLM Agent For Data Science (2025, ACL Findings) - https://aclanthology.org/2025.findings-acl.1016.pdf
- DatawiseAgent: A Notebook-Centric LLM Agent Framework for Automated Data Science (2025) - https://arxiv.org/html/2503.07044v1
- DA-Studio: An Agentic System for End-to-End Data Analysis (2026) - https://arxiv.org/pdf/2606.31423
- Augmented Analytics and Decision Quality: The Role of Trust among Non-Technical BI Users (2026) - https://arxiv.org/pdf/2605.20198

### 6.9 관련 참고/보조 자료 (업계 블로그·해설)
- What Is Conversational Analytics for Business Intelligence? - https://atlan.com/know/conversational-analytics/
- What is Conversational Analytics and How Does it Work? (ThoughtSpot) - https://www.thoughtspot.com/data-trends/analytics/conversational-analytics
- GitHub - zengxingchen/LLM-Visualization-Paper-List (Awesome list, Visualization x LLM) - https://github.com/zengxingchen/LLM-Visualization-Paper-List
- A Reading List on GenAI for Data Visualization (FILWD Substack) - https://filwd.substack.com/p/a-reading-list-on-genai-for-data
