import { supabase } from "./supabase.js";

/* ---------- LOGIN ---------- */
const loginForm = document.getElementById("loginForm");
const emailEl = document.getElementById("email");
const passwordEl = document.getElementById("password");
const errorEl = document.getElementById("error");

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = emailEl.value.trim();
    const password = passwordEl.value;

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      if (errorEl) errorEl.textContent = error.message;
      return;
    }

    window.location.href = "dashboard.html";
  });
}

/* ---------- PROTECT DASHBOARD ---------- */
const isDashboardPage =
  window.location.pathname.endsWith("/dashboard.html") ||
  window.location.pathname.endsWith("dashboard.html");

if (isDashboardPage) {
  const { data, error } = await supabase.auth.getUser();

  // if request fails or no user, send back to login
  if (error || !data?.user) {
    window.location.href = "index.html";
  }
}
