const API_BASE = window.API_BASE || "";

const adminHint = document.getElementById("adminHint");
const createForm = document.getElementById("createForm");
const createMsg = document.getElementById("createMsg");
const userTableBody = document.querySelector("#userTable tbody");
const listMsg = document.getElementById("listMsg");
const deptTableBody = document.querySelector("#deptTable tbody");
const deptMsg = document.getElementById("deptMsg");

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
        <select data-id="${u.id}" class="modern-select" style="min-width: 140px; padding: 6px 10px; background: transparent;">
          <option value="teacher">teacher</option>
          <option value="staff">staff</option>
          <option value="root">root</option>
        </select>
      </td>
      <td>${u.created_at || ""}</td>
      <td class="row-actions">
        <button class="btn ghost" data-action="save" data-id="${u.id}" type="button">更新</button>
        <button class="btn danger-ghost" data-action="delete" data-id="${u.id}" type="button">刪除</button>
      </td>
    `;
    const select = tr.querySelector("select");
    if (select) select.value = u.role;
    userTableBody.appendChild(tr);
  });
}

async function loadDepartments() {
  if (!deptTableBody) return;
  deptMsg.textContent = "";
  const data = await api("/api/admin/departments");
  const departments = data.data || [];
  deptTableBody.innerHTML = "";

  departments.forEach((d) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${d.id}</td>
      <td>${d.unit_no ?? ""}</td>
      <td><input type="text" data-field="unit_name" value="${d.unit_name || ""}" style="background: transparent;"></td>
      <td><input type="text" data-field="account" value="${d.account || ""}" style="background: transparent;"></td>
      <td><input type="password" data-field="password" placeholder="不修改請留空" style="background: transparent;"></td>
      <td>${d.created_at || ""}</td>
      <td class="row-actions">
        <button class="btn ghost" data-action="save-dept" data-id="${d.id}" type="button">更新</button>
      </td>
    `;
    deptTableBody.appendChild(tr);
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

deptTableBody?.addEventListener("click", async (e) => {
  const target = e.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.dataset.action !== "save-dept") return;

  const deptId = target.dataset.id;
  const row = target.closest("tr");
  if (!deptId || !row) return;

  const unitName = row.querySelector('input[data-field="unit_name"]')?.value?.trim() || "";
  const account = row.querySelector('input[data-field="account"]')?.value?.trim() || "";
  const password = row.querySelector('input[data-field="password"]')?.value || "";

  try {
    await api(`/api/admin/departments/${deptId}`, {
      method: "PATCH",
      body: JSON.stringify({
        unit_name: unitName,
        account,
        password,
      }),
    });
    await loadDepartments();
  } catch (err) {
    deptMsg.textContent = err.message;
  }
});

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const user = await ensureRoot();
    if (!user) return;
    await loadUsers();
    await loadDepartments();
  } catch (err) {
    window.location.href = "admin";
  }
});



// Tabs Logic
const tabs = document.querySelectorAll('.tab');
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('is-active'));
    tab.classList.add('is-active');
    
    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
    const targetId = tab.dataset.target;
    document.getElementById(targetId + 'View').style.display = 'block';
  });
});
