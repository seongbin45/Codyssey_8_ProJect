// 백엔드 API 호출 공통 모듈
const API = (() => {
  const BASE_URL = window.APP_CONFIG.API_BASE_URL;

  async function request(path, options = {}) {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });

    if (!res.ok) {
      let detail = res.statusText;
      try {
        const body = await res.json();
        detail = body.detail || detail;
      } catch (_) {
        // 응답 본문이 JSON이 아닌 경우 statusText 그대로 사용
      }
      throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
    }

    if (res.status === 204) return null;
    return res.json();
  }

  return {
    // 데이터 CRUD + 요약
    getDataList: () => request("/api/data"),
    getSummary: () => request("/api/data/summary"),
    addData: (data) => request("/api/data", { method: "POST", body: JSON.stringify(data) }),
    updateData: (id, data) => request(`/api/data/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    deleteData: (id) => request(`/api/data/${id}`, { method: "DELETE" }),

    // 대화 기록
    getConversations: () => request("/api/conversations"),
    getConversation: (id) => request(`/api/conversations/${id}`),
    deleteConversation: (id) => request(`/api/conversations/${id}`, { method: "DELETE" }),

    // AI 챗봇
    chat: (message, conversationId) =>
      request("/api/chat", {
        method: "POST",
        body: JSON.stringify({ message, conversation_id: conversationId || null }),
      }),
  };
})();
