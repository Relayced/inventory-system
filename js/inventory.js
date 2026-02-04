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
    el("tableNote").innerHTML = `<span class="danger">Cannot load inventory: ${escapeHtml(
      error.message
    )}</span>`;
    el("invBody").innerHTML = "";
    return;
  }

  allRows = (data || []).map((r) => ({
    id: r.products?.id || r.product_id,
    invProductId: r.product_id,
    name: r.products?.name ?? "Unknown",
    price: Number(r.products?.price ?? 0),
    min: Number(r.products?.min_stock ?? 5),
    stock: Number(r.stock ?? 0),
  }));

  el("tableNote").textContent = allRows.length
    ? ""
    : "No products yet. (Admin can add.)";

  renderTable(allRows);
}

/* =========================
   DELETE PRODUCT + STOCK
========================= */
async function deleteProduct(row) {
  if (!row?.invProductId || !row?.id) return;

  const ok = confirm(
    `Delete this product?\n\n${row.name}\n\nThis will REMOVE it from inventory and products.`
  );
  if (!ok) return;

  const verify = prompt(`Type DELETE to confirm deleting:\n\n${row.name}`, "");
  if (verify !== "DELETE") {
    alert("Cancelled. (You must type DELETE exactly.)");
    return;
  }

  showMsg("Deleting product…", false);

  // 1️⃣ delete inventory row and CONFIRM deletion
  const { data: invDeleted, error: invErr } = await supabase
    .from("inventory")
    .delete()
    .eq("product_id", row.invProductId)
    .select("product_id");

  if (invErr) {
    showMsg("Delete failed (inventory): " + invErr.message, true);
    return;
  }

  if (!invDeleted || invDeleted.length === 0) {
    showMsg(
      "Delete blocked: inventory row NOT deleted (RLS policy issue).",
      true
    );
    return;
  }

  // 2️⃣ delete product row and CONFIRM deletion
  const { data: prodDeleted, error: prodErr } = await supabase
    .from("products")
    .delete()
    .eq("id", row.id)
    .select("id");

  if (prodErr) {
    showMsg(
      "Inventory deleted but product delete failed: " + prodErr.message,
      true
    );
    return;
  }

  if (!prodDeleted || prodDeleted.length === 0) {
    showMsg(
      "Delete blocked: product row NOT deleted (RLS policy issue).",
      true
    );
    return;
  }

  // remove immediately from UI
  allRows = allRows.filter((x) => String(x.id) !== String(row.id));
  renderTable(allRows);

  showMsg("✅ Deleted!", false);
  await loadInventory();
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
            <button class="btn" data-upstock="${r.invProductId}" data-stock="${r.stock}">Stock</button>
            <button class="btn" style="background:#0ea5e9" data-edit="${r.id}">Edit</button>
            <button class="btn" style="background:#dc2626" data-del="${r.id}">Delete</button>
          </td>`
        : "";

      return `
        <tr>
          <td>${escapeHtml(r.name)}</td>
          <td>₱${r.price.toFixed(2)}</td>
          <td>${r.stock}</td>
          <td>${r.min}</td>
          <td>${statusBadge(r.stock, r.min)}</td>
          ${actionCell}
        </tr>`;
    })
    .join("");

  if (!isAdmin) return;

  document.querySelectorAll("button[data-del]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const row = allRows.find((x) => String(x.id) === btn.dataset.del);
      if (row) deleteProduct(row);
    });
  });
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
  if (price < 0 || min < 0 || stock < 0)
    return showMsg("Invalid values.", true);

  showMsg("Adding product…", false);

  const { data: prod, error: pErr } = await supabase
    .from("products")
    .insert([{ name, price, min_stock: min }])
    .select("id")
    .single();

  if (pErr) return showMsg(pErr.message, true);

  const { error: iErr } = await supabase
    .from("inventory")
    .insert([{ product_id: prod.id, stock }]);

  if (iErr) return showMsg(iErr.message, true);

  showMsg("✅ Product added!", false);
  await loadInventory();
}

function showMsg(text, isError = false) {
  const m = el("msg");
  if (!m) return;
  m.textContent = text;
  m.style.color = isError ? "#dc2626" : "#6b7280";
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

  if (!isAdmin) {
    el("adminTools").style.display = "none";
    el("thAction").style.display = "none";
  }

  el("logoutBtn").onclick = async () => {
    await supabase.auth.signOut();
    window.location.href = "./index.html";
  };

  el("search").addEventListener("input", () => renderTable(allRows));
  el("addProductBtn")?.addEventListener("click", addProduct);

  await loadInventory();
}

main();
