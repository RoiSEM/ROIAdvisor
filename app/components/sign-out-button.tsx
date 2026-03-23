"use client";

import { supabase } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";

type Props = {
  className?: string;
};

export default function SignOutButton({ className }: Props) {
  const router = useRouter();

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Sign-out error:", error);
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
        "rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
      }
    >
      Sign out
    </button>
  );
}
