const API_BASE = window.API_BASE || "";

const detailRoot = document.getElementById("detailRoot");
const detailMsg = document.getElementById("detailMsg");
const btnBack = document.getElementById("btnBack");

const FIELD_DEFS = {
  in: [
    { key: "organizerDept", label: "主辦單位", type: "text" },
    { key: "eventName", label: "活動名稱", type: "text" },
    { key: "hostName", label: "主(承)辦人員", type: "text" },
    { key: "ext", label: "聯絡分機", type: "text" },
    { key: "location", label: "活動地點", type: "text" },
    { key: "hours", label: "活動時數", type: "text" },
    { key: "domain", label: "鏈結領域", type: "array" },
    { key: "domainOther", label: "其他鏈結領域", type: "text" },
    { key: "sdg", label: "SDGs 指標", type: "array" },
    { key: "teachingRelation", label: "教學專業成長說明", type: "textarea" },
  ],
  out: [
    { key: "teacherName", label: "教師姓名", type: "text" },
    { key: "department", label: "任教單位", type: "text" },
    { key: "teacherId", label: "教師編號", type: "text" },
    { key: "ext", label: "聯絡分機", type: "text" },
    { key: "hours", label: "活動時數", type: "text" },
    { key: "courseTitle", label: "活動名稱", type: "text" },
    { key: "organizer", label: "舉辦單位", type: "text" },
    { key: "relevance", label: "教學專業成長", type: "textarea" },
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
  if (!detailMsg) return;
  detailMsg.style.color = type === "error" ? "#dc2626" : "#16a34a";
  detailMsg.textContent = text || "";
}

function arrToText(v) {
  if (Array.isArray(v)) return v.join("、");
  return v || "";
}

function buildInput(def, value) {
  const v = def.type === "array" ? arrToText(value) : value || "";
  if (def.type === "textarea") {
    return `<textarea name="${def.key}">${v}</textarea>`;
  }
  const inputType = def.type === "date" ? "date" : "text";
  return `<input type="${inputType}" name="${def.key}" value="${v}">`;
}

function fileExt(name) {
  const n = (name || "").toLowerCase();
  const idx = n.lastIndexOf(".");
  return idx >= 0 ? n.slice(idx) : "";
}

function renderAttachments(record) {
  const files = record.data?.attachments_files || [];
  const names = record.data?.attachments || [];

  if (!files.length && !names.length) {
    return `
      <details class="attachments-panel" open>
        <summary>附件</summary>
        <div class="attachments-body">
          <div class="muted">尚未上傳附件</div>
        </div>
      </details>
    `;
  }

  const stored = files.map((f, idx) => {
    const name = f.name || `附件 ${idx + 1}`;
    const ext = fileExt(name);
    const downloadUrl = `${API_BASE}/api/applications/${record.id}/files/${idx}`;
    const inlineUrl = `${API_BASE}/api/applications/${record.id}/files/${idx}?inline=1`;
    const isPdf = ext === ".pdf";
    const isImage = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"].includes(ext);
    return `
      <details class="file-item">
        <summary>${name}</summary>
        <div class="file-content">
          ${
            isPdf
              ? `<div class="file-preview-frame"><iframe src="${inlineUrl}" title="${name}" loading="lazy"></iframe></div>`
              : isImage
                ? `<div class="image-preview-frame"><img src="${inlineUrl}" alt="${name}" loading="lazy"></div>`
                : `<div class="muted">此檔案類型不支援內嵌預覽，可直接下載。</div>`
          }
          <div class="file-links">
            <a class="file-link" href="${downloadUrl}" target="_blank" rel="noopener">下載</a>
            ${(isPdf || isImage) ? `<a class="file-link" href="${inlineUrl}" target="_blank" rel="noopener">另開預覽</a>` : ""}
          </div>
        </div>
      </details>
    `;
  });

  const pendingNames = names
    .filter((n) => !files.some((f) => f.name === n))
    .map((n) => `<div class="muted">待處理附件：${n}</div>`);

  return `
    <details class="attachments-panel" open>
      <summary>附件（${files.length || names.length}）</summary>
      <div class="attachments-body">
        ${stored.join("")}
        ${pendingNames.join("")}
      </div>
    </details>
  `;
}

function buildEventDate(start, end) {
  const s = (start || "").trim();
  const e = (end || "").trim();
  if (s && e) return `${s} ~ ${e}`;
  return s || e || "";
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

function normalizeExistingSlots(record) {
  const slotsFromBackend = (record.time_slots || [])
    .map((s) => ({
      slotDate: s.slot_date || "",
      startTime: s.start_time || "",
      endTime: s.end_time || "",
    }))
    .filter((s) => s.slotDate || s.startTime || s.endTime);

  if (slotsFromBackend.length > 0) return slotsFromBackend;

  const fromData = (record.data?.timeSlots || [])
    .map((s) => ({
      slotDate: s.slotDate || s.slot_date || "",
      startTime: s.startTime || s.start_time || "",
      endTime: s.endTime || s.end_time || "",
    }))
    .filter((s) => s.slotDate || s.startTime || s.endTime);

  if (fromData.length > 0) return fromData;

  return [
    {
      slotDate: record.data?.eventDateStart || "",
      startTime: record.data?.startTime || "",
      endTime: record.data?.endTime || "",
    },
  ];
}

function renderTimeSlotEditor(record) {
  const rows = normalizeExistingSlots(record)
    .map(
      (slot) => `
      <div class="slot-row">
        <input class="slot-date" type="date" value="${slot.slotDate || ""}">
        <input class="slot-start" type="time" value="${slot.startTime || ""}">
        <span class="muted slot-sep">～</span>
        <input class="slot-end" type="time" value="${slot.endTime || ""}">
        <button type="button" class="btn ghost slot-remove">移除</button>
      </div>
    `
    )
    .join("");

  return `
    <div class="field field-span-2">
      <span class="lbl">活動起訖時段（每個時段需設定日期）</span>
      <div id="slotWrap" class="slot-wrap">${rows}</div>
      <button id="btnAddSlot" type="button" class="btn ghost">+ 新增時段</button>
    </div>
  `;
}

function readSlotsFromDom(root) {
  return Array.from(root.querySelectorAll(".slot-row")).map((row, idx) => ({
    slotDate: row.querySelector(".slot-date")?.value?.trim() || "",
    startTime: row.querySelector(".slot-start")?.value?.trim() || "",
    endTime: row.querySelector(".slot-end")?.value?.trim() || "",
    sortOrder: idx,
  }));
}

function timeToMinutes(value) {
  if (!value || !value.includes(":")) return null;
  const [hh, mm] = value.split(":").map((v) => parseInt(v, 10));
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return hh * 60 + mm;
}

function calcRoundedHoursFromSlots(slots) {
  const totalMinutes = slots.reduce((sum, slot) => {
    const s = timeToMinutes(slot.startTime);
    const e = timeToMinutes(slot.endTime);
    if (s === null || e === null || e <= s) return sum;
    return sum + (e - s);
  }, 0);
  if (totalMinutes <= 0) return "";
  return String(Math.min(4, Math.max(1, Math.round(totalMinutes / 60))));
}

function validateSlots(slots, eventDateStart, eventDateEnd) {
  if (!Array.isArray(slots) || slots.length === 0) return "請至少新增 1 個時段。";
  for (let i = 0; i < slots.length; i += 1) {
    const slot = slots[i] || {};
    const s = timeToMinutes(slot.startTime);
    const e = timeToMinutes(slot.endTime);
    if (!slot.slotDate) return `第 ${i + 1} 個時段尚未選擇日期。`;
    if (s === null || e === null) return `第 ${i + 1} 個時段請填寫完整起訖時間。`;
    if (e <= s) return `第 ${i + 1} 個時段的結束時間必須晚於開始時間。`;
    if (eventDateStart && slot.slotDate < eventDateStart) {
      return `第 ${i + 1} 個時段日期不得早於活動起始日期。`;
    }
    if (eventDateEnd && slot.slotDate > eventDateEnd) {
      return `第 ${i + 1} 個時段日期不得晚於活動結束日期。`;
    }
  }
  return "";
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

function normalizeFormData(form, appType, existingData = {}) {
  const defs = FIELD_DEFS[appType] || [];
  const fd = new FormData(form);
  const data = { ...(existingData || {}) };
  defs.forEach((def) => {
    const raw = (fd.get(def.key) || "").toString().trim();
    if (def.type === "array") {
      data[def.key] = raw
        ? raw
            .split(/[、,]/)
            .map((v) => v.trim())
            .filter(Boolean)
        : [];
    } else {
      data[def.key] = raw;
    }
  });
  data.eventDate = buildEventDate(data.eventDateStart, data.eventDateEnd);
  if (Array.isArray(data.attachments)) data.attachmentCount = data.attachments.length;
  return data;
}

function renderDetail(record) {
  if (!detailRoot) return;
  const defs = FIELD_DEFS[record.app_type] || [];
  const rows = defs
    .map(
      (def) => `
      <label class="field">
        <span class="lbl">${def.label}</span>
        ${buildInput(def, record.data?.[def.key])}
      </label>
    `
    )
    .join("");

  const approvedHours =
    record.approved_hours !== null && record.approved_hours !== undefined
      ? record.approved_hours
      : record.data?.hours || "";

  detailRoot.innerHTML = `
    <div class="detail-header">
      <span class="history-badge ${record.app_type}">${fmtType(record.app_type)}</span>
      <span class="status-badge ${normalizeStatus(record.status)}">${fmtStatus(record.status)}</span>
      <strong>${record.event_name || "-"}</strong>
      <span class="muted">${record.event_date || "-"}</span>
    </div>
    <form id="detailForm" class="detail-form" data-id="${record.id}" data-type="${record.app_type}">
      <div class="detail-grid">
        ${rows}
        ${renderTimeSlotEditor(record)}
        <label class="field">
          <span class="lbl">審核狀態</span>
          <input type="text" value="${fmtStatus(record.status)}" disabled>
        </label>
        <label class="field">
          <span class="lbl">核定時數</span>
          <input type="text" value="${approvedHours}" disabled>
        </label>
      </div>
      <div class="detail-actions">
        <button type="button" id="btnDelete" class="btn ghost">刪除</button>
        <button type="submit" class="btn primary">儲存</button>
      </div>
      ${renderAttachments(record)}
    </form>
  `;
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
    setMsg("error", "缺少有效的 id 參數。");
    return;
  }
  try {
    setMsg("success", "");
    currentRecord = await api(`/api/applications/${id}`);
    renderDetail(currentRecord);
  } catch (err) {
    setMsg("error", err.message || "讀取資料失敗。");
  }
}

detailRoot?.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  if (target.id === "btnAddSlot") {
    const wrap = detailRoot.querySelector("#slotWrap");
    if (!wrap) return;
    const defaultDate =
      detailRoot.querySelector('input[name="eventDateStart"]')?.value?.trim() ||
      currentRecord?.data?.eventDateStart ||
      "";
    const row = document.createElement("div");
    row.className = "slot-row";
    row.innerHTML = `
      <input class="slot-date" type="date" value="${defaultDate}">
      <input class="slot-start" type="time">
      <span class="muted slot-sep">～</span>
      <input class="slot-end" type="time">
      <button type="button" class="btn ghost slot-remove">移除</button>
    `;
    wrap.appendChild(row);
    return;
  }

  if (target.classList.contains("slot-remove")) {
    const wrap = detailRoot.querySelector("#slotWrap");
    const row = target.closest(".slot-row");
    if (!wrap || !row) return;
    if (wrap.querySelectorAll(".slot-row").length <= 1) return;
    row.remove();
  }
});

