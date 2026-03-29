import Link from "next/link";
import type { ReactNode } from "react";

type SiteHeaderNavProps = {
  current: "home" | "pricing" | "dashboard";
  children?: ReactNode;
};

const navItems = [
  {
    href: "/",
    key: "home",
    label: "Home",
  },
  {
    href: "/pricing",
    key: "pricing",
    label: "Pricing",
  },
  {
    href: "/dashboard",
    key: "dashboard",
    label: "Dashboard",
  },
] as const;

export default function SiteHeaderNav({
  current,
  children,
}: SiteHeaderNavProps) {
  return (
    <section className="border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4 sm:px-8">
        <Link
          href="/"
          className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-600"
        >
          Convert
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
          {navItems.map((item) => {
            const isActive = item.key === current;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`transition ${
                  isActive
                    ? "text-slate-950"
                    : "text-slate-600 hover:text-slate-950"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">{children}</div>
      </div>
    </section>
  );
}
