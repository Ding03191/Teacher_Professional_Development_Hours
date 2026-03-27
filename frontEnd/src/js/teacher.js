const API_BASE = window.API_BASE || "";

const formT = document.getElementById("formTeacher");
const filesInput = document.getElementById("files");
const fileList = document.getElementById("fileList");
const msgEl = document.getElementById("msg");
const certNoBox = document.getElementById("certNoBox");
const btnScoreOut = document.getElementById("btnScoreOut");
const relevanceScoreValue = document.getElementById("relevanceScoreValue");
const relevanceScoreMsg = document.getElementById("relevanceScoreMsg");
const startTimeOut = document.querySelector('input[name="startTime"]');
const endTimeOut = document.querySelector('input[name="endTime"]');
let hoursInputOut = null;

function timeToMinutes(value) {
  if (!value || !value.includes(":")) return null;
  const [hh, mm] = value.split(":").map((v) => parseInt(v, 10));
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return hh * 60 + mm;
}

function calcRoundedHours(start, end) {
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  if (s === null || e === null || e <= s) return "";
  const diffHours = (e - s) / 60;
  const rounded = Math.round(diffHours);
  const clamped = Math.min(4, Math.max(1, rounded));
  return clamped.toString();
}

function ensureHoursFieldOut() {
  if (!formT || hoursInputOut) return;
  const timeField = startTimeOut?.closest(".field") || endTimeOut?.closest(".field");
  if (!timeField || !timeField.parentElement) return;
  const wrapper = document.createElement("label");
  wrapper.className = "field";
  wrapper.innerHTML = `
    <span class="lbl">活動時數（自動計算）</span>
    <input name="hours" id="hoursOut" type="text" readonly placeholder="1~4 小時">
  `;
  timeField.parentElement.insertBefore(wrapper, timeField.nextSibling);
  hoursInputOut = wrapper.querySelector("input");
}

function updateHoursOut() {
  if (!hoursInputOut) return;
  const hours = calcRoundedHours(startTimeOut?.value, endTimeOut?.value);
  hoursInputOut.value = hours;
}

function setMsg(type, text) {
  if (!msgEl) return;
  const color = type === "error" ? "#dc2626" : "#16a34a";
  msgEl.innerHTML = `<span style="color:${color}">${text}</span>`;
}

function setScoreMsg(type, text) {
  if (!relevanceScoreMsg) return;
  const color = type === "error" ? "#dc2626" : "#16a34a";
  relevanceScoreMsg.innerHTML = `<span style="color:${color}">${text}</span>`;
}

formT?.addEventListener("change", (e) => {
  const target = e.target;
  if (target?.name === "hasCert") {
    certNoBox?.classList.toggle("is-hidden", target.value !== "yes");
  }
});

filesInput?.addEventListener("change", () => {
  if (!fileList) return;
  fileList.innerHTML = "";
  Array.from(filesInput.files || []).forEach((f, i) => {
    const li = document.createElement("li");
    li.textContent = `${i + 1}. ${f.name} (${Math.round(f.size / 1024)} KB)`;
    fileList.appendChild(li);
  });
});

function collectTeacherForm() {
  const fd = new FormData(formT);
  const hours = calcRoundedHours(fd.get("startTime"), fd.get("endTime"));
  return {
    teacherName: fd.get("teacherName")?.toString().trim(),
    department: fd.get("department")?.toString().trim(),
    teacherId: fd.get("teacherId")?.toString().trim(),
    ext: fd.get("ext")?.toString().trim() || "",
    eventDateStart: fd.get("eventDateStart"),
    eventDateEnd: fd.get("eventDateEnd"),
    startTime: fd.get("startTime"),
    endTime: fd.get("endTime"),
    hours,
    courseTitle: fd.get("courseTitle")?.toString().trim(),
    organizer: fd.get("organizer")?.toString().trim(),
    relevance: fd.get("relevance")?.toString().trim(),
    evidenceLink: fd.get("evidenceLink")?.toString().trim(),
    hasCert: fd.get("hasCert"),
    certNo:
      fd.get("hasCert") === "yes"
        ? fd.get("certNo")?.toString().trim() || ""
        : "",
    attachments: Array.from(filesInput?.files || []).map((f) => f.name),
    attachmentCount: filesInput?.files?.length || 0,
  };
}

