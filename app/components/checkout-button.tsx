"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CheckoutButtonProps = {
  plan: "starter" | "pro";
  label: string;
  featured?: boolean;
  className?: string;
  successPath?: string;
  cancelPath?: string;
  disabled?: boolean;
};

export default function CheckoutButton({
  plan,
  label,
  featured = false,
  className,
  successPath = "/pricing?checkout=success",
  cancelPath = "/pricing?checkout=cancelled",
  disabled = false,
}: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const startCheckout = async () => {
    try {
      setLoading(true);

      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          plan,
          success_path: successPath,
          cancel_path: cancelPath,
        }),
      });

      if (res.status === 401) {
        router.push("/login");
        return;
      }
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
      disabled={loading || disabled}
      className={
        className ||
        `inline-flex w-full items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
          featured
            ? "bg-white text-slate-950 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-50 dark:hover:bg-slate-800"
            : "bg-black text-white hover:opacity-90 dark:bg-emerald-500 dark:text-emerald-950"
        }`
      }
    >
      {loading ? "Redirecting..." : label}
    </button>
  );
}
