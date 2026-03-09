// teacher.js：教師成長時數前端送出
const API_BASE = window.API_BASE || "http://localhost:5000";
// DOM 元素
const formT      = document.getElementById('formTeacher');
const filesInput = document.getElementById('files');
const fileList   = document.getElementById('fileList');
const msgEl      = document.getElementById('msg');
const certNoBox  = document.getElementById('certNoBox');

// 是否核發證書 → 顯示 / 隱藏「證書字號」
formT?.addEventListener('change', e => {
  if (e.target.name === 'hasCert') {
    certNoBox.classList.toggle('is-hidden', e.target.value !== 'yes');
  }
});

// 附件清單顯示
filesInput?.addEventListener('change', () => {
  fileList.innerHTML = '';
  Array.from(filesInput.files || []).forEach((f, i) => {
    const li = document.createElement('li');
    li.textContent = `${i + 1}. ${f.name} (${Math.round(f.size / 1024)} KB)`;
    fileList.appendChild(li);
  });
});

// 收集表單資料 → 給預覽 & 匯出用
function collectTeacherForm() {
  const fd = new FormData(formT);
  return {
    teacherName: fd.get('teacherName')?.toString().trim(),
    department:  fd.get('department')?.toString().trim(),
    teacherId:   fd.get('teacherId')?.toString().trim(),
    ext:         fd.get('ext')?.toString().trim() || '',
    eventDate:   fd.get('eventDate'),
    startTime:   fd.get('startTime'),
    endTime:     fd.get('endTime'),
    courseTitle: fd.get('courseTitle')?.toString().trim(),
    organizer:   fd.get('organizer')?.toString().trim(),
    relevance:   fd.get('relevance')?.toString().trim(),
    hasCert:     fd.get('hasCert'),
    certNo:      (fd.get('hasCert') === 'yes'
                  ? (fd.get('certNo')?.toString().trim() || '')
                  : ''),
    attachments: Array.from(filesInput?.files || []).map((f) => f.name),
    attachmentCount: filesInput?.files?.length || 0
  };
}

// 簡易欄位檢查
function validateTeacher() {
  const d = collectTeacherForm();
  const errs = [];
  if (!d.teacherName) errs.push('請填寫「教師姓名」。');
  if (!d.department)  errs.push('請填寫「任教單位」。');
  if (!d.teacherId)   errs.push('請填寫「教師編號」。');
  if (!d.eventDate)   errs.push('請選擇「活動日期」。');
  if (!d.startTime || !d.endTime) errs.push('請填寫「活動起訖時間」。');
  if (d.startTime && d.endTime && d.startTime >= d.endTime)
    errs.push('起訖時間不合理。');
  if (!d.courseTitle) errs.push('請填寫「課程名稱」。');
  if (!d.organizer)   errs.push('請填寫「舉辦單位」。');
  if (!d.relevance)   errs.push('請填寫「關聯說明」。');
  if (!d.hasCert)     errs.push('請選擇是否核發證書。');
  if (d.hasCert === 'yes' && !d.certNo)
    errs.push('已選「是」，請填「證書字號」。');
  if (!d.attachmentCount)
    errs.push('請至少上傳 1 份佐證附件。');

  return errs;
}

// 「前端檢查」按鈕
formT?.addEventListener('submit', e => {
  e.preventDefault();
  msgEl.textContent = '';
  const errs = validateTeacher();
  if (errs.length) {
    msgEl.innerHTML =
      '<span style="color:#dc2626">' + errs.join('<br>') + '</span>';
    return;
  }
  msgEl.innerHTML = '<span style="color:#16a34a">送出中…</span>';
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
        event_date: data.eventDate,
        organizer: data.organizer,
      },
    }),
  })
    .then((res) => res.json().then((body) => ({ ok: res.ok, body })))
    .then(({ ok, body }) => {
      if (!ok || body.ok === false) {
        throw new Error(body.error || "submit_failed");
      }
      const appId = body.data?.id;
      const files = Array.from(filesInput?.files || []);
      if (!appId || files.length === 0) {
        msgEl.innerHTML =
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
          msgEl.innerHTML =
            '<span style="color:#16a34a">送出成功，將前往歷史記錄。</span>';
          setTimeout(() => {
            window.location.href = "history.html";
          }, 300);
        });
    })
    .catch((err) => {
      msgEl.innerHTML = `<span style="color:#dc2626">${err.message}</span>`;
    });
});

/* ========= 填入「Word 表格版」PDF 表單內容 ========= */
function fillPdfForm(d) {
  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value || '';
  };

  setText('pdf_teacherName', d.teacherName);
  setText('pdf_department',  d.department);
  setText('pdf_teacherId',   d.teacherId);
  setText('pdf_ext',         d.ext);

  setText('pdf_eventDate',   d.eventDate);
  setText('pdf_start',       d.startTime);
  setText('pdf_end',         d.endTime);

  setText('pdf_courseTitle', d.courseTitle);
  setText('pdf_organizer',   d.organizer);
  setText('pdf_relevance',   d.relevance);

  // 是否核發證書＋字號
  let hasCertText = '';
  if (d.hasCert === 'yes') hasCertText = '是';
  else if (d.hasCert === 'no') hasCertText = '否';
  setText('pdf_hasCert', hasCertText);

  setText('pdf_certNo', d.hasCert === 'yes' && d.certNo
    ? `證書字號：${d.certNo}`
    : ''
  );

  // 附件清單
  const filesEl = document.getElementById('pdf_files');
  if (filesEl) {
    const list = Array.from(filesInput.files || [])
      .map((f, i) => `${i + 1}. ${f.name}`)
      .join('\n');
    filesEl.textContent = list || '（無附件）';
  }
}

