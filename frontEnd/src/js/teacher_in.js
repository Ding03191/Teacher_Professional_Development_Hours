// teacher_in.js: 校內活動教師成長時數前端檢核與預覽
const formIn = document.getElementById("formInCampus");
const previewIn = document.getElementById("previewIn");
const msgIn = document.getElementById("msgIn");
const btnCheckIn = document.getElementById("btnCheckIn");

function getMultiValues(selectEl) {
  if (!selectEl) return [];
  return Array.from(selectEl.selectedOptions || []).map((opt) => opt.value);
}

function collectInCampusForm() {
  if (!formIn) return {};
  const fd = new FormData(formIn);
  const domainSelect = document.getElementById("domainSelect");
  const sdgSelect = document.getElementById("sdgSelect");

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
    domain: getMultiValues(domainSelect),
    domainOther: fd.get("domainOther")?.toString().trim(),
    sdg: getMultiValues(sdgSelect),
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
  if (!data.domain || data.domain.length === 0) errs.push("請選擇至少一項「類型領域」");
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
  msgIn.innerHTML =
    '<span style="color:#16a34a">資料已通過檢核，可列印或匯出。</span>';
  renderPreview();
});

formIn?.addEventListener("change", renderPreview);
document.addEventListener("DOMContentLoaded", renderPreview);
