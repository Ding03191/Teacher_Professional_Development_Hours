const API_BASE = window.API_BASE || "";

const historyList = document.getElementById("historyList");
const historyMsg = document.getElementById("historyMsg");
const btnRefresh = document.getElementById("btnRefresh");
const tabs = Array.from(document.querySelectorAll(".tab"));
const printArea = document.getElementById("printArea");

const FIELD_DEFS = {
  in: [
    { key: "organizerDept", label: "\u4e3b\u8fa6\u55ae\u4f4d", type: "text" },
    { key: "eventName", label: "\u6d3b\u52d5\u540d\u7a31", type: "text" },
    { key: "hostName", label: "\u4e3b(\u627f)\u8fa6\u4eba\u54e1", type: "text" },
    { key: "ext", label: "\u806f\u7d61\u96fb\u8a71\uff08\u6821\u5167\u5206\u6a5f\uff09", type: "text" },
    { key: "location", label: "\u6d3b\u52d5\u5730\u9ede", type: "text" },
    { key: "eventDateStart", label: "\u6d3b\u52d5\u65e5\u671f\uff08\u8d77\uff09", type: "date" },
    { key: "eventDateEnd", label: "\u6d3b\u52d5\u65e5\u671f\uff08\u8a96\uff09", type: "date" },
    { key: "startTime", label: "\u6d3b\u52d5\u6642\u9593\uff08\u958b\u59cb\uff09", type: "time" },
    { key: "endTime", label: "\u6d3b\u52d5\u6642\u9593\uff08\u7d50\u675f\uff09", type: "time" },
    { key: "hours", label: "\u6642\u6578", type: "text" },
    { key: "hasCert", label: "\u662f\u5426\u6838\u767c\u8b49\u66f8", type: "text" },
    { key: "certNo", label: "\u8b49\u66f8\u5b57\u865f", type: "text" },
    { key: "attachments", label: "\u9644\u4ef6", type: "array" },
    { key: "domain", label: "\u93c8\u7d50\u9818\u57df", type: "array" },
    { key: "domainOther", label: "\u5176\u4ed6\u93c8\u7d50\u9818\u57df", type: "text" },
    { key: "sdg", label: "SDGs \u6307\u6a19", type: "array" },
    { key: "activityPurpose", label: "\u4e00\u3001\u6d3b\u52d5\u4e3b\u65e8", type: "textarea" },
    { key: "activityDetail", label: "\u4e8c\u3001\u8a73\u7d30\u6d3b\u52d5\u5167\u5bb9", type: "textarea" },
    { key: "teachingRelation", label: "\u4e09\u3001\u6d3b\u52d5\u8207\u63d0\u6617\u6559\u5e2b\u6559\u5b78\u5c08\u696d\u767c\u5c55\u4e4b\u95dc\u4fc2\uff08\u6559\u5b78\u5c08\u696d\uff09", type: "textarea" },
    { key: "researchRelation", label: "\u56db\u3001\u6d3b\u52d5\u8207\u63d0\u6617\u6559\u5e2b\u7814\u7a76\u5c08\u696d\u767c\u5c55\u4e4b\u95dc\u4fc2\uff08\u7814\u7a76\u5c08\u696d\uff09", type: "textarea" },
    { key: "note", label: "\u5176\u4ed6\u5099\u8a3b", type: "textarea" },
  ],
  out: [
    { key: "teacherName", label: "\u6559\u5e2b\u59d3\u540d", type: "text" },
    { key: "department", label: "\u4efb\u6559\u55ae\u4f4d", type: "text" },
    { key: "teacherId", label: "\u6559\u5e2b\u7de8\u865f", type: "text" },
    { key: "ext", label: "\u806f\u7d61\u5206\u6a5f", type: "text" },
    { key: "eventDate", label: "\u6d3b\u52d5\u65e5\u671f", type: "date" },
    { key: "startTime", label: "\u6d3b\u52d5\u8d77\u8fc4\u6642\u9593\uff08\u958b\u59cb\uff09", type: "time" },
    { key: "endTime", label: "\u6d3b\u52d5\u8d77\u8fc4\u6642\u9593\uff08\u7d50\u675f\uff09", type: "time" },
    { key: "hours", label: "\u6642\u6578", type: "text" },
    { key: "courseTitle", label: "\u6d3b\u52d5\u540d\u7a31", type: "text" },
    { key: "organizer", label: "\u8209\u8fa6\u55ae\u4f4d", type: "text" },
    { key: "relevance", label: "\u6559\u5b78\u5c08\u696d\u6210\u9577", type: "textarea" },
    { key: "hasCert", label: "\u662f\u5426\u6838\u767c\u8b49\u66f8", type: "text" },
    { key: "certNo", label: "\u8b49\u66f8\u5b57\u865f", type: "text" },
    { key: "evidenceLink", label: "\u9644\u4e0a\u9023\u7d50", type: "text" },
    { key: "attachments", label: "\u9644\u4ef6", type: "array" },
  ],
};

