import Link from "next/link";
import type { ReactNode } from "react";
import ThemeSwitch from "@/components/theme-switch";

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

/** Emerald "trend" tile shared by the homepage and app headers. */
export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-[9px] bg-emerald-700 text-white dark:bg-emerald-500 dark:text-emerald-950 ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 17l5-5 4 3 7-8" />
        <path d="M15 7h5v5" />
      </svg>
    </span>
  );
}

export default function SiteHeaderNav({
  current,
  children,
}: SiteHeaderNavProps) {
  return (
    <header className="no-print sticky top-0 z-20 border-b border-slate-200 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2.5 sm:gap-4 sm:px-8">
        <Link
          href="/"
          aria-label="Convert by WhachaWant, home"
          className="flex min-h-11 min-w-11 items-center justify-center gap-2.5 rounded-lg text-slate-950 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:text-slate-50 dark:focus-visible:outline-sky-300"
        >
          <BrandMark />
          <span className="hidden text-lg font-extrabold tracking-tight sm:inline">
            Convert
          </span>
        </Link>

        <nav
          aria-label="Main"
          className="hidden items-center gap-1 text-sm font-semibold md:flex"
        >
          {navItems.map((item) => {
            const isActive = item.key === current;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`inline-flex min-h-11 items-center rounded-md px-3 transition ${
                  isActive
                    ? "text-slate-950 underline decoration-emerald-600 decoration-2 underline-offset-8 dark:text-white dark:decoration-emerald-400"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeSwitch />
          {children}
        </div>
      </div>
    </header>
  );
}
