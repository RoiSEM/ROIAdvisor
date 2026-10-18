"use client";

async function backend() {
  const response = await fetch("/api/auth/config", { cache: "no-store" });
  if (!response.ok) throw new Error("Authentication unavailable");
  const { backend } = await response.json();
  if (backend !== "supabase" && backend !== "better-auth") throw new Error("Authentication unavailable");
  return backend as "supabase" | "better-auth";
}
export async function startGoogleSignIn() {
  if (await backend() === "supabase") {
    const { supabase } = await import("./supabase-browser");
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback` } });
    if (error) throw new Error("Unable to start Google sign-in");
    return;
  }
  const response = await fetch("/api/auth/sign-in/social", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider: "google", callbackURL: "/dashboard", errorCallbackURL: "/login?error=auth_callback" }),
  });
  if (!response.ok) throw new Error("Unable to start Google sign-in");
  const { url } = await response.json();
  if (typeof url !== "string" || new URL(url).protocol !== "https:") throw new Error("Invalid sign-in response");
  window.location.assign(url);
}
export async function signOut() {
  if (await backend() === "supabase") {
    const { supabase } = await import("./supabase-browser");
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error("Unable to sign out");
    return;
  }
  const response = await fetch("/api/auth/sign-out", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  if (!response.ok) throw new Error("Unable to sign out");
}
