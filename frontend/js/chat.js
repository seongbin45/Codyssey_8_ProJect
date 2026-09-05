// 채팅 인터페이스 로직
const Chat = (() => {
  let currentConversationId = null;

  const els = {};

  function init() {
    els.messages = document.getElementById("chat-messages");
    els.form = document.getElementById("chat-form");
    els.input = document.getElementById("chat-input");
    els.newBtn = document.getElementById("chat-new-btn");

    els.form.addEventListener("submit", onSubmit);
    els.newBtn.addEventListener("click", startNewConversation);
  }

  function startNewConversation() {
    currentConversationId = null;
    els.messages.innerHTML = "";
    renderSystemNotice("새 대화를 시작했어요. 데이터에 대해 무엇이든 물어보세요.");
  }

  function renderSystemNotice(text) {
    const div = document.createElement("div");
    div.className = "chat-notice";
    div.textContent = text;
    els.messages.appendChild(div);
  }

  function renderMessage(role, content) {
    const bubble = document.createElement("div");
    bubble.className = `chat-bubble chat-bubble--${role === "user" ? "user" : "assistant"}`;
    bubble.textContent = content;
    els.messages.appendChild(bubble);
    els.messages.scrollTop = els.messages.scrollHeight;
    return bubble;
  }

  function renderLoading() {
    const bubble = document.createElement("div");
    bubble.className = "chat-bubble chat-bubble--assistant chat-bubble--loading";
    bubble.innerHTML = `<span class="dot"></span><span class="dot"></span><span class="dot"></span>`;
    els.messages.appendChild(bubble);
    els.messages.scrollTop = els.messages.scrollHeight;
    return bubble;
  }

  async function onSubmit(e) {
    e.preventDefault();
    const message = els.input.value.trim();
    if (!message) return;

    els.input.value = "";
    els.input.disabled = true;
    renderMessage("user", message);
    const loadingBubble = renderLoading();

    try {
      const res = await API.chat(message, currentConversationId);
      currentConversationId = res.conversation_id;
      loadingBubble.remove();
      renderMessage("assistant", res.reply);
      Conversations.refresh();
    } catch (err) {
      loadingBubble.remove();
      renderMessage("assistant", `⚠️ 오류가 발생했어요: ${err.message}`);
    } finally {
      els.input.disabled = false;
      els.input.focus();
    }
  }

  // 대화 기록 탭에서 특정 대화를 불러올 때 호출됨
  function loadConversation(conversation) {
    currentConversationId = conversation.id;
    els.messages.innerHTML = "";
    conversation.messages
      .filter((m) => m.role !== "system")
      .forEach((m) => renderMessage(m.role, m.content));
  }

  return { init, loadConversation, startNewConversation };
})();
