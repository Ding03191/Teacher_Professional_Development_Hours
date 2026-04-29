const API_BASE = window.API_BASE || "";

const detailRoot = document.getElementById("detailRoot");
const detailMsg = document.getElementById("detailMsg");
const btnBack = document.getElementById("btnBack");
const DOMAIN_OPTIONS = ["機械", "生產製造", "智慧化", "資訊安全", "資訊素養", "綠能科技", "學術倫理", "智慧財產權", "生命教育", "品德教育", "性別平等"];
const SDG_OPTIONS = [
  { value: "SDG1", label: "SDG1 終結貧窮" },
  { value: "SDG2", label: "SDG2 消除飢餓" },
  { value: "SDG3", label: "SDG3 健康與福祉" },
  { value: "SDG4", label: "SDG4 優質教育" },
  { value: "SDG5", label: "SDG5 性別平權" },
  { value: "SDG6", label: "SDG6 淨水及衛生" },
  { value: "SDG7", label: "SDG7 潔淨能源" },
  { value: "SDG8", label: "SDG8 合適工作與經濟成長" },
  { value: "SDG9", label: "SDG9 工業化、創新及基礎建設" },
  { value: "SDG10", label: "SDG10 減少不平等" },
  { value: "SDG11", label: "SDG11 永續城鄉" },
  { value: "SDG12", label: "SDG12 責任消費及生產" },
  { value: "SDG13", label: "SDG13 氣候行動" },
  { value: "SDG14", label: "SDG14 保育海洋生態" },
  { value: "SDG15", label: "SDG15 保育陸域生態" },
  { value: "SDG16", label: "SDG16 和平、正義及健全制度" },
  { value: "SDG17", label: "SDG17 多元夥伴關係" }
];

