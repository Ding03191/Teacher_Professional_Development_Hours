const API_BASE = window.API_BASE || "";

const reviewList = document.getElementById("reviewList");
const reviewMsg = document.getElementById("reviewMsg");
const btnRefresh = document.getElementById("btnReviewRefresh");
const tabs = Array.from(document.querySelectorAll(".tab"));

function fmtType(type) {
  return type === "in" ? "校內" : "校外";
}

function normalizeStatus(status) {
  const v = (status || "pending").toString().toLowerCase();
  if (v === "approved") return "approved";
  if (v === "rejected") return "rejected";
  return "pending";
}

function fmtStatus(status) {
  const s = normalizeStatus(status);
  if (s === "approved") return "通過";
  if (s === "rejected") return "退件";
  return "待審核";
}

function getActiveStatus() {
  return (
    tabs.find((tab) => tab.classList.contains("is-active"))?.dataset.status ||
    "all"
  );
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

function renderItem(record) {
  const status = normalizeStatus(record.status);
  const hours = record.data?.hours ?? "";
  const approvedHours =
    record.approved_hours !== null && record.approved_hours !== undefined
      ? record.approved_hours
      : hours;
  const attachments = renderAttachmentsLinks(record);
  return `
    <details class="review-item">
      <summary class="review-summary">
        <span class="review-badge ${record.app_type}">${fmtType(record.app_type)}</span>
        <span class="status-badge ${status}">${fmtStatus(status)}</span>
        <strong>${record.event_name || "-"}</strong>
        <span class="muted">${record.event_date || "-"}</span>
        <span class="muted">${record.unit_name || "-"}</span>
      </summary>
      <div class="review-detail">
        <div class="review-grid">
          <div class="field">
            <span class="lbl">申請單位</span>
            <div>${record.unit_name || "-"}</div>
          </div>
          <div class="field">
            <span class="lbl">帳號</span>
            <div>${record.account || "-"}</div>
          </div>
          <div class="field">
            <span class="lbl">申請時數</span>
            <div>${hours}</div>
          </div>
          <div class="field">
            <span class="lbl">建立時間</span>
            <div>${record.created_at || "-"}</div>
          </div>
          <div class="field">
            <span class="lbl">附件</span>
            ${attachments || "-"}
          </div>
        </div>

        <form class="review-form" data-id="${record.id}">
          <div class="review-actions">
            <label class="field inline">
              <span class="lbl">審核狀態</span>
              <select name="status">
                <option value="pending" ${status === "pending" ? "selected" : ""}>待審核</option>
                <option value="approved" ${status === "approved" ? "selected" : ""}>通過</option>
                <option value="rejected" ${status === "rejected" ? "selected" : ""}>退件</option>
              </select>
            </label>
            <label class="field inline">
              <span class="lbl">核定時數</span>
              <input name="approved_hours" type="number" step="0.5" value="${approvedHours}">
            </label>
            <label class="field">
              <span class="lbl">備註</span>
              <textarea name="review_comment">${record.review_comment || ""}</textarea>
            </label>
            <div class="actions">
              <button class="btn primary" type="submit">儲存</button>
            </div>
          </div>
        </form>
      </div>
    </details>
  `;
}

function renderList(records) {
  if (!reviewList) return;
  const statusFilter = getActiveStatus();
  const filtered =
    statusFilter === "all"
      ? records
      : records.filter((r) => normalizeStatus(r.status) === statusFilter);
  reviewList.innerHTML = "";
  if (!filtered.length) {
    reviewList.innerHTML = `<div class="muted">目前沒有資料。</div>`;
    return;
  }
  filtered.forEach((record) => {
    const item = document.createElement("div");
    item.innerHTML = renderItem(record);
    reviewList.appendChild(item.firstElementChild);
  });
}

async function loadReviews() {
  if (reviewMsg) reviewMsg.textContent = "";
  const records = await api(`/api/applications?type=all`);
  renderList(records || []);
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    loadReviews().catch((err) => {
      if (reviewMsg) reviewMsg.textContent = err.message;
    });
  });
});

btnRefresh?.addEventListener("click", () => {
  loadReviews().catch((err) => {
    if (reviewMsg) reviewMsg.textContent = err.message;
  });
});

reviewList?.addEventListener("submit", async (e) => {
  const form = e.target;
  if (!(form instanceof HTMLFormElement)) return;
  if (!form.classList.contains("review-form")) return;
  e.preventDefault();
  if (reviewMsg) reviewMsg.textContent = "";
  const id = form.dataset.id;
  if (!id) return;
  const fd = new FormData(form);
  const payload = {
    status: fd.get("status"),
    approved_hours: fd.get("approved_hours"),
    review_comment: fd.get("review_comment"),
  };
  try {
    await api(`/api/applications/${id}/review`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    await loadReviews();
  } catch (err) {
    if (reviewMsg) reviewMsg.textContent = err.message;
  }
});

window.__authUserPromise
  ?.then((user) => {
    if (user?.role !== "root") {
      window.location.href = "history";
      return;
    }
    loadReviews().catch((err) => {
      if (reviewMsg) reviewMsg.textContent = err.message;
    });
  })
  .catch(() => {});

