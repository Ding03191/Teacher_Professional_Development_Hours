const API_BASE = window.API_BASE || "";

const formIn = document.getElementById("formInCampus");
const previewIn = document.getElementById("previewIn");
const msgIn = document.getElementById("msgIn");
const btnCheckIn = document.getElementById("btnCheckIn");
const domainWrap = document.querySelector('[data-multi="domain"]');
const sdgWrap = document.querySelector('[data-multi="sdg"]');
const filesInputIn = document.getElementById("filesIn");
const fileListIn = document.getElementById("fileListIn");
const sampleExcelLinkIn = document.getElementById("sampleExcelLinkIn");
const timeSlotsIn = document.getElementById("timeSlotsIn");
const btnAddTimeSlotIn = document.getElementById("btnAddTimeSlotIn");
let hoursInputIn = null;

function getTodayIsoLocal() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseDownloadFilename(contentDisposition, fallback = "ex.csv") {
  if (!contentDisposition) return fallback;
  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch (_) {
      return utf8Match[1];
    }
  }
  const plainMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  return plainMatch?.[1] || fallback;
}

async function handleSampleTemplateDownload(event) {
  event.preventDefault();
  const apiUrl = `${API_BASE}/api/applications/templates/excel`;
  const staticUrl = "./ex.csv";
  try {
    let res = await fetch(apiUrl, { method: "GET", credentials: "include" });
    if (res.status === 404) res = await fetch(staticUrl, { method: "GET" });
    if (!res.ok) throw new Error(`下載失敗（${res.status}）`);

    const disposition = res.headers.get("content-disposition") || "";
    const filename = parseDownloadFilename(disposition, "ex.csv");
    const blob = await res.blob();
    const objectUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(objectUrl);
  } catch (error) {
    setMsg("error", error.message || "下載範例檔失敗，請稍後再試。");
  }
}

