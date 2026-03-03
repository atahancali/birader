export type CookieOptions = {
  days?: number;
  path?: string;
  sameSite?: "Lax" | "Strict" | "None";
  secure?: boolean;
};

export function readCookie(name: string) {
  if (typeof document === "undefined") return "";
  const token = `${encodeURIComponent(name)}=`;
  const parts = document.cookie.split(";").map((p) => p.trim());
  for (const p of parts) {
    if (!p.startsWith(token)) continue;
    return decodeURIComponent(p.slice(token.length));
  }
  return "";
}

export function writeCookie(name: string, value: string, options: CookieOptions = {}) {
  if (typeof document === "undefined") return;
  const path = options.path || "/";
  const sameSite = options.sameSite || "Lax";
  const secure = options.secure ?? (typeof window !== "undefined" && window.location.protocol === "https:");
  let str = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; path=${path}; SameSite=${sameSite}`;
  if (secure) str += "; Secure";
  if (typeof options.days === "number" && Number.isFinite(options.days)) {
    const maxAge = Math.max(0, Math.floor(options.days * 24 * 60 * 60));
    str += `; Max-Age=${maxAge}`;
  }
  document.cookie = str;
}

export function deleteCookie(name: string, path = "/") {
  if (typeof document === "undefined") return;
  document.cookie = `${encodeURIComponent(name)}=; path=${path}; Max-Age=0; SameSite=Lax`;
}
