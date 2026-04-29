const API_BASE = window.API_BASE || "";

const detailRoot = document.getElementById("detailRoot");
const detailMsg = document.getElementById("detailMsg");
const btnBack = document.getElementById("btnBack");

const FIELD_DEFS = {
  in: [
    { key: "organizerDept", label: "主辦單位", type: "text" },
    { key: "eventName", label: "活動名稱", type: "text" },
    { key: "hostName", label: "主講人", type: "text" },
    { key: "ext", label: "聯絡分機", type: "text" },
    { key: "location", label: "活動地點", type: "text" },
    { key: "domain", label: "活動領域", type: "array" },
    { key: "domainOther", label: "其他活動領域", type: "text" },
    { key: "sdg", label: "SDGs 目標", type: "array" },
    { key: "teachingRelation", label: "與教學專業成長關聯性", type: "textarea" },
    { key: "note", label: "備註", type: "textarea" },
  ],
  out: [
    { key: "teacherName", label: "教師姓名", type: "text" },
    { key: "department", label: "任教單位", type: "text" },
    { key: "teacherId", label: "教師編號", type: "text" },
    { key: "ext", label: "聯絡分機", type: "text" },
    { key: "courseTitle", label: "課程 / 活動名稱", type: "text" },
    { key: "organizer", label: "舉辦單位", type: "text" },
    { key: "relevance", label: "與教師專業成長關聯性", type: "textarea" },
    { key: "hasCert", label: "是否核發證書", type: "text" },
    { key: "certNo", label: "證書字號", type: "text" },
    { key: "evidenceLink", label: "佐證連結", type: "text" },
  ],
};

let currentRecord = null;

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

function setMsg(type, text) {
  // detailMsg is rendered inside detailRoot; query it each time
  const el = document.getElementById("detailMsg") || detailMsg;
  if (!el) return;
  el.style.color = type === "error" ? "#dc2626" : "#16a34a";
  el.textContent = text || "";
}

