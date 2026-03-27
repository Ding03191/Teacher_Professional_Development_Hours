const API_BASE = window.API_BASE || "";

const formIn = document.getElementById("formInCampus");
const previewIn = document.getElementById("previewIn");
const msgIn = document.getElementById("msgIn");
const btnCheckIn = document.getElementById("btnCheckIn");
const domainWrap = document.querySelector('[data-multi="domain"]');
const sdgWrap = document.querySelector('[data-multi="sdg"]');
const filesInputIn = document.getElementById("filesIn");
const fileListIn = document.getElementById("fileListIn");
const startTimeIn = document.querySelector('input[name="startTime"]');
const endTimeIn = document.querySelector('input[name="endTime"]');
let hoursInputIn = null;

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

function ensureHoursFieldIn() {
  if (!formIn || hoursInputIn) return;
  const timeField = startTimeIn?.closest(".field") || endTimeIn?.closest(".field");
  if (!timeField || !timeField.parentElement) return;
  const wrapper = document.createElement("label");
  wrapper.className = "field span-2";
  wrapper.innerHTML = `
    <span class="lbl">活動時數（自動計算）</span>
    <input name="hours" id="hoursIn" type="text" readonly placeholder="1~4 小時">
  `;
  timeField.parentElement.insertBefore(wrapper, timeField.nextSibling);
  hoursInputIn = wrapper.querySelector("input");
}

function updateHoursIn() {
  if (!hoursInputIn) return;
  const hours = calcRoundedHours(startTimeIn?.value, endTimeIn?.value);
  hoursInputIn.value = hours;
}

function setMsg(type, text) {
  if (!msgIn) return;
  const color = type === "error" ? "#dc2626" : "#16a34a";
  msgIn.innerHTML = `<span style="color:${color}">${text}</span>`;
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
  valueEl.textContent = labels.length <= 3
    ? labels.join("\u3001")
    : `\u5df2\u9078\u64c7 ${labels.length} \u9805`;
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

  panel?.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  document.addEventListener("click", (event) => {
    if (!container.contains(event.target)) close();
  });

  checkboxes.forEach((checkbox) => {
    checkbox.addEventListener("change", () => updateMultiSelectDisplay(container));
  });

  updateMultiSelectDisplay(container);
}

function collectInCampusForm() {
  if (!formIn) return {};
  const fd = new FormData(formIn);
  const hours = calcRoundedHours(fd.get("startTime"), fd.get("endTime"));

  return {
    organizerDept: fd.get("organizerDept")?.toString().trim(),
    eventName: fd.get("eventName")?.toString().trim(),
    hostName: fd.get("hostName")?.toString().trim(),
    ext: fd.get("ext")?.toString().trim(),
    location: fd.get("location")?.toString().trim(),
    eventDate: fd.get("eventDate")?.toString().trim(),
    startTime: fd.get("startTime")?.toString().trim(),
    endTime: fd.get("endTime")?.toString().trim(),
    hours,
    domain: getCheckedValues(domainWrap),
    domainOther: fd.get("domainOther")?.toString().trim(),
    sdg: getCheckedValues(sdgWrap),
    activityPurpose: fd.get("activityPurpose")?.toString().trim(),
    activityDetail: fd.get("activityDetail")?.toString().trim(),
    teachingRelation: fd.get("teachingRelation")?.toString().trim(),
    researchRelation: fd.get("researchRelation")?.toString().trim(),
    applicant: fd.get("applicant")?.toString().trim(),
    deptHead: fd.get("deptHead")?.toString().trim(),
    staff: fd.get("staff")?.toString().trim(),
    lead: fd.get("lead")?.toString().trim(),
    note: fd.get("note")?.toString().trim(),
    attachments: Array.from(filesInputIn?.files || []).map((f) => f.name),
    attachmentCount: filesInputIn?.files?.length || 0,
  };
}

function validateInCampusForm(data) {
  const errs = [];
  if (!data.organizerDept) errs.push("\u8acb\u8f38\u5165\u4e3b\u8fa6\u55ae\u4f4d\u3002");
  if (!data.eventName) errs.push("\u8acb\u8f38\u5165\u6d3b\u52d5\u540d\u7a31\u3002");
  if (!data.hostName) errs.push("\u8acb\u8f38\u5165\u4e3b(\u627f)\u8fa6\u4eba\u54e1\u3002");
  if (!data.ext) errs.push("\u8acb\u8f38\u5165\u806f\u7d61\u5206\u6a5f\u3002");
  if (!data.location) errs.push("\u8acb\u8f38\u5165\u6d3b\u52d5\u5730\u9ede\u3002");
  if (!data.eventDate) errs.push("\u8acb\u9078\u64c7\u6d3b\u52d5\u65e5\u671f\u3002");
  if (!data.startTime || !data.endTime) errs.push("\u8acb\u9078\u64c7\u6d3b\u52d5\u6642\u9593\u3002");
  if (data.startTime && data.endTime && data.startTime >= data.endTime) {
    errs.push("\u7d50\u675f\u6642\u9593\u9700\u665a\u65bc\u958b\u59cb\u6642\u9593\u3002");
  }
  if (!data.domain || data.domain.length === 0) errs.push("\u8acb\u9078\u64c7\u81f3\u5c11\u4e00\u9805\u93c8\u7d50\u9818\u57df\u3002");
  if (!data.sdg || data.sdg.length === 0) errs.push("\u8acb\u9078\u64c7\u81f3\u5c11\u4e00\u9805 SDGs \u6307\u6a19\u3002");
  if (!data.activityPurpose) errs.push("\u8acb\u586b\u5beb\u6d3b\u52d5\u4e3b\u65e8\u3002");
  if (!data.activityDetail) errs.push("\u8acb\u586b\u5beb\u8a73\u7d30\u6d3b\u52d5\u5167\u5bb9\u3002");
  if (!data.attachmentCount) errs.push("\u8acb\u81f3\u5c11\u4e0a\u50b3 1 \u4efd\u9644\u4ef6\u3002");
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
  if (!confirm("\u78ba\u8a8d\u8981\u9001\u51fa\u7533\u8acb\u55ce\uff1f")) return;

  setMsg("success", "\u9001\u51fa\u4e2d\uff0c\u8acb\u7a0d\u5019\u2026");

  fetch(`${API_BASE}/api/applications`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_type: "in",
      data,
      summary: {
        event_name: data.eventName,
        event_date: data.eventDate,
        organizer: data.organizerDept,
      },
    }),
  })
    .then((res) => res.json().then((body) => ({ ok: res.ok, body })))
    .then(({ ok, body }) => {
      if (!ok || body.ok === false) throw new Error(body.error || "submit_failed");
      const appId = body.data?.id;
      const files = Array.from(filesInputIn?.files || []);
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

formIn?.addEventListener("change", renderPreview);

document.addEventListener("DOMContentLoaded", () => {
  initMultiSelect(domainWrap);
  initMultiSelect(sdgWrap);
  renderPreview();
});

filesInputIn?.addEventListener("change", () => {
  if (!fileListIn) return;
  fileListIn.innerHTML = "";
  Array.from(filesInputIn.files || []).forEach((f, i) => {
    const li = document.createElement("li");
    li.textContent = `${i + 1}. ${f.name}`;
    fileListIn.appendChild(li);
  });
});

document.addEventListener("DOMContentLoaded", () => {
  ensureHoursFieldIn();
  updateHoursIn();
  startTimeIn?.addEventListener("change", updateHoursIn);
  endTimeIn?.addEventListener("change", updateHoursIn);
});
