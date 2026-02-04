import { supabase } from "./supabase.js";

const el = (id) => document.getElementById(id);

// ✅ CHANGE THIS if your Edge Function name is different in Supabase
const FUNCTION_NAME = "admin-create-user";

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
  if (error) console.error("getUser error:", error);

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
   OPTIONAL: PING FUNCTION
   Helps you confirm the function exists & CORS is OK
========================= */
async function pingFunction() {
  try {
    const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
      body: { ping: true },
    });
    console.log("PING data:", data);
    console.log("PING error:", error);
  } catch (e) {
    console.error("PING crashed:", e);
  }
}

/* =========================
   CREATE ACCOUNT (ADMIN)
========================= */
async function inviteUser() {
  el("err").textContent = "";
  el("msg").textContent = "";

  const email = (el("newEmail")?.value || "").trim().toLowerCase();
  const password = el("newPassword")?.value || "";
  const role = el("newRole")?.value || "staff";

  if (!email || !email.includes("@")) {
    el("err").textContent = "Please enter a valid email.";
    return;
  }

  if (password.length < 6) {
    el("err").textContent = "Password must be at least 6 characters.";
    return;
  }

  el("msg").textContent = "Checking session…";

  const { data: sessionWrap, error: sessionErr } = await supabase.auth.getSession();
  const token = sessionWrap?.session?.access_token;

  console.log("Session error:", sessionErr);
  console.log("Access token exists?", !!token);
  console.log("Access token length:", token ? token.length : 0);

  if (!token) {
    el("err").textContent = "No login session found. Logout then login again.";
    el("msg").textContent = "";
    return;
  }

  el("msg").textContent = "Creating account…";

  try {
    const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
      body: { email, password, role },
    });

    if (error) {
      console.error("Edge Function error object:", error);

      // If function is missing/not deployed, SDK often shows "Failed to send request"
      if ((error.message || "").toLowerCase().includes("failed to send")) {
        el("err").textContent =
          `Create failed: Cannot reach Edge Function "${FUNCTION_NAME}". ` +
          `Check: (1) function name matches in Supabase, (2) function is deployed, (3) CORS/OPTIONS is handled.`;
        el("msg").textContent = "";
        return;
      }

      const status =
        error.status ??
        error.context?.status ??
        error.context?.response?.status ??
        "unknown";

      const body =
        error.context?.body ??
        error.context?.response ??
        error.message ??
        JSON.stringify(error);

      el("err").textContent =
        `Create failed (status ${status}): ` +
        (typeof body === "string" ? body : JSON.stringify(body));

      el("msg").textContent = "";
      return;
    }

    console.log("Create success:", data);

    el("msg").textContent = data?.message ? "✅ " + data.message : "✅ Account created!";

    if (el("newEmail")) el("newEmail").value = "";
    if (el("newPassword")) el("newPassword").value = "";
    if (el("newRole")) el("newRole").value = "staff";

    await loadUsers();
  } catch (e) {
    console.error("Invoke crashed:", e);
    el("err").textContent =
      `Create request crashed (network/CORS). Make sure Edge Function "${FUNCTION_NAME}" exists and is deployed.`;
    el("msg").textContent = "";
  }
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

  // Optional: uncomment for debugging
  // await pingFunction();
}

main();
