const API_BASE = "http://localhost:5000";

const loginPanel = document.getElementById("loginPanel");
const adminPanel = document.getElementById("adminPanel");
const loginForm = document.getElementById("loginForm");
const loginMsg = document.getElementById("loginMsg");
const adminHint = document.getElementById("adminHint");
const btnLogout = document.getElementById("btnLogout");
const appbarActions = document.querySelector(".appbar-actions");
const unitSelect = document.getElementById("unitSelect");
const topbarUser = document.querySelector(".topbar-user");
const logoutBtnTop = document.getElementById("btnLogoutTop");

function setAvatar(user) {
  if (!topbarUser || !user) return;
  topbarUser.classList.remove("role-root", "role-dept");
  if (user.role === "root") {
    topbarUser.textContent = "管";
    topbarUser.title = "教學資源組";
    topbarUser.classList.add("role-root");
    return;
  }
  const name = user.unit_name || user.name || user.account || user.email || "U";
  topbarUser.textContent = name.slice(0, 2);
  topbarUser.title = name;
  topbarUser.classList.add("role-dept");
}

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
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || "request_failed");
  }
  return data;
}

async function checkMe() {
  try {
    const data = await api("/api/auth/me");
    const user = data.data?.user;
    if (!user) throw new Error("not_logged_in");
    hide(loginPanel);
    show(appbarActions);
    show(btnLogout);
    logoutBtnTop?.classList.remove("is-hidden");
    setAvatar(user);
    if (user.role === "root") {
      show(adminPanel);
      adminHint.textContent = `已登入，角色：${user.role}`;
      await loadUsers();
    } else {
      hide(adminPanel);
      adminHint.textContent = "";
    }
  } catch (err) {
    hide(adminPanel);
    show(loginPanel);
    hide(appbarActions);
    hide(btnLogout);
    logoutBtnTop?.classList.add("is-hidden");
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
    unitName: fd.get("unitName"),
    account: fd.get("account"),
    password: fd.get("password"),
  };
  try {
    const data = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const role = data.data?.user?.role;
    if (role && role !== "root") {
      window.location.href = "teacher.html";
      return;
    }
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

logoutBtnTop?.addEventListener("click", async () => {
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
    if (!confirm("確定要刪除這位使用者嗎？")) return;
    try {
      await api(`/api/admin/users/${userId}`, { method: "DELETE" });
      await loadUsers();
    } catch (err) {
      listMsg.textContent = err.message;
    }
  }
});

document.addEventListener("DOMContentLoaded", checkMe);

async function loadDepartments() {
  if (!unitSelect) return;
  try {
    const data = await api("/api/departments/list");
    const items = data.data || [];
    unitSelect.innerHTML = '<option value="">請選擇單位</option>';
    items.forEach((item) => {
      const opt = document.createElement("option");
      opt.value = item.unit_name;
      opt.textContent = item.unit_name;
      unitSelect.appendChild(opt);
    });
  } catch (err) {
    // silent fail, keep placeholder
  }
}

document.addEventListener("DOMContentLoaded", loadDepartments);
