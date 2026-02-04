import { supabase } from "./supabase.js";

const el = (id) => document.getElementById(id);

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

async function requireAuth() {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    console.error("getUser error:", error);
  }
  if (!data?.user) {
    window.location.href = "./index.html";
    return null;
  }
  return data.user;
}

async function getMyRole(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (error) return "staff";
  return data?.role || "staff";
}

let allUsers = [];

function renderUsers() {
  const q = (el("search")?.value || "").trim().toLowerCase();
  const filtered = allUsers.filter((u) =>
    String(u.email || "").toLowerCase().includes(q)
  );

  el("note").textContent = filtered.length ? "" : "No matching users.";
  el("userBody").innerHTML = filtered
    .map((u) => {
      const role = u.role === "admin" ? "admin" : "staff";
      return `
        <tr>
          <td>${escapeHtml(u.email || "")}</td>
          <td>
            <span class="pill ${role}">${role.toUpperCase()}</span>
            <div style="height:8px"></div>
            <select data-role="${u.id}">
              <option value="staff" ${role === "staff" ? "selected" : ""}>staff</option>
              <option value="admin" ${role === "admin" ? "selected" : ""}>admin</option>
            </select>
          </td>
          <td>${fmtDate(u.created_at)}</td>
          <td>
            <div class="row-actions">
              <button class="btn mini save" data-save="${u.id}">Save</button>
              <button class="btn mini copy" data-copy="${u.id}">Copy ID</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  // Save role buttons
  document.querySelectorAll("button[data-save]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      el("err").textContent = "";
      el("msg").textContent = "";

      const userId = btn.getAttribute("data-save");
      const sel = document.querySelector(`select[data-role="${userId}"]`);
      const newRole = sel?.value || "staff";

      el("msg").textContent = "Saving role…";

      const { error } = await supabase.rpc("admin_set_user_role", {
        p_user_id: userId,
        p_role: newRole,
      });

      if (error) {
        el("err").textContent = error.message;
        el("msg").textContent = "";
        return;
      }

      el("msg").textContent = "✅ Updated role!";
      await loadUsers();
    });
  });

  // Copy ID
  document.querySelectorAll("button[data-copy]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const userId = btn.getAttribute("data-copy");
      try {
        await navigator.clipboard.writeText(userId);
        el("msg").textContent = "Copied user ID ✅";
      } catch {
        alert("Copy failed. User ID:\n" + userId);
      }
    });
  });
}

async function loadUsers() {
  el("err").textContent = "";
  el("msg").textContent = "";
  el("note").textContent = "Loading users…";

  const { data, error } = await supabase.rpc("admin_list_users");

  if (error) {
    el("note").textContent = "";
    el("err").textContent = error.message;
    el("userBody").innerHTML = "";
    return;
  }

  allUsers = data || [];
  renderUsers();
}

/* =========================
   INVITE USER (ADMIN) - FIXED
   Uses supabase.functions.invoke
========================= */
async function inviteUser() {
  el("err").textContent = "";
  el("msg").textContent = "";

  const email = (el("newEmail")?.value || "").trim().toLowerCase();
  const role = el("newRole")?.value || "staff";

  if (!email || !email.includes("@")) {
    el("err").textContent = "Please enter a valid email.";
    return;
  }

  el("msg").textContent = "Sending invite…";

  // This sends your logged-in user's JWT automatically
  const { data, error } = await supabase.functions.invoke("admin-create-user", {
    body: { email, role },
  });

  if (error) {
    console.error("Invite invoke error:", error);
    el("err").textContent = error.message || "Invite failed.";
    el("msg").textContent = "";
    return;
  }

  // Optional: function can return message/details
  if (data?.message) {
    el("msg").textContent = "✅ " + data.message;
  } else {
    el("msg").textContent = "✅ Invite sent! (User must check email)";
  }

  if (el("newEmail")) el("newEmail").value = "";
  if (el("newRole")) el("newRole").value = "staff";

  await loadUsers();
}

async function main() {
  const user = await requireAuth();
  if (!user) return;

  el("userEmail").textContent = user.email || "(no email)";

  const myRole = await getMyRole(user.id);
  el("userRole").textContent = myRole;

  if (myRole !== "admin") {
    window.location.href = "./dashboard.html";
    return;
  }

  el("search")?.addEventListener("input", renderUsers);
  el("refreshBtn")?.addEventListener("click", loadUsers);
  el("createUserBtn")?.addEventListener("click", inviteUser);

  el("logoutBtn")?.addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "./index.html";
  });

  await loadUsers();
}

main();
