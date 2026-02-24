export function favoriteBeerName(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  const parts = trimmed
    .split("—")
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length >= 2) return `${parts[0]} — ${parts[1]}`;
  return trimmed;
}

