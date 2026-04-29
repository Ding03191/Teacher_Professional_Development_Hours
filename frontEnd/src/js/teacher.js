const API_BASE = window.API_BASE || "";

const formT = document.getElementById("formTeacher");
const filesInput = document.getElementById("files");
const fileList = document.getElementById("fileList");
const msgEl = document.getElementById("msg");
const certNoBox = document.getElementById("certNoBox");
const timeSlotsOut = document.getElementById("timeSlotsOut");
const btnAddTimeSlotOut = document.getElementById("btnAddTimeSlotOut");

let hoursInputOut = null;
let isSubmittingOut = false;

function getTodayIsoLocal() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
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
  const rounded = Math.round(totalMinutes / 60);
  return String(Math.min(4, Math.max(1, rounded)));
}

function setMsg(type, text) {
  if (!msgEl) return;
  const color = type === "error" ? "#dc2626" : "#16a34a";
  msgEl.innerHTML = `<span style="color:${color}">${text || ""}</span>`;
}

async function rollbackApplication(appId) {
  if (!appId) return;
  try {
    await fetch(`${API_BASE}/api/applications/${appId}`, {
      method: "DELETE",
      credentials: "include",
    });
  } catch (_) {
    // noop
  }
}

function createTimeSlotRow(slot = {}) {
  const today = getTodayIsoLocal();
  const row = document.createElement("div");
  row.className = "time-slot-row";
  row.innerHTML = `
    <div class="time-slot-date-group">
      <input type="date" class="slot-date-start" value="${slot.startDate || slot.slotDate || ""}" max="${today}" required>
      <span class="time-slot-sep">~</span>
      <input type="date" class="slot-date-end" value="${slot.endDate || slot.slotEndDate || slot.slotDate || ""}" max="${today}" required>
    </div>
    <div class="time-slot-time-group">
      <input type="time" class="slot-start" value="${slot.startTime || ""}" required>
      <span class="time-slot-sep">~</span>
      <input type="time" class="slot-end" value="${slot.endTime || ""}" required>
    </div>
    <button type="button" class="btn ghost slot-remove" aria-label="移除時段">×</button>
  `;
  return row;
}

function ensureTimeSlotsOut() {
  if (!timeSlotsOut) return;
  if (timeSlotsOut.querySelector(".time-slot-row")) return;
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
  return Array.from(timeSlotsOut.querySelectorAll(".time-slot-row")).map((row) => ({
    startDate: row.querySelector(".slot-date-start")?.value?.trim() || "",
    endDate: row.querySelector(".slot-date-end")?.value?.trim() || "",
    startTime: row.querySelector(".slot-start")?.value?.trim() || "",
    endTime: row.querySelector(".slot-end")?.value?.trim() || "",
  }));
}

function applyDateMaxOut() {
  if (!timeSlotsOut) return;
  const today = getTodayIsoLocal();
  timeSlotsOut.querySelectorAll(".slot-date-start, .slot-date-end").forEach((input) => {
    input.max = today;
  });
}

function ensureHoursFieldOut() {
  if (!formT || hoursInputOut) return;
  const timeField = timeSlotsOut?.closest(".field");
  if (!timeField || !timeField.parentElement) return;
  const wrapper = document.createElement("label");
  wrapper.className = "field";
  wrapper.innerHTML = `
    <span class="lbl">活動時數（自動計算，最多 4 小時）</span>
    <input name="hours" id="hoursOut" type="text" readonly placeholder="1~4 小時">
  `;
  timeField.parentElement.insertBefore(wrapper, timeField.nextSibling);
  hoursInputOut = wrapper.querySelector("input");
}

function updateHoursOut() {
  if (!hoursInputOut) return;
  hoursInputOut.value = calcRoundedHoursFromSlots(getTimeSlotsOut());
}

function collectTeacherForm() {
  const fd = new FormData(formT);
  const timeSlots = getTimeSlotsOut();
  const firstSlot = timeSlots[0] || { startTime: "", endTime: "" };
  const startDates = timeSlots.map((slot) => slot.startDate).filter(Boolean).sort();
  const endDates = timeSlots.map((slot) => slot.endDate).filter(Boolean).sort();
  const eventDateStart = startDates[0] || endDates[0] || "";
  const eventDateEnd = endDates[endDates.length - 1] || eventDateStart;
  return {
    teacherName: fd.get("teacherName")?.toString().trim(),
    department: fd.get("department")?.toString().trim(),
    teacherId: fd.get("teacherId")?.toString().trim(),
    ext: fd.get("ext")?.toString().trim() || "",
    eventDateStart,
    eventDateEnd,
    startTime: firstSlot.startTime,
    endTime: firstSlot.endTime,
    timeSlots,
    hours: calcRoundedHoursFromSlots(timeSlots),
    courseTitle: fd.get("courseTitle")?.toString().trim(),
    organizer: fd.get("organizer")?.toString().trim(),
    relevance: fd.get("relevance")?.toString().trim(),
    evidenceLink: fd.get("evidenceLink")?.toString().trim(),
    hasCert: fd.get("hasCert"),
    certNo: fd.get("hasCert") === "yes" ? fd.get("certNo")?.toString().trim() || "" : "",
    attachments: Array.from(filesInput?.files || []).map((f) => f.name),
    attachmentCount: filesInput?.files?.length || 0,
  };
}

