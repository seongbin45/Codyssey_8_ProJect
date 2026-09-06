// 데이터 관리(CRUD) + 요약 카드 + 추이 그래프 + 내보내기
const DataView = (() => {
  const els = {};
  let editingId = null;
  let items = [];
  let summary = null;
  let range = 0; // 0 = 전체

  const VISIBLE_ROWS = 10;

  function init() {
    els.form = document.getElementById("data-form");
    els.date = document.getElementById("data-date");
    els.value = document.getElementById("data-value");
    els.memo = document.getElementById("data-memo");
    els.submit = document.getElementById("data-submit-btn");
    els.cancel = document.getElementById("data-cancel-btn");
    els.body = document.getElementById("data-table-body");
    els.count = document.getElementById("data-count");
    els.cards = document.getElementById("summary-cards");
    els.trend = document.getElementById("trend-chip");
    els.chart = document.getElementById("chart");
    els.chartX = document.getElementById("chart-x");
    els.chartNote = document.getElementById("chart-note");

    els.form.addEventListener("submit", onSubmit);
    els.cancel.addEventListener("click", resetForm);
    els.date.value = new Date().toISOString().slice(0, 10);

    document.getElementById("export-csv").addEventListener("click", exportCsv);
    document.getElementById("export-json").addEventListener("click", exportJson);

    document.getElementById("range-group").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-range]");
      if (!btn) return;
      range = Number(btn.dataset.range);
      document.querySelectorAll("#range-group button").forEach((b) => {
        b.setAttribute("aria-pressed", String(b === btn));
      });
      renderChart();
    });
  }

  function fmt(n) { return Number(n).toLocaleString(); }

  function resetForm() {
    editingId = null;
    els.form.reset();
    els.date.value = new Date().toISOString().slice(0, 10);
    els.submit.textContent = "추가";
    els.cancel.hidden = true;
    renderTable();
  }

  async function onSubmit(e) {
    e.preventDefault();
    const payload = {
      date: els.date.value,
      value: parseFloat(els.value.value),
      memo: els.memo.value || null,
    };
    if (!payload.date || Number.isNaN(payload.value)) {
      App.showBanner("error", "날짜와 값을 올바르게 입력해주세요.");
      return;
    }
    els.submit.disabled = true;
    try {
      if (editingId) await API.updateData(editingId, payload);
      else await API.addData(payload);
      resetForm();
      await refresh();
    } catch (err) {
      App.showBanner("error", "저장 실패: " + err.message);
    } finally {
      els.submit.disabled = false;
    }
  }

  function startEdit(item) {
    editingId = item.id;
    els.date.value = item.date;
    els.value.value = item.value;
    els.memo.value = item.memo || "";
    els.submit.textContent = "수정 완료";
    els.cancel.hidden = false;
    renderTable();
    els.date.focus();
  }

  async function removeItem(id) {
    if (!confirm("이 데이터를 삭제할까요?")) return;
    try {
      await API.deleteData(id);
      await refresh();
    } catch (err) {
      App.showBanner("error", "삭제 실패: " + err.message);
    }
  }

  function sortedDesc() {
    return [...items].sort((a, b) => (a.date < b.date ? 1 : -1));
  }

  function renderTable() {
    const rows = sortedDesc().slice(0, VISIBLE_ROWS);
    els.count.textContent = items.length
      ? items.length + "개 레코드 · 최근 " + rows.length + "건 표시 · 날짜 내림차순"
      : "데이터가 없습니다.";

    els.body.innerHTML = "";
    if (!rows.length) {
      els.body.innerHTML = '<tr><td colspan="4" class="empty">데이터가 없어요. 위 폼으로 첫 데이터를 추가해보세요.</td></tr>';
      return;
    }

    rows.forEach((item) => {
      const tr = document.createElement("tr");
      if (item.id === editingId) tr.className = "editing";
      tr.innerHTML =
        '<td class="date"></td><td class="value num"></td><td class="memo"></td>' +
        '<td><div class="row-actions"></div></td>';
      tr.querySelector(".date").textContent = item.date;
      tr.querySelector(".value").textContent = fmt(item.value);
      tr.querySelector(".memo").textContent = item.memo || "—";

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "btn btn--ghost";
      editBtn.textContent = "수정";
      editBtn.addEventListener("click", () => startEdit(item));

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "btn btn--danger";
      delBtn.textContent = "삭제";
      delBtn.addEventListener("click", () => removeItem(item.id));

      const actions = tr.querySelector(".row-actions");
      actions.appendChild(editBtn);
      actions.appendChild(delBtn);
      els.body.appendChild(tr);
    });
  }

  // 보너스: 표준편차를 추가 지표로 계산 (백엔드 summary에 없으면 클라이언트에서 보강)
  function stdDev(values, mean) {
    if (values.length < 2) return 0;
    const v = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    return Math.sqrt(v);
  }

  function renderSummary() {
    if (!summary) return;
    const m = summary.metrics || {};
    const values = items.map((d) => Number(d.value));
    const avg = Number(m.average || 0);
    const sd = m.std_dev != null ? Number(m.std_dev) : stdDev(values, avg);
    const sdPct = avg ? ((sd / avg) * 100).toFixed(1) + "%" : "—";

    const cards = [
      ["PERIOD", (summary.period || "").split(" ~ ")[0] || "—", "~ " + ((summary.period || "").split(" ~ ")[1] || "")],
      ["COUNT", String(summary.count || 0), "레코드"],
      ["TOTAL", fmt(m.total || 0), "전체 합계"],
      ["AVERAGE", fmt(Math.round(avg)), "일 평균"],
      ["MAX", fmt(m.max || 0), "최고값"],
      ["MIN", fmt(m.min || 0), "최저값"],
      ["STD DEV", fmt(Math.round(sd)), "평균의 " + sdPct],
    ];

    els.cards.innerHTML = "";
    cards.forEach(([label, value, sub]) => {
      const card = document.createElement("div");
      card.className = "summary-card";
      card.innerHTML =
        '<span class="summary-card__label"></span>' +
        '<span class="summary-card__value"></span>' +
        '<span class="summary-card__sub"></span>';
      card.querySelector(".summary-card__label").textContent = label;
      card.querySelector(".summary-card__value").textContent = value;
      card.querySelector(".summary-card__sub").textContent = sub;
      els.cards.appendChild(card);
    });

    els.trend.textContent = "TREND: " + (summary.trend || "—");
  }

  function ascRows() {
    return [...items].sort((a, b) => (a.date < b.date ? -1 : 1));
  }

  function renderChart() {
    const all = ascRows();
    const rows = range ? all.slice(-range) : all;
    const avg = summary && summary.metrics ? Number(summary.metrics.average) : undefined;
    Chart.render(els.chart, rows, { height: 300, grid: true, average: avg, label: rows.length + "일 값 추이 선 그래프" });
    Chart.xLabels(els.chartX, rows);
    els.chartNote.textContent = avg
      ? "점선은 전체 평균(" + fmt(Math.round(avg)) + ")입니다. 트렌드는 최근 5개 평균과 그 이전 5개 평균을 ±5% 기준으로 비교해 판정합니다."
      : "";
    Chat.setSpark(all);
  }

  function exportCsv() {
    const head = "date,value,memo\n";
    const body = ascRows()
      .map((d) => [d.date, d.value, '"' + String(d.memo || "").replace(/"/g, '""') + '"'].join(","))
      .join("\n");
    download("data_export.csv", "\uFEFF" + head + body, "text/csv;charset=utf-8");
  }

  function exportJson() {
    download("data_export.json", JSON.stringify({ summary: summary, data: ascRows() }, null, 2), "application/json");
  }

  function download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type: type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function refresh() {
    const [list, sum] = await Promise.all([API.getDataList(), API.getSummary()]);
    items = list || [];
    summary = sum;
    renderTable();
    renderSummary();
    renderChart();
    Chat.setSummary(sum);
  }

  return { init, refresh };
})();
