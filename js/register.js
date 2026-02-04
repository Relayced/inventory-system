import { supabase } from "./supabase.js";

const form = document.getElementById("registerForm");
const emailEl = document.getElementById("email");
const passEl = document.getElementById("password");
const errEl = document.getElementById("error");
const msgEl = document.getElementById("msg");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errEl.textContent = "";
  msgEl.textContent = "";

  const email = (emailEl.value || "").trim().toLowerCase();
  const password = passEl.value || "";

  if (!email || !email.includes("@")) {
    errEl.textContent = "Please enter a valid email.";
    return;
  }
  if (password.length < 6) {
    errEl.textContent = "Password must be at least 6 characters.";
    return;
  }

  msgEl.textContent = "Creating account…";

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    errEl.textContent = error.message;
    msgEl.textContent = "";
    return;
  }

  // If email confirmation is ON, user must confirm via email.
  // If OFF, they can login right away.
  if (data?.user && !data?.session) {
    msgEl.textContent = "✅ Account created! Please check your email to confirm, then sign in.";
  } else {
    msgEl.textContent = "✅ Account created! Redirecting…";
    setTimeout(() => (window.location.href = "./dashboard.html"), 800);
  }
});
