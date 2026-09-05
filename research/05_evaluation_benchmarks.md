# 05. LLM 데이터 분석 시스템의 평가·벤치마크·신뢰성 연구

> 조사 대상: "내 데이터를 아는 AI 비서" 프로젝트의 README "관련 연구" 섹션 작성을 위한 사전 조사.
> 초점: 학계는 LLM 기반 데이터 분석/챗봇 시스템의 정확성·신뢰성을 어떤 방법론으로 평가하는가, 그리고 우리 시스템(수동 스모크 테스트 외에 자동화된 평가가 전무)이 그 기준에서 얼마나 부족한가.

---

## 1. 개요

우리 시스템은 Firestore에 쌓인 시계열 데이터를 `/api/data/summary`에서 집계한 뒤, 그 결과를 파이썬 f-string으로 만든 텍스트 템플릿에 그대로 끼워 넣어 LLM의 system prompt로 사용하고, 사용자 메시지와 함께 `/api/chat`을 통해 응답을 생성한다. 이 구조는 학계 문헌에서 "grounded/데이터 기반 QA" 또는 "structured-data-to-text 생성" 문제로 분류되는 정확히 그 범주에 속한다. 그런데 현재 검증 수단은 개발자가 몇 개 질문을 수동으로 던져보고 답변이 그럴듯한지 눈으로 확인하는 것뿐이며, 이는 학계 기준으로 보면 "평가가 전혀 없는" 상태에 가깝다.

지난 3~4년간 이 문제를 다루는 연구는 폭발적으로 늘었다. 크게 세 갈래로 나뉜다. (1) **데이터 분석/코드 실행 벤치마크** — DS-1000, InfiAgent-DABench, DA-Code, DSBench, TableBench처럼 "모델이 생성한 코드나 답을 실제로 실행/채점해서 정답과 비교"하는 방식으로 데이터 분석 능력 자체를 측정하는 연구들. (2) **환각(hallucination)·사실성(factuality) 측정 연구** — FActScore, SelfCheckGPT, HaluEval처럼 정답이 없는 개방형 생성물에서 "이 문장이 근거가 있는가"를 원자적으로 쪼개 검증하거나, 여러 번 샘플링한 응답의 일관성으로 환각을 추정하는 연구들. (3) **LLM-as-a-judge / RAG 평가 프레임워크** — G-Eval, RAGAS처럼 정답 라벨이 없는 상황에서 LLM 자신을 채점자로 써서 "충실성(faithfulness)", "관련성(relevancy)" 같은 축을 자동 채점하는 연구들.

세 갈래 모두 공통적으로 강조하는 원칙이 하나 있다: **"그럴듯해 보인다"는 사람의 주관적 인상은 평가로 인정하지 않는다.** 반드시 (a) 실행 가능한 정답과의 자동 비교, (b) 원자 단위로 분해한 사실 검증, (c) 명시적 채점 기준을 가진 LLM judge 중 하나를 통해 재현 가능한 점수를 낸다. 우리 시스템의 "몇 번 채팅해보고 확인" 수준은 이 세 갈래 중 어느 것도 충족하지 못하며, 특히 숫자를 다루는 시스템 특유의 실패(계산 오류, 없는 트렌드 지어내기, 추론형 모델의 토큰 예산 소진으로 인한 빈 답변)는 사람이 몇 번 눈으로 봐서는 체계적으로 잡히지 않는다는 것이 아래 조사에서 반복적으로 확인된다.

---

## 2. 조사 규모 및 트렌드

WebSearch로 12개 이상의 쿼리(데이터 분석 벤치마크, 에이전트 평가, hallucination survey, factuality survey, RAG 평가, LLM-as-judge, 수치 추론 벤치마크, text-to-SQL 평가, 코드 실행 벤치마크, 벤치마크 오염, 추론 모델 truncation, 금융 수치 환각 등)로 검색해 **약 175편의 논문/자료**를 제목+링크로 수집했다(전체 목록은 6장 참고문헌 참조). 이 중 8편을 선정해 초록/방법론까지 WebFetch로 읽어 심층 비교했다.

관찰되는 트렌드:

- **"정답 비교 가능한 벤치마크"에서 "실제 파이프라인 평가"로 이동**: 2022~2023년의 DS-1000이 단일 함수 코드 생성을 테스트했다면, 2024~2025년의 DA-Code, DSBench, KramaBench, DABstep, DSAgentBench는 "여러 파일을 읽고, 정제하고, 계산하고, 결론을 내는" 종단간(end-to-end) 파이프라인을 통째로 평가하는 방향으로 옮겨가고 있다. 이는 우리 시스템의 구조(요약 집계 → LLM 서술)와 정확히 같은 문제의식이다.
- **테이블/수치 추론 전용 벤치마크의 급증**: TableBench, TReB, RealHiTBench, TabularMath, RUST-BENCH, FinanceReasoning, NumericBench 등 2024~2025년에 쏟아진 벤치마크들은 한결같이 "LLM은 단순 조회는 잘하지만 다단계 계산·트렌드 판단에서 급격히 무너진다"는 결론을 반복한다.
- **환각 측정의 "정답 없는 텍스트" 대응**: FActScore(2023), SelfCheckGPT(2023) 이후 HaluEval, HalluLens, RefChecker 등 후속 연구들은 "정답 라벨이 없는 자유 서술형 응답에서 hallucination을 어떻게 자동으로 잡아낼 것인가"를 계속 정교화하고 있다. 우리 시스템의 `/api/chat` 응답이 정확히 이 범주(자유 서술형, 정답 라벨 없음)에 속한다.
- **LLM-as-judge의 신뢰성 자체가 별도 연구 주제화**: G-Eval(2023) 이후 judge의 위치 편향(position bias), 자기 선호 편향(self-preference bias), 장문 선호 편향(length bias) 등을 다루는 메타 연구가 2024~2025년에 급증했다. 즉 "LLM한테 채점시키면 끝"이 아니라 judge 자체의 신뢰도도 검증 대상이라는 인식이 자리잡았다.
- **추론형 모델 특유의 실패 모드가 최근에야 인프라 이슈로 인식됨**: `max_tokens` vs `max_completion_tokens` 문제, reasoning 토큰이 답변 토큰 예산을 잠식해 빈 응답이 나오는 문제는 2024년 말~2025년에 evaluation 프레임워크(OpenAI 공식 문서, inspect_ai, lm-evaluation-harness 등)의 이슈 트래커에서 반복적으로 보고된, 우리가 실제로 겪은 것과 동일한 버그다.

