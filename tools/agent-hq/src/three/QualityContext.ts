import { createContext, useContext } from "react";

export type Quality = "high" | "low";

export interface QualitySettings {
  quality: Quality;
  /** prefers-reduced-motion: agents still walk, but camera moves and effects stay minimal. */
  reduced: boolean;
}

export const QualityContext = createContext<QualitySettings>({ quality: "high", reduced: false });

export function useQuality(): QualitySettings {
  return useContext(QualityContext);
}

const STORAGE_KEY = "agent-hq-quality";

export function loadQuality(): Quality | null {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === "high" || v === "low" ? v : null;
  } catch {
    return null;
  }
}

export function saveQuality(q: Quality): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, q);
  } catch {
    // storage may be unavailable; the setting then lasts for the session only
  }
}
