export type Variant = "A" | "B";

export function getExperimentVariant(experimentKey: string, ratio = 0.5): Variant {
  if (typeof window === "undefined") return "A";
  const storageKey = `birader:exp:${experimentKey}`;
  const existing = window.localStorage.getItem(storageKey);
  if (existing === "A" || existing === "B") return existing;
  const next: Variant = Math.random() < ratio ? "A" : "B";
  window.localStorage.setItem(storageKey, next);
  return next;
}