function validateTeacher() {
  const d = collectTeacherForm();
  const errs = [];
  if (!d.teacherName) errs.push("\u8acb\u8f38\u5165\u6559\u5e2b\u59d3\u540d\u3002");
  if (!d.department) errs.push("\u8acb\u8f38\u5165\u4efb\u6559\u55ae\u4f4d\u3002");
  if (!d.teacherId) errs.push("\u8acb\u8f38\u5165\u6559\u5e2b\u7de8\u865f\u3002");
  if (!d.eventDateStart) errs.push("\u8acb\u9078\u64c7\u6d3b\u52d5\u8d77\u59cb\u65e5\u671f\u3002");
  if (!d.eventDateEnd) errs.push("\u8acb\u9078\u64c7\u6d3b\u52d5\u7d50\u675f\u65e5\u671f\u3002");
  if (d.eventDateStart && d.eventDateEnd && d.eventDateEnd < d.eventDateStart) {
    errs.push("\u6d3b\u52d5\u7d50\u675f\u65e5\u671f\u9700\u665a\u65bc\u6216\u7b49\u65bc\u8d77\u59cb\u65e5\u671f\u3002");
  }
  if (!d.startTime || !d.endTime) errs.push("\u8acb\u9078\u64c7\u6d3b\u52d5\u6642\u9593\u3002");
  if (d.startTime && d.endTime && d.startTime >= d.endTime) {
    errs.push("\u7d50\u675f\u6642\u9593\u9700\u665a\u65bc\u958b\u59cb\u6642\u9593\u3002");
  }
  if (!d.courseTitle) errs.push("\u8acb\u8f38\u5165\u6d3b\u52d5\u540d\u7a31\u3002");
  if (!d.organizer) errs.push("\u8acb\u8f38\u5165\u8209\u8fa6\u55ae\u4f4d\u3002");
  if (!d.relevance) errs.push("\u8acb\u586b\u5beb\u6559\u5b78\u5c08\u696d\u6210\u9577\u3002");
  if (!d.hasCert) errs.push("\u8acb\u9078\u64c7\u662f\u5426\u6838\u767c\u8b49\u66f8\u3002");
  if (d.hasCert === "yes" && !d.certNo) errs.push("\u8acb\u8f38\u5165\u8b49\u66f8\u5b57\u865f\u3002");
  if (!d.attachmentCount) errs.push("\u8acb\u81f3\u5c11\u4e0a\u50b3 1 \u4efd\u9644\u4ef6\u3002");
  return errs;
}

formT?.addEventListener("submit", (e) => {
  e.preventDefault();
  msgEl.textContent = "";
  const errs = validateTeacher();
  if (errs.length) {
    msgEl.innerHTML = `<span style="color:#dc2626">${errs.join("<br>")}</span>`;
    return;
  }
  if (!confirm("\u78ba\u8a8d\u8981\u9001\u51fa\u7533\u8acb\u55ce\uff1f")) return;

  setMsg("success", "\u9001\u51fa\u4e2d\uff0c\u8acb\u7a0d\u5019\u2026");
  const data = collectTeacherForm();

  fetch(`${API_BASE}/api/applications`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_type: "out",
      data,
      summary: {
        event_name: data.courseTitle,
        event_date: data.eventDateStart && data.eventDateEnd
          ? `${data.eventDateStart} ~ ${data.eventDateEnd}`
          : data.eventDateStart || data.eventDateEnd || "",
        organizer: data.organizer,
      },
    }),
  })
    .then((res) => res.json().then((body) => ({ ok: res.ok, body })))
    .then(({ ok, body }) => {
      if (!ok || body.ok === false) throw new Error(body.error || "submit_failed");
      const appId = body.data?.id;
      const files = Array.from(filesInput?.files || []);
      if (!appId || files.length === 0) {
        setMsg("success", "\u9001\u51fa\u6210\u529f\uff0c\u5c07\u524d\u5f80\u6b77\u53f2\u7d00\u9304\u3002");
        setTimeout(() => (window.location.href = "history.html"), 300);
        return;
      }
      const fd = new FormData();
      files.forEach((file) => fd.append("files", file));
      return fetch(`${API_BASE}/api/applications/${appId}/files`, {
        method: "POST",
        credentials: "include",
        body: fd,
      })
        .then((res) => res.json().then((body) => ({ ok: res.ok, body })))
        .then(({ ok, body }) => {
          if (!ok || body.ok === false) {
            if (body.error === "only_pdf_or_xlsx_allowed") {
              throw new Error("\u53ea\u652f\u63f4 PDF \u6216 Excel\uff08.xlsx\uff09\u6a94\u6848\u3002");
            }
            throw new Error(body.error || "upload_failed");
          }
          setMsg("success", "\u9001\u51fa\u6210\u529f\uff0c\u5c07\u524d\u5f80\u6b77\u53f2\u7d00\u9304\u3002");
          setTimeout(() => (window.location.href = "history.html"), 300);
        });
    })
    .catch((err) => setMsg("error", err.message));
});

