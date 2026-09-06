// 대화 기록 목록 + 불러오기 + 삭제
const Conversations = (() => {
  const els = {};

  function init() {
    els.list = document.getElementById("conversations-list");
  }

  function formatDate(value) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" });
  }

  async function removeConversation(id) {
    if (!confirm("이 대화 기록을 삭제할까요?")) return;
    try {
      await API.deleteConversation(id);
      await refresh();
    } catch (err) {
      App.showBanner("error", "삭제 실패: " + err.message);
    }
  }

  async function openConversation(id) {
    try {
      const conversation = await API.getConversation(id);
      Chat.loadConversation(conversation);
      Tabs.activate("chat");
    } catch (err) {
      App.showBanner("error", "불러오기 실패: " + err.message);
    }
  }

  function render(items) {
    els.list.innerHTML = "";
    if (!items.length) {
      els.list.innerHTML = '<li class="empty">저장된 대화가 없어요. 채팅 탭에서 첫 질문을 보내보세요.</li>';
      return;
    }

    const sorted = [...items].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    sorted.forEach((item) => {
      const count = (item.messages || []).filter((m) => m.role !== "system").length;
      const li = document.createElement("li");
      li.className = "conversation-item";
      li.innerHTML =
        '<div class="conversation-item__main">' +
        '<span class="conversation-item__title"></span>' +
        '<span class="conversation-item__meta"></span>' +
        "</div>" +
        '<div class="conversation-item__actions"></div>';
      li.querySelector(".conversation-item__title").textContent = item.title || "제목 없음";
      li.querySelector(".conversation-item__meta").textContent =
        formatDate(item.created_at) + (count ? " · " + count + " messages" : "");

      const loadBtn = document.createElement("button");
      loadBtn.type = "button";
      loadBtn.className = "btn btn--soft";
      loadBtn.textContent = "불러오기";
      loadBtn.addEventListener("click", () => openConversation(item.id));

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "btn btn--danger";
      delBtn.textContent = "삭제";
      delBtn.addEventListener("click", () => removeConversation(item.id));

      const actions = li.querySelector(".conversation-item__actions");
      actions.appendChild(loadBtn);
      actions.appendChild(delBtn);
      els.list.appendChild(li);
    });
  }

  async function refresh() {
    const items = await API.getConversations();
    render(items || []);
  }

  return { init, refresh };
})();
