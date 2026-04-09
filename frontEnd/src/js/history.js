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
  return v === "approved" ? "approved" : "pending";
}

function fmtStatus(status) {
  return normalizeStatus(status) === "approved" ? "已通過" : "待審核";
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
    historyList.innerHTML = `<div class="muted">目前沒有紀錄。</div>`;
    return;
  }

  records.forEach((record) => {
    const item = document.createElement("div");
    item.className = "history-item";
    item.innerHTML = `
      <a class="history-summary history-summary-link" href="history_detail?id=${record.id}&type=${getActiveType()}">
        <span class="history-badge ${record.app_type}">${fmtType(record.app_type)}</span>
        <span class="status-badge ${normalizeStatus(record.status)}">${fmtStatus(record.status)}</span>
        <strong>${record.event_name || "-"}</strong>
        <span class="muted">${record.event_date || "-"}</span>
        <span class="muted">${record.unit_name || "-"}</span>
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
