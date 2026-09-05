// 대화 기록 목록 + 불러오기 UI 로직
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
      alert(`삭제 실패: ${err.message}`);
    }
  }

  async function openConversation(id) {
    try {
      const conversation = await API.getConversation(id);
      Chat.loadConversation(conversation);
      Tabs.activate("chat");
    } catch (err) {
      alert(`불러오기 실패: ${err.message}`);
    }
  }

  function render(items) {
    els.list.innerHTML = "";
    if (items.length === 0) {
      els.list.innerHTML = `<li class="empty-row">저장된 대화가 없어요.</li>`;
      return;
    }

    const sorted = [...items].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    for (const item of sorted) {
      const li = document.createElement("li");
      li.className = "conversation-item";
      li.innerHTML = `
        <div class="conversation-item__main">
          <span class="conversation-item__title"></span>
          <span class="conversation-item__date">${formatDate(item.created_at)}</span>
        </div>
        <div class="conversation-item__actions"></div>
      `;
      li.querySelector(".conversation-item__title").textContent = item.title;

      const loadBtn = document.createElement("button");
      loadBtn.textContent = "불러오기";
      loadBtn.className = "btn btn--ghost btn--sm";
      loadBtn.addEventListener("click", () => openConversation(item.id));

      const delBtn = document.createElement("button");
      delBtn.textContent = "삭제";
      delBtn.className = "btn btn--danger btn--sm";
      delBtn.addEventListener("click", () => removeConversation(item.id));

      const actions = li.querySelector(".conversation-item__actions");
      actions.appendChild(loadBtn);
      actions.appendChild(delBtn);

      els.list.appendChild(li);
    }
  }

  async function refresh() {
    const items = await API.getConversations();
    render(items);
  }

  return { init, refresh };
})();