function fillPdfForm(d) {
  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value || "";
  };

  setText("pdf_teacherName", d.teacherName);
  setText("pdf_department", d.department);
  setText("pdf_teacherId", d.teacherId);
  setText("pdf_ext", d.ext);
  const dateRange = d.eventDateStart && d.eventDateEnd
    ? `${d.eventDateStart} ~ ${d.eventDateEnd}`
    : d.eventDateStart || d.eventDateEnd || "";
  setText("pdf_eventDate", dateRange);
  setText("pdf_start", d.startTime);
  setText("pdf_end", d.endTime);
  setText("pdf_courseTitle", d.courseTitle);
  setText("pdf_organizer", d.organizer);
  setText("pdf_relevance", d.relevance);

  let hasCertText = "";
  if (d.hasCert === "yes") hasCertText = "\u662f";
  else if (d.hasCert === "no") hasCertText = "\u5426";
  setText("pdf_hasCert", hasCertText);

  setText(
    "pdf_certNo",
    d.hasCert === "yes" && d.certNo ? `\u8b49\u66f8\u5b57\u865f\uff1a${d.certNo}` : ""
  );

  const filesEl = document.getElementById("pdf_files");
  if (filesEl) {
    const list = Array.from(filesInput?.files || [])
      .map((f, i) => `${i + 1}. ${f.name}`)
      .join("\n");
    filesEl.textContent = list || "\uff08\u7121\u9644\u4ef6\uff09";
  }
}

// expose for other scripts if needed
window.fillPdfForm = fillPdfForm;

document.addEventListener("DOMContentLoaded", () => {
  ensureHoursFieldOut();
  updateHoursOut();
  startTimeOut?.addEventListener("change", updateHoursOut);
  endTimeOut?.addEventListener("change", updateHoursOut);
});

btnScoreOut?.addEventListener("click", async () => {
  if (relevanceScoreValue) relevanceScoreValue.textContent = "評分中…";
  setScoreMsg("success", "");

  const relevance = formT?.querySelector('textarea[name="relevance"]')?.value?.trim() || "";
  const files = Array.from(filesInput?.files || []);
  if (!relevance) {
    if (relevanceScoreValue) relevanceScoreValue.textContent = "尚未評分";
    setScoreMsg("error", "請先填寫教學專業成長說明。");
    return;
  }
  if (!files.length) {
    if (relevanceScoreValue) relevanceScoreValue.textContent = "尚未評分";
    setScoreMsg("error", "請先上傳至少 1 份佐證檔案。");
    return;
  }

  try {
    const fd = new FormData();
    fd.append("relevance", relevance);
    files.forEach((f) => fd.append("files", f));

    const res = await fetch(`${API_BASE}/api/ai/relevance`, {
      method: "POST",
      credentials: "include",
      body: fd,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.ok === false) {
      const err = body.error || "score_failed";
      if (err === "not_logged_in") {
        throw new Error("請先登入後再評分。");
      }
      if (err === "forbidden") {
        throw new Error("權限不足，無法評分。");
      }
      throw new Error(err);
    }
    const result = body.data || {};
    const score = result.score;
    const reason = result.reason || "";
    if (relevanceScoreValue) relevanceScoreValue.textContent = typeof score === "number" ? `${score} / 5` : "完成";
    setScoreMsg("success", reason ? `原因：${reason}` : "評分完成");
  } catch (err) {
    if (relevanceScoreValue) relevanceScoreValue.textContent = "尚未評分";
    setScoreMsg("error", err.message || "評分失敗");
  }
});
