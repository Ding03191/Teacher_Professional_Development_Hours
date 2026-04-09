const API_BASE = window.API_BASE || "";

const formT = document.getElementById("formTeacher");
const filesInput = document.getElementById("files");
const fileList = document.getElementById("fileList");
const msgEl = document.getElementById("msg");
const certNoBox = document.getElementById("certNoBox");
const btnScoreOut = document.getElementById("btnScoreOut");
const relevanceScoreValue = document.getElementById("relevanceScoreValue");
const relevanceScoreMsg = document.getElementById("relevanceScoreMsg");
const timeSlotsOut = document.getElementById("timeSlotsOut");
const btnAddTimeSlotOut = document.getElementById("btnAddTimeSlotOut");
let hoursInputOut = null;

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
  const rounded = Math.round(totalMinutes / 60);
  const clamped = Math.min(4, Math.max(1, rounded));
  return clamped.toString();
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

async function rollbackApplication(appId) {
  if (!appId) return;
  try {
    await fetch(`${API_BASE}/api/applications/${appId}`, {
      method: "DELETE",
      credentials: "include",
    });
  } catch (_) {
    // Ignore rollback errors; the user-facing error is handled by submit flow.
  }
}

function createTimeSlotRow(slot = {}) {
  const row = document.createElement("div");
  row.className = "time-slot-row";
  row.innerHTML = `
    <input type="time" class="slot-start" value="${slot.startTime || ""}" required>
    <span class="time-slot-sep">～</span>
    <input type="time" class="slot-end" value="${slot.endTime || ""}" required>
    <button type="button" class="btn ghost slot-remove">刪除</button>
  `;
  return row;
}

function ensureTimeSlotsOut() {
  if (!timeSlotsOut) return;
  if (timeSlotsOut.children.length > 0) return;
  timeSlotsOut.appendChild(createTimeSlotRow());
  refreshTimeSlotRemoveState();
}

function refreshTimeSlotRemoveState() {
  if (!timeSlotsOut) return;
  const rows = Array.from(timeSlotsOut.querySelectorAll(".time-slot-row"));
  rows.forEach((row, index) => {
    const btn = row.querySelector(".slot-remove");
    if (!btn) return;
    btn.disabled = rows.length === 1;
    btn.style.visibility = rows.length === 1 && index === 0 ? "hidden" : "visible";
  });
}

function getTimeSlotsOut() {
  if (!timeSlotsOut) return [];
  return Array.from(timeSlotsOut.querySelectorAll(".time-slot-row")).map((row) => {
    const startTime = row.querySelector(".slot-start")?.value?.trim() || "";
    const endTime = row.querySelector(".slot-end")?.value?.trim() || "";
    return { startTime, endTime };
  });
}

function ensureHoursFieldOut() {
  if (!formT || hoursInputOut) return;
  const timeField = timeSlotsOut?.closest(".field");
  if (!timeField || !timeField.parentElement) return;
  const wrapper = document.createElement("label");
  wrapper.className = "field";
  wrapper.innerHTML = `
    <span class="lbl">活動時數（自動計算，最多4小時）</span>
    <input name="hours" id="hoursOut" type="text" readonly placeholder="1~4 小時">
  `;
  timeField.parentElement.insertBefore(wrapper, timeField.nextSibling);
  hoursInputOut = wrapper.querySelector("input");
}

function updateHoursOut() {
  if (!hoursInputOut) return;
  const hours = calcRoundedHoursFromSlots(getTimeSlotsOut());
  hoursInputOut.value = hours;
}

