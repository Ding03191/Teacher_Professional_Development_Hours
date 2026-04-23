const API_BASE = window.API_BASE || "";

const loginPanel = document.getElementById("loginPanel");
const loginForm = document.getElementById("loginForm");
const loginMsg = document.getElementById("loginMsg");
const googleSigninContainer = document.getElementById("googleSigninContainer");
const topbarUser = document.querySelector(".topbar-user");
const topbarAccount = document.getElementById("topbarAccount");
const topbarLoginLink = document.getElementById("topbarLoginLink");
const logoutBtnTop = document.getElementById("btnLogoutTop");
let googleClientId = "";
let googleHostedDomain = "";

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

async function loadGoogleConfig() {
  try {
    const data = await api("/api/auth/google/config");
    googleClientId = data.data?.clientId || "";
    googleHostedDomain = data.data?.hostedDomain || "";
    return Boolean(data.data?.enabled && googleClientId);
  } catch {
    return false;
  }
}

async function onGoogleCredentialResponse(response) {
  if (!response?.credential) {
    loginMsg.textContent = "Google 登入失敗，請再試一次";
    return;
  }
  loginMsg.textContent = "";
  try {
    const data = await api("/api/auth/google", {
      method: "POST",
      body: JSON.stringify({ credential: response.credential }),
    });
    gotoRoleHome(data.data?.user);
  } catch (err) {
    loginMsg.textContent = err.message;
  }
}

async function waitForGoogleGsi(timeoutMs = 5000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (window.google?.accounts?.id) return true;
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  return false;
}

async function initGoogleLogin() {
  if (!googleSigninContainer) return;
  const enabled = await loadGoogleConfig();
  const gsiReady = await waitForGoogleGsi();
  if (!enabled || !gsiReady) {
    googleSigninContainer.textContent = "Google 登入尚未設定";
    return;
  }

  window.google.accounts.id.initialize({
    client_id: googleClientId,
    callback: onGoogleCredentialResponse,
    auto_select: false,
    cancel_on_tap_outside: true,
    hd: googleHostedDomain || undefined,
  });

  googleSigninContainer.innerHTML = "";
  const width = Math.min(384, Math.max(260, Math.floor(googleSigninContainer.clientWidth || 360)));
  window.google.accounts.id.renderButton(googleSigninContainer, {
    type: "standard",
    theme: "outline",
    size: "large",
    text: "continue_with",
    shape: "pill",
    width,
    logo_alignment: "left",
    locale: "zh-TW",
  });
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
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect();
    }
    await api("/api/auth/logout", { method: "POST" });
  } finally {
    window.location.href = "admin";
  }
});

document.addEventListener("DOMContentLoaded", checkMe);
document.addEventListener("DOMContentLoaded", initGoogleLogin);

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

