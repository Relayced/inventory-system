import { supabase } from "./supabase.js";

/* LOGIN */
document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = emailInput.value;
  const password = passwordInput.value;

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    document.getElementById("error").innerText = error.message;
    return;
  }

  window.location.href = "dashboard.html";
});

/* PROTECT DASHBOARD */
const { data: { user } } = await supabase.auth.getUser();

if (window.location.pathname.includes("dashboard") && !user) {
  window.location.href = "index.html";
}