---

## 3. 대표 논문 심층 비교 (8편)

### 3.1 InfiAgent-DABench (Hu et al., 2024)
- **링크**: https://arxiv.org/abs/2401.05507 (ICML 2024, OpenReview: https://openreview.net/forum?id=d5LURMSfTx)
- **핵심 아이디어**: LLM 에이전트가 실행 환경(파이썬 인터프리터)과 상호작용하며 CSV 데이터에 대한 데이터 분석 질문을 종단간으로 풀게 하는 최초의 에이전트 벤치마크. 52개의 실제 CSV 파일에서 도출한 257개 질문(DAEval 데이터셋)으로 구성.
- **무엇을, 어떻게 측정하는가**: 데이터 분석 질문은 본래 "트렌드를 설명해봐"처럼 개방형이라 자동 채점이 어렵다는 문제를, **format-prompting** 기법으로 해결한다 — 각 질문을 "답을 특정 형식(예: 소수점 둘째 자리 숫자, `[a, b, c]` 형태 리스트 등)으로만 출력하라"는 폐쇄형(closed-form) 질문으로 재구성해, LLM의 최종 출력 문자열을 정답과 **문자열/수치 exact match**로 비교한다. 즉 서술의 유창함이 아니라 "숫자가 정확히 맞았는가"만 채점한다.
- **결과/실패 패턴**: 34개 LLM을 벤치마킹한 결과 GPT-4 계열도 다단계 계산이 섞인 질문에서 정확도가 크게 떨어졌고, 저자들이 만든 전용 에이전트(DAAgent)조차 GPT-3.5 대비 3.9%p 개선에 그쳤다 — 즉 이 문제 자체가 최신 모델로도 쉽게 안 풀린다.
- **우리 시스템에 적용 가능한 부분**: 우리도 `/api/data/summary`가 만드는 `metrics(total/average/max/min)`, `trend` 필드에 대해 "이 요약이 주어졌을 때 정답이 명확히 계산 가능한 질문"(예: "평균이 얼마야?", "최댓값이 언제 기록됐어?")을 골든 세트로 만들고, LLM 답변에서 숫자를 추출해 summary의 실제 값과 **exact/허용오차 비교**를 자동화할 수 있다. format-prompting처럼 "숫자만 답해" 프롬프트를 평가용으로 별도로 만들면 채점이 쉬워진다.

### 3.2 TableBench (Wu et al., 2024/2025, AAAI 2025)
- **링크**: https://arxiv.org/abs/2408.09174 (GitHub: https://github.com/TableBench/TableBench)
- **핵심 아이디어**: 학계 테이블 QA 벤치마크와 실제 산업 현장에서 요구되는 테이블 추론 사이의 괴리를 메우기 위해 만든 벤치마크. 3,681개 테이블에 대해 fact-checking, numerical reasoning, data analysis, visualization 등 4대 카테고리·18개 세부 능력을 다루는 886개 문항으로 구성.
- **무엇을, 어떻게 측정하는가**: 정답이 정형화된 값(숫자, 카테고리, 차트 스펙 등)으로 존재하는 문항은 정답과의 비교로 채점하고, 자유 서술이 필요한 문항은 참조 답안 대비 유사도/LLM 채점을 병행한다. 사람(전문가) 성능을 별도로 측정해 "인간 대비 LLM의 격차"를 기준선으로 삼는다.
- **결과/실패 패턴**: 가장 강력한 모델(GPT-4)조차 사람 수준에 크게 못 미쳤고, 특히 numerical reasoning·data analysis 카테고리에서 격차가 컸다. 즉 "테이블에서 사실을 조회하는 것"과 "테이블을 근거로 계산·추론하는 것" 사이에 난이도 단절이 뚜렷하다.
- **우리 시스템에 적용 가능한 부분**: 우리 요약 JSON도 일종의 "작은 테이블"이다. TableBench의 카테고리 구분(단순 조회 vs 수치 계산 vs 트렌드/시각화 서술)을 그대로 빌려와, 골든 QA 세트를 난이도별로 계층화하면(예: "총합이 얼마야" [조회] → "지난주 대비 몇 % 늘었어" [계산] → "이 추세가 앞으로도 이어질까" [추론/서술]) 어느 난이도에서 우리 시스템이 무너지는지 특정할 수 있다.

### 3.3 DS-1000 (Lai et al., 2023, ICML)
- **링크**: https://arxiv.org/abs/2211.11501 (사이트: https://ds1000-code-gen.github.io/)
- **핵심 아이디어**: NumPy, Pandas, Matplotlib 등 7개 파이썬 데이터 과학 라이브러리에 걸친 1,000개의 실제(StackOverflow 유래) 코드 생성 문제로 구성된 벤치마크.
- **무엇을, 어떻게 측정하는가**: **Multi-criteria execution-based evaluation** — 생성된 코드를 실제로 실행해 (1) 테스트 케이스를 통과하는지(기능적 정확성), (2) 금지된 API/편법(예: 정답 문자열을 그대로 하드코딩)을 쓰지 않았는지(표층 제약)를 동시에 검사한다. 또한 StackOverflow 원문을 살짝 변형해 모델이 사전학습 중 암기한 답을 그대로 재현하지 못하도록(memorization 방지) 설계했다. 이 다중 기준 덕분에 "우연히 맞은" 답을 걸러내 평가 자체의 오탐률이 1.8% 수준으로 낮다.
- **결과**: 당시 최고 모델(Codex-002)도 43.3% 정확도에 그쳐 개선 여지가 컸다.
- **우리 시스템에 적용 가능한 부분**: 우리 시스템은 코드를 생성하진 않지만, "실행 가능한 검증"이라는 철학은 그대로 가져올 수 있다 — LLM 답변에서 언급된 숫자를 정규식으로 추출해, 그 값을 `/api/data/summary`가 실제로 계산한 값과 스크립트로 자동 비교하는 것이 바로 이 논문의 "execution-based evaluation"을 우리 맥락에 옮긴 것이다.

