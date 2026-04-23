const API_BASE = window.API_BASE || "";

const weekMondayInput = document.getElementById("weekMonday");
const lmBaseUrlInput = document.getElementById("lmBaseUrl");
const lmModelInput = document.getElementById("lmModel");
const btnSetCurrentMonday = document.getElementById("btnSetCurrentMonday");
const btnLoadBatch = document.getElementById("btnLoadBatch");
const btnSelectAll = document.getElementById("btnSelectAll");
const btnRunScore = document.getElementById("btnRunScore");
const btnWriteBack = document.getElementById("btnWriteBack");
const btnExportCsv = document.getElementById("btnExportCsv");
const scoreMsg = document.getElementById("scoreMsg");
const scoreTableBody = document.getElementById("scoreTableBody");

let stateRecords = [];
const scoreMap = new Map();

function setMsg(text, isError = true) {
  if (!scoreMsg) return;
  scoreMsg.style.color = isError ? "#dc2626" : "#166534";
  scoreMsg.textContent = text || "";
}

function getTodayIsoLocal() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

function getMondayIso(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(
    2,
    "0"
  )}`;
}

function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(
    2,
    "0"
  )}`;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text == null ? "" : String(text);
  return div.innerHTML;
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

function recordSummary(record) {
  const data = record.data || {};
  if (record.app_type === "in") {
    return [data.teachingRelation, data.purpose, data.content, data.note]
      .filter(Boolean)
      .join(" ");
  }
  return [data.relevance, data.courseTitle, data.organizer, data.content, data.note]
    .filter(Boolean)
    .join(" ");
}

function isInWeek(record, mondayIso) {
  const start = mondayIso;
  const end = addDays(mondayIso, 6);
  const createdDate = (record.created_at || "").slice(0, 10);
  return createdDate >= start && createdDate <= end;
}

function getSelectedIds() {
  return Array.from(document.querySelectorAll('input[name="pick"]:checked')).map((el) => Number(el.value));
}

function scoreClass(score) {
  if (typeof score !== "number") return "";
  if (score >= 75) return "score-high";
  if (score >= 50) return "score-mid";
  return "score-low";
}

function renderTable() {
  if (!scoreTableBody) return;
  const rows = stateRecords
    .map((record) => {
      const scored = scoreMap.get(record.id);
      const summary = recordSummary(record).slice(0, 180);
      const resultText = scored?.reason || "";
      return `
        <tr>
          <td><input name="pick" type="checkbox" value="${record.id}" ${scored ? "checked" : ""}></td>
          <td>${record.id}</td>
          <td>${escapeHtml(record.created_at || "-")}</td>
          <td>${record.app_type === "in" ? "校內" : "校外"}</td>
          <td>${escapeHtml(record.unit_name || "-")}</td>
          <td>${escapeHtml(record.event_name || "-")}</td>
          <td class="summary-cell">${escapeHtml(summary || "-")}</td>
          <td class="${scoreClass(scored?.score)}">${scored?.score ?? "-"}</td>
          <td>${escapeHtml(resultText)}</td>
        </tr>
      `;
    })
    .join("");
  scoreTableBody.innerHTML = rows || `<tr><td colspan="9">本週一批次無資料。</td></tr>`;
}

async function loadBatchRecords() {
  const mondayIso = weekMondayInput?.value || getMondayIso();
  const records = await api("/api/applications?type=all");
  stateRecords = (records || [])
    .filter((record) => isInWeek(record, mondayIso))
    .filter((record) => !scoreMap.has(record.id));
  renderTable();
  setMsg(`已載入 ${stateRecords.length} 筆（${mondayIso} 到 ${addDays(mondayIso, 6)}）。`, false);
}

function getBatchPayload(records) {
  return records.map((record) => ({
    id: record.id,
    app_type: record.app_type,
    unit_name: record.unit_name,
    event_name: record.event_name,
    event_date: record.event_date,
    content: recordSummary(record),
  }));
}

