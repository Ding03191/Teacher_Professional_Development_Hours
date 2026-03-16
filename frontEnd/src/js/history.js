const API_BASE = window.API_BASE || "";

const historyList = document.getElementById("historyList");
const historyMsg = document.getElementById("historyMsg");
const btnRefresh = document.getElementById("btnRefresh");
const tabs = Array.from(document.querySelectorAll(".tab"));
const printArea = document.getElementById("printArea");

const FIELD_DEFS = {
  in: [
    { key: "organizerDept", label: "主辦單位", type: "text" },
    { key: "eventName", label: "活動名稱", type: "text" },
    { key: "hostName", label: "主(承)辦人員", type: "text" },
    { key: "ext", label: "聯絡電話（校內分機）", type: "text" },
    { key: "location", label: "活動地點", type: "text" },
    { key: "eventDate", label: "活動日期", type: "date" },
    { key: "startTime", label: "活動時間（起）", type: "time" },
    { key: "endTime", label: "活動時間（迄）", type: "time" },
    { key: "hasCert", label: "是否核發研習證書", type: "text" },
    { key: "certNo", label: "證書字號", type: "text" },
    { key: "attachments", label: "附件清單", type: "array" },
    { key: "evidenceLink", label: "????", type: "text" },
    { key: "domain", label: "鏈結領域", type: "array" },
    { key: "domainOther", label: "其他鏈結領域", type: "text" },
    { key: "sdg", label: "對接 SDGs 指標", type: "array" },
    { key: "purpose", label: "一、活動主旨", type: "textarea" },
    { key: "content", label: "二、詳細活動內容", type: "textarea" },
    { key: "teachingRelation", label: "三、教學專業關係", type: "textarea" },
    { key: "researchRelation", label: "四、研究專業關係", type: "textarea" },
    { key: "applicant", label: "申請人（主辦人）", type: "text" },
    { key: "deptHead", label: "申請單位主管", type: "text" },
    { key: "staff", label: "處理人員", type: "text" },
    { key: "lead", label: "教學資源組組長", type: "text" },
    { key: "note", label: "其他備註", type: "textarea" },
  ],
  out: [
    { key: "teacherName", label: "教師姓名", type: "text" },
    { key: "department", label: "任教單位", type: "text" },
    { key: "teacherId", label: "教師編號", type: "text" },
    { key: "ext", label: "聯絡分機", type: "text" },
    { key: "eventDate", label: "活動日期", type: "date" },
    { key: "startTime", label: "活動時間（起）", type: "time" },
    { key: "endTime", label: "活動時間（迄）", type: "time" },
    { key: "courseTitle", label: "活動課程名稱", type: "text" },
    { key: "organizer", label: "舉辦單位", type: "text" },
    { key: "relevance", label: "請具體舉證與專業成長之關係", type: "textarea" },
    { key: "hasCert", label: "是否核發證書", type: "text" },
    { key: "certNo", label: "證書字號", type: "text" },
    { key: "attachments", label: "附件清單", type: "array" },
  ],
};

function fmtType(type) {
  return type === "in" ? "校內" : "校外";
}

function arrToText(value) {
  if (Array.isArray(value)) return value.join("、");
  return value || "";
}

function buildFieldInput(def, value) {
  const v = def.type === "array" ? arrToText(value) : value || "";
  if (def.type === "textarea") {
    return `<textarea name="${def.key}">${v}</textarea>`;
  }
  const type = def.type === "date" ? "date" : def.type === "time" ? "time" : "text";
  return `<input type="${type}" name="${def.key}" value="${v}">`;
}

function renderAttachmentsLinks(record) {
  const files = record.data?.attachments_files || [];
  if (!files.length) return "";
  const links = files
    .map((file, idx) => {
      const name = file.name || `附件 ${idx + 1}`;
      return `<a class="attachment-link" href="${API_BASE}/api/applications/${record.id}/files/${idx}" target="_blank" rel="noopener">${name}</a>`;
    })
    .join("");
  return `<div class="attachment-links">${links}</div>`;
}

function renderDetailForm(record) {
  const defs = FIELD_DEFS[record.app_type] || [];
  const rows = defs
    .map((def) => {
      const extra =
        def.key === "attachments" ? renderAttachmentsLinks(record) : "";
      return `
        <label class="field">
          <span class="lbl">${def.label}</span>
          ${buildFieldInput(def, record.data?.[def.key])}
          ${extra}
        </label>
      `;
    })
    .join("");
  return `
    <form class="detail-form" data-id="${record.id}">
      <div class="detail-grid">
        ${rows}
      </div>
      <div class="detail-actions">
        <button type="button" class="btn ghost" data-action="export" data-id="${record.id}">匯出 PDF</button>
        <button type="button" class="btn ghost" data-action="delete" data-id="${record.id}">刪除</button>
        <button type="submit" class="btn primary">儲存修改</button>
      </div>
    </form>
  `;
}

