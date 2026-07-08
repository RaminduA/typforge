export type ThemePreference = "system" | "light" | "dark";

export function applyTheme(theme: ThemePreference) {
  const root = document.documentElement;

  if (theme === "system") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = prefersDark ? "dark" : "light";
    return;
  }

  root.dataset.theme = theme;
}