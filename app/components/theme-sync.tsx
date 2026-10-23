"use client";

import { useLayoutEffect } from "react";
import {
  createThemeController,
  THEME_STORAGE_KEY,
  type ThemeController,
} from "@/lib/theme";

let controller: ThemeController | null = null;

/** Browser-only singleton shared by every ThemeSwitch on the page. */
export function getThemeController(): ThemeController | null {
  if (typeof window === "undefined" || typeof document === "undefined") return null;
  if (!controller) {
    controller = createThemeController({
      root: document.documentElement,
      getStorage: () => window.localStorage,
      matchMedia: typeof window.matchMedia === "function"
        ? (q) => window.matchMedia(q)
        : null,
    });
  }
  return controller;
}

/**
 * Mounted once in the root layout (which persists across client navigations).
 * Re-applies the theme after hydration (React dev remounts can reset <html>
 * attributes), follows live system changes in Auto, and syncs other tabs.
 */
export default function ThemeSync() {
  useLayoutEffect(() => {
    const c = getThemeController();
    if (!c) return;
    const stop = c.start();
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === THEME_STORAGE_KEY) c.sync();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      stop();
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return null;
}