function renderList(records) {
  if (!historyList) return;
  historyList.innerHTML = "";
  if (!records.length) {
    historyList.innerHTML = `<div class="muted">目前沒有紀錄。</div>`;
    return;
  }
  records.forEach((record) => {
    const item = document.createElement("details");
    item.className = "history-item";
    item.dataset.id = record.id;
    item.innerHTML = `
      <summary class="history-summary">
        <span class="history-badge ${record.app_type}">${fmtType(record.app_type)}</span>
        <strong>${record.event_name || "-"}</strong>
        <span class="muted">${record.event_date || "-"}</span>
        <span class="muted">${record.unit_name || "-"}</span>
      </summary>
      <div class="history-detail">
        ${renderDetailForm(record)}
      </div>
    `;
    historyList.appendChild(item);
  });
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

async function loadApplications(type) {
  if (historyMsg) historyMsg.textContent = "";
  const records = await api(`/api/applications?type=${encodeURIComponent(type)}`);
  renderList(records || []);
}

function getActiveType() {
  return tabs.find((tab) => tab.classList.contains("is-active"))?.dataset.type || "all";
}

function normalizeFormData(form, appType) {
  const defs = FIELD_DEFS[appType] || [];
  const fd = new FormData(form);
  const data = {};
  defs.forEach((def) => {
    const raw = (fd.get(def.key) || "").toString().trim();
    if (def.type === "array") {
      data[def.key] = raw
        ? raw.split(/[，,]/).map((v) => v.trim()).filter(Boolean)
        : [];
    } else {
      data[def.key] = raw;
    }
  });
  return data;
}

function buildSummary(appType, data) {
  if (appType === "in") {
    return {
      event_name: data.eventName,
      event_date: data.eventDate,
      organizer: data.organizerDept,
    };
  }
  return {
    event_name: data.courseTitle,
    event_date: data.eventDate,
    organizer: data.organizer,
  };
}

function buildPrintHtml(record) {
  const defs = FIELD_DEFS[record.app_type] || [];
  const rows = defs
    .map((def) => {
      const value = arrToText(record.data?.[def.key]);
      return `<div class="print-row"><div class="print-label">${def.label}</div><div class="print-value">${value || "-"}</div></div>`;
    })
    .join("");
  return `
    <div class="print-sheet">
      <h2>申請紀錄（${fmtType(record.app_type)}）</h2>
      <div class="print-meta">申請單位：${record.unit_name || "-"}　　日期：${record.event_date || "-"}</div>
      <div class="print-block">
        ${rows}
      </div>
      <div class="print-only">
        <h3>簽章與備註（列印後簽名）</h3>
        <div class="print-sign">
          <div>申請人（主辦人）________________</div>
          <div>申請單位主管________________</div>
          <div>處理人員________________</div>
          <div>教學資源組組長________________</div>
          <div>其他備註：________________________________</div>
        </div>
      </div>
    </div>
  `;
}

function injectPrint(record) {
  if (!printArea) return;
  printArea.classList.remove("is-hidden");
  printArea.innerHTML = `
    <style>
      .print-sheet{font-family:"Noto Sans TC","Microsoft JhengHei",sans-serif;color:#111;}
      .print-sheet h2{margin:0 0 10px;}
      .print-meta{margin-bottom:12px;color:#555;}
      .print-row{display:grid;grid-template-columns:180px 1fr;gap:12px;padding:6px 0;border-bottom:1px dashed #ddd;}
      .print-label{font-weight:700;}
      .print-sign{display:grid;gap:10px;margin-top:12px;}
    </style>
    ${buildPrintHtml(record)}
  `;
}

historyList?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target.closest(".detail-form");
  if (!form) return;
  const id = form.dataset.id;
  const item = form.closest(".history-item");
  const appType = item?.querySelector(".history-badge")?.classList.contains("in") ? "in" : "out";
  const data = normalizeFormData(form, appType);
  const summary = buildSummary(appType, data);
  try {
    await api(`/api/applications/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ data, summary }),
    });
    await loadApplications(getActiveType());
  } catch (err) {
    if (historyMsg) historyMsg.textContent = err.message;
  }
});

historyList?.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const action = target.dataset.action;
  const id = target.dataset.id;
  if (!action || !id) return;
  if (action === "delete") {
    if (!confirm("確定要刪除此筆紀錄嗎？")) return;
    try {
      await api(`/api/applications/${id}`, { method: "DELETE" });
      await loadApplications(getActiveType());
    } catch (err) {
      if (historyMsg) historyMsg.textContent = err.message;
    }
  }
  if (action === "export") {
    const item = target.closest(".history-item");
    const appType = item?.querySelector(".history-badge")?.classList.contains("in") ? "in" : "out";
    const form = item?.querySelector(".detail-form");
    const data = form ? normalizeFormData(form, appType) : {};
    const record = {
      id,
      app_type: appType,
      unit_name: item?.querySelector(".history-summary .muted:last-child")?.textContent || "",
      event_date: data.eventDate || "",
      data,
    };
    try {
      const res = await fetch(`${API_BASE}/api/applications/${id}/print`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("print_failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (err) {
      if (historyMsg) historyMsg.textContent = err.message;
    }
  }
});

tabs.forEach((tab) => {
  tab.addEventListener("click", async () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    await loadApplications(getActiveType());
  });
});

btnRefresh?.addEventListener("click", async () => {
  await loadApplications(getActiveType());
});

document.addEventListener("DOMContentLoaded", async () => {
  if (window.__authUserPromise) {
    try {
      await window.__authUserPromise;
    } catch {
      return;
    }
  }
  await loadApplications(getActiveType());
});
