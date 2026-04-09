window.API_BASE = window.API_BASE || "";

const topbarUser = document.querySelector(".topbar-user");
const logoutBtn = document.getElementById("btnLogoutTop");
const topbarLoginLink = document.getElementById("topbarLoginLink");
const topbarAccount = document.getElementById("topbarAccount");

function ensureRootSidebarLinks() {
  const nav = document.querySelector(".sidebar-nav");
  if (!(nav instanceof HTMLElement)) return;

  const ensureLink = (href, text) => {
    let link = nav.querySelector(`a[href="${href}"]`);
    if (!(link instanceof HTMLAnchorElement)) {
      link = document.createElement("a");
      link.href = href;
      link.textContent = text;
      link.className = "nav-link root-only";
      link.setAttribute("data-role", "root");
      nav.appendChild(link);
    } else {
      link.classList.add("nav-link", "root-only");
      link.setAttribute("data-role", "root");
      link.textContent = text;
    }

    const currentPage = window.location.pathname.split("/").pop();
    link.classList.toggle("active", currentPage === href);
  };

  ensureLink("review", "時數審核");
  ensureLink("user_management", "使用者管理");
}

function getTopbarLinks() {
  const loginText = "\u767b\u5165";
  let login = topbarLoginLink;

  if (!login) {
    const links = Array.from(document.querySelectorAll(".topbar-link"));
    for (const link of links) {
      if (!(link instanceof HTMLElement)) continue;
      const text = (link.textContent || "").trim();
      if (!login && text === loginText) login = link;
    }
  }

  return { login };
}



function setAvatar(user) {
  if (!topbarUser || !user) return;
  let label = "U";
  topbarUser.classList.remove("role-root", "role-dept");

  if (user.role === "root") {
    label = "\u7ba1";
    topbarUser.classList.add("role-root");
    topbarUser.title = "\u6559\u5b78\u8cc7\u6e90\u7d44";
    if (topbarAccount) topbarAccount.textContent = user.account || user.name || "root";
  } else {
    const name = user.unit_name || user.name || user.account || user.email || "U";
    label = name.slice(0, 2);
    topbarUser.classList.add("role-dept");
    topbarUser.title = name;
    if (topbarAccount) topbarAccount.textContent = name;
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
    document.body.classList.toggle("is-root", user?.role === "root");
    if (user?.role === "root") ensureRootSidebarLinks();
    document.querySelectorAll("[data-role='root']").forEach((el) => {
      if (user?.role !== "root") {
        el.classList.add("is-hidden");
      } else {
        el.classList.remove("is-hidden");
      }
    });
    const { login } = getTopbarLinks();
    login?.classList.add("is-hidden");
    if (logoutBtn) {
      logoutBtn.classList.remove("is-hidden");
      logoutBtn.addEventListener("click", async () => {
        await fetch(`${window.API_BASE}/api/auth/logout`, {
          method: "POST",
          credentials: "include",
        });
        window.location.href = "admin";
      });
    }
    return user;
  } catch (err) {
    if (logoutBtn) logoutBtn.classList.add("is-hidden");
    const { login } = getTopbarLinks();
    login?.classList.remove("is-hidden");
    window.location.href = "admin";
    throw err;
  }
}

window.__authUserPromise = guard();

