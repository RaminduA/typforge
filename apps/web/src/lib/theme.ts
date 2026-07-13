export type ThemePreference = "system" | "dark" | "light";
type ResolvedTheme = "dark" | "light";

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(preference: ThemePreference): void {
  const resolvedTheme: ResolvedTheme = preference === "system" ? getSystemTheme() : preference;

  document.documentElement.dataset.theme = resolvedTheme;

  document.documentElement.dataset.themePreference = preference;

  document.documentElement.style.colorScheme = resolvedTheme;
}