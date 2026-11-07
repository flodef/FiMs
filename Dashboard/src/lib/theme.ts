export type ThemePref = "system" | "dark" | "light";

const KEY = "fims-theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

export function themePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === "dark" || v === "light" ? v : "system";
  } catch {
    return "system";
  }
}

const isDark = (pref: ThemePref) => pref === "dark" || (pref === "system" && window.matchMedia(DARK_QUERY).matches);

export function applyTheme(pref: ThemePref = themePref()) {
  const dark = isDark(pref);
  document.documentElement.classList.toggle("dark", dark);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "#0b0f17" : "#f3f4f6");
}

export function setTheme(pref: ThemePref) {
  try {
    localStorage.setItem(KEY, pref);
  } catch {
    /* storage may be unavailable */
  }
  applyTheme(pref);
}

export function initTheme() {
  applyTheme();
  window.matchMedia(DARK_QUERY).addEventListener("change", () => {
    if (themePref() === "system") applyTheme();
  });
}