### 3.4 RAGAS (Es et al., 2023)
- **링크**: https://arxiv.org/abs/2309.15217
- **핵심 아이디어**: 사람이 미리 정답을 라벨링하지 않아도(reference-free) RAG(검색 증강 생성) 파이프라인을 자동 평가하는 프레임워크. Faithfulness(생성문이 검색된 컨텍스트에 얼마나 근거하는가), Answer Relevancy(답이 질문과 얼마나 관련 있는가), Context Precision/Recall(검색된 컨텍스트가 얼마나 적절한가) 네 축을 핵심 메트릭으로 제시.
- **무엇을, 어떻게 측정하는가**: Faithfulness는 생성된 답변을 여러 개의 원자적 주장(claim)으로 분해한 뒤, 각 주장이 제공된 컨텍스트로부터 추론 가능한지를 LLM으로 판정해 "지지되는 주장 비율"을 계산한다(FActScore와 유사한 원자 분해 접근). Answer Relevancy는 답변으로부터 역으로 "이 답이 나올 법한 질문들"을 LLM으로 재생성한 뒤 원 질문과의 임베딩 유사도를 측정한다. 즉 사람이 정답을 안 써도, LLM을 보조 도구로 써서 자동으로 두 방향(주장→근거, 답→질문)의 일관성을 검증하는 것이 핵심 메커니즘이다.
- **우리 시스템에 적용 가능한 부분**: 우리 구조(요약 JSON = "검색된 컨텍스트", LLM 답변 = "생성문")는 RAG 파이프라인과 사실상 동형이다. Faithfulness 메트릭을 그대로 이식하면 — "답변에 등장하는 수치·트렌드 주장이 실제로 summary JSON에 있는 값에서 도출 가능한가"를 LLM judge로 자동 채점할 수 있다. 이는 "존재하지 않는 트렌드를 지어내는" 실패를 정량적으로 잡아내는 가장 직접적인 방법이다.

### 3.5 G-Eval (Liu et al., 2023, EMNLP)
- **링크**: https://arxiv.org/abs/2303.16634
- **핵심 아이디어**: BLEU/ROUGE 같은 참조 기반 지표가 개방형 생성 품질과 상관관계가 낮다는 문제를, GPT-4를 채점자로 쓰는 **chain-of-thought + form-filling** 방식으로 해결. 채점 기준(criteria)을 프롬프트에 명시하고, LLM이 먼저 채점 단계를 스스로 생성(CoT)한 뒤 정해진 양식(1~5점 등)으로 점수를 채워 넣게(form-filling) 한다.
- **무엇을, 어떻게 측정하는가**: 요약·대화 생성 두 태스크에서 사람 평가와의 Spearman 상관계수 0.514를 달성해 기존 자동 지표를 크게 앞섰다. 다만 논문 스스로 **LLM judge가 자신(혹은 유사 계열 모델)이 생성한 텍스트를 선호하는 편향**이 있음을 지적한다.
- **우리 시스템에 적용 가능한 부분**: gpt-5-mini 답변을 채점할 때 다른 계열 모델(예: Claude, 또는 사람)을 judge로 쓰거나, 최소한 채점 기준(정확성/근거성/완결성)을 명시한 rubric을 프롬프트에 박아 넣는 G-Eval 방식의 "CoT+form-filling" 채점 프롬프트를 만들면, "그럴듯해 보인다"는 인상 평가를 훨씬 재현 가능한 점수로 바꿀 수 있다. 단, self-preference bias를 피하려면 채점 모델을 응답 생성 모델과 다르게 가져가는 것이 중요하다는 시사점도 얻는다.

### 3.6 FActScore (Min et al., 2023, EMNLP)
- **링크**: https://arxiv.org/abs/2305.14251
- **핵심 아이디어**: 장문 생성물(예: 인물 전기)의 사실성을 이진(참/거짓) 판정 대신, 문장을 더 작은 **원자적 사실(atomic fact)** 단위로 쪼갠 뒤 각 사실이 신뢰할 수 있는 지식 소스(위키피디아 등)에 의해 지지되는지를 개별 판정하고, 그 비율을 최종 점수로 낸다.
- **무엇을, 어떻게 측정하는가**: "지지되는 원자 사실 수 / 전체 원자 사실 수"로 정밀도(precision)를 계산. ChatGPT가 생성한 전기 텍스트를 이 방식으로 채점한 결과 58%만이 사실로 지지됨(즉 거의 절반이 근거 없는 서술)이 드러났다. 사람이 일일이 원자 사실을 나누고 검증하는 것은 비용이 크므로, 검색 기반 자동 추정 모델을 만들어 2% 미만의 오차로 이를 근사했다.
- **우리 시스템에 적용 가능한 부분**: 우리 답변을 "이 기간 평균은 X였다", "Y라는 추세가 관찰된다" 같은 원자 주장 단위로 쪼갠 뒤, 각 주장을 summary JSON의 필드와 대조해 지지 여부를 이진 판정하는 **자동화된 체크리스트형 검증**을 만들 수 있다. 원자 단위 분해라는 아이디어 자체가, "숫자 하나만 틀려도 전체 응답이 오염된다"는 우리 문제의 본질(트렌드 지어내기, 계산 오류)을 정확히 겨냥한다.

