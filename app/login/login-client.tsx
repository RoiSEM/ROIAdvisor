"use client";

import Link from "next/link";
import { BrandMark } from "@/components/site-header-nav";
import ThemeSwitch from "@/components/theme-switch";
import { startGoogleSignIn } from "@/lib/auth-browser";
import { useSearchParams } from "next/navigation";

export default function LoginClient() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const handleGoogleLogin = async () => {
    try {
      await startGoogleSignIn();
    } catch {
      alert("Unable to start Google sign-in. Please try again.");
    }
  };

  return (
    <main className="flex min-h-screen flex-col bg-slate-50 px-4 text-slate-950 sm:px-6 dark:bg-slate-950 dark:text-slate-50">
      <div className="mx-auto flex w-full max-w-md items-center justify-between gap-3 py-3">
        <Link
          href="/"
          aria-label="Convert by WhachaWant, home"
          className="flex min-h-11 items-center gap-2.5 rounded-lg focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:focus-visible:outline-sky-300"
        >
          <BrandMark />
          <span className="text-lg font-extrabold tracking-tight">Convert</span>
        </Link>
        <ThemeSwitch showLabels={false} />
      </div>

      <div className="flex flex-1 items-center justify-center pb-16">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-slate-800 dark:bg-slate-900">
          <div className="space-y-3 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-800 dark:text-emerald-300">
              Convert by WhachaWant
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-slate-50">
              Sign in to your dashboard
            </h1>
            <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
              Use your Google account to access your dashboard, websites,
              reports, and print-ready summaries.
            </p>
            {error && (
              <p role="alert" className="text-sm text-red-600 dark:text-red-300">
                Sign-in failed. Please try again.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            className="mt-8 flex min-h-11 w-full items-center justify-center rounded-lg bg-black px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:bg-emerald-500 dark:text-emerald-950 dark:focus-visible:outline-sky-300"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    </main>
  );
}
