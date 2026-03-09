// teacher_in.js: 校內活動教師成長時數前端檢核與預覽
const API_BASE = "http://localhost:5000";
const formIn = document.getElementById("formInCampus");
const previewIn = document.getElementById("previewIn");
const msgIn = document.getElementById("msgIn");
const btnCheckIn = document.getElementById("btnCheckIn");
const domainWrap = document.querySelector('[data-multi="domain"]');
const sdgWrap = document.querySelector('[data-multi="sdg"]');
const certNoField = document.getElementById("certNoField");
const filesInputIn = document.getElementById("filesIn");
const fileListIn = document.getElementById("fileListIn");

function syncCertNoField(value) {
  if (!certNoField) return;
  const shouldShow = value === "yes";
  certNoField.hidden = !shouldShow;
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
  valueEl.textContent = labels.length <= 3 ? labels.join("、") : `已選 ${labels.length} 項`;
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

  return {
    organizerDept: fd.get("organizerDept")?.toString().trim(),
    eventName: fd.get("eventName")?.toString().trim(),
    hostName: fd.get("hostName")?.toString().trim(),
    ext: fd.get("ext")?.toString().trim(),
    location: fd.get("location")?.toString().trim(),
    eventDate: fd.get("eventDate")?.toString().trim(),
    startTime: fd.get("startTime")?.toString().trim(),
    endTime: fd.get("endTime")?.toString().trim(),
    hasCert: fd.get("hasCert"),
    certNo: fd.get("certNo")?.toString().trim(),
    domain: getCheckedValues(domainWrap),
    domainOther: fd.get("domainOther")?.toString().trim(),
    sdg: getCheckedValues(sdgWrap),
    attachments: Array.from(filesInputIn?.files || []).map((f) => f.name),
    purpose: fd.get("purpose")?.toString().trim(),
    content: fd.get("content")?.toString().trim(),
    teachingRelation: fd.get("teachingRelation")?.toString().trim(),
    researchRelation: fd.get("researchRelation")?.toString().trim(),
    applicant: fd.get("applicant")?.toString().trim(),
    deptHead: fd.get("deptHead")?.toString().trim(),
    staff: fd.get("staff")?.toString().trim(),
    lead: fd.get("lead")?.toString().trim(),
    note: fd.get("note")?.toString().trim(),
  };
}

function validateInCampusForm(data) {
  const errs = [];
  if (!data.organizerDept) errs.push("請填寫「主辦單位」");
  if (!data.eventName) errs.push("請填寫「活動名稱」");
  if (!data.hostName) errs.push("請填寫「承辦人」");
  if (!data.ext) errs.push("請填寫「聯絡電話」");
  if (!data.location) errs.push("請填寫「活動地點」");
  if (!data.eventDate) errs.push("請選擇「活動日期」");
  if (!data.startTime || !data.endTime) errs.push("請填寫活動時間");
  if (data.startTime && data.endTime && data.startTime >= data.endTime) {
    errs.push("活動開始時間需早於結束時間");
  }
  if (!data.hasCert) errs.push("請選擇是否核發證書");
  if (!data.domain || data.domain.length === 0) errs.push("請選擇至少一項「鏈結領域」");
  if (!data.sdg || data.sdg.length === 0) errs.push("請選擇至少一項「SDGs」");
  if (!data.purpose) errs.push("請填寫「活動目的」");
  if (!data.content) errs.push("請填寫「活動內容」");
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
  msgIn.innerHTML = '<span style="color:#16a34a">送出中…</span>';
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
      if (!ok || body.ok === false) {
        throw new Error(body.error || "submit_failed");
      }
      const appId = body.data?.id;
      const files = Array.from(filesInputIn?.files || []);
      if (!appId || files.length === 0) {
        msgIn.innerHTML =
          '<span style="color:#16a34a">送出成功，將前往歷史記錄。</span>';
        setTimeout(() => {
          window.location.href = "history.html";
        }, 300);
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
            throw new Error(body.error || "upload_failed");
          }
          msgIn.innerHTML =
            '<span style="color:#16a34a">送出成功，將前往歷史記錄。</span>';
          setTimeout(() => {
            window.location.href = "history.html";
          }, 300);
        });
    })
    .catch((err) => {
      msgIn.innerHTML = `<span style="color:#dc2626">${err.message}</span>`;
    });
});

formIn?.addEventListener("change", renderPreview);
document.addEventListener("DOMContentLoaded", () => {
  initMultiSelect(domainWrap);
  initMultiSelect(sdgWrap);
  syncCertNoField(formIn?.querySelector('input[name="hasCert"]:checked')?.value);
  renderPreview();

  formIn
    ?.querySelectorAll('input[name="hasCert"]')
    .forEach((radio) => radio.addEventListener("change", () => syncCertNoField(radio.value)));
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

formIn?.addEventListener("change", (event) => {
  if (event.target?.name === "hasCert") {
    syncCertNoField(event.target.value);
  }
});