async function runBatchScoring() {
  const selectedIds = getSelectedIds();
  const selected = stateRecords.filter((record) => selectedIds.includes(record.id));
  if (!selected.length) {
    setMsg("請先勾選要評分的資料。");
    return;
  }
  setMsg("批次評分中...", false);
  const data = await api("/api/lmstudio/relevance/score-batch", {
    method: "POST",
    body: JSON.stringify({
      base_url: lmBaseUrlInput?.value?.trim(),
      model: lmModelInput?.value?.trim(),
      items: getBatchPayload(selected),
    }),
  });
  (data.results || []).forEach((item) => {
    scoreMap.set(item.id, item);
  });
  renderTable();
  setMsg(`評分完成：${data.count || 0} 筆。`, false);
}

function buildReviewComment(oldComment, scoreResult) {
  const lines = [
    `[LM相關度分數] ${scoreResult?.score ?? "N/A"}/100`,
    `[LM評語] ${(scoreResult?.reason || "").slice(0, 240)}`,
  ];
  if (!oldComment) return lines.join("\n");
  if (String(oldComment).includes("[LM相關度分數]")) return String(oldComment);
  return `${oldComment}\n${lines.join("\n")}`.trim();
}

async function writeBackScores() {
  const selectedIds = getSelectedIds();
  const selected = stateRecords.filter((record) => selectedIds.includes(record.id));
  const ready = selected.filter((record) => scoreMap.has(record.id));
  if (!ready.length) {
    setMsg("請先執行評分後再回寫。");
    return;
  }
  setMsg("回寫審核備註中...", false);
  let done = 0;
  for (const record of ready) {
    const scored = scoreMap.get(record.id);
    const payload = {
      status: record.status || "pending",
      approved_hours: record.approved_hours ?? "",
      review_comment: buildReviewComment(record.review_comment, scored),
    };
    await api(`/api/applications/${record.id}/review`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    done += 1;
  }
  setMsg(`回寫完成：${done} 筆。`, false);
}

function exportCsv() {
  const rows = [["id", "created_at", "unit_name", "event_name", "score", "reason"]];
  for (const record of stateRecords) {
    const scored = scoreMap.get(record.id);
    rows.push([
      record.id,
      record.created_at || "",
      record.unit_name || "",
      record.event_name || "",
      scored?.score ?? "",
      (scored?.reason || "").replace(/\r?\n/g, " "),
    ]);
  }
  const csv = rows
    .map((cols) =>
      cols
        .map((col) => `"${String(col).replace(/"/g, '""')}"`)
        .join(",")
    )
    .join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const mondayIso = weekMondayInput?.value || getTodayIsoLocal();
  a.download = `lm_batch_score_${mondayIso}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

btnSetCurrentMonday?.addEventListener("click", () => {
  if (weekMondayInput) weekMondayInput.value = getMondayIso();
});

btnLoadBatch?.addEventListener("click", () => {
  loadBatchRecords().catch((err) => setMsg(err.message));
});

btnSelectAll?.addEventListener("click", () => {
  document.querySelectorAll('input[name="pick"]').forEach((el) => {
    el.checked = true;
  });
});

btnRunScore?.addEventListener("click", () => {
  runBatchScoring().catch((err) => setMsg(err.message));
});

btnWriteBack?.addEventListener("click", () => {
  writeBackScores().catch((err) => setMsg(err.message));
});

btnExportCsv?.addEventListener("click", exportCsv);

document.addEventListener("DOMContentLoaded", () => {
  if (weekMondayInput) weekMondayInput.value = getMondayIso();
});

window.__authUserPromise
  ?.then((user) => {
    if (user?.role !== "root") {
      window.location.href = "history";
      return;
    }
    loadBatchRecords().catch((err) => setMsg(err.message));
  })
  .catch(() => {});
