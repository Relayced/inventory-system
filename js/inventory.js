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

function statusBadge(stock, min) {
  const s = Number(stock);
  const m = Number(min);

  if (s <= 0) return `<span class="status out">OUT</span>`;
  if (s <= m) return `<span class="status low">LOW</span>`;
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

/* =========================
   LOAD INVENTORY
========================= */
async function loadInventory() {
  el("tableNote").textContent = "Loading inventory…";

  const { data, error } = await supabase
    .from("inventory")
    .select("product_id, stock, products:product_id(id, name, price, min_stock)")
    .order("updated_at", { ascending: false });

  if (error) {
    el("tableNote").innerHTML = `<span class="danger">Cannot load inventory: ${escapeHtml(error.message)}</span>`;
    el("invBody").innerHTML = "";
    return;
  }

  allRows = (data || []).map((r) => ({
    id: r.products?.id || r.product_id,                // IMPORTANT: use products.id for editing
    invProductId: r.product_id,                        // inventory uses product_id
    name: r.products?.name ?? "Unknown",
    price: Number(r.products?.price ?? 0),
    min: Number(r.products?.min_stock ?? 5),          // default 5 so status won’t break
    stock: Number(r.stock ?? 0),
  }));

  el("tableNote").textContent = allRows.length ? "" : "No products yet. (Admin can add.)";
  renderTable(allRows);
}

/* =========================
   RENDER TABLE
========================= */
function renderTable(rows) {
  const q = el("search").value.trim().toLowerCase();
  const filtered = rows.filter((r) => r.name.toLowerCase().includes(q));

  el("invBody").innerHTML = filtered
    .map((r) => {
      const actionCell = isAdmin
        ? `
          <td style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn" style="padding:8px 10px;border-radius:10px"
              data-upstock="${r.invProductId}" data-stock="${r.stock}">
              Stock
            </button>
            <button class="btn" style="padding:8px 10px;border-radius:10px;background:#0ea5e9"
              data-edit="${r.id}">
              Edit
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

  if (isAdmin) {
    // Update stock button
    document.querySelectorAll("button[data-upstock]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const invProductId = btn.getAttribute("data-upstock");
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
          .eq("product_id", invProductId);

        if (error) {
          alert("Update failed: " + error.message);
          return;
        }

        await loadInventory();
      });
    });

    // Edit product price + min_stock
    document.querySelectorAll("button[data-edit]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const productId = btn.getAttribute("data-edit");
        const row = allRows.find((x) => x.id === productId);
        if (!row) return;

        const newPriceStr = prompt("New price (₱):", String(row.price));
        if (newPriceStr === null) return;

        const newMinStr = prompt("New minimum stock:", String(row.min));
        if (newMinStr === null) return;

        const newPrice = Number(newPriceStr);
        const newMin = Number(newMinStr);

        if (!Number.isFinite(newPrice) || newPrice < 0) {
          alert("Invalid price.");
          return;
        }
        if (!Number.isFinite(newMin) || newMin < 0) {
          alert("Invalid minimum stock.");
          return;
        }

        const { error } = await supabase
          .from("products")
          .update({ price: newPrice, min_stock: newMin })
          .eq("id", productId);

        if (error) {
          alert("Edit failed: " + error.message);
          return;
        }

        await loadInventory();
      });
    });
  }
}

/* =========================
   ADMIN: ADD PRODUCT
========================= */
async function addProduct() {
  const name = el("pName").value.trim();
  const price = Number(el("pPrice").value);
  const min = Number(el("pMin").value || 5);
  const stock = Number(el("pStock").value || 0);

  if (!name) return showMsg("Product name required.", true);
  if (!Number.isFinite(price) || price < 0) return showMsg("Invalid price.", true);
  if (!Number.isFinite(min) || min < 0) return showMsg("Invalid min stock.", true);
  if (!Number.isFinite(stock) || stock < 0) return showMsg("Invalid initial stock.", true);

  showMsg("Adding product...", false);

  // 1) Insert product
  const { data: prod, error: pErr } = await supabase
    .from("products")
    .insert([{ name, price, min_stock: min }])
    .select("id")
    .single();

  if (pErr) return showMsg("Add product failed: " + pErr.message, true);

  // 2) Create inventory row
  const { error: iErr } = await supabase
    .from("inventory")
    .insert([{ product_id: prod.id, stock }]);

  if (iErr) return showMsg("Inventory create failed: " + iErr.message, true);

  showMsg("✅ Product added!", false);

  el("pName").value = "";
  el("pPrice").value = "";
  el("pMin").value = "";
  el("pStock").value = "";

  await loadInventory();
}

function showMsg(text, isError = false) {
  const m = el("msg");
  if (!m) return;
  m.textContent = text;
  m.style.color = isError ? "#dc2626" : "#6b7280";
}

/* =========================
   REALTIME
========================= */
function setupRealtime() {
  supabase
    .channel("inventory-page")
    .on("postgres_changes", { event: "*", schema: "public", table: "inventory" }, async () => {
      await loadInventory();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "products" }, async () => {
      await loadInventory();
    })
    .subscribe();
}

/* =========================
   MAIN
========================= */
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
    el("adminTools").classList.remove("hidden");
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
