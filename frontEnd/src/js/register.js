const API_BASE = "http://localhost:5000";

const registerForm = document.getElementById("registerForm");
const registerMsg = document.getElementById("registerMsg");

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

registerForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!registerMsg) return;
  registerMsg.textContent = "";
  registerMsg.classList.remove("ok");
  const fd = new FormData(registerForm);
  const payload = {
    unitName: fd.get("unitName"),
    account: fd.get("account"),
    password: fd.get("password"),
  };
  try {
    const data = await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    registerMsg.textContent = data.data?.message || "註冊完成，請登入。";
    registerMsg.classList.add("ok");
    setTimeout(() => {
      window.location.href = "admin.html";
    }, 1200);
  } catch (err) {
    registerMsg.textContent = err.message;
  }
});
