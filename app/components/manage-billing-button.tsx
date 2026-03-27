"use client";

export default function ManageBillingButton() {
  const openPortal = async () => {
    const res = await fetch("/api/stripe/portal", {
      method: "POST",
    });

    const text = await res.text();
    const data = text ? JSON.parse(text) : null;

    if (!res.ok) {
      throw new Error(data?.error || "Failed to open billing portal");
    }

    if (!data?.url) {
      throw new Error("Billing portal URL missing");
    }

    window.location.href = data.url;
  };

  return <button onClick={openPortal}>Manage Billing</button>;
}