function validateTimeSlots(slots) {
  if (!Array.isArray(slots) || slots.length === 0) return "請至少新增 1 個時段。";
  for (let i = 0; i < slots.length; i += 1) {
    const slot = slots[i] || {};
    const start = parseSlotDateTime(slot.startDate, slot.startTime);
    const end = parseSlotDateTime(slot.endDate, slot.endTime);
    if (!slot.startDate || !slot.endDate) return `第 ${i + 1} 個時段需填寫起訖日期。`;
    if (!slot.startTime || !slot.endTime) return `第 ${i + 1} 個時段請填寫完整起訖時間。`;
    if (!start || !end || end <= start) return `第 ${i + 1} 個時段結束時間必須晚於開始時間。`;
  }
  return "";
}

function validateTeacher() {
  const data = collectTeacherForm();
  const errs = [];
  if (!data.teacherName) errs.push("請填寫教師姓名。");
  if (!data.department) errs.push("請填寫任教單位。");
  if (!data.teacherId) errs.push("請填寫教師編號。");
  const slotErr = validateTimeSlots(data.timeSlots);
  if (slotErr) errs.push(slotErr);
  const today = getTodayIsoLocal();
  const hasFutureDate = data.timeSlots.some(
    (slot) =>
      (slot.startDate && slot.startDate > today) ||
      (slot.endDate && slot.endDate > today)
  );
  if (hasFutureDate) errs.push("活動日期不可晚於今天。");
  if (!data.courseTitle) errs.push("請填寫活動名稱。");
  if (!data.organizer) errs.push("請填寫舉辦單位。");
  if (!data.relevance) errs.push("請填寫教學專業成長。");
  if (!data.hasCert) errs.push("請選擇是否核發證書。");
  if (data.hasCert === "yes" && !data.certNo) errs.push("請填寫證書字號。");
  if (!data.attachmentCount) errs.push("請至少上傳 1 份附件。");
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
  if (
    target.classList.contains("slot-start") ||
    target.classList.contains("slot-end") ||
    target.classList.contains("slot-date-start") ||
    target.classList.contains("slot-date-end")
  ) {
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
  applyDateMaxOut();
  refreshTimeSlotRemoveState();
  updateHoursOut();
});

btnAddTimeSlotOut?.addEventListener("click", () => {
  if (!timeSlotsOut) return;
  timeSlotsOut.appendChild(createTimeSlotRow());
  applyDateMaxOut();
  refreshTimeSlotRemoveState();
});

filesInput?.addEventListener("change", () => {
  if (!fileList) return;
  fileList.innerHTML = "";
  Array.from(filesInput.files || []).forEach((file, i) => {
    const li = document.createElement("li");
    li.textContent = `${i + 1}. ${file.name} (${Math.round(file.size / 1024)} KB)`;
    fileList.appendChild(li);
  });
});

formT?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (isSubmittingOut) return;
  setMsg("success", "");

  const errs = validateTeacher();
  if (errs.length) {
    msgEl.innerHTML = `<span style="color:#dc2626">${errs.join("<br>")}</span>`;
    return;
  }

  if (!window.confirm("確認要送出申請嗎？")) return;

  isSubmittingOut = true;
  setMsg("success", "送出中，請稍候…");

  const data = collectTeacherForm();
  const timeSlotsPayload = data.timeSlots.map((slot, idx) => ({
    slot_date: slot.startDate || data.eventDateStart || "",
    slot_end_date: slot.endDate || slot.startDate || data.eventDateEnd || "",
    start_time: slot.startTime,
    end_time: slot.endTime,
    sort_order: idx,
  }));

  try {
    const res = await fetch(`${API_BASE}/api/applications`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_type: "out",
        data,
        time_slots: timeSlotsPayload,
        summary: {
          event_name: data.courseTitle,
          event_date:
            data.eventDateStart && data.eventDateEnd
              ? `${data.eventDateStart} ~ ${data.eventDateEnd}`
              : data.eventDateStart || data.eventDateEnd || "",
          organizer: data.organizer,
        },
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.ok === false) throw new Error(body.error || "submit_failed");

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
        if (
          uploadBody.error === "only_pdf_or_xlsx_allowed" ||
          uploadBody.error === "only_supported_file_types"
        ) {
          throw new Error("只支援 PDF、Excel（.xlsx）或圖檔（JPG/PNG/WebP/GIF/BMP）。");
        }
        throw new Error(uploadBody.error || "upload_failed");
      }
    } catch (error) {
      await rollbackApplication(appId);
      throw error;
    }

    setMsg("success", "送出成功，將前往歷史紀錄。");
    setTimeout(() => {
      window.location.href = "history";
    }, 300);
  } catch (err) {
    setMsg("error", err.message || "送出失敗");
    isSubmittingOut = false;
  }
});

window.fillPdfForm = function fillPdfForm() {};

document.addEventListener("DOMContentLoaded", () => {
  ensureTimeSlotsOut();
  ensureHoursFieldOut();
  refreshTimeSlotRemoveState();
  applyDateMaxOut();
  updateHoursOut();
});

// ===== 拖曳上傳區塊互動 =====
document.addEventListener("DOMContentLoaded", () => {
  const fileDropZone = document.getElementById("fileDropZone");
  const fileInput = document.getElementById("files");
  
  if (fileDropZone && fileInput) {
    fileDropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      fileDropZone.classList.add("drag-active");
    });
    fileDropZone.addEventListener("dragleave", () => {
      fileDropZone.classList.remove("drag-active");
    });
    fileDropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      fileDropZone.classList.remove("drag-active");
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        fileInput.files = e.dataTransfer.files;
        fileInput.dispatchEvent(new Event("change"));
      }
    });
  }
});
