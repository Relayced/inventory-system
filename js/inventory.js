import { supabase } from "./supabase.js";

const el = (id) => document.getElementById(id);

function statusBadge(stock, min) {
  if (stock <= 0) return `<span class="status out">OUT</span>`;
  if (stock <= min) return `<span class="status low">LOW</span>`;
  return `<span class="status ok">OK</span>`;
}

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
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (error) return "staff";
  return data?.role || "staff";
}

let isAdmin = false;
let allRows = [];

async function loadInventory() {
  el("tableNote").textContent = "Loading inventory…";

  const { data, error } = await supabase
    .from("inventory")
    .select("product_id, stock, products:product_id(name, price, min_stock)")
    .order("updated_at", { ascending: false });

  if (error) {
    el("tableNote").innerHTML = `<span class="danger">Cannot load inventory: ${error.message}</span>`;
    el("invBody").innerHTML = "";
    return;
  }

  allRows = (data || []).map((r) => ({
    id: r.product_id,
    name: r.products?.name ?? "Unknown",
    price: Number(r.products?.price ?? 0),
    min: Number(r.products?.min_stock ?? 0),
    stock: Number(r.stock ?? 0)
  }));

  el("tableNote").textContent = allRows.length ? "" : "No products yet. (Admin can add.)";
  renderTable(allRows);
}

function renderTable(rows) {
  const q = el("search").value.trim().toLowerCase();
  const filtered = rows.filter((r) => r.name.toLowerCase().includes(q));

  el("invBody").innerHTML = filtered
    .map((r) => {
      const actionCell = isAdmin
        ? `
          <td>
            <button class="btn" style="padding:8px 10px;border-radius:10px" data-id="${r.id}" data-stock="${r.stock}">
              Update Stock
            </button>
          </td>
        `
        : "";

      return `
        <tr>
          <td>${escapeHtml(r.name)}</td>
          <td>₱${r.price.toFixed(2)}</td>
          <td>${r.stock}</td>
          <td>${r.min}</td>
          <td>${statusBadge(r.stock, r.min)}</td>
          ${actionCell}
        </tr>
      `;
    })
    .join("");

  // Attach update stock events (admin only)
  if (isAdmin) {
    document.querySelectorAll('button[data-id]').forEach((btn) => {
      btn.addEventListener("click", async () => {
        const productId = btn.getAttribute("data-id");
        const current = Number(btn.getAttribute("data-stock"));

        const newStockStr = prompt("Enter new stock:", String(current));
        if (newStockStr === null) return;

        const newStock = Number(newStockStr);
        if (!Number.isFinite(newStock) || newStock < 0) {
          alert("Invalid stock value.");
          return;
        }

        const { error } = await supabase
          .from("inventory")
          .update({ stock: newStock, updated_at: new Date().toISOString() })
          .eq("product_id", productId);

        if (error) {
          alert("Update failed: " + error.message);
          return;
        }

        await loadInventory();
      });
    });
  }
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
  supabase
    .channel("inventory-page")
    .on("postgres_changes", { event: "*", schema: "public", table: "inventory" }, async () => {
      await loadInventory();
    })
    .subscribe();
}

async function addProduct() {
  const name = el("pName").value.trim();
  const price = Number(el("pPrice").value);
  const min = Number(el("pMin").value || 5);
  const stock = Number(el("pStock").value || 0);

  if (!name) return showMsg("Product name required.");
  if (!Number.isFinite(price) || price < 0) return showMsg("Invalid price.");
  if (!Number.isFinite(min) || min < 0) return showMsg("Invalid min stock.");
  if (!Number.isFinite(stock) || stock < 0) return showMsg("Invalid initial stock.");

  showMsg("Adding product...");

  // 1) insert into products
  const { data: prod, error: pErr } = await supabase
    .from("products")
    .insert([{ name, price, min_stock: min }])
    .select("id")
    .single();

  if (pErr) return showMsg("Add product failed: " + pErr.message, true);

  // 2) create inventory row
  const { error: iErr } = await supabase
    .from("inventory")
    .insert([{ product_id: prod.id, stock }]);

  if (iErr) return showMsg("Inventory create failed: " + iErr.message, true);

  showMsg("✅ Product added!");

  el("pName").value = "";
  el("pPrice").value = "";
  el("pMin").value = "";
  el("pStock").value = "";

  await loadInventory();
}

function showMsg(text, isError = false) {
  const m = el("msg");
  m.textContent = text;
  m.style.color = isError ? "#dc2626" : "#6b7280";
}

async function main() {
  const user = await requireAuth();
  if (!user) return;

  el("userEmail").textContent = user.email || "(no email)";
  const role = await getMyRole(user.id);
  el("userRole").textContent = role;
  isAdmin = role === "admin";

  // Hide Admin nav and tools for staff
  if (!isAdmin) {
    el("navAdmin").style.display = "none";
    el("adminTools").style.display = "none";
  } else {
    el("adminTools").style.display = "block";
    el("thAction").classList.remove("hidden");
  }

  el("logoutBtn").addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "./index.html";
  });

  el("refreshBtn")?.addEventListener("click", loadInventory);
  el("search").addEventListener("input", () => renderTable(allRows));
  el("addProductBtn")?.addEventListener("click", addProduct);

  await loadInventory();
  setupRealtime();
}

main();
