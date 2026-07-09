import { useEffect, useState } from "react";

export type FontSizeKey = "sm" | "md" | "lg" | "xl";

export const FONT_SIZE_PX: Record<FontSizeKey, number> = {
  sm: 15,
  md: 17,
  lg: 19,
  xl: 22,
};

export const FONT_SIZE_LABEL: Record<FontSizeKey, string> = {
  sm: "Pequeno",
  md: "Padrão",
  lg: "Grande",
  xl: "Extra grande",
};

const KEY = "edufinance.fontSize";

export function getStoredFontSize(): FontSizeKey {
  if (typeof window === "undefined") return "md";
  const v = window.localStorage.getItem(KEY);
  if (v === "sm" || v === "md" || v === "lg" || v === "xl") return v;
  return "md";
}

export function applyFontSize(key: FontSizeKey) {
  if (typeof document === "undefined") return;
  document.documentElement.style.fontSize = `${FONT_SIZE_PX[key]}px`;
}

/** Sincroniza a preferência global de fonte com o <html>. Deve ser chamado uma vez no root. */
export function useApplyFontSize() {
  useEffect(() => {
    applyFontSize(getStoredFontSize());
  }, []);
}

/** Estado + setter para a UI de configuração. */
export function useFontSize() {
  const [size, setSize] = useState<FontSizeKey>(() => getStoredFontSize());

  function update(next: FontSizeKey) {
    setSize(next);
    if (typeof window !== "undefined") window.localStorage.setItem(KEY, next);
    applyFontSize(next);
  }

  return { size, setSize: update };
}
