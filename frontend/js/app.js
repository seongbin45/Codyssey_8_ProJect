// 탭 전환 + 앱 초기화
const Tabs = (() => {
  const panels = {};
  const buttons = {};

  function activate(name) {
    for (const key of Object.keys(panels)) {
      panels[key].hidden = key !== name;
      buttons[key].classList.toggle("tab-btn--active", key === name);
    }
  }

  function init() {
    document.querySelectorAll("[data-tab-btn]").forEach((btn) => {
      const name = btn.dataset.tabBtn;
      buttons[name] = btn;
      btn.addEventListener("click", () => activate(name));
    });
    document.querySelectorAll("[data-tab-panel]").forEach((panel) => {
      panels[panel.dataset.tabPanel] = panel;
    });
  }

  return { init, activate };
})();

document.addEventListener("DOMContentLoaded", async () => {
  Tabs.init();
  Chat.init();
  DataView.init();
  Conversations.init();

  Chat.startNewConversation();

  try {
    await Promise.all([DataView.refresh(), Conversations.refresh()]);
  } catch (err) {
    console.error("초기 데이터 로드 실패:", err);
  }

  Tabs.activate("chat");
});
