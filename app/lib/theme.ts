// Application-wide Light / Dark / Auto theme logic.
// Pure and DOM-agnostic so it can run in the pre-paint script, the client
// controller and Node tests. "system" (Auto) is never written to storage:
// choosing Auto removes the stored manual choice.

export const THEME_STORAGE_KEY = "convert-theme";
export const THEME_PREFERENCES = ["light", "dark", "system"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type ResolvedTheme = "light" | "dark";

const DARK_QUERY = "(prefers-color-scheme: dark)";

export type ThemeStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};
type MediaQueryLike = {
  matches: boolean;
  addEventListener?: (type: "change", fn: () => void) => void;
  removeEventListener?: (type: "change", fn: () => void) => void;
};
export type ThemeRoot = {
  setAttribute(name: string, value: string): void;
  style: { colorScheme?: string };
};

export function parseThemePreference(value: unknown): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === "system") return systemPrefersDark ? "dark" : "light";
  return preference;
}

export function readThemePreference(
  getStorage: () => ThemeStorage | null | undefined,
): ThemePreference {
  try {
    return parseThemePreference(getStorage()?.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

/** Returns false when the choice could not be persisted (e.g. storage denied). */
export function writeThemePreference(
  getStorage: () => ThemeStorage | null | undefined,
  preference: ThemePreference,
): boolean {
  try {
    const storage = getStorage();
    if (!storage) return false;
    if (preference === "system") storage.removeItem(THEME_STORAGE_KEY);
    else storage.setItem(THEME_STORAGE_KEY, preference);
    return true;
  } catch {
    return false;
  }
}

export function applyThemeToRoot(
  root: ThemeRoot,
  preference: ThemePreference,
  resolved: ResolvedTheme,
) {
  root.setAttribute("data-theme", resolved);
  root.setAttribute("data-theme-preference", preference);
  root.style.colorScheme = resolved;
}

export type ThemeController = ReturnType<typeof createThemeController>;

export function createThemeController({
  root,
  getStorage,
  matchMedia,
}: {
  root: ThemeRoot;
  getStorage: () => ThemeStorage | null | undefined;
  matchMedia?: ((query: string) => MediaQueryLike) | null;
}) {
  let preference = readThemePreference(getStorage);
  const listeners = new Set<() => void>();
  let mql: MediaQueryLike | null = null;
  try {
    mql = matchMedia ? matchMedia(DARK_QUERY) : null;
  } catch {
    mql = null;
  }

  const systemDark = () => Boolean(mql?.matches);
  const getResolved = () => resolveTheme(preference, systemDark());
  const apply = () => applyThemeToRoot(root, preference, getResolved());
  const notify = () => listeners.forEach((fn) => fn());
  const onSystemChange = () => {
    if (preference !== "system") return; // a manual choice wins
    apply();
    notify();
  };

  return {
    getPreference: () => preference,
    getResolved,
    setPreference(next: unknown) {
      preference = parseThemePreference(next);
      writeThemePreference(getStorage, preference); // in-memory still applies if denied
      apply();
      notify();
    },
    /** Re-read storage (e.g. another tab changed it) and re-apply. */
    sync() {
      preference = readThemePreference(getStorage);
      apply();
      notify();
    },
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    start() {
      apply();
      mql?.addEventListener?.("change", onSystemChange);
      return () => mql?.removeEventListener?.("change", onSystemChange);
    },
  };
}

// Runs synchronously in <head> before first paint. Self-contained ES5; it
// mirrors parseThemePreference/resolveTheme above and never throws.
export const THEME_INIT_SCRIPT = `(function(){var p="system",d=false,r;try{var s=window.localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(s==="light"||s==="dark")p=s}catch(e){}try{d=!!(window.matchMedia&&window.matchMedia(${JSON.stringify(
  DARK_QUERY,
)}).matches)}catch(e){}r=p==="system"?(d?"dark":"light"):p;try{var h=document.documentElement;h.setAttribute("data-theme",r);h.setAttribute("data-theme-preference",p);h.style.colorScheme=r}catch(e){}})();`;
