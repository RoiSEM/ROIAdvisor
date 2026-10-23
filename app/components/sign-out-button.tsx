"use client";

import { signOut } from "@/lib/auth-browser";
import { useRouter } from "next/navigation";

type Props = {
  className?: string;
};

export default function SignOutButton({ className }: Props) {
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch {
      alert("Unable to sign out right now. Please try again.");
      return;
    }

    router.replace("/login");
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className={
        className ??
        "inline-flex min-h-11 items-center whitespace-nowrap rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:px-4 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      }
    >
      Sign out
    </button>
  );
}
