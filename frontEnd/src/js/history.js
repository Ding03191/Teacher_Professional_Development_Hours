const API_BASE = window.API_BASE || "";

const historyList = document.getElementById("historyList");
const historyMsg = document.getElementById("historyMsg");
const btnRefresh = document.getElementById("btnRefresh");
const tabs = Array.from(document.querySelectorAll(".tab"));

function fmtType(type) {
  return type === "in" ? "校內" : "校外";
}

function normalizeStatus(status) {
  const v = (status || "pending").toString().toLowerCase();
  if (v === "approved") return "approved";
  if (v === "rejected") return "rejected";
  return "pending";
}

function fmtStatus(status) {
  const s = normalizeStatus(status);
  if (s === "approved") return "通過";
  if (s === "rejected") return "退件";
  return "待審核";
}

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || "request_failed");
  }
  return data.data;
}

function getActiveType() {
  return tabs.find((tab) => tab.classList.contains("is-active"))?.dataset.type || "all";
}

function initActiveTypeFromQuery() {
  const type = new URLSearchParams(window.location.search).get("type");
  if (!type) return;
  const target = tabs.find((tab) => tab.dataset.type === type);
  if (!target) return;
  tabs.forEach((t) => t.classList.remove("is-active"));
  target.classList.add("is-active");
}

function renderList(records) {
  if (!historyList) return;
  historyList.innerHTML = "";
  if (!records.length) {
    historyList.innerHTML = `<div class="muted">目前沒有歷史申請紀錄。</div>`;
    return;
  }

  records.forEach((record) => {
    let hours = "-";
    if (record.approved_hours !== null && record.approved_hours !== undefined) {
      hours = record.approved_hours;
    } else if (record.data && record.data.hours !== undefined && record.data.hours !== "") {
      hours = record.data.hours;
    }

    const item = document.createElement("div");
    item.className = "history-item";
    item.innerHTML = `
      <a class="history-summary" href="history_detail?id=${record.id}&type=${getActiveType()}">
        <div class="history-summary-left">
          <span class="history-badge ${record.app_type}">${fmtType(record.app_type)}</span>
        </div>
        <div class="history-summary-main">
          <h4 class="history-summary-title">${record.event_name || "無活動名稱"}</h4>
          <div class="history-summary-meta">
            <span title="活動日期">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
              ${record.event_date || "-"}
            </span>
            <span title="申請單位">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
              ${record.unit_name || "-"}
            </span>
          </div>
        </div>
        <div class="history-summary-right">
          <div class="history-hours">
            <span class="history-hours-val">${hours}</span>
            <span class="history-hours-lbl">小時</span>
          </div>
          <span class="status-badge ${normalizeStatus(record.status)}">${fmtStatus(record.status)}</span>
          <div class="history-chevron">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </div>
        </div>
      </a>
    `;
    historyList.appendChild(item);
  });
}

async function loadApplications(type) {
  if (historyMsg) historyMsg.textContent = "";
  const records = await api(`/api/applications?type=${encodeURIComponent(type)}`);
  renderList(records || []);
}

tabs.forEach((tab) => {
  tab.addEventListener("click", async () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    await loadApplications(getActiveType());
  });
});

btnRefresh?.addEventListener("click", () => loadApplications(getActiveType()));

document.addEventListener("DOMContentLoaded", () => {
  initActiveTypeFromQuery();
  loadApplications(getActiveType());
});

