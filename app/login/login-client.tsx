"use client";

import { supabase } from "@/lib/supabase-browser";
import { useSearchParams } from "next/navigation";

export default function LoginClient() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const handleGoogleLogin = async () => {
    const redirectTo = `${window.location.origin}/auth/callback`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
      },
    });

    if (error) {
      console.error("Google login error:", error);
      alert("Unable to start Google sign-in. Please try again.");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="space-y-3 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            AI Client Reporting
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">
            Sign in to your dashboard
          </h1>
          <p className="text-sm leading-6 text-slate-600">
            Use your Google account to access your clients, reports, and
            print-ready summaries.
          </p>
          {error && (
            <p className="text-sm text-red-600">
              Sign-in failed. Please try again.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          className="mt-8 flex w-full items-center justify-center rounded-lg bg-black px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Sign in with Google
        </button>
      </div>
    </main>
  );
}
