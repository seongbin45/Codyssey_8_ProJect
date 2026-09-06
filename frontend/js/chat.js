// 채팅 인터페이스: 메시지 렌더링, 전송, 로딩 표시, 주입 컨텍스트 패널, 도구 호출 흐름
const Chat = (() => {
  let currentConversationId = null;
  let lastSummary = null;
  const els = {};

  const SUGGESTIONS = ["이번 달 실적이 어때?", "최근 트렌드 알려줘", "가장 실적이 좋았던 날은?"];

  const TRACE = [
    ["01", "GET /api/data/summary", "저장된 데이터 통계 계산"],
    ["02", "system prompt 주입", "기간 · 개수 · 지표 · 트렌드"],
    ["03", "POST /v1/chat/completions", "gpt-5-mini"],
  ];

  function init() {
    els.messages = document.getElementById("chat-messages");
    els.form = document.getElementById("chat-form");
    els.input = document.getElementById("chat-input");
    els.newBtn = document.getElementById("chat-new-btn");
    els.convId = document.getElementById("chat-conv-id");
    els.ctxRows = document.getElementById("ctx-rows");
    els.ctxPrompt = document.getElementById("ctx-prompt");
    els.ctxToggle = document.getElementById("ctx-toggle");
    els.suggestions = document.getElementById("chat-suggestions");
    els.spark = document.getElementById("spark");

    els.form.addEventListener("submit", onSubmit);
    els.newBtn.addEventListener("click", startNewConversation);
    els.ctxToggle.addEventListener("click", () => {
      const open = els.ctxPrompt.hidden;
      els.ctxPrompt.hidden = !open;
      els.ctxToggle.textContent = open ? "접기" : "원문 보기";
    });

    SUGGESTIONS.forEach((text) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = text;
      b.addEventListener("click", () => { els.input.value = text; els.input.focus(); });
      els.suggestions.appendChild(b);
    });
  }

  function setConvLabel() {
    els.convId.textContent = currentConversationId
      ? "conversation_id: " + currentConversationId.slice(0, 7)
      : "새 대화";
  }

  function startNewConversation() {
    currentConversationId = null;
    els.messages.innerHTML = "";
    setConvLabel();
    renderNotice("새 대화입니다. 지금 시점의 데이터 요약이 컨텍스트로 주입됩니다.");
  }

  function renderNotice(text) {
    const p = document.createElement("p");
    p.className = "chat-notice";
    p.textContent = text;
    els.messages.appendChild(p);
  }

  function renderMessage(role, content, withTrace) {
    const user = role === "user";
    const wrap = document.createElement("div");
    wrap.className = "msg msg--" + (user ? "user" : "assistant");

    const who = document.createElement("span");
    who.className = "msg__who";
    who.textContent = user ? "USER" : "ASSISTANT";

    const bubble = document.createElement("div");
    bubble.className = "msg__bubble";
    bubble.textContent = content;

    wrap.appendChild(who);
    wrap.appendChild(bubble);
    if (withTrace) wrap.appendChild(renderTrace());

    els.messages.appendChild(wrap);
    els.messages.scrollTop = els.messages.scrollHeight;
    return wrap;
  }

  // 보너스: "어떤 근거로 어떤 도구를 호출했는지" 화면에서 확인 가능하게 표시
  function renderTrace() {
    const box = document.createElement("div");
    box.className = "trace";
    const t = document.createElement("span");
    t.className = "trace__title";
    t.textContent = "TOOL CALL TRACE";
    box.appendChild(t);
    TRACE.forEach(([n, call, note]) => {
      const row = document.createElement("div");
      row.className = "trace__step";
      row.innerHTML = '<span class="trace__n"></span><span class="trace__call"></span><span class="trace__note"></span>';
      row.querySelector(".trace__n").textContent = n;
      row.querySelector(".trace__call").textContent = call;
      row.querySelector(".trace__note").textContent = note;
      box.appendChild(row);
    });
    return box;
  }

  function renderLoading() {
    const el = document.createElement("div");
    el.className = "typing";
    el.setAttribute("aria-label", "AI가 답변을 작성 중입니다");
    el.innerHTML = "<span></span><span></span><span></span>";
    els.messages.appendChild(el);
    els.messages.scrollTop = els.messages.scrollHeight;
    return el;
  }

  async function onSubmit(e) {
    e.preventDefault();
    const message = els.input.value.trim();
    if (!message) return;

    const isFirstTurn = !currentConversationId;
    els.input.value = "";
    els.input.disabled = true;
    renderMessage("user", message);
    const loading = renderLoading();
    App.setStatus("cold", "AI 응답 대기 중");

    try {
      const res = await API.chat(message, currentConversationId);
      currentConversationId = res.conversation_id;
      setConvLabel();
      loading.remove();
      renderMessage("assistant", res.reply, isFirstTurn);
      App.setStatus("ok", "API 200");
      Conversations.refresh();
    } catch (err) {
      loading.remove();
      renderMessage("assistant", "요청이 실패했어요: " + err.message);
      App.showBanner("error");
    } finally {
      els.input.disabled = false;
      els.input.focus();
    }
  }

  // 주입되는 요약을 채팅 화면에서 바로 확인할 수 있게 표시
  function setSummary(summary) {
    lastSummary = summary;
    const m = summary.metrics || {};
    const rows = [
      ["기간", summary.period],
      ["레코드", summary.count + "개"],
      ["평균", Number(m.average || 0).toLocaleString()],
      ["최대 / 최소", Number(m.max || 0).toLocaleString() + " / " + Number(m.min || 0).toLocaleString()],
      ["트렌드", summary.trend],
    ];
    els.ctxRows.innerHTML = "";
    rows.forEach(([k, v]) => {
      const div = document.createElement("div");
      div.innerHTML = "<dt></dt><dd></dd>";
      div.querySelector("dt").textContent = k;
      div.querySelector("dd").textContent = v;
      els.ctxRows.appendChild(div);
    });

    els.ctxPrompt.textContent =
      "당신은 데이터 분석 비서입니다.\n\n" +
      "[사용자 데이터 요약]\n" +
      "- 데이터 기간: " + summary.period + "\n" +
      "- 총 레코드: " + summary.count + "개\n" +
      "- 주요 지표:\n" +
      "  - 총합: " + Number(m.total || 0).toLocaleString() + "\n" +
      "  - 평균: " + Number(m.average || 0).toLocaleString() + "\n" +
      "  - 최대: " + Number(m.max || 0).toLocaleString() + "\n" +
      "  - 최소: " + Number(m.min || 0).toLocaleString() + "\n" +
      "- 최근 트렌드: " + summary.trend + "\n\n" +
      "위 데이터를 기반으로 맞춤형 답변을 제공하세요.";
  }

  function setSpark(rows) {
    if (!els.spark) return;
    Chart.render(els.spark, rows.slice(-120), { height: 150, thin: true, label: "최근 120일 값 추이 스파크라인" });
  }

  function loadConversation(conversation) {
    currentConversationId = conversation.id;
    setConvLabel();
    els.messages.innerHTML = "";
    renderNotice("불러온 대화입니다. 이어서 대화하면 같은 컨텍스트가 유지됩니다.");
    (conversation.messages || [])
      .filter((m) => m.role !== "system")
      .forEach((m) => renderMessage(m.role, m.content));
  }

  return { init, loadConversation, startNewConversation, setSummary, setSpark };
})();