### 3.7 SelfCheckGPT (Manakul et al., 2023, EMNLP)
- **링크**: https://arxiv.org/abs/2303.08896
- **핵심 아이디어**: 외부 지식 소스나 모델 내부 확률(로그프롭)에 접근하지 않고도(zero-resource, black-box) hallucination을 탐지하는 방법. 같은 질문에 대해 모델로부터 **여러 개의 응답을 샘플링**한 뒤, "모델이 그 사실을 실제로 알고 있다면 여러 샘플이 서로 일관될 것이고, 지어낸(환각된) 사실이라면 샘플마다 내용이 달라지며 서로 모순될 것"이라는 직관에 기반한다.
- **무엇을, 어떻게 측정하는가**: BERTScore, QA 기반 일치도, n-gram 기반, NLI(자연어추론) 기반 등 여러 방식으로 샘플 간 일관성을 측정해 문장/문단 단위 hallucination 점수를 산출한다. WikiBio 인물 소개문 생성 태스크에서 회색 상자(gray-box, 확률 기반) 방법들보다 우수한 AUC-PR을 기록했다.
- **우리 시스템에 적용 가능한 부분**: 별도 인프라 없이 지금 당장 적용 가능한 방법이다 — 같은 질문(예: "이번 달 트렌드 알려줘")을 temperature를 살짝 높여 3~5회 반복 호출한 뒤, 답변에 등장하는 숫자·트렌드 서술이 매번 바뀌는지 확인하는 것만으로 "이 답변이 요약 데이터에 근거한 것인지, 모델이 즉흥적으로 지어낸 것인지"를 저비용으로 스크리닝할 수 있다.

### 3.8 FAITH: Framework for Assessing Intrinsic Tabular Hallucinations in Finance (Zhang et al., 2025)
- **링크**: https://arxiv.org/abs/2508.05201
- **핵심 아이디어**: S&P 500 연차보고서의 재무 테이블을 대상으로, "테이블 안의 특정 셀 값을 마스킹(masked span prediction)한 뒤 모델이 나머지 테이블 맥락만으로 그 값을 복원/계산하게 시키고 정답과 비교"하는 방식으로 금융 도메인의 수치 환각을 정량화한다.
- **무엇을, 어떻게 측정하는가**: 문제를 난이도별 4단계로 나눈다 — ① Direct Lookup(단일 셀 직접 조회), ② Comparative Calculation(동일 지표의 기간 간 비교), ③ Bivariate Calculation(서로 다른 두 지표 간 연산), ④ Multivariate Calculation(3개 이상 지표 또는 다단계 연산). Claude-Sonnet-4는 Direct Lookup에서 97.0%였지만 Multivariate Calculation에서는 80.0%로 떨어졌고, Llama-3.1-8B·Gemma-3-12B·Ministral-8B 등 다수 모델은 Multivariate Calculation에서 **정확도가 0.0%로 완전히 붕괴**했다. 즉 "복잡도가 올라갈수록 오류가 지수적으로 증가"한다는 것이 핵심 발견이다.
- **우리 시스템에 적용 가능한 부분**: 이 4단계 난이도 구분이 우리 골든 QA 세트 설계에 그대로 쓸 수 있는 청사진이다 — "총합이 얼마야"(조회) → "이번 달과 지난 달 평균 차이는?"(비교 계산) → "이 지표와 저 지표를 곱하면?"(이변수 계산) → "지난 3개월 트렌드를 종합하면?"(다변수/서술)처럼 난이도를 계층화해서 테스트하면, 우리 시스템이 정확히 어느 계산 복잡도부터 무너지는지 특정할 수 있다. 이는 우리가 실제로 겪은 "존재하지 않는 트렌드 지어내기" 버그가 학계에서도 "복잡도 증가에 따른 지수적 오류 증가"라는 이름으로 이미 잘 알려진 현상임을 보여준다.

---

## 4. 숫자를 다루는 LLM 답변의 대표적 실패 패턴

우리가 실제로 겪었거나 겪을 수 있는 문제들이 문헌에서 어떻게 이름 붙여지고 관찰되는지 정리하면 다음과 같다.