const FIELD_DEFS = {
  in: [
    { key: "organizerDept", label: "主辦單位", type: "text" },
    { key: "eventName", label: "活動名稱", type: "text" },
    { key: "hostName", label: "主(承)辦人員", type: "text" },
    { key: "ext", label: "聯絡電話（校內分機）", type: "text" },
    { key: "location", label: "活動地點", type: "text" },
    { key: "eventDateStart", label: "活動日期（起）", type: "date" },
    { key: "eventDateEnd", label: "活動日期（迄）", type: "date" },
    { key: "startTime", label: "活動時間（起）", type: "time" },
    { key: "endTime", label: "活動時間（迄）", type: "time" },
    { key: "hours", label: "活動時數", type: "text", readonly: true },
    { key: "domain", label: "鏈結領域", type: "array" },
    { key: "domainOther", label: "其他鏈結領域", type: "text" },
    { key: "sdg", label: "SDGs 指標", type: "array" },
    { key: "teachingRelation", label: "教學專業成長說明", type: "textarea" },
    { key: "note", label: "備註", type: "textarea" },
  ],
  out: [
    { key: "teacherName", label: "教師姓名", type: "text" },
    { key: "department", label: "系所單位", type: "text" },
    { key: "teacherId", label: "教師職號", type: "text" },
    { key: "ext", label: "聯絡分機", type: "text" },
    { key: "eventDateStart", label: "活動日期（起）", type: "date" },
    { key: "eventDateEnd", label: "活動日期（迄）", type: "date" },
    { key: "startTime", label: "活動時間（起）", type: "time" },
    { key: "endTime", label: "活動時間（迄）", type: "time" },
    { key: "hours", label: "活動時數", type: "text", readonly: true },
    { key: "courseTitle", label: "課程/活動名稱", type: "text" },
    { key: "organizer", label: "主辦單位", type: "text" },
    { key: "relevance", label: "與教學/研究關聯", type: "textarea" },
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
  if (s === "approved") return "已通過";
  if (s === "rejected") return "退件";
  return "待審核";
}

function setMsg(type, text) {
  if (!detailMsg) return;
  detailMsg.style.color = type === "error" ? "#dc2626" : "#16a34a";
  detailMsg.textContent = text || "";
}

function esc(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function arrToText(v) {
  if (Array.isArray(v)) return v.join("、");
  return v || "";
}

function parseArrayText(raw) {
  return (raw || "")
    .split(/[、,，\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function buildInput(def, value) {
  const v = def.type === "array" ? arrToText(value) : value || "";
  if (def.type === "textarea") {
    return `<textarea name="${def.key}" ${def.readonly ? "readonly" : ""}>${esc(v)}</textarea>`;
  }
  const inputType = def.type === "date" ? "date" : def.type === "time" ? "time" : "text";
  const readonlyAttr = def.readonly ? " readonly" : "";
  return `<input type="${inputType}" name="${def.key}" value="${esc(v)}"${readonlyAttr}>`;
}

function getCheckedValues(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
}
function getCheckedLabels(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.parentElement?.textContent?.trim() || cb.value);
}
function updateMultiSelectDisplay(container) {
  if (!container) return;
  const placeholder = container.querySelector(".ms-placeholder");
  const valueEl = container.querySelector(".ms-value");
  const hidden = container.querySelector('input[type="hidden"]');
  const labels = getCheckedLabels(container);
  const values = getCheckedValues(container);
  if (hidden) hidden.value = values.join(", ");
  if (!valueEl || !placeholder) return;
  if (labels.length === 0) {
    placeholder.hidden = false;
    valueEl.hidden = true;
    valueEl.textContent = "";
  } else {
    placeholder.hidden = true;
    valueEl.hidden = false;
    valueEl.textContent = labels.length <= 3 ? labels.join("、") : `已選擇 ${labels.length} 項`;
  }
}
function initMultiSelect(container) {
  if (!container) return;
  const trigger = container.querySelector(".ms-trigger");
  const panel = container.querySelector(".ms-panel");
  const checkboxes = Array.from(container.querySelectorAll('input[type="checkbox"]'));
  const close = () => { container.classList.remove("is-open"); trigger?.setAttribute("aria-expanded", "false"); };
  const toggle = () => { const isOpen = container.classList.toggle("is-open"); trigger?.setAttribute("aria-expanded", isOpen ? "true" : "false"); };
  trigger?.addEventListener("click", (e) => { e.preventDefault(); toggle(); });
  panel?.addEventListener("click", (e) => e.stopPropagation());
  document.addEventListener("click", (e) => { if (!container.contains(e.target)) close(); });
  checkboxes.forEach(cb => cb.addEventListener("change", () => updateMultiSelectDisplay(container)));
  updateMultiSelectDisplay(container);
}

function buildMultiSelectHtml(key, label, selected = []) {
  const selectedArr = Array.isArray(selected) ? selected : parseArrayText(selected);
  let optionsHtml = "";
  if (key === "sdg") {
    optionsHtml = SDG_OPTIONS.map(opt => `
      <label class="ms-option"><input type="checkbox" value="${opt.value}" ${selectedArr.includes(opt.value) ? "checked" : ""}>${opt.label}</label>
    `).join("");
  } else if (key === "domain") {
    optionsHtml = DOMAIN_OPTIONS.map(opt => `
      <label class="ms-option"><input type="checkbox" value="${opt}" ${selectedArr.includes(opt) ? "checked" : ""}>${opt}</label>
    `).join("");
  }
  return `
    <div class="multi-select" data-multi="${key}">
      <button type="button" class="ms-trigger" aria-haspopup="listbox" aria-expanded="false">
        <span class="ms-placeholder">請選擇 ${label}</span>
        <span class="ms-value" hidden></span>
        <span class="ms-caret" aria-hidden="true"></span>
      </button>
      <div class="ms-panel" role="listbox">
        ${optionsHtml}
      </div>
      <input type="hidden" name="${key}" value="${selectedArr.join(", ")}">
    </div>
  `;
}


function fileExt(name) {
  const n = (name || "").toLowerCase();
  const idx = n.lastIndexOf(".");
  return idx >= 0 ? n.slice(idx) : "";
}

function renderAttachments(record) {
  const statusNormalized = normalizeStatus(record.status);
  const canEdit = statusNormalized === "rejected";
  const files = record.data?.attachments_files || [];
  const names = record.data?.attachments || [];

  const stored = files.map((f, idx) => {
    const name = f.name || `附件 ${idx + 1}`;
    const ext = fileExt(name);
    const downloadUrl = `${API_BASE}/api/applications/${record.id}/files/${idx}`;
    const inlineUrl = `${API_BASE}/api/applications/${record.id}/files/${idx}?inline=1`;
    const isPdf = ext === ".pdf";
    const isImage = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"].includes(ext);
    return `
      <details class="file-item" style="margin-bottom: 8px;">
        <summary style="font-weight: 500;">${esc(name)}</summary>
        <div class="file-content" style="padding: 12px; background: #fff; border: 1px solid var(--border); border-radius: 8px; margin-top: 8px;">
          ${
            isPdf
              ? `<div class="file-preview-frame"><iframe src="${inlineUrl}" title="${esc(name)}" loading="lazy"></iframe></div>`
              : isImage
                ? `<div class="image-preview-frame"><img src="${inlineUrl}" alt="${esc(name)}" loading="lazy"></div>`
                : `<div class="muted">此檔案類型不支援站內預覽，可直接下載。</div>`
          }
          <div class="file-links" style="margin-top: 12px; display: flex; gap: 8px;">
            <a class="btn ghost" href="${downloadUrl}" target="_blank" rel="noopener">下載</a>
            ${(isPdf || isImage) ? `<a class="btn ghost" href="${inlineUrl}" target="_blank" rel="noopener">預覽</a>` : ""}
            ${statusNormalized === 'rejected' ? `<button type="button" class="btn ghost danger file-delete" data-file-index="${idx}">刪除附件</button>` : ""}
          </div>
        </div>
      </details>
    `;
  });

  const pendingNames = names
    .filter((n) => !files.some((f) => f.name === n))
    .map((n) => `<div class="muted" style="margin-bottom: 8px;">附件名稱：${esc(n)}</div>`);


  const uploadUI = !canEdit ? '' : `
    <div class="file-drop-zone" id="detailFileDropZone" style="margin-top: 16px;">
      <div class="drop-zone-icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
      </div>
      <div class="drop-zone-text">
        <span class="text-primary font-bold">點擊選擇檔案</span> 或將檔案拖曳至此 (重新上傳)
      </div>
      <p class="muted" style="margin-top: 4px;">請至少上傳 1 份：PDF、Excel 或圖檔</p>
      <input id="detailFiles" type="file" multiple accept=".pdf,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.gif,.bmp" style="position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer;">
    </div>
    <div id="detailUploadList" class="muted upload-list" style="margin-top: 8px;"></div>
    <div style="margin-top: 8px;"><button type="button" id="btnUploadAttachments" class="btn ghost">上傳所選附件</button></div>
  `;

  return `
    <div class="form-group" style="margin-top: 40px;">
      <h4 class="group-title">附件清單（${files.length || names.length}）</h4>
      <div class="attachments-body">
        ${files.length || names.length ? "" : '<div class="muted">尚無附件</div>'}
        ${stored.join("")}
        ${pendingNames.join("")}
        ${uploadUI}
      </div>
    </div>
  `;
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

function buildSummary(appType, data) {
  const eventDate = data.eventDate || buildEventDate(data.eventDateStart, data.eventDateEnd);
  if (appType === "in") {
    return {
      event_name: data.eventName || "",
      event_date: eventDate,
      organizer: data.organizerDept || "",
    };
  }
  return {
    event_name: data.courseTitle || "",
    event_date: eventDate,
    organizer: data.organizer || "",
  };
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

function validateTimeSlots(slots) {
  if (!Array.isArray(slots) || slots.length === 0) return "請至少填寫 1 筆活動時段";
  for (let i = 0; i < slots.length; i += 1) {
    const slot = slots[i] || {};
    const start = parseSlotDateTime(slot.startDate, slot.startTime);
    const end = parseSlotDateTime(slot.endDate, slot.endTime);
    if (!slot.startDate || !slot.endDate) return `第 ${i + 1} 筆時段請填寫起訖日期`;
    if (!slot.startTime || !slot.endTime) return `第 ${i + 1} 筆時段請填寫起訖時間`;
    if (!start || !end || end <= start) return `第 ${i + 1} 筆時段結束時間必須晚於開始時間`;
  }
  return "";
}

function validateInCampusDateTime(data) {
  const today = new Date().toISOString().slice(0, 10);
  if (!data.eventDateStart || !data.eventDateEnd) return "請填寫活動起訖日期";
  if (data.eventDateStart > today || data.eventDateEnd > today) return "活動日期不可晚於今天";
  if (!data.startTime || !data.endTime) return "請填寫活動起訖時間";
  const start = parseSlotDateTime(data.eventDateStart, data.startTime);
  const end = parseSlotDateTime(data.eventDateEnd, data.endTime);
  if (!start || !end || end <= start) return "活動結束時間必須晚於開始時間";
  return "";
}

function normalizeFormData(form, appType, existingData = {}) {
  const defs = FIELD_DEFS[appType] || [];
  const fd = new FormData(form);
  const data = { ...(existingData || {}) };
  defs.forEach((def) => {
    const raw = (fd.get(def.key) || "").toString().trim();
    if (def.type === "array") data[def.key] = parseArrayText(raw);
    else data[def.key] = raw;
  });
  data.eventDate = buildEventDate(data.eventDateStart, data.eventDateEnd);
  if (Array.isArray(data.attachments)) data.attachmentCount = data.attachments.length;
  return data;
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
          const isError = row.to_status === 'rejected';
          const iconColor = isError ? 'var(--danger)' : 'var(--accent)';
          return `
            <div class="timeline-item">
              <div class="timeline-dot" style="background-color: ${iconColor};"></div>
              <div class="timeline-content">
                <div class="timeline-title">${esc(fromStatus)} &rarr; ${esc(toStatus)}</div>
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

function createTimeSlotRow(slot = {}, readonly = false) {
  const ro = readonly ? "readonly" : "required";
  const btnStyle = readonly ? 'style="visibility:hidden"' : '';
  const today = new Date().toISOString().slice(0, 10);
  return `
    <div class="time-slot-row">
      <div class="time-slot-date-group">
        <input type="date" class="slot-date-start" value="${esc(slot.startDate || slot.slotDate || "")}" max="${today}" ${ro}>
        <span class="time-slot-sep">~</span>
        <input type="date" class="slot-date-end" value="${esc(slot.endDate || slot.slotEndDate || slot.slotDate || "")}" max="${today}" ${ro}>
      </div>
      <div class="time-slot-time-group">
        <input type="time" class="slot-start" value="${esc(slot.startTime || "")}" ${ro}>
        <span class="time-slot-sep">~</span>
        <input type="time" class="slot-end" value="${esc(slot.endTime || "")}" ${ro}>
      </div>
      <button type="button" class="btn ghost slot-remove" aria-label="移除時段" ${btnStyle}>×</button>
    </div>
  `;
}

function getTimeSlotsFromDOM(form) {
  const container = form.querySelector("#timeSlotsList");
  if (!container) return [];
  return Array.from(container.querySelectorAll(".time-slot-row")).map(row => ({
    startDate: row.querySelector(".slot-date-start")?.value?.trim() || "",
    endDate: row.querySelector(".slot-date-end")?.value?.trim() || "",
    startTime: row.querySelector(".slot-start")?.value?.trim() || "",
    endTime: row.querySelector(".slot-end")?.value?.trim() || "",
  }));
}

function renderDetail(record) {
  if (!detailRoot) return;
  const normalized = normalizeRecord(record);
  const statusNormalized = normalizeStatus(normalized.status);
  const defs = FIELD_DEFS[normalized.app_type] || [];
  const groups = {
    out: [
      { title: "申請人資訊", keys: ['teacherName', 'department', 'teacherId', 'ext'] },
      { title: "活動時間", keys: ['timeSlots'] },
      { title: "活動詳情", keys: ['courseTitle', 'organizer', 'relevance', 'hasCert', 'certNo', 'evidenceLink'] }
    ],
    in: [
      { title: "基本資訊", keys: ['organizerDept', 'eventName', 'hostName', 'ext', 'location'] },
      { title: "活動時間", keys: ['timeSlots'] },
      { title: "指標與說明", keys: ['domain', 'domainOther', 'sdg', 'teachingRelation', 'note'] }
    ]
  };

  const currentGroups = groups[normalized.app_type] || [{title: "申請內容", keys: defs.map(d => d.key)}];

  const groupedRows = currentGroups.map(group => {
    const groupFields = group.keys.map(key => {
      if (key === 'timeSlots') {
        const slots = getRecordSlots(normalized);
        const isOut = normalized.app_type === "out";
        const readonly = statusNormalized !== "rejected";
        const showBtns = isOut && !readonly;
        const btnStyle = showBtns ? 'style="padding:0 8px; margin-left:8px;"' : 'style="display:none"';
        const slotRows = slots.length ? slots.map(s => createTimeSlotRow(s, readonly)).join("") : createTimeSlotRow({}, readonly);
        return `
          <div class="field field-span-2">
            <span class="lbl">活動起訖時段 <button type="button" class="btn icon-btn ghost slot-add" title="新增時段" ${btnStyle}>+</button></span>
            <div id="timeSlotsList">${slotRows}</div>
          </div>
          <label class="field">
            <span class="lbl">活動時數（自動計算，最多 4 小時）</span>
            <input type="text" name="hours" value="${esc(normalized.data?.hours || calcRoundedHoursFromSlots(slots))}" readonly class="readonly-style">
          </label>
        `;
      }
      const def = defs.find(d => d.key === key);
      if(!def) return "";
      
      const isReadOnly = def.readonly || statusNormalized !== "rejected" || def.key === "teacherName" || def.key === "department" || def.key === "teacherId";
      const roClass = isReadOnly ? 'readonly-style' : '';
      const v = def.type === "array" ? arrToText(normalized.data?.[def.key]) : normalized.data?.[def.key] || "";
      
      let inputHtml = "";
      if (def.type === "array" && !isReadOnly) {
        inputHtml = buildMultiSelectHtml(def.key, def.label, normalized.data?.[def.key]);
      } else if (def.type === "textarea") {
        inputHtml = `<textarea name="${def.key}" ${isReadOnly ? "readonly" : ""} class="${roClass}">${esc(v)}</textarea>`;
      } else {
        const inputType = def.type === "date" ? "date" : def.type === "time" ? "time" : "text";
        inputHtml = `<input type="${inputType}" name="${def.key}" value="${esc(v)}" ${isReadOnly ? "readonly" : ""} class="${roClass}">`;
      }

      return `
        <label class="field ${def.type === 'textarea' ? 'field-span-2' : ''}">
          <span class="lbl">${def.label}</span>
          ${inputHtml}
        </label>
      `;
    }).join("");
    return `
      <div class="form-group">
        <h4 class="group-title">${group.title}</h4>
        <div class="grid g-2">
          ${groupFields}
        </div>
      </div>
    `;
  }).join("");

  const approvedHours =
    normalized.approved_hours !== null && normalized.approved_hours !== undefined
      ? normalized.approved_hours
      : normalized.data?.hours || "";

  const statusHistoryHtml = renderStatusHistory(normalized.status_history || []);
  const resubmitPanel =
    statusNormalized === "rejected"
      ? `
      <div class="form-group" style="margin-top: 40px; border-top: 1px solid var(--border); padding-top: 30px;">
        <h4 class="group-title">退件補齊作業</h4>
        <label class="field">
          <span class="lbl req">補件說明（重新送審必填）</span>
          <textarea name="resubmit_comment" id="resubmitComment" placeholder="請說明已補正的內容" rows="4"></textarea>
        </label>
        <div class="form-actions" style="border-top: none; padding-top: 0;">
          <button type="button" id="btnResubmit" class="btn primary btn-large">重新送審</button>
        </div>
      </div>
    `
      : "";

  detailRoot.innerHTML = `
    <div class="detail-hero" style="margin-bottom: 40px; padding: 24px 30px; background: rgba(255,255,255,0.7); border-radius: 16px; border: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 20px;">
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <div class="muted" style="font-size: 14px;">${esc(normalized.event_date || "-")}</div>
        <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
          <strong style="font-size: 24px; color: var(--text);">${esc(normalized.event_name || "-")}</strong>
          <span class="history-badge ${normalized.app_type}">${fmtType(normalized.app_type)}</span>
          <span class="status-badge ${statusNormalized}">${fmtStatus(normalized.status)}</span>
        </div>
      </div>
      <div class="detail-actions" style="display: flex; gap: 12px;">
        <button type="button" id="btnDelete" class="btn ghost danger">刪除紀錄</button>
      </div>
    </div>

    <form id="detailForm" class="form unboxed-form" novalidate data-id="${normalized.id}" data-type="${normalized.app_type}">
      ${groupedRows}
      
      <div class="form-group">
        <h4 class="group-title">審核資訊</h4>
        <div class="grid g-2">
          <label class="field">
            <span class="lbl">審核狀態</span>
            <input type="text" value="${fmtStatus(normalized.status)}" readonly class="readonly-style">
          </label>
          <label class="field">
            <span class="lbl">核定時數</span>
            <input type="text" value="${esc(approvedHours)}" readonly class="readonly-style">
          </label>
        </div>
      </div>

      <div class="form-group" style="margin-top: 40px;">
        <h4 class="group-title">狀態歷程紀錄</h4>
        ${statusHistoryHtml}
      </div>

      ${renderAttachments(normalized)}
      ${resubmitPanel}
    </form>
  `;

  // Apply drop-zone logic
  const fileDropZone = document.getElementById("detailFileDropZone");
  const fileInput = document.getElementById("detailFiles");
  if (fileDropZone && fileInput) {
    fileDropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      fileDropZone.style.borderColor = "var(--accent)";
      fileDropZone.style.background = "rgba(59, 130, 246, 0.05)";
    });
    fileDropZone.addEventListener("dragleave", () => {
      fileDropZone.style.borderColor = "var(--border)";
      fileDropZone.style.background = "rgba(248, 250, 252, 0.5)";
    });
    fileDropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      fileDropZone.style.borderColor = "var(--border)";
      fileDropZone.style.background = "rgba(248, 250, 252, 0.5)";
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        fileInput.files = e.dataTransfer.files;
        fileInput.dispatchEvent(new Event("change"));
      }
    });
  }

  // Initialize multi-selects
  document.querySelectorAll(".multi-select").forEach(ms => initMultiSelect(ms));
}

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    const err = data.error || data.message || `request_failed_${res.status}`;
    throw new Error(err);
  }
  return data.data;
}

function getQuery() {
  const params = new URLSearchParams(window.location.search);
  return {
    id: params.get("id"),
    fromType: params.get("type") || "all",
  };
}

async function loadDetail() {
  const { id, fromType } = getQuery();
  if (btnBack) btnBack.href = `history?type=${encodeURIComponent(fromType)}`;
  if (!id || Number.isNaN(Number(id))) {
    setMsg("error", "缺少正確的 id 參數");
    return;
  }
  try {
    setMsg("success", "");
    currentRecord = await api(`/api/applications/${id}`);
    renderDetail(currentRecord);
  } catch (err) {
    setMsg("error", err.message || "讀取申請資料失敗");
  }
}

function buildUpdatePayload(form, appType, baseRecord) {
  const data = normalizeFormData(form, appType, baseRecord.data || {});
  
  const slotsFromDOM = getTimeSlotsFromDOM(form);
  const slots = slotsFromDOM.length > 0 ? slotsFromDOM : getRecordSlots(baseRecord);

  const slotErr = appType === "in" && slotsFromDOM.length === 0 ? validateInCampusDateTime(data) : validateTimeSlots(slots);
  if (slotErr) throw new Error(slotErr);

  const hasAnySlotData = slots.some((s) => s.startDate || s.endDate || s.startTime || s.endTime);

  if (hasAnySlotData) {
    const firstSlot = slots[0] || {};
    const startDates = slots.map((s) => s.startDate).filter(Boolean).sort();
    const endDates = slots.map((s) => s.endDate).filter(Boolean).sort();

    data.eventDateStart = startDates[0] || endDates[0] || "";
    data.eventDateEnd = endDates[endDates.length - 1] || data.eventDateStart || "";
    data.startTime = firstSlot.startTime || "";
    data.endTime = firstSlot.endTime || "";
    data.hours = calcRoundedHoursFromSlots(slots);
    data.eventDate = buildEventDate(data.eventDateStart, data.eventDateEnd);
    data.timeSlots = slots.map((s) => ({
      startDate: s.startDate,
      endDate: s.endDate,
      startTime: s.startTime,
      endTime: s.endTime,
    }));
  } else {
    data.timeSlots = Array.isArray(baseRecord.data?.timeSlots) ? baseRecord.data.timeSlots : [];
  }

  const summary = buildSummary(appType, data);
  const timeSlotsPayload = hasAnySlotData
    ? slots.map((s, idx) => ({
        slot_date: s.startDate,
        slot_end_date: s.endDate || s.startDate,
        start_time: s.startTime,
        end_time: s.endTime,
        sort_order: idx,
      }))
    : (baseRecord.time_slots || []).map((s, idx) => ({
        slot_date: s.slot_date || "",
        slot_end_date: s.slot_end_date || s.slot_date || "",
        start_time: s.start_time || "",
        end_time: s.end_time || "",
        sort_order: s.sort_order ?? idx,
      }));

  return { data, summary, timeSlotsPayload };
}

detailRoot?.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  const form = target.closest("#detailForm");
  if (!form) return;
  
  if (
    target.classList.contains("slot-start") ||
    target.classList.contains("slot-end") ||
    target.classList.contains("slot-date-start") ||
    target.classList.contains("slot-date-end")
  ) {
    const hoursInput = form.querySelector('input[name="hours"]');
    if (hoursInput) {
      hoursInput.value = calcRoundedHoursFromSlots(getTimeSlotsFromDOM(form));
    }
  }
});

detailRoot?.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const form = target.closest("#detailForm");
  
  if (target.classList.contains("slot-add")) {
    if (!form) return;
    const container = form.querySelector("#timeSlotsList");
    if (container) {
      container.insertAdjacentHTML("beforeend", createTimeSlotRow());
    }
    return;
  }

  if (target.classList.contains("slot-remove")) {
    if (!form) return;
    const row = target.closest(".time-slot-row");
    if (!row) return;
    const container = form.querySelector("#timeSlotsList");
    row.remove();
    if (container && !container.querySelector(".time-slot-row")) {
      container.insertAdjacentHTML("beforeend", createTimeSlotRow());
    }
    const hoursInput = form.querySelector('input[name="hours"]');
    if (hoursInput) {
      hoursInput.value = calcRoundedHoursFromSlots(getTimeSlotsFromDOM(form));
    }
    return;
  }
});

detailRoot?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target.closest("#detailForm");
  if (!form || !currentRecord) return;
  const appType = form.dataset.type;

  try {
    setMsg("success", "儲存中...");
    const { data, summary, timeSlotsPayload } = buildUpdatePayload(form, appType, currentRecord);
    await api(`/api/applications/${currentRecord.id}`, {
      method: "PATCH",
      body: JSON.stringify({ data, summary, time_slots: timeSlotsPayload }),
    });
    setMsg("success", "儲存成功");
    await loadDetail();
  } catch (err) {
    setMsg("error", err.message || "儲存失敗");
  }
});

detailRoot?.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (target.id !== "detailFiles") return;
  const list = detailRoot.querySelector("#detailUploadList");
  if (!list) return;
  const files = Array.from(target.files || []);
  list.textContent = files.length ? files.map((f, i) => `${i + 1}. ${f.name}`).join(" / ") : "";
});

detailRoot?.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.id !== "btnUploadAttachments" || !currentRecord) return;
  
  if (normalizeStatus(currentRecord.status) !== "rejected") {
    setMsg("error", "未經過審核（退件）前不可上傳附件");
    return;
  }

  const input = detailRoot.querySelector("#detailFiles");
  if (!(input instanceof HTMLInputElement)) return;
  const files = Array.from(input.files || []);
  if (!files.length) {
    setMsg("error", "請至少選擇 1 個檔案");
    return;
  }

  try {
    const fd = new FormData();
    files.forEach((file) => fd.append("files", file));
    const res = await fetch(`${API_BASE}/api/applications/${currentRecord.id}/files`, {
      method: "POST",
      credentials: "include",
      body: fd,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.ok === false) throw new Error(body.error || "upload_failed");
    setMsg("success", "附件上傳成功");
    await loadDetail();
  } catch (err) {
    setMsg("error", err.message || "附件上傳失敗");
  }
});

detailRoot?.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof Element) || !currentRecord) return;
  const btn = target.closest(".file-delete");
  if (!(btn instanceof HTMLElement)) return;

  if (normalizeStatus(currentRecord.status) !== "rejected") {
    setMsg("error", "未經過審核（退件）前不可刪除附件");
    return;
  }

  const fileIndexRaw = btn.getAttribute("data-file-index");
  const fileIndex = Number(fileIndexRaw);
  if (!Number.isInteger(fileIndex) || fileIndex < 0) return;
  
  showDeleteFileDialog(fileIndex);
});

detailRoot?.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.id !== "btnResubmit" || !currentRecord) return;

  const form = detailRoot.querySelector("#detailForm");
  if (!(form instanceof HTMLFormElement)) return;
  const commentInput = form.querySelector("#resubmitComment");
  const resubmitComment = commentInput instanceof HTMLTextAreaElement ? commentInput.value.trim() : "";
  if (!resubmitComment) {
    setMsg("error", "重新送審前請填寫補件說明");
    return;
  }

  try {
    const { data, summary, timeSlotsPayload } = buildUpdatePayload(form, form.dataset.type, currentRecord);
    await api(`/api/applications/${currentRecord.id}/resubmit`, {
      method: "PATCH",
      body: JSON.stringify({
        resubmit_comment: resubmitComment,
        data,
        summary,
        time_slots: timeSlotsPayload,
      }),
    });
    setMsg("success", "已重新送審");
    await loadDetail();
  } catch (err) {
    setMsg("error", err.message || "重新送審失敗");
  }
});

detailRoot?.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.id !== "btnDelete" || !currentRecord) return;
  showDeleteAppDialog();
});

// ── Custom Delete Dialogs ─────────────────────────────────
let _pendingFileIndex = null;

function initDeleteDialogs() {
  // — Delete File Dialog —
  const fileDialog = document.createElement("div");
  fileDialog.id = "deleteFileDialog";
  fileDialog.className = "del-dialog-backdrop";
  fileDialog.innerHTML = `
    <div class="del-dialog" role="alertdialog" aria-modal="true">
      <div class="del-dialog-icon">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
          <path d="M10 11v6"></path><path d="M14 11v6"></path>
          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
        </svg>
      </div>
      <div class="del-dialog-body">
        <h3 class="del-dialog-title">刪除附件</h3>
        <p class="del-dialog-desc">確定要刪除這個附件嗎？此操作無法復原。</p>
      </div>
      <div class="del-dialog-actions">
        <button type="button" class="del-btn del-btn-cancel" id="deleteFileCancel">取消</button>
        <button type="button" class="del-btn del-btn-danger" id="deleteFileConfirm">刪除附件</button>
      </div>
    </div>`;
  document.body.appendChild(fileDialog);

  async function execDeleteFile() {
    closeFileDialog();
    const idx = _pendingFileIndex;
    _pendingFileIndex = null;
    if (idx === null || !currentRecord) return;
    try {
      setMsg("success", "刪除附件中...");
      try {
        await api(`/api/applications/${currentRecord.id}/files/${idx}`, { method: "DELETE" });
      } catch (err) {
        const msg = String(err?.message || "");
        if (!msg.includes("405")) throw err;
        await api(`/api/applications/${currentRecord.id}/files/${idx}/delete`, { method: "POST" });
      }
      setMsg("success", "附件已刪除");
      await loadDetail();
    } catch (err) {
      setMsg("error", err.message || "刪除附件失敗");
    }
  }

  function closeFileDialog() {
    fileDialog.classList.remove("is-open");
    document.body.style.overflow = "";
  }

  document.getElementById("deleteFileConfirm").addEventListener("click", execDeleteFile);
  document.getElementById("deleteFileCancel").addEventListener("click", closeFileDialog);
  fileDialog.addEventListener("click", (e) => { if (e.target === fileDialog) closeFileDialog(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && fileDialog.classList.contains("is-open")) closeFileDialog();
  });

  // — Delete Application Dialog —
  const appDialog = document.createElement("div");
  appDialog.id = "deleteAppDialog";
  appDialog.className = "del-dialog-backdrop";
  appDialog.innerHTML = `
    <div class="del-dialog" role="alertdialog" aria-modal="true">
      <div class="del-dialog-icon">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      </div>
      <div class="del-dialog-body">
        <h3 class="del-dialog-title">刪除此申請</h3>
        <p class="del-dialog-desc">確定要刪除此申請嗎？刪除後無法復原，所有相關資料將一並消除。</p>
      </div>
      <div class="del-dialog-actions">
        <button type="button" class="del-btn del-btn-cancel" id="deleteAppCancel">取消</button>
        <button type="button" class="del-btn del-btn-danger" id="deleteAppConfirm">確定刪除</button>
      </div>
    </div>`;
  document.body.appendChild(appDialog);

  async function execDeleteApp() {
    closeAppDialog();
    if (!currentRecord) return;
    try {
      await api(`/api/applications/${currentRecord.id}`, { method: "DELETE" });
      window.location.href = "history";
    } catch (err) {
      setMsg("error", err.message || "刪除失敗");
    }
  }

  function closeAppDialog() {
    appDialog.classList.remove("is-open");
    document.body.style.overflow = "";
  }

  document.getElementById("deleteAppConfirm").addEventListener("click", execDeleteApp);
  document.getElementById("deleteAppCancel").addEventListener("click", closeAppDialog);
  appDialog.addEventListener("click", (e) => { if (e.target === appDialog) closeAppDialog(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && appDialog.classList.contains("is-open")) closeAppDialog();
  });
}

function showDeleteFileDialog(fileIndex) {
  _pendingFileIndex = fileIndex;
  const d = document.getElementById("deleteFileDialog");
  if (!d) return;
  d.classList.add("is-open");
  document.body.style.overflow = "hidden";
  document.getElementById("deleteFileConfirm")?.focus();
}

function showDeleteAppDialog() {
  const d = document.getElementById("deleteAppDialog");
  if (!d) return;
  d.classList.add("is-open");
  document.body.style.overflow = "hidden";
  document.getElementById("deleteAppConfirm")?.focus();
}

document.addEventListener("DOMContentLoaded", () => {
  initDeleteDialogs();
  loadDetail();
});
