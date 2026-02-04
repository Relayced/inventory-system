import { supabase } from "./supabase.js";

// Helpers
const peso = (n) => `₱${Number(n || 0).toFixed(2)}`;
const el = (id) => document.getElementById(id);

async function requireAuth() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    window.location.href = "./index.html";
    return null;
  }
  return data.user;
}

async function getMyRole(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", userId)
    .single();

  if (error) {
    // show the error on the page so you know what's wrong
    const roleEl = document.getElementById("userRole");
    if (roleEl) roleEl.textContent = "ERROR (check console)";
    console.error("Role read failed:", error);
    return { role: "staff", full_name: null };
  }

  return data;
}

async function loadCounts(userId) {
  // Products count
  const { count: productCount } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true });

  el("productCount").textContent = productCount ?? 0;

  // Low stock list (join products + inventory)
  const { data: lowList, error: lowErr } = await supabase
    .from("inventory")
    .select("stock, products:product_id(id,name,min_stock)")
    .order("updated_at", { ascending: true });

  if (lowErr) {
    el("lowStockNote").textContent = "Cannot load low stock (RLS or table issue).";
    el("lowStockList").innerHTML = "";
    el("lowStockCount").textContent = "0";
  } else {
    const lows = (lowList || [])
      .map((row) => ({
        name: row.products?.name ?? "Unknown",
        stock: row.stock ?? 0,
        min: row.products?.min_stock ?? 0
      }))
      .filter((x) => x.stock <= x.min);

    el("lowStockCount").textContent = lows.length;

    if (lows.length === 0) {
      el("lowStockNote").textContent = "No low-stock items 🎉";
      el("lowStockList").innerHTML = "";
    } else {
      el("lowStockNote").textContent = "Items that need restocking:";
      el("lowStockList").innerHTML = lows
        .map((x) => {
          const isOut = x.stock <= 0;
          return `
            <div class="list-item">
              <div>
                <div class="li-title">${escapeHtml(x.name)}</div>
                <div class="li-sub">Stock: ${x.stock} • Min: ${x.min}</div>
              </div>
              <div class="badge">${isOut ? "OUT" : "LOW"}</div>
            </div>
          `;
        })
        .join("");
    }
  }

  // Sales totals (your current RLS allows users to view only their own sales)
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");

  const startToday = `${y}-${m}-${d}T00:00:00`;
  const startMonth = `${y}-${m}-01T00:00:00`;

  const { data: todaySales } = await supabase
    .from("sales")
    .select("total,created_at")
    .eq("user_id", userId)
    .gte("created_at", startToday);

  const { data: monthSales } = await supabase
    .from("sales")
    .select("total,created_at")
    .eq("user_id", userId)
    .gte("created_at", startMonth);

  const todayTotal = (todaySales || []).reduce((a, r) => a + Number(r.total || 0), 0);
  const monthTotal = (monthSales || []).reduce((a, r) => a + Number(r.total || 0), 0);

  el("todaySales").textContent = peso(todayTotal);
  el("todayOrders").textContent = `${(todaySales || []).length} orders`;

  el("monthSales").textContent = peso(monthTotal);
  el("monthOrders").textContent = `${(monthSales || []).length} orders`;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setupRealtime() {
  // Refresh when inventory changes (works great for low-stock alerts)
  supabase
    .channel("inventory-realtime")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "inventory" },
      async () => {
        const user = await requireAuth();
        if (!user) return;
        await loadCounts(user.id);
      }
    )
    .subscribe();
}

async function main() {
  const user = await requireAuth();
  if (!user) return;

  el("userEmail").textContent = user.email || "(no email)";

  const prof = await getMyRole(user.id);
  el("userRole").textContent = prof.role || "staff";

  // Optional: hide Admin link for staff
  if ((prof.role || "staff") !== "admin") {
    el("navAdmin").style.display = "none";
  }

  await loadCounts(user.id);
  setupRealtime();

  el("refreshBtn").addEventListener("click", async () => {
    await loadCounts(user.id);
  });

  el("logoutBtn").addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "./index.html";
  });
}

main();