function timeToMinutes(value) {
  if (!value || !value.includes(":")) return null;
  const [hh, mm] = value.split(":").map((v) => parseInt(v, 10));
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return hh * 60 + mm;
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

function parseSlotDateTime(dateValue, timeValue) {
  if (!dateValue || !timeValue) return null;
  const d = new Date(`${dateValue}T${timeValue}:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function setMsg(type, text) {
  if (!msgIn) return;
  const color = type === "error" ? "#dc2626" : "#16a34a";
  msgIn.innerHTML = `<span style="color:${color}">${text}</span>`;
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

function getCheckedValues(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll('input[type="checkbox"]:checked')).map(
    (checkbox) => checkbox.value
  );
}

function getCheckedLabels(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll('input[type="checkbox"]:checked')).map(
    (checkbox) => checkbox.parentElement?.textContent?.trim() || checkbox.value
  );
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
    return;
  }

  placeholder.hidden = true;
  valueEl.hidden = false;
  valueEl.textContent = labels.length <= 3 ? labels.join("、") : `已選擇 ${labels.length} 項`;
}

function initMultiSelect(container) {
  if (!container) return;
  const trigger = container.querySelector(".ms-trigger");
  const panel = container.querySelector(".ms-panel");
  const checkboxes = Array.from(container.querySelectorAll('input[type="checkbox"]'));

  const close = () => {
    container.classList.remove("is-open");
    trigger?.setAttribute("aria-expanded", "false");
  };

  const toggle = () => {
    const isOpen = container.classList.toggle("is-open");
    trigger?.setAttribute("aria-expanded", isOpen ? "true" : "false");
  };

  trigger?.addEventListener("click", (event) => {
    event.preventDefault();
    toggle();
  });

  panel?.addEventListener("click", (event) => event.stopPropagation());
  document.addEventListener("click", (event) => {
    if (!container.contains(event.target)) close();
  });

  checkboxes.forEach((checkbox) =>
    checkbox.addEventListener("change", () => updateMultiSelectDisplay(container))
  );

  updateMultiSelectDisplay(container);
}

function createTimeSlotRow(slot = {}) {
  const row = document.createElement("div");
  row.className = "time-slot-row";
  row.innerHTML = `
    <input type="date" class="slot-date-start" value="${slot.startDate || slot.slotDate || ""}" required>
    <input type="date" class="slot-date-end" value="${slot.endDate || slot.slotEndDate || slot.slotDate || ""}" required>
    <input type="time" class="slot-start" value="${slot.startTime || ""}" required>
    <span class="time-slot-sep">～</span>
    <input type="time" class="slot-end" value="${slot.endTime || ""}" required>
    <button type="button" class="btn ghost slot-remove" aria-label="移除時段">×</button>
  `;
  return row;
}

function ensureTimeSlotsIn() {
  if (!timeSlotsIn) return;
  if (timeSlotsIn.children.length > 0) return;
  timeSlotsIn.appendChild(createTimeSlotRow());
  refreshTimeSlotRemoveStateIn();
}

function refreshTimeSlotRemoveStateIn() {
  if (!timeSlotsIn) return;
  const rows = Array.from(timeSlotsIn.querySelectorAll(".time-slot-row"));
  rows.forEach((row, index) => {
    const btn = row.querySelector(".slot-remove");
    if (!btn) return;
    btn.disabled = rows.length === 1;
    btn.style.visibility = rows.length === 1 && index === 0 ? "hidden" : "visible";
  });
}

function readTimeSlotsIn() {
  if (!timeSlotsIn) return [];
  return Array.from(timeSlotsIn.querySelectorAll(".time-slot-row")).map((row) => ({
    startDate: row.querySelector(".slot-date-start")?.value?.trim() || "",
    endDate: row.querySelector(".slot-date-end")?.value?.trim() || "",
    startTime: row.querySelector(".slot-start")?.value?.trim() || "",
    endTime: row.querySelector(".slot-end")?.value?.trim() || "",
  }));
}

function ensureHoursFieldIn() {
  if (!formIn || hoursInputIn) return;
  const timeField = timeSlotsIn?.closest(".field");
  if (!timeField || !timeField.parentElement) return;
  const wrapper = document.createElement("label");
  wrapper.className = "field";
  wrapper.innerHTML = `
    <span class="lbl">活動時數（自動計算，最多4小時）</span>
    <input name="hours" id="hoursIn" type="text" readonly placeholder="1~4 小時">
  `;
  timeField.parentElement.insertBefore(wrapper, timeField.nextSibling);
  hoursInputIn = wrapper.querySelector("input");
}

function updateHoursIn() {
  if (!hoursInputIn) return;
  hoursInputIn.value = calcRoundedHoursFromSlots(readTimeSlotsIn());
}

function collectInCampusForm() {
  if (!formIn) return {};
  const fd = new FormData(formIn);
  const timeSlots = readTimeSlotsIn();
  const firstSlot = timeSlots[0] || { startTime: "", endTime: "" };
  const startDates = timeSlots
    .map((slot) => slot.startDate)
    .filter(Boolean)
    .sort();
  const endDates = timeSlots
    .map((slot) => slot.endDate)
    .filter(Boolean)
    .sort();
  const eventDateStart = startDates[0] || endDates[0] || "";
  const eventDateEnd = endDates[endDates.length - 1] || eventDateStart;
  const eventDate =
    eventDateStart && eventDateEnd
      ? `${eventDateStart} ~ ${eventDateEnd}`
      : eventDateStart || eventDateEnd || "";

  return {
    organizerDept: fd.get("organizerDept")?.toString().trim(),
    eventName: fd.get("eventName")?.toString().trim(),
    hostName: fd.get("hostName")?.toString().trim(),
    ext: fd.get("ext")?.toString().trim(),
    location: fd.get("location")?.toString().trim(),
    eventDateStart,
    eventDateEnd,
    eventDate,
    startTime: firstSlot.startTime,
    endTime: firstSlot.endTime,
    timeSlots,
    hours: calcRoundedHoursFromSlots(timeSlots),
    domain: getCheckedValues(domainWrap),
    domainOther: fd.get("domainOther")?.toString().trim(),
    sdg: getCheckedValues(sdgWrap),
    teachingRelation: fd.get("teachingRelation")?.toString().trim(),
    applicant: fd.get("applicant")?.toString().trim(),
    deptHead: fd.get("deptHead")?.toString().trim(),
    staff: fd.get("staff")?.toString().trim(),
    lead: fd.get("lead")?.toString().trim(),
    note: fd.get("note")?.toString().trim(),
    attachments: Array.from(filesInputIn?.files || []).map((f) => f.name),
    attachmentCount: filesInputIn?.files?.length || 0,
  };
}

function validateTimeSlotsIn(slots, eventDateStart, eventDateEnd, today) {
  if (!Array.isArray(slots) || slots.length === 0) return "請至少新增 1 個時段。";
  for (let i = 0; i < slots.length; i += 1) {
    const slot = slots[i] || {};
    const start = parseSlotDateTime(slot.startDate, slot.startTime);
    const end = parseSlotDateTime(slot.endDate, slot.endTime);
    if (!slot.startDate || !slot.endDate) return `第 ${i + 1} 個時段需填寫起訖日期。`;
    if (slot.startDate > today || slot.endDate > today) return `第 ${i + 1} 個時段日期不可晚於今天。`;
    if (!slot.startTime || !slot.endTime) return `第 ${i + 1} 個時段請填寫完整起訖時間。`;
    if (!start || !end || end <= start) return `第 ${i + 1} 個時段結束時間必須晚於開始時間。`;
  }
  return "";
}

function validateInCampusForm(data) {
  const errs = [];
  const today = getTodayIsoLocal();
  if (!data.organizerDept) errs.push("請輸入主辦單位。");
  if (!data.eventName) errs.push("請輸入活動名稱。");
  if (!data.hostName) errs.push("請輸入主(承)辦人員。");
  if (!data.ext) errs.push("請輸入聯絡分機。");
  if (!data.location) errs.push("請輸入活動地點。");
  const slotErr = validateTimeSlotsIn(data.timeSlots, data.eventDateStart, data.eventDateEnd, today);
  if (slotErr) errs.push(slotErr);
  if (!data.teachingRelation) errs.push("請填寫「活動與提升教師教學專業發展之關係」。");
  if (!data.attachmentCount) errs.push("請至少上傳 1 份附件。");
  return errs;
}

function renderPreview() {
  if (!previewIn || !formIn) return;
  previewIn.textContent = JSON.stringify(collectInCampusForm(), null, 2);
}

btnCheckIn?.addEventListener("click", () => {
  if (!formIn || !msgIn) return;
  msgIn.textContent = "";
  const data = collectInCampusForm();
  const errs = validateInCampusForm(data);
  if (errs.length) {
    msgIn.innerHTML = `<span style="color:#dc2626">${errs.join("<br>")}</span>`;
    return;
  }
  if (!window.confirm("確認要送出申請嗎？")) return;

  setMsg("success", "送出中，請稍候…");
  const timeSlotsPayload = data.timeSlots.map((slot, idx) => ({
    slot_date: slot.startDate || data.eventDateStart || "",
    slot_end_date: slot.endDate || slot.startDate || data.eventDateEnd || "",
    start_time: slot.startTime,
    end_time: slot.endTime,
    sort_order: idx,
  }));

  fetch(`${API_BASE}/api/applications`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_type: "in",
      data,
      time_slots: timeSlotsPayload,
      summary: {
        event_name: data.eventName,
        event_date: data.eventDate,
        organizer: data.organizerDept,
      },
    }),
  })
    .then((res) => res.json().then((body) => ({ ok: res.ok, body })))
    .then(async ({ ok, body }) => {
      if (!ok || body.ok === false) throw new Error(body.error || "submit_failed");
      const appId = body.data?.id;
      const files = Array.from(filesInputIn?.files || []);
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
    })
    .catch((err) => setMsg("error", err.message));
});

formIn?.addEventListener("change", () => renderPreview());

timeSlotsIn?.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (
    target.classList.contains("slot-date-start") ||
    target.classList.contains("slot-date-end") ||
    target.classList.contains("slot-start") ||
    target.classList.contains("slot-end")
  ) {
    updateHoursIn();
  }
});

timeSlotsIn?.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (!target.classList.contains("slot-remove")) return;
  const row = target.closest(".time-slot-row");
  if (!row) return;
  row.remove();
  if (!timeSlotsIn.querySelector(".time-slot-row")) {
    timeSlotsIn.appendChild(createTimeSlotRow());
  }
  refreshTimeSlotRemoveStateIn();
  updateHoursIn();
});

btnAddTimeSlotIn?.addEventListener("click", () => {
  if (!timeSlotsIn) return;
  timeSlotsIn.appendChild(createTimeSlotRow());
  refreshTimeSlotRemoveStateIn();
});

filesInputIn?.addEventListener("change", () => {
  if (!fileListIn) return;
  fileListIn.innerHTML = "";
  Array.from(filesInputIn.files || []).forEach((file, i) => {
    const li = document.createElement("li");
    li.textContent = `${i + 1}. ${file.name}`;
    fileListIn.appendChild(li);
  });
});

document.addEventListener("DOMContentLoaded", () => {
  initMultiSelect(domainWrap);
  initMultiSelect(sdgWrap);

  if (sampleExcelLinkIn) {
    sampleExcelLinkIn.href = "./ex.csv";
    sampleExcelLinkIn.addEventListener("click", handleSampleTemplateDownload);
  }

  ensureTimeSlotsIn();
  ensureHoursFieldIn();
  refreshTimeSlotRemoveStateIn();
  updateHoursIn();
  renderPreview();
});