1. **복잡도에 따른 지수적 정확도 붕괴 (계산 오류)**: FAITH(2508.05201)가 보여주듯, 단일 값 조회는 90%대 정확도가 나와도 두세 개 지표를 조합하는 계산으로 넘어가면 일부 모델은 0%까지 떨어진다. TableBench, RUST-BENCH 등도 동일하게 "numerical reasoning" 카테고리에서 인간 대비 격차가 가장 크다고 보고한다. 우리 시스템처럼 `average/max/min/trend`를 조합해 서술하게 하는 프롬프트는 이 실패 모드에 직격으로 노출된다.
2. **존재하지 않는 트렌드/사실 지어내기 (intrinsic hallucination)**: FAITH는 이를 "numeric hallucination"으로 분류하며 4가지 하위 유형(조작된 숫자, 반올림 오류, 산술 오류, 맥락 불일치)을 제시한다. RAGAS의 faithfulness 개념, FActScore의 원자적 사실 검증은 모두 "생성문의 특정 주장이 제공된 근거 데이터로부터 실제로 도출 가능한가"를 자동으로 판정하기 위한 장치다 — 근거(우리 경우 summary JSON)에 없는 트렌드를 언급하면 곧바로 unsupported claim으로 잡힌다.
3. **산술 실수 vs 의미 오해 vs 접근법 오류의 혼재**: GSM8K 관련 후속 연구(예: "Achieving >97% on GSM8K")는 LLM의 수학 오류를 단순 계산 실수, 문제(맥락) 오해, 잘못된 풀이 전략 선택 세 범주로 나눈다. 우리 시스템에서도 "질문 자체를 잘못 이해해서 엉뚱한 필드를 참조"하는 경우와 "올바른 필드를 참조했지만 계산이 틀린" 경우를 구분해서 로그를 남기면 원인 진단이 쉬워진다.
4. **추론 토큰이 답변 토큰 예산을 잠식해 발생하는 빈 응답(truncation)**: 이는 우리가 실제로 겪은 버그와 정확히 같은 유형이다. `max_tokens`를 설정한 상태에서 gpt-5-mini류 추론형 모델을 호출하면, 내부 추론(reasoning) 과정에 토큰 예산을 다 써버려 최종 답변이 텍스트 없이 잘리는 문제가 OpenAI 공식 문서(reasoning 가이드)와 다수의 평가 프레임워크 이슈 트래커(inspect_ai #3582, lm-evaluation-harness #3382, opencode #25096)에서 반복적으로 보고된다. 핵심은 이 문제가 "눈으로 몇 번 보고 확인"하는 방식으로는 잡히지 않고, 자동화된 평가 파이프라인이 매 응답의 "빈 문자열 여부"와 "finish_reason=length" 같은 메타데이터를 체크할 때만 체계적으로 드러난다는 점이다 — 우리가 이 버그를 발견한 경위(수동 테스트 중 우연히 빈 답변을 목격)가 바로 이 취약점을 잘 보여준다.
5. **LLM judge/평가 자체의 편향**: G-Eval 이후 연구들이 지적하듯, LLM을 채점자로 쓸 때 위치 편향·길이 편향·자기 선호 편향이 존재한다. 우리가 향후 LLM-judge 방식의 자동 평가를 도입하더라도, 그 결과를 "정답"처럼 맹신하기보다는 실행 기반 검증(숫자 exact match)과 병행해야 한다는 교훈을 준다.

---

## 5. 종합 시사점 — 우리 시스템에 도입 가능한 최소 평가 체계 제안

학계 기준으로 볼 때 우리 시스템의 현재 검증 수준(수동 스모크 테스트)은 "평가가 없는 것"에 가깝다. 다만 위 연구들에서 배운 방법론 중 다음 네 가지는 큰 인프라 투자 없이도 현실적으로 도입 가능하다.

1. **골든 Q&A 세트 + 정기 회귀 테스트 (InfiAgent-DABench / RAGAS 방식 응용)**: `/api/data/summary`가 계산한 실제 값(total/average/max/min/trend)을 정답(ground truth)으로 두고, "이번 달 평균이 얼마야?", "최고 기록이 언제였어?" 같은 20~50개의 질문-정답 쌍을 골든 세트로 만든다. CI 또는 배포 전 스크립트로 `/api/chat`을 호출해 답변에서 숫자를 정규식으로 추출하고, summary 값과 exact/허용오차 비교를 자동화한다. InfiAgent-DABench의 format-prompting처럼 평가용 프롬프트는 "숫자만 답하라"로 별도 구성하면 파싱이 쉬워진다.
2. **Faithfulness 체크: 생성된 주장을 summary JSON과 자동 대조 (RAGAS / FActScore 방식 응용)**: 답변을 문장 단위로 쪼갠 뒤, 각 문장이 summary JSON의 특정 필드에서 실제로 도출 가능한지를 별도의 LLM 호출(judge 프롬프트)로 이진 판정한다. "지지되지 않는 주장 비율"을 매 응답마다 로그로 남기면, 존재하지 않는 트렌드를 지어내는 사례를 정량적으로 추적할 수 있다. 다만 G-Eval의 self-preference bias 교훈에 따라, judge 모델은 응답 생성 모델(gpt-5-mini)과 다른 모델을 쓰는 것이 바람직하다.
3. **응답 무결성 가드레일 (truncation/empty-response 자동 감지)**: 매 `/api/chat` 응답에 대해 (a) 응답 문자열이 비어있지 않은지, (b) OpenAI 응답의 `finish_reason`이 `length`(토큰 예산 소진)인지, (c) `usage.completion_tokens_details.reasoning_tokens`가 비정상적으로 크지 않은지를 체크하는 단순 assertion을 API 레이어에 추가하고, 위반 시 로그/알림을 남긴다. 이는 우리가 실제로 겪은 버그의 재발을 자동으로 잡아내는 가장 저비용 대책이다.
4. **일관성 기반 셀프체크 (SelfCheckGPT 방식 응용)**: 동일 질문을 temperature를 다르게 하여 2~3회 반복 호출하고, 답변 속 핵심 숫자/트렌드 서술이 매번 일치하는지 비교하는 스모크 테스트를 주간 단위로 자동 실행한다. 일치하지 않는 질문 유형이 발견되면 그 질문을 골든 세트에 편입시켜 회귀 테스트 범위를 점진적으로 넓힌다.

이 네 가지는 모두 별도의 대규모 라벨링 인력이나 전용 평가 인프라 없이, 이미 존재하는 `/api/data/summary`의 정답 값과 기존 LLM API 호출만으로 구현 가능하다는 점에서 학교 과제 규모의 프로젝트에 현실적인 첫걸음이 될 수 있다.

---

## 6. 참고문헌 목록

### 데이터 분석/에이전트 벤치마크
- InfiAgent-DABench: Evaluating Agents on Data Analysis Tasks (2024) - https://arxiv.org/abs/2401.05507
- DS-1000: A Natural and Reliable Benchmark for Data Science Code Generation (2022) - https://arxiv.org/abs/2211.11501
- TableBench: A Comprehensive and Complex Benchmark for Table Question Answering (2024) - https://arxiv.org/abs/2408.09174
- DA-Code: Agent Data Science Code Generation Benchmark for LLMs (2024) - https://arxiv.org/pdf/2410.07331
- DSBench: How Far Are Data Science Agents from Becoming Data Science Experts? (2024) - https://arxiv.org/pdf/2409.07703
- DSCodeBench: A Realistic Benchmark for Data Science Code Generation (2025) - https://arxiv.org/pdf/2505.15621
- DSAgentBench: Can Agents Automate End-to-End Data-Science Workflows in Real Computer Environments? (2025) - https://arxiv.org/html/2608.10366v1
- DAComp: Benchmarking Data Agents across the Full Data Intelligence Lifecycle (2025) - https://arxiv.org/pdf/2512.04324
- DeepAnalyze: Agentic LLMs for Autonomous Data Science (2025) - https://arxiv.org/pdf/2510.16872
- DS-STAR: Data Science Agent for Solving Diverse Tasks across Heterogeneous Formats (2025) - https://arxiv.org/pdf/2509.21825
- EvoDS: Self-Evolving Autonomous Data Science Agent (2026) - https://arxiv.org/pdf/2606.03841
- Data Interpreter: An LLM Agent For Data Science (2024) - https://arxiv.org/pdf/2402.18679
- DatawiseAgent: A Notebook-Centric LLM Agent Framework (2025) - https://arxiv.org/pdf/2503.07044
- KramaBench: A Benchmark for AI Systems on Data-to-Insight Pipelines over Data Lakes (2025) - https://arxiv.org/abs/2506.06541
- DABstep: Data Agent Benchmark for Multi-step Reasoning (2025) - https://arxiv.org/pdf/2506.23719
- LongDA: Benchmarking LLM Agents for Long-Document Data Analysis (2026) - https://arxiv.org/pdf/2601.02598
- AgentAda: Skill-Adaptive Data Analytics for Tailored Insight Discovery (2025) - https://arxiv.org/pdf/2504.07421
- Benchmarking LLM-based agents for single-cell omics analysis (2025) - https://arxiv.org/pdf/2508.13201
- A Survey on Large Language Model-based Agents for Statistics and Data Science (2024) - https://arxiv.org/pdf/2412.14222
- Large Language Model-based Data Science Agent: A Survey (2025) - https://arxiv.org/pdf/2508.02744
- MLAgentBench (관련 서베이 내 언급) - https://arxiv.org/pdf/2412.14222

### 테이블/수치 추론 벤치마크
- TReB: A Comprehensive Benchmark for Evaluating Table Reasoning Capabilities of LLMs (2025) - https://arxiv.org/pdf/2506.18421
- RealHiTBench: A Comprehensive Realistic Hierarchical Table Benchmark (2025) - https://arxiv.org/pdf/2506.13405
- TabularMath: Understanding Math Reasoning over Tables with LLMs (2025) - https://arxiv.org/pdf/2505.19563
- How well do LLMs reason over tabular data, really? (2025) - https://arxiv.org/pdf/2505.07453
- RUST-BENCH: Benchmarking LLM Reasoning on Unstructured Text within Structured Tables (2025) - https://arxiv.org/html/2511.04491
- Exposing Numeracy Gaps: A Benchmark to Evaluate Fundamental Numerical Abilities in LLMs (2025) - https://arxiv.org/pdf/2502.11075
- FinanceReasoning: Benchmarking Financial Numerical Reasoning (2025) - https://arxiv.org/html/2506.05828
- JT-DA: Enhancing Data Analysis with Tool-Integrated Table Reasoning LLMs (2025) - https://arxiv.org/pdf/2512.06859

### 금융 수치 환각/신뢰성
- FAITH: A Framework for Assessing Intrinsic Tabular Hallucinations in Finance (2025) - https://arxiv.org/abs/2508.05201
- FinVerBench: Benchmark Validity and Calibration in LLM Financial Statement Verification (2026) - https://arxiv.org/pdf/2605.29586
- Characterizing Multimodal Long-form Summarization: A Case Study on Financial Reports (2024) - https://arxiv.org/pdf/2404.06162
- Large Language Models Acing Chartered Accountancy (2025) - https://arxiv.org/pdf/2506.21031
- Beyond the Reported Cutoff: Where LLMs Fall Short on Financial Knowledge (2025) - https://arxiv.org/html/2504.00042v2
- Expect the Unexpected: FailSafe Long Context QA for Finance (2025) - https://arxiv.org/pdf/2502.06329

### Text-to-SQL 평가 방법론
- A Survey on Employing Large Language Models for Text-to-SQL Tasks (2024) - https://arxiv.org/pdf/2407.15186
- MARS-SQL: A multi-agent reinforcement learning framework for Text-to-SQL (2025) - https://arxiv.org/pdf/2511.01008
- Text-to-SQL as Dual-State Reasoning (2025) - https://arxiv.org/pdf/2511.21402
- Every Step Counts: Step-Level Credit Assignment for Tool-Integrated Text-to-SQL (2026) - https://arxiv.org/pdf/2605.04719
- Skeletons Matter: Dynamic Data Augmentation for Text-to-Query (2025) - https://arxiv.org/pdf/2511.18934
- MCI-SQL: Text-to-SQL with Metadata-Complete Context and Intermediate Correction (2026) - https://arxiv.org/pdf/2603.13390
- Memory Architectures for Multi-Turn Text-to-SQL: A Benchmark and Empirical Study (2026) - https://arxiv.org/pdf/2605.26394
- Agent-Agnostic Evaluation of SQL Accuracy in Production Text-to-SQL Systems (2026) - https://arxiv.org/pdf/2604.28049
- Text-to-SQL Benchmarks and the Current State-of-the-Art (Dataherald blog) - https://medium.com/dataherald/text-to-sql-benchmarks-and-the-current-state-of-the-art-63dd3b3943fe

### Hallucination 서베이/탐지
- A Survey on Hallucination in LLMs: Principles, Taxonomy, Challenges, and Open Questions (2023) - https://arxiv.org/abs/2311.05232
- Large Language Models Hallucination: A Comprehensive Survey (2025) - https://arxiv.org/abs/2510.06265
- A Comprehensive Survey of Hallucination in Large Language, Image, Video and Audio Foundation Models (2024) - https://arxiv.org/pdf/2405.09589
- Hallucination Detection and Evaluation of Large Language Model (2025) - https://arxiv.org/pdf/2512.22416
- Principled Detection of Hallucinations in LLMs via Multiple Testing (2025) - https://arxiv.org/pdf/2508.18473
- FActScore: Fine-grained Atomic Evaluation of Factual Precision (2023) - https://arxiv.org/pdf/2305.14251
- SelfCheckGPT: Zero-Resource Black-Box Hallucination Detection (2023) - https://arxiv.org/pdf/2303.08896
- FactSelfCheck: Fact-Level Black-Box Hallucination Detection for LLMs (2025) - https://arxiv.org/html/2503.17229
- RefChecker: Reference-based Fine-grained Hallucination Checker and Benchmark (2024) - https://arxiv.org/pdf/2405.14486
- Metric Ensembles For Hallucination Detection (2023) - https://arxiv.org/pdf/2310.10495
- Decomposed Entailment for Factuality Checking and Hallucination Detection (2026) - https://arxiv.org/html/2608.05823
- HaluEval and TruthfulQA Benchmarks (요약 자료) - https://www.emergentmind.com/topics/halueval-and-truthfulqa
- HalluLens: LLM Hallucination Benchmark (2025) - https://arxiv.org/html/2504.17550v1
- HalluScore: Large Language Model Hallucination Question Answering Benchmark (2026) - https://arxiv.org/html/2605.17007v1
- HalluTruthQA: A Fine-Grained Benchmark for Hallucination Detection in Arabic QA (2026) - https://arxiv.org/html/2607.20219v2
- CrossHallu: Do Hallucination Signals Generalize Across Languages and Domains? (2026) - https://arxiv.org/pdf/2607.04029
- HuDEx: Integrating Hallucination Detection and Explainability (2025) - https://arxiv.org/pdf/2502.08109
- Towards Lightweight Reliability: Soft Prompts for Hallucination Mitigation (2026) - https://arxiv.org/pdf/2606.00919
- Improving the Reliability of LLMs: Combining CoT, RAG, Self-Consistency, and Self-Verification (2025) - https://arxiv.org/pdf/2505.09031
- Provenance: A Light-weight Fact-checker for RAG Generation Output (2024) - https://arxiv.org/pdf/2411.01022
- GitHub - awesome-hallucination-detection (EdinburghNLP) - https://github.com/EdinburghNLP/awesome-hallucination-detection

### Factuality 서베이/벤치마크
- Survey on Factuality in Large Language Models: Knowledge, Retrieval and Domain-Specificity (2023) - https://arxiv.org/pdf/2310.07521
- Survey on Factuality in Large Language Models (ACM Computing Surveys, 2025) - https://dl.acm.org/doi/10.1145/3742420
- OpenFactCheck: A Unified Framework for Factuality Evaluation of LLMs (2024) - https://arxiv.org/pdf/2405.05583
- Factuality Challenges in the Era of Large Language Models (2023) - https://arxiv.org/pdf/2310.05189
- Factuality or Fiction? Benchmarking Modern LLMs on Ambiguous QA with Citations (2024) - https://arxiv.org/pdf/2412.18051
- When Benchmarks Age: Temporal Misalignment through LLM Factuality Evaluation (2025) - https://www.alphaxiv.org/abs/2510.07238
- AdversaRiskQA: An Adversarial Factuality Benchmark for High-Risk Domains (2026) - https://arxiv.org/pdf/2601.15511
- The CitizenQuery Benchmark (2026) - https://arxiv.org/pdf/2602.04064

### RAG 평가 프레임워크
- Ragas: Automated Evaluation of Retrieval Augmented Generation (2023) - https://arxiv.org/abs/2309.15217
- RAGBench: Explainable Benchmark for Retrieval-Augmented Generation Systems (2024) - https://arxiv.org/pdf/2407.11005
- A Systematic Review of Key RAG Systems: Progress, Gaps, and Future Directions (2025) - https://arxiv.org/pdf/2507.18910
- ragR: Retrieval-Augmented Generation and RAG Assessment in R (2026) - https://arxiv.org/pdf/2604.23515
- QuIM-RAG: Advancing RAG with Inverted Question Matching (2025) - https://arxiv.org/pdf/2501.02702
- LLM-Assisted QA on Technical Documents Using Structured Data-Aware RAG (2025) - https://arxiv.org/pdf/2506.23136
- A RAG Framework for Academic Literature Navigation in Data Science (2024) - https://arxiv.org/pdf/2412.15404
- RAG Evaluation Survey: Framework, Metrics, and Methods (EvalScope 문서) - https://evalscope.readthedocs.io/en/latest/blog/RAG/RAG_Evaluation.html

### LLM-as-a-judge
- G-Eval: NLG Evaluation using GPT-4 with Better Human Alignment (2023) - https://arxiv.org/abs/2303.16634
- A Survey on LLM-as-a-Judge (2024) - https://arxiv.org/pdf/2411.15594
- Judging the Judges: A Systematic Study of Position Bias in LLM-as-a-Judge (2025) - https://aclanthology.org/2025.ijcnlp-long.18/
- Justice or Prejudice? Quantifying Biases in LLM-as-a-Judge (프로젝트 페이지) - https://llm-judge-bias.github.io/
- MLLM-as-a-Judge Exhibits Model Preference Bias (2026) - https://arxiv.org/pdf/2604.11589
- Relative Bias: A Comparative Framework for Quantifying Bias in LLMs (2025) - https://arxiv.org/pdf/2505.17131
- Are Bias Evaluation Methods Biased? (2025) - https://arxiv.org/pdf/2506.17111
- Is ChatGPT a Good NLG Evaluator? A Preliminary Study (2023) - https://arxiv.org/pdf/2303.04048

### LLM 종합 평가 서베이
- A Survey on Evaluation of Large Language Models (2023, ACM TIST 2024) - https://arxiv.org/abs/2307.03109
- Evaluating Large Language Models: A Comprehensive Survey (2023) - https://arxiv.org/pdf/2310.19736
- A Systematic Survey and Critical Review on Evaluating LLMs: Challenges, Limitations, and Recommendations (2024) - https://arxiv.org/pdf/2407.04069
- GitHub - LLM-eval-survey (MLGroupJLU) - https://github.com/MLGroupJLU/LLM-eval-survey
- LLM-based NLG Evaluation: Current Status and Challenges (MIT Press, Computational Linguistics) - https://direct.mit.edu/coli/article/51/2/661/128807/
- Datasets for Large Language Models: A Comprehensive Survey (2024) - https://arxiv.org/pdf/2402.18041
- 30 LLM evaluation benchmarks and how they work (Evidently AI) - https://www.evidentlyai.com/llm-guide/llm-benchmarks
- Evaluating LLMs and Agents: Benchmarks, Evals & Guardrails (LangChain) - https://www.langchain.com/resources/how-to-evaluate-llms

### 벤치마크 오염/신뢰성 이슈
- Benchmark Data Contamination of Large Language Models: A Survey (2024) - https://arxiv.org/abs/2406.04244
- LLM Benchmark Datasets Should Be Contamination-Resistant (2026) - https://arxiv.org/pdf/2605.19999
- Towards Contamination Resistant Benchmarks (2025) - https://arxiv.org/pdf/2505.08389
- PaCoST: Paired Confidence Significance Testing for Benchmark Contamination Detection (2024) - https://arxiv.org/pdf/2406.18326
- Don't Make Your LLM an Evaluation Benchmark Cheater (2023) - https://arxiv.org/pdf/2311.01964
- Cheating Automatic LLM Benchmarks: Null Models Achieve High Win Rates (2024) - https://arxiv.org/html/2410.07137v1
- Establishing Trustworthy LLM Evaluation via Shortcut Neuron Analysis (2025) - https://arxiv.org/pdf/2506.04142
- Eval Factsheets: A Structured Framework for Documenting AI Evaluations (2025) - https://arxiv.org/pdf/2512.04062

### 수치 추론/수학 벤치마크
- Achieving >97% on GSM8K: Deeply Understanding the Problems Makes LLMs Better Solvers (2024) - https://arxiv.org/html/2404.14963v5
- ARB: Advanced Reasoning Benchmark for Large Language Models (2023) - https://arxiv.org/pdf/2307.13692
- Chain of Draft: Thinking Faster by Writing Less (2025) - https://arxiv.org/pdf/2502.18600

### 요약/근거성(faithfulness) 평가
- Evaluating the Factual Consistency of Large Language Models Through News Summarization (2023) - https://arxiv.org/abs/2211.08412
- FineSurE: Fine-grained Summarization Evaluation using LLMs (2024) - https://arxiv.org/html/2407.00908v3
- FABLES: Evaluating faithfulness and content selection in book-length summarization (2024) - https://arxiv.org/pdf/2404.01261
- A review of faithfulness metrics for hallucination assessment in LLMs (2025) - https://arxiv.org/pdf/2501.00269
- On A Scale From 1 to 5: Quantifying Hallucination in Faithfulness Evaluation (2024) - https://arxiv.org/pdf/2410.12222
- Faithful Summarization of Consumer Health Queries: A Cross-Lingual Framework with LLMs (2025) - https://arxiv.org/html/2511.10768

### 불확실성/보정(calibration)
- Uncertainty Quantification and Confidence Calibration in Large Language Models: A Survey (2025) - https://arxiv.org/abs/2503.15850
- A Survey on Uncertainty Quantification of Large Language Models: Taxonomy, Open Research Challenges (2024) - https://arxiv.org/pdf/2412.05563
- On Calibration of Large Language Models: From Response To Capability (2026) - https://arxiv.org/pdf/2602.13540
- Double-Calibration: Towards Reliable LLMs via Calibrating Knowledge and Reasoning Confidence (2026) - https://arxiv.org/pdf/2601.11956
- Uncertainty Quantification in LLM Agents: Foundations, Emerging Challenges, and Opportunities (2026) - https://arxiv.org/pdf/2602.05073

### 에이전트/툴 사용 벤치마크
- AgentBench: Evaluating LLM Agent Capabilities (요약자료) - https://www.emergentmind.com/topics/agentbench-729b2968-66e6-478e-9bf4-c1a576adaf32
- 10 AI agent benchmarks (Evidently AI) - https://www.evidentlyai.com/blog/ai-agent-benchmarks
- Evaluating Tool-Using Language Agents: AgentProp-Bench (2026) - https://arxiv.org/pdf/2604.16706

### 추론형 모델의 토큰/truncation 이슈 (실무 사례)
- Reasoning models | OpenAI API 공식 문서 - https://developers.openai.com/api/docs/guides/reasoning
- [Bug] Truncation before think_end_token causes incomplete reasoning to be parsed as final response - lm-evaluation-harness #3382 - https://github.com/EleutherAI/lm-evaluation-harness/issues/3382
- evaluations with max tokens set often result in truncated responses - inspect_ai #3582 - https://github.com/UKGovernmentBEIS/inspect_ai/issues/3582
- openai-compatible adapter sends max_tokens to GPT-5/o-series reasoning models that require max_completion_tokens - opencode #25096 - https://github.com/anomalyco/opencode/issues/25096
- Length-truncation continuation loop cannot converge on reasoning-only output - hermes-agent #83915 - https://github.com/NousResearch/hermes-agent/issues/83915
- DiffAdapt: Difficulty-Adaptive Reasoning for Token-Efficient LLM Inference (2025) - https://arxiv.org/pdf/2510.19669
- On the Optimal Reasoning Length for RL-Trained Language Models (2026) - https://arxiv.org/pdf/2602.09591

### 챗봇/대화형 평가 실무
- Top LLM Chatbot Evaluation Metrics: Conversation Testing Techniques (Confident AI) - https://www.confident-ai.com/blog/llm-chatbot-evaluation-explained-top-chatbot-evaluation-metrics-and-testing-techniques
- Metrics for Evaluating LLM Chatbot Agents - Part 1 (Galileo AI) - https://galileo.ai/blog/metrics-for-evaluating-llm-chatbots-part-1
- GitHub - Awesome LLM for NLG Evaluation Papers - https://github.com/chongyangtao/LLMs-for-NLG-Evaluation

### 골든 데이터셋/회귀 테스트 (실무 가이드)
- Golden dataset evaluation: build and maintain LLM test sets (Langfuse) - https://langfuse.com/resources/engineering/golden-dataset-evaluation
- LLM regression testing: fail CI before regressions ship (Langfuse) - https://langfuse.com/resources/engineering/llm-regression-testing
- Automated Regression Testing for LLMs (Latitude.so) - https://latitude.so/blog/automated-regression-testing-llms
- How to Build Automated LLM Evaluation Pipelines (Latitude.so) - https://latitude.so/blog/how-to-build-automated-llm-evaluation-pipelines
- LLM Regression Testing Pipeline for QA Engineers: RAG Triad & Gold Sets (TestQuality) - https://testquality.com/llm-regression-testing-pipeline/
- Datasets | DeepEval - The LLM Evaluation Framework - https://deepeval.com/docs/evaluation-datasets

### 헬스/개인 데이터 어시스턴트 사례 (도메인 유사 참고)
- Conversational health agents: a personalized LLM-powered agent framework (2025) - https://pmc.ncbi.nlm.nih.gov/articles/PMC12228965/
- Exploring Personalized Health Support through Data-Driven, Theory-Guided LLMs: Sleep Health Case Study (CHI 2025) - https://arxiv.org/html/2502.13920v1
- Knowledge-Infused LLM-Powered Conversational Health Agent for Diabetes Patients (2024) - https://arxiv.org/html/2402.10153v2
- Assessing the User Experience of an LLM-Based Conversational Assistant in Diabetes Mellitus Care (2025) - https://link.springer.com/article/10.1007/s41666-025-00217-5
- Conversational Assistants to support Heart Failure Patients (2025) - https://arxiv.org/pdf/2504.17753
