// 탭 전환 + 상태 배너 + 앱 초기화
const Tabs = (() => {
  const panels = {};
  const buttons = {};

  function activate(name) {
    Object.keys(panels).forEach((key) => {
      const on = key === name;
      panels[key].hidden = !on;
      buttons[key].setAttribute("aria-selected", String(on));
      buttons[key].tabIndex = on ? 0 : -1;
    });
  }

  function init() {
    const list = Array.from(document.querySelectorAll("[data-tab-btn]"));
    list.forEach((btn) => {
      const name = btn.dataset.tabBtn;
      buttons[name] = btn;
      btn.addEventListener("click", () => activate(name));
      // 좌우 화살표로 탭 이동 (접근성)
      btn.addEventListener("keydown", (e) => {
        const i = list.indexOf(btn);
        let next = null;
        if (e.key === "ArrowRight") next = list[(i + 1) % list.length];
        if (e.key === "ArrowLeft") next = list[(i - 1 + list.length) % list.length];
        if (next) { e.preventDefault(); next.focus(); next.click(); }
      });
    });
    document.querySelectorAll("[data-tab-panel]").forEach((panel) => {
      panels[panel.dataset.tabPanel] = panel;
    });
    document.querySelectorAll("[data-goto]").forEach((el) => {
      el.addEventListener("click", () => activate(el.dataset.goto));
    });
  }

  return { init, activate };
})();

const App = (() => {
  const els = {};

  const BANNERS = {
    cold: {
      tag: "COLD START",
      text: "백엔드가 Render 무료 티어라 일정 시간 요청이 없으면 슬립됩니다. 첫 응답은 10~30초 걸릴 수 있으니 잠시 기다려주세요.",
      action: "지금 예열",
    },
    error: {
      tag: "OFFLINE",
      text: "백엔드에 연결할 수 없습니다. 표시된 값은 마지막으로 불러온 데이터이며, 저장/삭제는 지금 동작하지 않습니다.",
      action: "다시 시도",
    },
  };

  function setStatus(kind, text) {
    els.status.className = "status status--" + kind;
    els.statusText.textContent = text;
  }

  function showBanner(kind, customText) {
    const b = BANNERS[kind];
    if (!b) return;
    els.banner.hidden = false;
    els.banner.classList.toggle("banner--error", kind === "error");
    els.bannerTag.textContent = b.tag;
    els.bannerText.textContent = customText || b.text;
    els.bannerAction.textContent = b.action;
    els.bannerAction.onclick = () => { els.banner.hidden = true; boot(true); };
  }

  function hideBanner() { els.banner.hidden = true; }

  async function boot(isRetry) {
    setStatus("cold", isRetry ? "재시도 중" : "API 확인 중");
    const h = await API.health();

    if (!h.ok) {
      setStatus("error", "API 연결 실패");
      showBanner("error");
      return;
    }
    // 응답이 3초를 넘으면 콜드스타트로 간주하고 안내를 남겨둔다.
    if (h.ms > 3000) showBanner("cold");
    else hideBanner();
    setStatus("ok", "API 200 · " + (h.ms / 1000).toFixed(1) + "s");

    try {
      await Promise.all([DataView.refresh(), Conversations.refresh()]);
    } catch (err) {
      setStatus("error", "데이터 로드 실패");
      showBanner("error", "데이터를 불러오지 못했습니다: " + err.message);
    }
  }

  function init() {
    els.banner = document.getElementById("banner");
    els.bannerTag = document.getElementById("banner-tag");
    els.bannerText = document.getElementById("banner-text");
    els.bannerAction = document.getElementById("banner-action");
    els.status = document.getElementById("api-status");
    els.statusText = document.getElementById("api-status-text");
    document.getElementById("api-base-label").textContent = "API_BASE_URL · " + API.BASE_URL;
  }

  return { init, boot, setStatus, showBanner };
})();

document.addEventListener("DOMContentLoaded", () => {
  Theme.init();
  Tabs.init();
  App.init();
  Chat.init();
  DataView.init();
  Conversations.init();

  Chat.startNewConversation();
  Tabs.activate("chat");
  App.boot(false);
});