function fmtType(type) {
  return type === "in" ? "\u6821\u5167" : "\u6821\u5916";
}

function arrToText(value) {
  if (Array.isArray(value)) return value.join("\u3001");
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
      const name = file.name || `\u9644\u4ef6 ${idx + 1}`;
      return `<a class="attachment-link" href="${API_BASE}/api/applications/${record.id}/files/${idx}" target="_blank" rel="noopener">${name}</a>`;
    })
    .join("");
  return `<div class="attachment-links">${links}</div>`;
}

function renderDetailForm(record) {
  const defs = FIELD_DEFS[record.app_type] || [];
  const rows = defs
    .map((def) => {
      const extra = def.key === "attachments" ? renderAttachmentsLinks(record) : "";
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
        ${record.app_type === "in" ? "" : `<button type="button" class="btn ghost" data-action="export" data-id="${record.id}">\u532f\u51fa PDF</button>`}
        <button type="button" class="btn ghost" data-action="delete" data-id="${record.id}">\u522a\u9664</button>
        <button type="submit" class="btn primary">\u66f4\u65b0</button>
      </div>
    </form>
  `;
}

function renderList(records) {
  if (!historyList) return;
  historyList.innerHTML = "";
  if (!records.length) {
    historyList.innerHTML = `<div class="muted">\u76ee\u524d\u6c92\u6709\u7d00\u9304\u3002</div>`;
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
        ? raw.split(/[\u3001,]/).map((v) => v.trim()).filter(Boolean)
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
      <h2>\u7533\u8acb\u7d00\u9304\uff1a${fmtType(record.app_type)}</h2>
      <div class="print-meta">\u55ae\u4f4d\uff1a${record.unit_name || "-"} \u2022 \u6d3b\u52d5\u65e5\u671f\uff1a${record.event_date || "-"}</div>
      <div class="print-block">
        ${rows}
      </div>
      <div class="print-only">
        <h3>\u7c3d\u7ae0\u6b04\u4f4d</h3>
        <div class="print-sign">
          <div>\u7533\u8acb\u4eba________________</div>
          <div>\u55ae\u4f4d\u4e3b\u7ba1________________</div>
          <div>\u8655\u7406\u4eba\u54e1________________</div>
          <div>\u6559\u5b78\u8cc7\u6e90\u7d44\u7d44\u9577________________</div>
          <div>\u5099\u8a3b\uff1a_______________________________</div>
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

  if (action === "export") {
    const record = await api(`/api/applications/${id}`);
    injectPrint(record);
    window.print();
    return;
  }

  if (action === "delete") {
    if (!confirm("\u78ba\u8a8d\u8981\u522a\u9664\u9019\u7b46\u7d00\u9304\u55ce\uff1f")) return;
    try {
      await api(`/api/applications/${id}`, { method: "DELETE" });
      await loadApplications(getActiveType());
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

btnRefresh?.addEventListener("click", () => loadApplications(getActiveType()));

document.addEventListener("DOMContentLoaded", () => loadApplications(getActiveType()));
