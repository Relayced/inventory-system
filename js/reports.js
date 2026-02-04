import { supabase } from "./supabase.js";

const el = (id) => document.getElementById(id);
const peso = (n) => `₱${Number(n || 0).toFixed(2)}`;

async function requireAuth() {
  const { data } = await supabase.auth.getUser();
  if (!data?.user) {
    window.location.href = "./index.html";
    return null;
  }
  return data.user;
}

async function getRole(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (error) return "staff";
  return data?.role || "staff";
}

function toRange(startDateStr, endDateStr) {
  // inclusive start, exclusive end (end + 1 day)
  const start = new Date(startDateStr + "T00:00:00");
  const end = new Date(endDateStr + "T00:00:00");
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadAll() {
  el("err").textContent = "";

  const startDate = el("startDate").value;
  const endDate = el("endDate").value;

  const { start, end } = toRange(startDate, endDate);

  // Summary
  const sum = await supabase.rpc("report_sales_summary", { p_start: start, p_end: end });
  if (sum.error) {
    el("err").textContent = "Summary error: " + sum.error.message;
    return;
  }
  const s = sum.data?.[0] || { orders: 0, items_sold: 0, revenue: 0, avg_order: 0 };
  el("orders").textContent = s.orders ?? 0;
  el("itemsSold").textContent = s.items_sold ?? 0;
  el("revenue").textContent = peso(s.revenue);
  el("avgOrder").textContent = peso(s.avg_order);

  // Fast moving
  el("fastNote").textContent = "Loading…";
  const fast = await supabase.rpc("report_fast_moving", { p_start: start, p_end: end, p_limit: 10 });
  if (fast.error) {
    el("fastNote").textContent = "Error: " + fast.error.message;
    el("fastBody").innerHTML = "";
  } else {
    const rows = fast.data || [];
    el("fastNote").textContent = rows.length ? "" : "No sales in this range.";
    el("fastBody").innerHTML = rows.map(r => `
      <tr>
        <td>${escapeHtml(r.name)}</td>
        <td>${r.qty}</td>
        <td>${peso(r.revenue)}</td>
      </tr>
    `).join("");
  }

  // Slow moving
  el("slowNote").textContent = "Loading…";
  const slow = await supabase.rpc("report_slow_moving", { p_start: start, p_end: end, p_limit: 10 });
  if (slow.error) {
    el("slowNote").textContent = "Error: " + slow.error.message;
    el("slowBody").innerHTML = "";
  } else {
    const rows = slow.data || [];
    el("slowNote").textContent = rows.length ? "" : "No products found.";
    el("slowBody").innerHTML = rows.map(r => `
      <tr>
        <td>${escapeHtml(r.name)}</td>
        <td>${r.qty}</td>
        <td>${peso(r.revenue)}</td>
      </tr>
    `).join("");
  }

  // Low stock
  el("lowNote").textContent = "Loading…";
  const low = await supabase.rpc("report_low_stock");
  if (low.error) {
    el("lowNote").textContent = "Error: " + low.error.message;
    el("lowBody").innerHTML = "";
  } else {
    const rows = low.data || [];
    el("lowNote").textContent = rows.length ? "" : "No low-stock items 🎉";
    el("lowBody").innerHTML = rows.map(r => `
      <tr>
        <td>${escapeHtml(r.name)}</td>
        <td>${r.stock}</td>
        <td>${r.min_stock}</td>
        <td>
          <span class="badge ${r.status === "OUT" ? "out" : "low"}">${r.status}</span>
        </td>
      </tr>
    `).join("");
  }
}

async function main() {
  const user = await requireAuth();
  if (!user) return;

  el("userEmail").textContent = user.email || "(no email)";

  const role = await getRole(user.id);
  el("userRole").textContent = role;

  // Hide Admin link for staff
  if (role !== "admin") el("navAdmin").style.display = "none";

  // Default date range: last 30 days
  const today = new Date();
  const end = new Date(today);
  const start = new Date(today);
  start.setDate(start.getDate() - 30);

  el("startDate").value = start.toISOString().slice(0, 10);
  el("endDate").value = end.toISOString().slice(0, 10);

  el("applyBtn").addEventListener("click", loadAll);

  el("logoutBtn").addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "./index.html";
  });

  await loadAll();
}

main();
