// 라이트/다크 테마 토글 (보너스 과제) — 선택값은 localStorage에 유지
const Theme = (() => {
  const KEY = "ai-assistant-theme";
  let btn = null;

  function apply(name) {
    document.documentElement.dataset.theme = name;
    if (btn) btn.textContent = name === "dark" ? "LIGHT" : "DARK";
    try { localStorage.setItem(KEY, name); } catch (e) {}
  }

  function current() {
    return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  }

  function init() {
    btn = document.getElementById("theme-btn");
    let saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) {}
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    apply(saved || (prefersDark ? "dark" : "light"));
    btn.addEventListener("click", () => apply(current() === "dark" ? "light" : "dark"));
  }

  return { init, current };
})();
