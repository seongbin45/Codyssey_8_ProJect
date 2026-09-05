// 데이터 관리(CRUD) + 요약 UI 로직
const DataView = (() => {
  const els = {};
  let editingId = null;

  function init() {
    els.form = document.getElementById("data-form");
    els.dateInput = document.getElementById("data-date");
    els.valueInput = document.getElementById("data-value");
    els.memoInput = document.getElementById("data-memo");
    els.submitBtn = document.getElementById("data-submit-btn");
    els.cancelBtn = document.getElementById("data-cancel-btn");
    els.tableBody = document.getElementById("data-table-body");
    els.summaryCards = document.getElementById("summary-cards");

    els.form.addEventListener("submit", onSubmit);
    els.cancelBtn.addEventListener("click", resetForm);
  }

  function resetForm() {
    editingId = null;
    els.form.reset();
    els.submitBtn.textContent = "추가";
    els.cancelBtn.hidden = true;
  }

  async function onSubmit(e) {
    e.preventDefault();
    const payload = {
      date: els.dateInput.value,
      value: parseFloat(els.valueInput.value),
      memo: els.memoInput.value || null,
    };

    try {
      if (editingId) {
        await API.updateData(editingId, payload);
      } else {
        await API.addData(payload);
      }
      resetForm();
      await refresh();
    } catch (err) {
      alert(`저장 실패: ${err.message}`);
    }
  }

  function startEdit(item) {
    editingId = item.id;
    els.dateInput.value = item.date;
    els.valueInput.value = item.value;
    els.memoInput.value = item.memo || "";
    els.submitBtn.textContent = "수정 완료";
    els.cancelBtn.hidden = false;
    els.dateInput.focus();
  }

  async function removeItem(id) {
    if (!confirm("이 데이터를 삭제할까요?")) return;
    try {
      await API.deleteData(id);
      await refresh();
    } catch (err) {
      alert(`삭제 실패: ${err.message}`);
    }
  }

  function renderTable(items) {
    els.tableBody.innerHTML = "";
    if (items.length === 0) {
      els.tableBody.innerHTML = `<tr><td colspan="4" class="empty-row">데이터가 없어요.</td></tr>`;
      return;
    }

    const sorted = [...items].sort((a, b) => (a.date < b.date ? 1 : -1));
    for (const item of sorted) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${item.date}</td>
        <td>${Number(item.value).toLocaleString()}</td>
        <td>${item.memo || ""}</td>
        <td class="row-actions"></td>
      `;
      const actionsCell = tr.querySelector(".row-actions");

      const editBtn = document.createElement("button");
      editBtn.textContent = "수정";
      editBtn.className = "btn btn--ghost btn--sm";
      editBtn.addEventListener("click", () => startEdit(item));

      const delBtn = document.createElement("button");
      delBtn.textContent = "삭제";
      delBtn.className = "btn btn--danger btn--sm";
      delBtn.addEventListener("click", () => removeItem(item.id));

      actionsCell.appendChild(editBtn);
      actionsCell.appendChild(delBtn);
      els.tableBody.appendChild(tr);
    }
  }

  function renderSummary(summary) {
    els.summaryCards.innerHTML = `
      <div class="summary-card">
        <span class="summary-card__label">기간</span>
        <span class="summary-card__value">${summary.period}</span>
      </div>
      <div class="summary-card">
        <span class="summary-card__label">데이터 개수</span>
        <span class="summary-card__value">${summary.count}개</span>
      </div>
      <div class="summary-card">
        <span class="summary-card__label">평균</span>
        <span class="summary-card__value">${Number(summary.metrics.average).toLocaleString()}</span>
      </div>
      <div class="summary-card">
        <span class="summary-card__label">최대</span>
        <span class="summary-card__value">${Number(summary.metrics.max).toLocaleString()}</span>
      </div>
      <div class="summary-card">
        <span class="summary-card__label">최소</span>
        <span class="summary-card__value">${Number(summary.metrics.min).toLocaleString()}</span>
      </div>
      <div class="summary-card summary-card--trend">
        <span class="summary-card__label">최근 트렌드</span>
        <span class="summary-card__value">${summary.trend}</span>
      </div>
    `;
  }

  async function refresh() {
    const [items, summary] = await Promise.all([API.getDataList(), API.getSummary()]);
    renderTable(items);
    renderSummary(summary);
  }

  return { init, refresh };
})();
