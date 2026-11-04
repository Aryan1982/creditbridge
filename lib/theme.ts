export const THEME_KEY = "creditbridge.theme";
export type Theme = "light" | "dark";

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function setTheme(t: Theme): void {
  document.documentElement.dataset.theme = t;
  try {
    localStorage.setItem(THEME_KEY, t);
  } catch {
    /* storage disabled: theme lasts for this page only */
  }
  window.dispatchEvent(new CustomEvent("themechange", { detail: t }));
}
