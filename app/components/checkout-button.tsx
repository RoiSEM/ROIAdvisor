"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase-browser";

type CheckoutButtonProps = {
  plan: "trial" | "pro";
  label: string;
  featured?: boolean;
};

export default function CheckoutButton({
  plan,
  label,
  featured = false,
}: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false);

  const startCheckout = async () => {
    try {
      setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        window.location.href = "/login";
        return;
      }

      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan }),
      });

     const text = await res.text();
     const data = text ? JSON.parse(text) : null;

     if (!res.ok) {
       throw new Error(data?.error || "Failed to start checkout");
     }

     if (!data?.url) {
       throw new Error("Checkout URL missing");
     }

      window.location.href = data.url;
    } catch (error) {
      console.error("Checkout error:", error);
      alert(error instanceof Error ? error.message : "Unable to start checkout right now. Please try again.");
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={startCheckout}
      disabled={loading}
      className={`inline-flex w-full items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
        featured
          ? "bg-white text-slate-950 hover:bg-slate-100"
          : "bg-black text-white hover:opacity-90"
      }`}
    >
      {loading ? "Redirecting..." : label}
    </button>
  );
}