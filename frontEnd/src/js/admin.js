const API_BASE = window.API_BASE || "";

const loginPanel = document.getElementById("loginPanel");
const loginForm = document.getElementById("loginForm");
const loginMsg = document.getElementById("loginMsg");
const topbarUser = document.querySelector(".topbar-user");
const topbarAccount = document.getElementById("topbarAccount");
const topbarLoginLink = document.getElementById("topbarLoginLink");
const logoutBtnTop = document.getElementById("btnLogoutTop");

function setAvatar(user) {
  if (!topbarUser || !user) return;
  topbarUser.classList.remove("role-root", "role-dept");
  if (user.role === "root") {
    topbarUser.textContent = "管";
    topbarUser.title = "教學資源組";
    topbarUser.classList.add("role-root");
    if (topbarAccount) topbarAccount.textContent = user.account || user.name || "root";
    return;
  }
  const name = user.unit_name || user.name || user.account || user.email || "U";
  topbarUser.textContent = name.slice(0, 2);
  topbarUser.title = name;
  topbarUser.classList.add("role-dept");
  if (topbarAccount) topbarAccount.textContent = name;
}

function gotoRoleHome(user) {
  if (user?.role === "root") {
    window.location.href = "user_management";
    return;
  }
  window.location.href = "teacher_in";
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
    setAvatar(user);
    gotoRoleHome(user);
  } catch (err) {
    document.body.classList.remove("is-root");
    document.body.classList.add("is-login");
    loginPanel?.classList.remove("is-hidden");
    topbarLoginLink?.classList.remove("is-hidden");
    logoutBtnTop?.classList.add("is-hidden");
  }
}

loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginMsg.textContent = "";
  const fd = new FormData(loginForm);
  const payload = {
    account: fd.get("account"),
    password: fd.get("password"),
  };
  try {
    const data = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    gotoRoleHome(data.data?.user);
  } catch (err) {
    loginMsg.textContent = err.message;
  }
});

logoutBtnTop?.addEventListener("click", async () => {
  try {
    await api("/api/auth/logout", { method: "POST" });
  } finally {
    window.location.href = "admin";
  }
});

document.addEventListener("DOMContentLoaded", checkMe);

function initPasswordToggle() {
  const btn = document.querySelector('[data-toggle="password"]');
  const input = document.getElementById("loginPassword");
  if (!btn || !input) return;
  btn.addEventListener("click", () => {
    const isText = input.type === "text";
    input.type = isText ? "password" : "text";
    btn.classList.toggle("is-on", !isText);
    btn.setAttribute("aria-label", isText ? "顯示密碼" : "隱藏密碼");
  });
}

document.addEventListener("DOMContentLoaded", initPasswordToggle);

