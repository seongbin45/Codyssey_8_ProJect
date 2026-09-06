// 백엔드 API 호출 공통 모듈 + 헬스체크/콜드스타트 대응
const API = (() => {
  const BASE_URL = window.APP_CONFIG.API_BASE_URL;

  async function request(path, options = {}) {
    const res = await fetch(BASE_URL + path, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });

    if (!res.ok) {
      let detail = res.statusText;
      try {
        const body = await res.json();
        detail = body.detail || detail;
      } catch (_) {}
      throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
    }

    if (res.status === 204) return null;
    return res.json();
  }

  // 루트 헬스체크. Render 무료 티어 콜드스타트를 감지하기 위해 응답 시간도 함께 반환한다.
  async function health() {
    const t0 = performance.now();
    try {
      const res = await fetch(BASE_URL + "/", { method: "GET" });
      return { ok: res.ok, ms: Math.round(performance.now() - t0) };
    } catch (e) {
      return { ok: false, ms: Math.round(performance.now() - t0), error: e.message };
    }
  }

  return {
    BASE_URL,
    health,
    getDataList: () => request("/api/data"),
    getSummary: () => request("/api/data/summary"),
    addData: (data) => request("/api/data", { method: "POST", body: JSON.stringify(data) }),
    updateData: (id, data) => request("/api/data/" + id, { method: "PUT", body: JSON.stringify(data) }),
    deleteData: (id) => request("/api/data/" + id, { method: "DELETE" }),

    getConversations: () => request("/api/conversations"),
    getConversation: (id) => request("/api/conversations/" + id),
    deleteConversation: (id) => request("/api/conversations/" + id, { method: "DELETE" }),

    chat: (message, conversationId) =>
      request("/api/chat", {
        method: "POST",
        body: JSON.stringify({ message, conversation_id: conversationId || null }),
      }),
  };
})();
