const API_BASE = "http://localhost:5000";

const historyForm = document.getElementById("historyForm");
const historyMsg = document.getElementById("historyMsg");
const historyTotal = document.getElementById("historyTotal");
const historyPassed = document.getElementById("historyPassed");
const historyFailed = document.getElementById("historyFailed");
const historyPassBar = document.getElementById("historyPassBar");
const historyFailBar = document.getElementById("historyFailBar");
const historyList = document.getElementById("historyList");
const historyDateInput = historyForm?.querySelector('input[name="date"]');

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "request_failed");
  }
  if (data.ok === false) {
    throw new Error(data.error || "request_failed");
  }
  return data;
}

function setHistorySummary(total, passed, failed) {
  if (historyTotal) historyTotal.textContent = `${total}`;
  if (historyPassed) historyPassed.textContent = `${passed}`;
  if (historyFailed) historyFailed.textContent = `${failed}`;

  const passPercent = total > 0 ? Math.round((passed / total) * 100) : 0;
  const failPercent = total > 0 ? 100 - passPercent : 0;

  if (historyPassBar) historyPassBar.style.width = `${passPercent}%`;
  if (historyFailBar) historyFailBar.style.width = `${failPercent}%`;
}

function renderHistoryList(records) {
  if (!historyList) return;
  historyList.innerHTML = "";
  if (!records || records.length === 0) {
    const li = document.createElement("li");
    li.className = "history-empty";
    li.textContent = "No records for this date.";
    historyList.appendChild(li);
    return;
  }

  records.forEach((record) => {
    const li = document.createElement("li");
    li.className = "history-item";

    const badge = document.createElement("span");
    badge.className = `badge ${record.isPassed ? "pass" : "fail"}`;
    badge.textContent = record.isPassed ? "PASS" : "FAIL";

    const info = document.createElement("div");
    info.className = "history-info";

    const title = document.createElement("div");
    title.className = "history-title";
    const stdn = record.applicantStdn || "-";
    const no = record.applicantNo ?? "-";
    const name = record.applicantName || "Unknown";
    title.textContent = `${name} (${stdn}-${no})`;

    const meta = document.createElement("div");
    meta.className = "muted";
    const time = record.applyTime || "--:--";
    const fileName = record.file_name || "no file";
    meta.textContent = `${time} · ${fileName}`;

    info.appendChild(title);
    info.appendChild(meta);

    li.appendChild(badge);
    li.appendChild(info);
    historyList.appendChild(li);
  });
}

async function loadHistory(date) {
  if (!date) return;
  if (historyMsg) historyMsg.textContent = "";
  setHistorySummary(0, 0, 0);
  renderHistoryList([]);
  try {
    const data = await api(`/api/query_records?date=${encodeURIComponent(date)}`);
    const total = Number(data.total) || 0;
    const passed = Number(data.passed) || 0;
    const failed = Number(data.failed) || 0;
    setHistorySummary(total, passed, failed);
    renderHistoryList(data.records || []);
  } catch (err) {
    if (historyMsg) historyMsg.textContent = err.message;
  }
}

function initHistory() {
  if (!historyForm || !historyDateInput) return;
  if (!historyDateInput.value) {
    const today = new Date();
    historyDateInput.value = today.toISOString().slice(0, 10);
  }
  loadHistory(historyDateInput.value);
}

historyForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!historyDateInput) return;
  loadHistory(historyDateInput.value);
});

document.addEventListener("DOMContentLoaded", initHistory);
