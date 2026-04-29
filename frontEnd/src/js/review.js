const API_BASE = window.API_BASE || "";

const reviewList = document.getElementById("reviewList");
const reviewMsg = document.getElementById("reviewMsg");
const btnRefresh = document.getElementById("btnReviewRefresh");
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

function esc(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getActiveStatus() {
  return tabs.find((tab) => tab.classList.contains("is-active"))?.dataset.status || "all";
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

function renderItem(record) {
  const status = normalizeStatus(record.status);
  const hours = record.data?.hours ?? "-";
  return `
    <a class="review-link-card review-item history-item" href="review_detail?id=${encodeURIComponent(record.id)}">
      <div class="history-summary-left" style="margin-right:16px;">
        <span class="history-badge ${record.app_type}">${fmtType(record.app_type)}</span>
      </div>
      <div class="history-summary-main">
        <h4 class="history-summary-title">${esc(record.event_name || "-")}</h4>
        <div class="history-summary-meta">
          <span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            ${esc(record.event_date || "-")}
          </span>
          <span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
            ${esc(record.unit_name || "-")}
          </span>
          <span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            ${esc(record.account || "-")}
          </span>
        </div>
      </div>
      <div class="history-summary-right">
        <div class="history-hours">
          <span class="history-hours-val">${esc(hours)}</span>
          <span class="history-hours-lbl">小時</span>
        </div>
        <span class="status-badge ${status}">${fmtStatus(status)}</span>
        <div class="history-chevron">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </div>
      </div>
    </a>
  `;
}

function renderList(records) {
  if (!reviewList) return;
  const statusFilter = getActiveStatus();
  const filtered =
    statusFilter === "all"
      ? records
      : records.filter((r) => normalizeStatus(r.status) === statusFilter);

  reviewList.innerHTML = "";
  if (!filtered.length) {
    reviewList.innerHTML = `<div class="muted">目前沒有資料。</div>`;
    return;
  }

  filtered.forEach((record) => {
    const item = document.createElement("div");
    item.innerHTML = renderItem(record);
    reviewList.appendChild(item.firstElementChild);
  });
}

async function loadReviews() {
  if (reviewMsg) reviewMsg.textContent = "";
  const records = await api("/api/applications/admin/list?type=all");
  renderList(records || []);
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    loadReviews().catch((err) => {
      if (reviewMsg) reviewMsg.textContent = err.message;
    });
  });
});

btnRefresh?.addEventListener("click", () => {
  loadReviews().catch((err) => {
    if (reviewMsg) reviewMsg.textContent = err.message;
  });
});

window.__authUserPromise
  ?.then((user) => {
    if (user?.role !== "root") {
      window.location.href = "history";
      return;
    }
    loadReviews().catch((err) => {
      if (reviewMsg) reviewMsg.textContent = err.message;
    });
  })
  .catch(() => {});
