import { useEffect, useState, useCallback } from "react";

export type Theme = "light" | "dark";
export type VisualTheme = "padrao" | "pulse";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "light";
    return (localStorage.getItem("edufinance.theme") as Theme) ?? "light";
  });

  const [visualTheme, setVisualTheme] = useState<VisualTheme>(() => {
    if (typeof window === "undefined") return "padrao";
    return (localStorage.getItem("edufinance.visualTheme") as VisualTheme) ?? "padrao";
  });

  useEffect(() => {
    const root = document.documentElement;
    
    // Light/Dark mode
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("edufinance.theme", theme);

    // Visual Theme (Pulse, etc)
    root.setAttribute("data-tema", visualTheme);
    localStorage.setItem("edufinance.visualTheme", visualTheme);
  }, [theme, visualTheme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === "light" ? "dark" : "light"));
  }, []);

  const changeVisualTheme = useCallback((t: VisualTheme) => {
    setVisualTheme(t);
  }, []);

  return { theme, toggleTheme, visualTheme, changeVisualTheme };
}
