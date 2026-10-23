"use client";

import { useSyncExternalStore } from "react";
import { getThemeController } from "@/components/theme-sync";
import type { ThemePreference } from "@/lib/theme";

const OPTIONS: {
  value: ThemePreference;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "light",
    label: "Light",
    description: "Light theme",
    icon: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </>
    ),
  },
  {
    value: "dark",
    label: "Dark",
    description: "Dark theme",
    icon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
  },
  {
    value: "system",
    label: "Auto",
    description: "Auto: follow device setting",
    icon: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" />
      </>
    ),
  },
];

const subscribe = (fn: () => void) => {
  const c = getThemeController();
  return c ? c.subscribe(fn) : () => {};
};
const getSnapshot = (): ThemePreference =>
  getThemeController()?.getPreference() ?? "system";
const getServerSnapshot = (): ThemePreference => "system";

type Props = { className?: string; showLabels?: boolean };

/** Segmented Light / Dark / Auto control. Every target is at least 44x44px. */
export default function ThemeSwitch({ className = "", showLabels = true }: Props) {
  const preference = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <div
      role="group"
      aria-label="Color theme"
      className={`inline-flex shrink-0 items-center rounded-full border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-800 ${className}`}
    >
      {OPTIONS.map((option) => {
        const pressed = preference === option.value;
        return (
          <button
            key={option.value}
            type="button"
            data-theme-option={option.value}
            aria-pressed={pressed}
            aria-label={option.description}
            title={option.description}
            onClick={() => getThemeController()?.setPreference(option.value)}
            className={`inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-1.5 rounded-full px-2.5 text-[13px] font-bold leading-none transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:focus-visible:outline-sky-300 ${
              pressed
                ? "bg-white text-emerald-800 shadow-sm dark:bg-slate-600 dark:text-emerald-200"
                : "text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              {option.icon}
            </svg>
            {showLabels && (
              <span className="hidden lg:inline" aria-hidden="true">
                {option.label}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
