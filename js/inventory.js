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
  const { data } = await supabase.auth.getUser();
  if (!data?.user) {
    window.location.href = "./index.html";
    return null;
  }
  return data.user;
}

async function getMyRole(userId) {
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

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
    el("tableNote").textContent = error.message;
    return;
  }

  allRows = (data || []).map((r) => ({
    id: r.products.id,
    invProductId: r.product_id,
    name: r.products.name,
    price: Number(r.products.price),
    min: Number(r.products.min_stock),
    stock: Number(r.stock),
  }));

  renderTable(allRows);
}

/* =========================
   DELETE
========================= */
async function deleteProduct(row) {
  if (!confirm(`Delete ${row.name}?`)) return;

  await supabase.from("inventory").delete().eq("product_id", row.invProductId);
  await supabase.from("products").delete().eq("id", row.id);

  allRows = allRows.filter((x) => x.id !== row.id);
  renderTable(allRows);
}

/* =========================
   RENDER TABLE (FIXED)
========================= */
function renderTable(rows) {
  const q = el("search").value.toLowerCase();
  const filtered = rows.filter((r) => r.name.toLowerCase().includes(q));

  el("invBody").innerHTML = filtered
    .map(
      (r) => `
    <tr>
      <td>${escapeHtml(r.name)}</td>
      <td>₱${r.price.toFixed(2)}</td>
      <td>${r.stock}</td>
      <td>${r.min}</td>
      <td>${statusBadge(r.stock, r.min)}</td>
      ${
        isAdmin
          ? `
        <td>
          <button class="btn" data-upstock="${r.invProductId}" data-stock="${r.stock}">Stock</button>
          <button class="btn" data-edit="${r.id}">Edit</button>
          <button class="btn danger" data-del="${r.id}">Delete</button>
        </td>`
          : ""
      }
    </tr>`
    )
    .join("");

  if (!isAdmin) return;

  /* ✅ STOCK BUTTON */
  document.querySelectorAll("[data-upstock]").forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.dataset.upstock;
      const current = Number(btn.dataset.stock);
      const value = prompt("New stock:", current);
      if (value === null) return;

      await supabase
        .from("inventory")
        .update({ stock: Number(value) })
        .eq("product_id", id);

      loadInventory();
    };
  });

  /* ✅ EDIT BUTTON */
  document.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.onclick = async () => {
      const row = allRows.find((x) => x.id === btn.dataset.edit);
      if (!row) return;

      const price = prompt("New price:", row.price);
      const min = prompt("New min stock:", row.min);
      if (price === null || min === null) return;

      await supabase
        .from("products")
        .update({ price: Number(price), min_stock: Number(min) })
        .eq("id", row.id);

      loadInventory();
    };
  });

  /* ✅ DELETE BUTTON */
  document.querySelectorAll("[data-del]").forEach((btn) => {
    btn.onclick = () => {
      const row = allRows.find((x) => x.id === btn.dataset.del);
      if (row) deleteProduct(row);
    };
  });
}

/* =========================
   ADD PRODUCT (UNCHANGED)
========================= */
async function addProduct() {
  const name = el("pName").value.trim();
  const price = Number(el("pPrice").value);
  const min = Number(el("pMin").value || 5);
  const stock = Number(el("pStock").value || 0);

  const { data: prod } = await supabase
    .from("products")
    .insert([{ name, price, min_stock: min }])
    .select("id")
    .single();

  await supabase
    .from("inventory")
    .insert([{ product_id: prod.id, stock }]);

  loadInventory();
}

/* =========================
   MAIN
========================= */
async function main() {
  const user = await requireAuth();
  if (!user) return;

  const role = await getMyRole(user.id);
  isAdmin = role === "admin";

  if (!isAdmin) {
    el("adminTools").style.display = "none";
    el("thAction").style.display = "none";
  }

  el("search").oninput = () => renderTable(allRows);
  el("addProductBtn")?.addEventListener("click", addProduct);

  await loadInventory();
}

main();
