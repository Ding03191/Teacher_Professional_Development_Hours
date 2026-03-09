window.API_BASE = window.API_BASE || "http://localhost:5000";

const topbarUser = document.querySelector(".topbar-user");
const logoutBtn = document.getElementById("btnLogoutTop");

function setAvatar(user) {
  if (!topbarUser || !user) return;
  let label = "U";
  topbarUser.classList.remove("role-root", "role-dept");

  if (user.role === "root") {
    label = "管";
    topbarUser.classList.add("role-root");
    topbarUser.title = "教學資源組";
  } else {
    const name = user.unit_name || user.name || user.account || user.email || "U";
    label = name.slice(0, 2);
    topbarUser.classList.add("role-dept");
    topbarUser.title = name;
  }

  topbarUser.textContent = label;
}

async function fetchMe() {
  const res = await fetch(`${window.API_BASE}/api/auth/me`, {
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    throw new Error("not_logged_in");
  }
  return data.data?.user;
}

async function guard() {
  try {
    const user = await fetchMe();
    window.__authUser = user;
    setAvatar(user);
    if (logoutBtn) {
      logoutBtn.classList.remove("is-hidden");
      logoutBtn.addEventListener("click", async () => {
        await fetch(`${window.API_BASE}/api/auth/logout`, {
          method: "POST",
          credentials: "include",
        });
        window.location.href = "admin.html";
      });
    }
    return user;
  } catch (err) {
    if (logoutBtn) logoutBtn.classList.add("is-hidden");
    window.location.href = "admin.html";
    throw err;
  }
}

window.__authUserPromise = guard();
