export type ThemePreference =
  | "system"
  | "dark"
  | "light";

type ResolvedTheme =
  | "dark"
  | "light";

const STORAGE_KEY = "typforge-theme-preference-v1";

const VALID_THEME_PREFERENCES: ThemePreference[] = ["system", "dark", "light"];

function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === "string" && VALID_THEME_PREFERENCES.includes(value as ThemePreference);
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function loadThemePreference(): ThemePreference {
  if (typeof window === "undefined") {
    return "system";
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);

    return isThemePreference(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

export function saveThemePreference(preference: ThemePreference): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      preference
    );
  } catch {

  }
}

export function applyTheme(preference: ThemePreference): void {
  if (typeof document === "undefined") {
    return;
  }

  const resolvedTheme: ResolvedTheme = preference === "system" ? getSystemTheme() : preference;

  document.documentElement.dataset.theme = resolvedTheme;

  document.documentElement.dataset.themePreference = preference;

  document.documentElement.style.colorScheme = resolvedTheme;
}