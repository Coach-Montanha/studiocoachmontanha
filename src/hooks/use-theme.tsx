import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";

export type Theme = "light" | "dark";
export type VisualTheme = "padrao" | "pulse" | "midnight";

export interface ThemeContextType {
  theme: Theme;
  setTheme: React.Dispatch<React.SetStateAction<Theme>>;
  toggleTheme: () => void;
  visualTheme: VisualTheme;
  changeVisualTheme: (t: VisualTheme) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    const stored = localStorage.getItem("edufinance.theme");
    if (stored === "dark" || stored === "light") return stored;
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
  } catch {
    /* ignore storage errors */
  }
  return "light";
}

function getInitialVisualTheme(): VisualTheme {
  if (typeof window === "undefined") return "midnight";
  try {
    const stored = localStorage.getItem("edufinance.visualTheme");
    if (stored === "pulse" || stored === "midnight") {
      return stored;
    }
    // Qualquer dispositivo sem tema ou com o antigo "padrao" adota "midnight" como padrão unificado
    return "midnight";
  } catch {
    /* ignore storage errors */
  }
  return "midnight";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [visualTheme, setVisualTheme] = useState<VisualTheme>(getInitialVisualTheme);

  // Garante que o padrão midnight seja salvo se ainda não houver preferência ou se for o antigo padrao
  useEffect(() => {
    try {
      const stored = localStorage.getItem("edufinance.visualTheme");
      if (!stored || stored === "padrao") {
        localStorage.setItem("edufinance.visualTheme", "midnight");
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Sincroniza classe dark e persistência no localStorage
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    try {
      localStorage.setItem("edufinance.theme", theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  // Sincroniza atributo data-tema e persistência no localStorage
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-tema", visualTheme);
    try {
      localStorage.setItem("edufinance.visualTheme", visualTheme);
    } catch {
      /* ignore */
    }
  }, [visualTheme]);

  // Sincronização entre abas
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === "edufinance.theme" && (e.newValue === "light" || e.newValue === "dark")) {
        setTheme(e.newValue);
      }
      if (
        e.key === "edufinance.visualTheme" &&
        (e.newValue === "padrao" || e.newValue === "pulse" || e.newValue === "midnight")
      ) {
        setVisualTheme(e.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === "light" ? "dark" : "light"));
  }, []);

  const changeVisualTheme = useCallback((nextTheme: VisualTheme) => {
    setVisualTheme(nextTheme);
  }, []);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme,
      visualTheme,
      changeVisualTheme,
    }),
    [theme, toggleTheme, visualTheme, changeVisualTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    // Fallback gracioso caso chamado fora do provider
    const currentTheme = getInitialTheme();
    const currentVisualTheme = getInitialVisualTheme();
    return {
      theme: currentTheme,
      setTheme: () => {},
      toggleTheme: () => {
        if (typeof window !== "undefined") {
          const isDark = document.documentElement.classList.contains("dark");
          const next = isDark ? "light" : "dark";
          if (next === "dark") {
            document.documentElement.classList.add("dark");
          } else {
            document.documentElement.classList.remove("dark");
          }
          try {
            localStorage.setItem("edufinance.theme", next);
          } catch {
            /* ignore */
          }
        }
      },
      visualTheme: currentVisualTheme,
      changeVisualTheme: () => {},
    };
  }
  return context;
}
