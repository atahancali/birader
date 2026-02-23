const AUTH_DOMAINS = ["birader.app", "birader.local"] as const;

export function normalizeUsername(input: string) {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/["'`]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[._-]+|[._-]+$/g, "");
}

export function usernameToCandidateEmails(username: string) {
  const normalized = normalizeUsername(username);
  if (!normalized) return [] as string[];
  return AUTH_DOMAINS.map((d) => `${normalized}@${d}`);
}

export function usernameFromEmail(email?: string | null) {
  if (!email) return "";
  return normalizeUsername(email.split("@")[0] ?? "");
}
