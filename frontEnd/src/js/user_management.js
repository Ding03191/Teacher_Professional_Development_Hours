const API_BASE = window.API_BASE || "";

const adminHint = document.getElementById("adminHint");
const createForm = document.getElementById("createForm");
const createMsg = document.getElementById("createMsg");
const userTableBody = document.querySelector("#userTable tbody");
const listMsg = document.getElementById("listMsg");

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
  return data;
}

async function ensureRoot() {
  const data = await api("/api/auth/me");
  const user = data.data?.user;
  if (!user) {
    window.location.href = "admin";
    return null;
  }
  if (user.role !== "root") {
    window.location.href = "teacher_in";
    return null;
  }
  adminHint.textContent = `已登入，角色：${user.role}`;
  return user;
}

async function loadUsers() {
  listMsg.textContent = "";
  const data = await api("/api/admin/users");
  const users = data.data || [];
  userTableBody.innerHTML = "";

  users.forEach((u) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${u.id}</td>
      <td>${u.name || ""}</td>
      <td>${u.email || ""}</td>
      <td>
        <select data-id="${u.id}">
          <option value="teacher">teacher</option>
          <option value="staff">staff</option>
          <option value="root">root</option>
        </select>
      </td>
      <td>${u.created_at || ""}</td>
      <td class="row-actions">
        <button class="btn ghost" data-action="save" data-id="${u.id}" type="button">更新</button>
        <button class="btn ghost" data-action="delete" data-id="${u.id}" type="button">刪除</button>
      </td>
    `;
    const select = tr.querySelector("select");
    if (select) select.value = u.role;
    userTableBody.appendChild(tr);
  });
}

createForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  createMsg.textContent = "";
  const fd = new FormData(createForm);
  const payload = {
    name: fd.get("name"),
    email: fd.get("email"),
    password: fd.get("password"),
    role: fd.get("role"),
  };
  try {
    await api("/api/admin/users", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    createForm.reset();
    await loadUsers();
  } catch (err) {
    createMsg.textContent = err.message;
  }
});

userTableBody?.addEventListener("click", async (e) => {
  const target = e.target;
  if (!(target instanceof HTMLElement)) return;
  const action = target.dataset.action;
  const userId = target.dataset.id;
  if (!action || !userId) return;

  const row = target.closest("tr");
  const roleSelect = row?.querySelector("select");

  if (action === "save") {
    try {
      await api(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role: roleSelect?.value }),
      });
      await loadUsers();
    } catch (err) {
      listMsg.textContent = err.message;
    }
    return;
  }

  if (action === "delete") {
    if (!confirm("確定要刪除這位使用者嗎？")) return;
    try {
      await api(`/api/admin/users/${userId}`, { method: "DELETE" });
      await loadUsers();
    } catch (err) {
      listMsg.textContent = err.message;
    }
  }
});

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const user = await ensureRoot();
    if (!user) return;
    await loadUsers();
  } catch (err) {
    window.location.href = "admin";
  }
});