function collectTeacherForm() {
  const fd = new FormData(formT);
  const timeSlots = getTimeSlotsOut();
  const hours = calcRoundedHoursFromSlots(timeSlots);
  const firstSlot = timeSlots[0] || { startTime: "", endTime: "" };
  return {
    teacherName: fd.get("teacherName")?.toString().trim(),
    department: fd.get("department")?.toString().trim(),
    teacherId: fd.get("teacherId")?.toString().trim(),
    ext: fd.get("ext")?.toString().trim() || "",
    eventDateStart: fd.get("eventDateStart"),
    eventDateEnd: fd.get("eventDateEnd"),
    startTime: firstSlot.startTime,
    endTime: firstSlot.endTime,
    timeSlots,
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

function validateTimeSlots(slots) {
  if (!Array.isArray(slots) || slots.length === 0) return "請至少新增 1 個活動時段。";

  const parsed = [];
  for (let i = 0; i < slots.length; i += 1) {
    const slot = slots[i] || {};
    const s = timeToMinutes(slot.startTime);
    const e = timeToMinutes(slot.endTime);
    if (s === null || e === null) return `第 ${i + 1} 個時段請填寫完整開始與結束時間。`;
    if (e <= s) return `第 ${i + 1} 個時段結束時間需晚於開始時間。`;
    parsed.push({ s, e, idx: i + 1 });
  }

  parsed.sort((a, b) => a.s - b.s);
  for (let i = 1; i < parsed.length; i += 1) {
    if (parsed[i].s < parsed[i - 1].e) {
      return `第 ${parsed[i - 1].idx} 與第 ${parsed[i].idx} 個時段有重疊。`;
    }
  }

  return "";
}

function validateTeacher() {
  const d = collectTeacherForm();
  const errs = [];
  if (!d.teacherName) errs.push("請輸入教師姓名。");
  if (!d.department) errs.push("請輸入任教單位。");
  if (!d.teacherId) errs.push("請輸入教師編號。");
  if (!d.eventDateStart) errs.push("請選擇活動起始日期。");
  if (!d.eventDateEnd) errs.push("請選擇活動結束日期。");
  if (d.eventDateStart && d.eventDateEnd && d.eventDateEnd < d.eventDateStart) {
    errs.push("活動結束日期需晚於或等於起始日期。");
  }
  const slotErr = validateTimeSlots(d.timeSlots);
  if (slotErr) errs.push(slotErr);
  if (!d.courseTitle) errs.push("請輸入活動名稱。");
  if (!d.organizer) errs.push("請輸入舉辦單位。");
  if (!d.relevance) errs.push("請填寫教學專業成長。");
  if (!d.hasCert) errs.push("請選擇是否核發證書。");
  if (d.hasCert === "yes" && !d.certNo) errs.push("請輸入證書字號。");
  if (!d.attachmentCount) errs.push("請至少上傳 1 份附件。");
  return errs;
}

formT?.addEventListener("change", (e) => {
  const target = e.target;
  if (target?.name === "hasCert") {
    certNoBox?.classList.toggle("is-hidden", target.value !== "yes");
  }
});

timeSlotsOut?.addEventListener("input", (e) => {
  const target = e.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.classList.contains("slot-start") || target.classList.contains("slot-end")) {
    updateHoursOut();
  }
});

timeSlotsOut?.addEventListener("click", (e) => {
  const target = e.target;
  if (!(target instanceof HTMLElement)) return;
  if (!target.classList.contains("slot-remove")) return;
  const row = target.closest(".time-slot-row");
  if (!row) return;
  row.remove();
  if (!timeSlotsOut.querySelector(".time-slot-row")) {
    timeSlotsOut.appendChild(createTimeSlotRow());
  }
  refreshTimeSlotRemoveState();
  updateHoursOut();
});

btnAddTimeSlotOut?.addEventListener("click", () => {
  if (!timeSlotsOut) return;
  timeSlotsOut.appendChild(createTimeSlotRow());
  refreshTimeSlotRemoveState();
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

formT?.addEventListener("submit", (e) => {
  e.preventDefault();
  msgEl.textContent = "";
  const errs = validateTeacher();
  if (errs.length) {
    msgEl.innerHTML = `<span style="color:#dc2626">${errs.join("<br>")}</span>`;
    return;
  }
  if (!confirm("確認要送出申請嗎？")) return;

  setMsg("success", "送出中，請稍候…");
  const data = collectTeacherForm();
  const timeSlotsPayload = data.timeSlots.map((slot, idx) => ({
    slot_date: data.eventDateStart || "",
    start_time: slot.startTime,
    end_time: slot.endTime,
    sort_order: idx,
  }));

  fetch(`${API_BASE}/api/applications`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_type: "out",
      data,
      time_slots: timeSlotsPayload,
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
    .then(async ({ ok, body }) => {
      if (!ok || body.ok === false) throw new Error(body.error || "submit_failed");
      const appId = body.data?.id;
      const files = Array.from(filesInput?.files || []);
      if (!appId || files.length === 0) {
        await rollbackApplication(appId);
        throw new Error("送出失敗：缺少申請編號或附件。");
      }
      const fd = new FormData();
      files.forEach((file) => fd.append("files", file));
      try {
        const uploadRes = await fetch(`${API_BASE}/api/applications/${appId}/files`, {
          method: "POST",
          credentials: "include",
          body: fd,
        });
        const uploadBody = await uploadRes.json().catch(() => ({}));
        if (!uploadRes.ok || uploadBody.ok === false) {
          if (uploadBody.error === "only_pdf_or_xlsx_allowed" || uploadBody.error === "only_supported_file_types") {
            throw new Error("只支援 PDF、Excel（.xlsx）或圖檔（JPG/PNG/WebP/GIF/BMP）。");
          }
          throw new Error(uploadBody.error || "upload_failed");
        }
      } catch (error) {
        await rollbackApplication(appId);
        throw error;
      }
      setMsg("success", "送出成功，將前往歷史紀錄。");
      setTimeout(() => (window.location.href = "history"), 300);
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
  if (d.hasCert === "yes") hasCertText = "是";
  else if (d.hasCert === "no") hasCertText = "否";
  setText("pdf_hasCert", hasCertText);

  setText(
    "pdf_certNo",
    d.hasCert === "yes" && d.certNo ? `證書字號：${d.certNo}` : ""
  );

  const filesEl = document.getElementById("pdf_files");
  if (filesEl) {
    const list = Array.from(filesInput?.files || [])
      .map((f, i) => `${i + 1}. ${f.name}`)
      .join("\n");
    filesEl.textContent = list || "（無附件）";
  }
}

window.fillPdfForm = fillPdfForm;

document.addEventListener("DOMContentLoaded", () => {
  ensureTimeSlotsOut();
  ensureHoursFieldOut();
  refreshTimeSlotRemoveState();
  updateHoursOut();
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
    if (relevanceScoreValue) {
      relevanceScoreValue.textContent = typeof score === "number" ? `${score} / 5` : "完成";
    }
    setScoreMsg("success", reason ? `原因：${reason}` : "評分完成");
  } catch (err) {
    if (relevanceScoreValue) relevanceScoreValue.textContent = "尚未評分";
    setScoreMsg("error", err.message || "評分失敗");
  }
});
