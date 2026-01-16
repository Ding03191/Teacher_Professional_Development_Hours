const API_BASE = "http://localhost:5000";

const loginPanel = document.getElementById("loginPanel");
const adminPanel = document.getElementById("adminPanel");
const loginForm = document.getElementById("loginForm");
const loginMsg = document.getElementById("loginMsg");
const adminHint = document.getElementById("adminHint");
const btnLogout = document.getElementById("btnLogout");

const createForm = document.getElementById("createForm");
const createMsg = document.getElementById("createMsg");
const userTableBody = document.querySelector("#userTable tbody");
const listMsg = document.getElementById("listMsg");

function show(el) {
  el?.classList.remove("is-hidden");
}

function hide(el) {
  el?.classList.add("is-hidden");
}

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "request_failed");
  }
  if (data.ok === false) {
    throw new Error(data.error || "request_failed");
  }
  return data;
}

async function checkMe() {
  try {
    const data = await api("/api/auth/me");
    const user = data.data?.user;
    if (!user) throw new Error("not_logged_in");
    if (user.role !== "root") {
      hide(adminPanel);
      show(loginPanel);
      loginMsg.textContent = "需要 root 權限才能使用管理功能。";
      return;
    }
    hide(loginPanel);
    show(adminPanel);
    show(btnLogout);
    adminHint.textContent = `登入身份：${user.role}`;
    await loadUsers();
  } catch (err) {
    hide(adminPanel);
    show(loginPanel);
    hide(btnLogout);
  }
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
      <td>${u.name}</td>
      <td>${u.email}</td>
      <td>
        <select data-id="${u.id}">
          <option value="teacher">teacher</option>
          <option value="staff">staff</option>
          <option value="root">root</option>
        </select>
      </td>
      <td>${u.created_at || ""}</td>
      <td class="row-actions">
        <button class="btn ghost" data-action="save" data-id="${u.id}">更新</button>
        <button class="btn ghost" data-action="delete" data-id="${u.id}">刪除</button>
      </td>
    `;
    const select = tr.querySelector("select");
    select.value = u.role;
    userTableBody.appendChild(tr);
  });
}

loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginMsg.textContent = "";
  const fd = new FormData(loginForm);
  const payload = {
    email: fd.get("email"),
    password: fd.get("password"),
  };
  try {
    await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    await checkMe();
  } catch (err) {
    loginMsg.textContent = err.message;
  }
});

btnLogout?.addEventListener("click", async () => {
  try {
    await api("/api/auth/logout", { method: "POST" });
  } finally {
    await checkMe();
  }
});

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
    const role = roleSelect?.value;
    try {
      await api(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      await loadUsers();
    } catch (err) {
      listMsg.textContent = err.message;
    }
  }
  if (action === "delete") {
    if (!confirm("確定要刪除此使用者？")) return;
    try {
      await api(`/api/admin/users/${userId}`, { method: "DELETE" });
      await loadUsers();
    } catch (err) {
      listMsg.textContent = err.message;
    }
  }
});

document.addEventListener("DOMContentLoaded", checkMe);