detailRoot?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target.closest("#detailForm");
  if (!form || !currentRecord) return;
  const appType = form.dataset.type;
  const data = normalizeFormData(form, appType, currentRecord.data || {});
  const slots = readSlotsFromDom(form);

  const slotErr = validateSlots(slots, data.eventDateStart, data.eventDateEnd);
  if (slotErr) {
    setMsg("error", slotErr);
    return;
  }

  data.timeSlots = slots.map((s) => ({
    slotDate: s.slotDate,
    startTime: s.startTime,
    endTime: s.endTime,
  }));
  data.startTime = data.timeSlots[0]?.startTime || "";
  data.endTime = data.timeSlots[0]?.endTime || "";
  data.hours = calcRoundedHoursFromSlots(data.timeSlots);

  const summary = buildSummary(appType, data);
  const timeSlotsPayload = slots.map((s, idx) => ({
    slot_date: s.slotDate,
    start_time: s.startTime,
    end_time: s.endTime,
    sort_order: idx,
  }));

  try {
    await api(`/api/applications/${currentRecord.id}`, {
      method: "PATCH",
      body: JSON.stringify({ data, summary, time_slots: timeSlotsPayload }),
    });
    setMsg("success", "更新成功。");
    await loadDetail();
  } catch (err) {
    setMsg("error", err.message || "更新失敗。");
  }
});

detailRoot?.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.id !== "btnDelete" || !currentRecord) return;
  if (!window.confirm("確認要刪除此筆申請紀錄嗎？")) return;
  try {
    await api(`/api/applications/${currentRecord.id}`, { method: "DELETE" });
    window.location.href = "history";
  } catch (err) {
    setMsg("error", err.message || "刪除失敗。");
  }
});

document.addEventListener("DOMContentLoaded", loadDetail);
