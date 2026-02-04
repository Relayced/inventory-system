import { supabase } from "./supabase.js";

const el = (id) => document.getElementById(id);

function escapeHtml(str) {
  return String(str ?? "")
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

function setMsg(text = "") {
  const m = el("msg");
  if (m) m.textContent = text;
}
function setErr(text = "") {
  const e = el("err");
  if (e) e.textContent = text;
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

  if (error) {
    console.error("getMyRole error:", error);
    return "staff";
  }
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
    el("tableNote").textContent = "Cannot load inventory: " + error.message;
    return;
  }

  allRows = (data || []).map((r) => ({
    id: r.products?.id || r.product_id,
    invProductId: r.product_id,
    name: r.products?.name ?? "Unknown",
    price: Number(r.products?.price ?? 0),
    min: Number(r.products?.min_stock ?? 0),
    stock: Number(r.stock ?? 0),
  }));

  el("tableNote").textContent = allRows.length ? "" : "No products yet.";
  renderTable(allRows);
}

/* =========================
   DELETE
========================= */
async function deleteProduct(row) {
  const ok = confirm(`Delete ${row.name}?`);
  if (!ok) return;

  setErr("");
  setMsg("Deleting…");

  const { error: invErr } = await supabase
    .from("inventory")
    .delete()
    .eq("product_id", row.invProductId);

  if (invErr) {
    setErr("Delete failed (inventory): " + invErr.message);
    setMsg("");
    return;
  }

  const { error: prodErr } = await supabase
    .from("products")
    .delete()
    .eq("id", row.id);

  if (prodErr) {
    setErr("Inventory deleted, but product delete failed: " + prodErr.message);
    setMsg("");
    return;
  }

  setMsg("✅ Deleted!");
  await loadInventory();
}

/* =========================
   RENDER TABLE
========================= */
function renderTable(rows) {
  const q = (el("search")?.value || "").trim().toLowerCase();
  const filtered = rows.filter((r) => (r.name || "").toLowerCase().includes(q));

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
            <button class="btn" style="background:#dc2626" data-del="${r.id}">Delete</button>
          </td>`
            : ""
        }
      </tr>
    `
    )
    .join("");

  if (!isAdmin) return;

  // STOCK
  document.querySelectorAll("[data-upstock]").forEach((btn) => {
    btn.onclick = async () => {
      const invId = btn.dataset.upstock;
      const current = Number(btn.dataset.stock || 0);
      const value = prompt("New stock:", String(current));
      if (value === null) return;

      const newStock = Number(value);
      if (!Number.isFinite(newStock) || newStock < 0) {
        alert("Invalid stock value.");
        return;
      }

      const { error } = await supabase
        .from("inventory")
        .update({ stock: newStock, updated_at: new Date().toISOString() })
        .eq("product_id", invId);

      if (error) {
        alert("Stock update failed: " + error.message);
        return;
      }

      await loadInventory();
    };
  });

  // EDIT (price + min_stock)
  document.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.onclick = async () => {
      const productId = btn.dataset.edit;
      const row = allRows.find((x) => String(x.id) === String(productId));
      if (!row) return;

      const priceStr = prompt("New price:", String(row.price));
      if (priceStr === null) return;

      const minStr = prompt("New min stock:", String(row.min));
      if (minStr === null) return;

      const price = Number(priceStr);
      const min = Number(minStr);
      if (!Number.isFinite(price) || price < 0) return alert("Invalid price.");
      if (!Number.isFinite(min) || min < 0) return alert("Invalid min stock.");

      const { error } = await supabase
        .from("products")
        .update({ price, min_stock: min })
        .eq("id", productId);

      if (error) {
        alert("Edit failed: " + error.message);
        return;
      }

      await loadInventory();
    };
  });

  // DELETE
  document.querySelectorAll("[data-del]").forEach((btn) => {
    btn.onclick = () => {
      const row = allRows.find((x) => String(x.id) === String(btn.dataset.del));
      if (row) deleteProduct(row);
    };
  });
}

/* =========================
   ADD PRODUCT
========================= */
async function addProduct() {
  setErr("");
  setMsg("");

  const name = (el("pName")?.value || "").trim();
  const price = Number(el("pPrice")?.value);
  const min = Number(el("pMin")?.value || 5);
  const stock = Number(el("pStock")?.value || 0);

  if (!name) return setErr("Product name required.");
  if (!Number.isFinite(price) || price < 0) return setErr("Invalid price.");
  if (!Number.isFinite(min) || min < 0) return setErr("Invalid min stock.");
  if (!Number.isFinite(stock) || stock < 0) return setErr("Invalid initial stock.");

  setMsg("Adding product…");

  const { data: prod, error: pErr } = await supabase
    .from("products")
    .insert([{ name, price, min_stock: min }])
    .select("id")
    .single();

  if (pErr) return setErr("Add product failed: " + pErr.message);

  const { error: iErr } = await supabase
    .from("inventory")
    .insert([{ product_id: prod.id, stock }]);

  if (iErr) return setErr("Inventory create failed: " + iErr.message);

  setMsg("✅ Product added!");

  el("pName").value = "";
  el("pPrice").value = "";
  el("pMin").value = "";
  el("pStock").value = "";

  await loadInventory();
}

/* =========================
   MAIN
========================= */
async function main() {
  const user = await requireAuth();
  if (!user) return;

  // ✅ show signed in info
  if (el("userEmail")) el("userEmail").textContent = user.email || "(no email)";

  const role = await getMyRole(user.id);
  if (el("userRole")) el("userRole").textContent = role;

  isAdmin = role === "admin";

  // ✅ hide admin stuff if not admin
  if (!isAdmin) {
    if (el("adminTools")) el("adminTools").style.display = "none";
    if (el("thAction")) el("thAction").style.display = "none";
    if (el("navAdmin")) el("navAdmin").style.display = "none";
  } else {
    if (el("navAdmin")) el("navAdmin").style.display = "block";
  }

  // ✅ logout works
  el("logoutBtn")?.addEventListener("click", async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      window.location.href = "./index.html";
    }
  });

  el("refreshBtn")?.addEventListener("click", loadInventory);
  el("search")?.addEventListener("input", () => renderTable(allRows));
  el("addProductBtn")?.addEventListener("click", addProduct);

  await loadInventory();
}

main();