function esc(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function arrToText(v) {
  if (Array.isArray(v)) return v.join("、");
  return v || "";
}

function buildEventDate(start, end) {
  const s = (start || "").trim();
  const e = (end || "").trim();
  if (s && e) return `${s} ~ ${e}`;
  return s || e || "";
}

function parseSlotDateTime(dateValue, timeValue) {
  if (!dateValue || !timeValue) return null;
  const d = new Date(`${dateValue}T${timeValue}:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function calcRoundedHoursFromSlots(slots) {
  const totalMinutes = slots.reduce((sum, slot) => {
    const start = parseSlotDateTime(slot.startDate, slot.startTime);
    const end = parseSlotDateTime(slot.endDate, slot.endTime);
    if (!start || !end || end <= start) return sum;
    return sum + Math.round((end.getTime() - start.getTime()) / 60000);
  }, 0);
  if (totalMinutes <= 0) return "";
  return String(Math.min(4, Math.max(1, Math.round(totalMinutes / 60))));
}

function getRecordSlots(record) {
  const fromBackend = (record?.time_slots || [])
    .map((s) => ({
      startDate: s.slot_date || "",
      endDate: s.slot_end_date || s.slot_date || "",
      startTime: s.start_time || "",
      endTime: s.end_time || "",
    }))
    .filter((s) => s.startDate || s.endDate || s.startTime || s.endTime);
  if (fromBackend.length) return fromBackend;

  const fromData = (record?.data?.timeSlots || [])
    .map((s) => ({
      startDate: s.startDate || s.slotDate || s.slot_date || "",
      endDate: s.endDate || s.slotEndDate || s.slot_end_date || s.startDate || s.slotDate || s.slot_date || "",
      startTime: s.startTime || s.start_time || "",
      endTime: s.endTime || s.end_time || "",
    }))
    .filter((s) => s.startDate || s.endDate || s.startTime || s.endTime);
  if (fromData.length) return fromData;

  return [
    {
      startDate: record?.data?.eventDateStart || "",
      endDate: record?.data?.eventDateEnd || record?.data?.eventDateStart || "",
      startTime: record?.data?.startTime || "",
      endTime: record?.data?.endTime || "",
    },
  ].filter((s) => s.startDate || s.endDate || s.startTime || s.endTime);
}

function normalizeRecord(record) {
  if (!record) return record;
  const data = { ...(record.data || {}) };
  const slots = getRecordSlots(record);
  const first = slots[0] || {};
  const startDates = slots.map((s) => s.startDate).filter(Boolean).sort();
  const endDates = slots.map((s) => s.endDate).filter(Boolean).sort();

  data.eventDateStart = data.eventDateStart || startDates[0] || endDates[0] || "";
  data.eventDateEnd = data.eventDateEnd || endDates[endDates.length - 1] || data.eventDateStart || "";
  data.startTime = data.startTime || first.startTime || "";
  data.endTime = data.endTime || first.endTime || "";
  data.hours = calcRoundedHoursFromSlots(slots) || data.hours || "";
  data.eventDate = buildEventDate(data.eventDateStart, data.eventDateEnd);

  return { ...record, data };
}

function fileExt(name) {
  const n = (name || "").toLowerCase();
  const idx = n.lastIndexOf(".");
  return idx >= 0 ? n.slice(idx) : "";
}

function renderValue(def, value) {
  const v = def.type === "array" ? arrToText(value) : value || "";
  if (!v) return `<div class="review-readonly muted">未填寫</div>`;

  if (def.key === "hasCert") {
    const text = String(v).toLowerCase() === "yes" ? "是" : String(v).toLowerCase() === "no" ? "否" : v;
    return `<div class="review-readonly">${esc(text)}</div>`;
  }

  if (def.key === "evidenceLink") {
    const safe = esc(v);
    return `<div class="review-readonly"><a href="${safe}" target="_blank" rel="noopener">${safe}</a></div>`;
  }

  const multiline = def.type === "textarea";
  return `<div class="review-readonly${multiline ? " multiline" : ""}">${esc(v)}</div>`;
}

function renderTimeSlots(record) {
  const slots = getRecordSlots(record);
  if (!slots.length) return `<div class="review-readonly muted">未填寫</div>`;
  return `
    <div class="slot-list">
      ${slots
        .map((slot, index) => {
          const dateText = buildEventDate(slot.startDate, slot.endDate) || "-";
          const timeText =
            slot.startTime || slot.endTime ? `${slot.startTime || "-"} ~ ${slot.endTime || "-"}` : "-";
          return `
            <div class="slot-card">
              <div class="slot-index">時段 ${index + 1}</div>
              <div class="slot-date">${esc(dateText)}</div>
              <div class="slot-time">${esc(timeText)}</div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderAttachments(record) {
  const files = record.data?.attachments_files || [];
  const names = record.data?.attachments || [];
  if (!files.length && !names.length) {
    return `<div class="muted" style="padding:12px 0;">無附件</div>`;
  }

  const EXT_META = {
    ".pdf":  { color: "#ef4444", label: "PDF",  emoji: "📄", type: "pdf" },
    ".doc":  { color: "#2563eb", label: "DOC",  emoji: "📝", type: "other" },
    ".docx": { color: "#2563eb", label: "DOCX", emoji: "📝", type: "other" },
    ".xls":  { color: "#16a34a", label: "XLS",  emoji: "📊", type: "other" },
    ".xlsx": { color: "#16a34a", label: "XLSX", emoji: "📊", type: "other" },
    ".jpg":  { color: "#f59e0b", label: "JPG",  emoji: "🖼️", type: "image" },
    ".jpeg": { color: "#f59e0b", label: "JPEG", emoji: "🖼️", type: "image" },
    ".png":  { color: "#8b5cf6", label: "PNG",  emoji: "🖼️", type: "image" },
    ".webp": { color: "#8b5cf6", label: "WEBP", emoji: "🖼️", type: "image" },
    ".gif":  { color: "#ec4899", label: "GIF",  emoji: "🖼️", type: "image" },
  };

  const svgChevron = `<svg class="file-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`;

  const stored = files.map((file, idx) => {
    const name      = file.name || `附件 ${idx + 1}`;
    const ext       = fileExt(name);
    const inlineUrl = `${API_BASE}/api/applications/admin/${record.id}/files/${idx}?inline=1`;
    const m         = EXT_META[ext] || { color: "#6b7280", label: (ext.slice(1) || "FILE").toUpperCase(), emoji: "📎", type: "other" };
    const canPreview = m.type === "pdf" || m.type === "image";

    const previewContent = canPreview
      ? (m.type === "pdf"
          ? `<div class="file-inline-preview"><iframe src="${inlineUrl}" title="${esc(name)}" loading="lazy"></iframe></div>`
          : `<div class="file-inline-preview file-inline-image"><img src="${inlineUrl}" alt="${esc(name)}" loading="lazy"></div>`)
      : `<div class="file-inline-unsupported">此格式不支援預覽</div>`;

    return `
      <details class="file-card-expand">
        <summary class="file-card">
          <div class="file-card-icon" style="background:${m.color}1a; color:${m.color};">
            <span style="font-size:20px;">${m.emoji}</span>
          </div>
          <div class="file-card-info">
            <div class="file-card-name" title="${esc(name)}">${esc(name)}</div>
            <span class="file-type-badge" style="background:${m.color}1a; color:${m.color};">${m.label}</span>
          </div>
          <div class="file-card-chevron">
            ${canPreview ? svgChevron : `<span style="font-size:12px;color:#9ca3af;">不支援預覽</span>`}
          </div>
        </summary>
        ${previewContent}
      </details>`;
  });

  const pending = names
    .filter((n) => !files.some((f) => f.name === n))
    .map((n) => `
      <div class="file-card" style="opacity:.6;">
        <div class="file-card-icon" style="background:#f3f4f6; color:#9ca3af;"><span style="font-size:20px;">📎</span></div>
        <div class="file-card-info">
          <div class="file-card-name">${esc(n)}</div>
          <span class="file-type-badge" style="background:#f3f4f6; color:#9ca3af;">等待上傳</span>
        </div>
      </div>`);

  return `<div class="file-list">${stored.join("")}${pending.join("")}</div>`;
}


function renderStatusHistory(history) {
  const rows = Array.isArray(history) ? history : [];
  if (!rows.length) return `<div class="muted">尚無狀態歷程</div>`;
  return `
    <div class="timeline">
      ${rows
        .map((row) => {
          const fromStatus = row.from_status ? fmtStatus(row.from_status) : "建立";
          const toStatus = fmtStatus(row.to_status);
          const reason = (row.reason || "").trim();
          const isError = row.to_status === "rejected";
          const iconColor = isError ? "#dc2626" : "var(--accent)";
          return `
            <div class="timeline-item">
              <div class="timeline-dot" style="background-color:${iconColor};"></div>
              <div class="timeline-content">
                <div class="timeline-title">${esc(fromStatus)} -> ${esc(toStatus)}</div>
                <div class="timeline-meta">${esc(row.actor || "-")} / ${esc(row.created_at || "-")}</div>
                ${reason ? `<div class="timeline-reason">${esc(reason)}</div>` : ""}
              </div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderGroups(record) {
  const normalized = normalizeRecord(record);
  const defs = FIELD_DEFS[normalized.app_type] || [];
  const groups = {
    out: [
      { title: "申請人資訊", keys: ["teacherName", "department", "teacherId", "ext"] },
      { title: "活動時段", keys: ["timeSlots", "hours"] },
      { title: "活動內容", keys: ["courseTitle", "organizer", "relevance", "hasCert", "certNo", "evidenceLink"] },
    ],
    in: [
      { title: "活動資訊", keys: ["organizerDept", "eventName", "hostName", "ext", "location"] },
      { title: "活動時段", keys: ["timeSlots", "hours"] },
      { title: "教學與成長", keys: ["domain", "domainOther", "sdg", "teachingRelation", "note"] },
    ],
  };

  const currentGroups = groups[normalized.app_type] || [{ title: "申請內容", keys: defs.map((d) => d.key) }];
  return currentGroups
    .map((group) => {
      const fields = group.keys
        .map((key) => {
          if (key === "timeSlots") {
            return `
              <div class="field field-span-2">
                <span class="lbl">活動起追時段</span>
                ${renderTimeSlots(normalized)}
              </div>
            `;
          }
          if (key === "hours") {
            return `
              <div class="field">
                <span class="lbl">申請時數</span>
                <div class="review-readonly">${esc(normalized.data?.hours || "-")}</div>
              </div>
            `;
          }
          const def = defs.find((item) => item.key === key);
          if (!def) return "";
          return `
            <div class="field ${def.type === "textarea" ? "field-span-2" : ""}">
              <span class="lbl">${def.label}</span>
              ${renderValue(def, normalized.data?.[def.key])}
            </div>
          `;
        })
        .join("");

      return `
        <div class="form-group">
          <h4 class="group-title">${group.title}</h4>
          <div class="review-grid">
            ${fields}
          </div>
        </div>
      `;
    })
    .join("");
}

// renderGroupsNew — same logic but uses section-block / section-title
function renderGroupsNew(record) {
  const normalized = normalizeRecord(record);
  const defs = FIELD_DEFS[normalized.app_type] || [];
  const groups = {
    out: [
      { title: "申請人資訊", keys: ["teacherName", "department", "teacherId", "ext"] },
      { title: "活動時段", keys: ["timeSlots", "hours"] },
      { title: "活動內容", keys: ["courseTitle", "organizer", "relevance", "hasCert", "certNo", "evidenceLink"] },
    ],
    in: [
      { title: "活動資訊", keys: ["organizerDept", "eventName", "hostName", "ext", "location"] },
      { title: "活動時段", keys: ["timeSlots", "hours"] },
      { title: "教學與成長", keys: ["domain", "domainOther", "sdg", "teachingRelation", "note"] },
    ],
  };
  const currentGroups = groups[normalized.app_type] || [{ title: "申請內容", keys: defs.map((d) => d.key) }];
  return currentGroups
    .map((group) => {
      const fields = group.keys
        .map((key) => {
          if (key === "timeSlots") {
            return `
              <div class="field field-span-2">
                <span class="lbl">活動起追時段</span>
                ${renderTimeSlots(normalized)}
              </div>`;
          }
          if (key === "hours") {
            return `
              <div class="field">
                <span class="lbl">申請時數</span>
                <div class="review-readonly">${esc(normalized.data?.hours || "-")}</div>
              </div>`;
          }
          const def = defs.find((item) => item.key === key);
          if (!def) return "";
          return `
            <div class="field ${def.type === "textarea" ? "field-span-2" : ""}">
              <span class="lbl">${def.label}</span>
              ${renderValue(def, normalized.data?.[def.key])}
            </div>`;
        })
        .join("");
      return `
        <div class="section-block">
          <div class="section-title">${group.title}</div>
          <div class="review-grid">${fields}</div>
        </div>`;
    })
    .join("");
}

// ── icon helpers ─────────────────────────────────────────────
function svgIcon(path, size = 14) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}
const IC_CALENDAR = svgIcon('<rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>');
const IC_BUILDING = svgIcon('<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline>');
const IC_USER    = svgIcon('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>');
const IC_CHECK   = svgIcon('<polyline points="20 6 9 17 4 12"></polyline>', 16);
const IC_X       = svgIcon('<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>', 16);
const IC_CLOCK   = svgIcon('<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>', 14);

// ── renderReviewForm → now just the sidebar decision card ─────
function renderDecisionCard(record) {
  const statusNormalized = normalizeStatus(record.status);
  const approvedHours =
    record.approved_hours !== null && record.approved_hours !== undefined
      ? record.approved_hours
      : record.data?.hours || "";

  if (statusNormalized === "approved") {
    return `
      <div class="decision-card approved">
        <div class="decision-title">審核結果</div>
        <div class="approved-result">
          ${IC_CHECK}
          已審核通過，核定時數：<strong>${esc(String(approvedHours || "-"))}</strong> 小時
        </div>
      </div>`;
  }

  if (statusNormalized === "rejected") {
    return `
      <div class="decision-card">
        <div class="decision-title">審核狀態</div>
        <div class="approved-result" style="color:#92400e; background:#fff7ed;">
          ${IC_CLOCK}
          此案件已退件，需等申請者修改並重新送審後，才可再次審核。
        </div>
      </div>`;
  }

  return `
    <div class="decision-card">
      <div class="decision-title">審核操作</div>
      <form id="reviewForm">
        <label>
          <span class="lbl-sm">核定時數（小時）</span>
          <input name="approved_hours" type="number" step="0.5" value="${esc(String(approvedHours))}" placeholder="0">
        </label>
        <label>
          <span class="lbl-sm">審核備註 / 退件原因</span>
          <textarea name="review_comment" placeholder="若退件必填；通過則選填">${esc(record.review_comment || "")}</textarea>
        </label>
        <div class="decision-btns">
          <button type="button" id="btnApprove" class="btn primary">${IC_CHECK}審核通過</button>
          <button type="button" id="btnReject"  class="btn danger" >${IC_X}退件</button>
        </div>
      </form>
    </div>`;
}

// ── renderReviewForm kept for backward-compat (unused) ────────
function renderReviewForm(record) { return ""; }

// ── renderDetail → two-column layout ─────────────────────────
function renderDetail(record) {
  if (!detailRoot) return;
  const normalized = normalizeRecord(record);
  const statusNormalized = normalizeStatus(normalized.status);
  const approvedHours =
    normalized.approved_hours !== null && normalized.approved_hours !== undefined
      ? normalized.approved_hours
      : normalized.data?.hours || "";

  detailRoot.innerHTML = `
    <!-- BACK + HERO -->
    <a href="review" class="back-btn" id="btnBack">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
      返回時數審核
    </a>

    <!-- HERO -->
    <div class="detail-hero">
      <div class="detail-hero-info">
        <div class="detail-hero-breadcrumb">
          ${IC_CLOCK}
          ${esc(normalized.event_date || "-")}
        </div>
        <h1 class="detail-hero-title">${esc(normalized.event_name || "-")}</h1>
        <div class="detail-hero-badges">
          <span class="history-badge ${normalized.app_type}">${fmtType(normalized.app_type)}</span>
          <span class="status-badge ${statusNormalized}">${fmtStatus(normalized.status)}</span>
        </div>
        <div class="detail-hero-meta">
          <span>${IC_BUILDING}${esc(normalized.unit_name || "-")}</span>
          <span>${IC_USER}${esc(normalized.account || "-")}</span>
        </div>
      </div>
      <div class="detail-hero-stat">
        <div class="detail-hours-val">${esc(String(normalized.data?.hours || "-"))}</div>
        <div class="detail-hours-lbl">申請時數</div>
      </div>
    </div>

    <!-- TWO-COLUMN BODY -->
    <div class="detail-body">

      <!-- LEFT: content sections -->
      <div class="detail-main">

        <!-- 審核資訊 -->
        <div class="section-block">
          <div class="section-title">審核資訊</div>
          <div class="review-grid">
            <div class="field">
              <span class="lbl">建立時間</span>
              <div class="review-readonly">${esc(normalized.created_at || "-")}</div>
            </div>
            <div class="field">
              <span class="lbl">核定時數</span>
              <div class="review-readonly">${esc(String(approvedHours || "-"))}</div>
            </div>
          </div>
        </div>

        <!-- 申請內容各分組 -->
        ${renderGroupsNew(normalized)}

        <!-- 附件 -->
        <div class="section-block">
          <div class="section-title">附件</div>
          ${renderAttachments(normalized)}
        </div>

        <!-- 狀態歷程 -->
        <div class="section-block">
          <div class="section-title">狀態歷程</div>
          ${renderStatusHistory(normalized.status_history || [])}
        </div>
      </div>

      <!-- RIGHT: sticky sidebar -->
      <div class="detail-sidebar">
        <!-- quick info -->
        <div class="sidebar-info">
          <div class="sidebar-info-row">
            <span class="key">申請時數</span>
            <span class="val">${esc(String(normalized.data?.hours || "-"))} 小時</span>
          </div>
          <div class="sidebar-info-row">
            <span class="key">狀態</span>
            <span class="status-badge ${statusNormalized}">${fmtStatus(normalized.status)}</span>
          </div>
          <div class="sidebar-info-row">
            <span class="key">類型</span>
            <span class="history-badge ${normalized.app_type}">${fmtType(normalized.app_type)}</span>
          </div>
          <div class="sidebar-info-row">
            <span class="key">建立日期</span>
            <span class="val" style="font-size:12px;">${esc((normalized.created_at || "-").slice(0,10))}</span>
          </div>
        </div>

        <!-- decision -->
        ${renderDecisionCard(normalized)}

        <div id="detailMsg" class="msg"></div>
      </div>
    </div>
  `;
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

async function loadDetail() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  if (!id) {
    setMsg("error", "缺少申請編號");
    return;
  }
  if (btnBack) btnBack.href = "review";
  currentRecord = await api(`/api/applications/admin/${id}`);
  renderDetail(currentRecord);
}

async function submitReview(status) {
  if (!currentRecord) return;
  if (normalizeStatus(currentRecord.status) !== "pending") {
    setMsg("error", "目前只有待審核案件可以進行審核。");
    return;
  }
  const form = document.getElementById("reviewForm");
  if (!(form instanceof HTMLFormElement)) return;

  const fd = new FormData(form);
  const payload = {
    status,
    approved_hours: fd.get("approved_hours"),
    review_comment: fd.get("review_comment"),
  };

  if (status === "rejected" && !String(payload.review_comment || "").trim()) {
    setMsg("error", "退件時必須填寫退件原因");
    return;
  }

  try {
    setMsg("success", "送出審核中...");
    await api(`/api/applications/${currentRecord.id}/review`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    setMsg("success", "審核已更新");
    await loadDetail();
  } catch (err) {
    setMsg("error", err.message || "審核更新失敗");
  }
}

detailRoot?.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-action], [id], [data-preview-url]");
  if (!target) return;

  // preview button
  if (target.dataset.previewUrl) {
    openPreviewModal(
      target.dataset.previewUrl,
      target.dataset.previewType,
      target.dataset.previewName
    );
    return;
  }

  const el = event.target;
  if (!(el instanceof HTMLElement)) return;
  if (el.id === "btnApprove") { showApproveDialog(); return; }
  if (el.id === "btnReject")  { showRejectDialog(); }
});

// ── Approve Confirmation Dialog ───────────────────────────────
function initApproveDialog() {
  const dialog = document.createElement("div");
  dialog.id = "approveDialog";
  dialog.className = "confirm-dialog-backdrop";
  dialog.innerHTML = `
    <div class="confirm-dialog" role="alertdialog" aria-modal="true">
      <div class="confirm-dialog-icon approve">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
      <div class="confirm-dialog-body">
        <h3 class="confirm-dialog-title">確認審核通過</h3>
        <p class="confirm-dialog-desc">您即將審核通過此申請。請確認核定時數正確。</p>
        <div class="confirm-dialog-hours">
          核定時數：<strong id="approveDialogHours">—</strong> 小時
        </div>
      </div>
      <div class="confirm-dialog-actions">
        <button type="button" class="confirm-btn confirm-btn-cancel" id="approveDialogCancel">取消</button>
        <button type="button" class="confirm-btn confirm-btn-approve" id="approveDialogConfirm">確認審核通過</button>
      </div>
    </div>
  `;
  document.body.appendChild(dialog);

  function closeDialog() {
    dialog.classList.remove("is-open");
    document.body.style.overflow = "";
  }

  document.getElementById("approveDialogCancel").addEventListener("click", closeDialog);
  dialog.addEventListener("click", (e) => { if (e.target === dialog) closeDialog(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && dialog.classList.contains("is-open")) closeDialog();
  });

  document.getElementById("approveDialogConfirm").addEventListener("click", async () => {
    closeDialog();
    await submitReview("approved");
  });
}

function showApproveDialog() {
  const form = document.getElementById("reviewForm");
  if (!(form instanceof HTMLFormElement)) return;

  const hours = String(new FormData(form).get("approved_hours") || "").trim();
  const hoursEl = document.getElementById("approveDialogHours");
  if (hoursEl) hoursEl.textContent = hours || "—";

  const dialog = document.getElementById("approveDialog");
  if (!dialog) return;
  dialog.classList.add("is-open");
  document.body.style.overflow = "hidden";
  document.getElementById("approveDialogConfirm")?.focus();
}

// ── Reject Confirmation Dialog ─────────────────────────────────
function initRejectDialog() {
  const dialog = document.createElement("div");
  dialog.id = "rejectDialog";
  dialog.className = "confirm-dialog-backdrop";
  dialog.innerHTML = `
    <div class="confirm-dialog" role="alertdialog" aria-modal="true">
      <div class="confirm-dialog-icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
      </div>
      <div class="confirm-dialog-body">
        <h3 class="confirm-dialog-title">確認退件</h3>
        <p class="confirm-dialog-desc">您即將退回此申請。申請人將收到通知，請確認退件原因已填寫完整。</p>
        <div class="confirm-dialog-reason" id="rejectDialogReason"></div>
      </div>
      <div class="confirm-dialog-actions">
        <button type="button" class="confirm-btn confirm-btn-cancel" id="rejectDialogCancel">取消</button>
        <button type="button" class="confirm-btn confirm-btn-danger" id="rejectDialogConfirm">確認退件</button>
      </div>
    </div>
  `;
  document.body.appendChild(dialog);

  function closeDialog() {
    dialog.classList.remove("is-open");
    document.body.style.overflow = "";
  }

  document.getElementById("rejectDialogCancel").addEventListener("click", closeDialog);
  dialog.addEventListener("click", (e) => { if (e.target === dialog) closeDialog(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && dialog.classList.contains("is-open")) closeDialog();
  });

  document.getElementById("rejectDialogConfirm").addEventListener("click", async () => {
    closeDialog();
    await submitReview("rejected");
  });
}

function showRejectDialog() {
  const form = document.getElementById("reviewForm");
  if (!(form instanceof HTMLFormElement)) return;

  const reason = String(new FormData(form).get("review_comment") || "").trim();
  if (!reason) {
    // show warning dialog instead of just inline message
    showWarnDialog();
    return;
  }

  // populate reason preview in dialog
  const reasonEl = document.getElementById("rejectDialogReason");
  if (reasonEl) reasonEl.textContent = reason;

  const dialog = document.getElementById("rejectDialog");
  if (!dialog) return;
  dialog.classList.add("is-open");
  document.body.style.overflow = "hidden";
  document.getElementById("rejectDialogConfirm")?.focus();
}

// ── Missing-Reason Warning Dialog ───────────────────────────────
function initWarnDialog() {
  const warn = document.createElement("div");
  warn.id = "warnDialog";
  warn.className = "confirm-dialog-backdrop";
  warn.innerHTML = `
    <div class="confirm-dialog" role="alertdialog" aria-modal="true">
      <div class="confirm-dialog-icon warn">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      </div>
      <div class="confirm-dialog-body">
        <h3 class="confirm-dialog-title">若退件請說明原因</h3>
        <p class="confirm-dialog-desc">退件必須填寫原因，方便申請人了解退件罗。請回到《審核備註 / 退件原因》欄位填寫完整內容。</p>
      </div>
      <div class="confirm-dialog-actions">
        <button type="button" class="confirm-btn confirm-btn-primary" id="warnDialogOk">我知道了，去填寫</button>
      </div>
    </div>
  `;
  document.body.appendChild(warn);

  function closeWarn() {
    warn.classList.remove("is-open");
    document.body.style.overflow = "";
    // auto-focus the textarea after closing
    const ta = document.querySelector("#reviewForm [name='review_comment']");
    ta?.focus();
  }

  document.getElementById("warnDialogOk").addEventListener("click", closeWarn);
  warn.addEventListener("click", (e) => { if (e.target === warn) closeWarn(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && warn.classList.contains("is-open")) closeWarn();
  });
}

function showWarnDialog() {
  const warn = document.getElementById("warnDialog");
  if (!warn) return;
  warn.classList.add("is-open");
  document.body.style.overflow = "hidden";
  document.getElementById("warnDialogOk")?.focus();
}


function initPreviewModal() {
  const svgClose = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

  const modal = document.createElement("div");
  modal.id = "previewModal";
  modal.className = "preview-modal";
  modal.innerHTML = `
    <div class="preview-modal-box" id="previewModalBox">
      <div class="preview-modal-header">
        <div class="preview-modal-title" id="previewModalTitle">預覽</div>
        <button class="preview-modal-close" id="previewModalClose" type="button" aria-label="關閉">${svgClose}</button>
      </div>
      <div class="preview-modal-body" id="previewModalBody"></div>
    </div>
  `;
  document.body.appendChild(modal);

  function closeModal() {
    modal.classList.remove("is-open");
    document.getElementById("previewModalBody").innerHTML = "";
    document.body.style.overflow = "";
  }

  document.getElementById("previewModalClose").addEventListener("click", closeModal);

  // click backdrop to close
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  // ESC to close
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("is-open")) closeModal();
  });
}

function openPreviewModal(url, type, name) {
  const modal = document.getElementById("previewModal");
  if (!modal) return;

  document.getElementById("previewModalTitle").textContent = name || "預覽";
  const body = document.getElementById("previewModalBody");

  if (type === "image") {
    body.innerHTML = `<img src="${url}" alt="${name || ''}">` ;
  } else if (type === "pdf") {
    body.innerHTML = `<iframe src="${url}" title="${name || ''}"></iframe>`;
  } else {
    body.innerHTML = `<div class="preview-modal-unsupported">此格式不支援預覽</div>`;
  }

  modal.classList.add("is-open");
  document.body.style.overflow = "hidden";  // prevent page scroll behind modal
}

// ── Boot ────────────────────────────────────────────────────
initPreviewModal();
initApproveDialog();
initRejectDialog();
initWarnDialog();

window.__authUserPromise
  ?.then((user) => {
    if (user?.role !== "root") {
      window.location.href = "history";
      return;
    }
    loadDetail().catch((err) => {
      setMsg("error", err.message || "載入失敗");
    });
  })
  .catch(() => {});
