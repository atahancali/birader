import { supabase } from "@/lib/supabase";

type AnalyticsProps = Record<string, string | number | boolean | null | undefined>;

type TrackEventInput = {
  eventName: string;
  userId?: string | null;
  props?: AnalyticsProps;
};

function readCookie(name: string) {
  if (typeof document === "undefined") return "";
  const token = `${encodeURIComponent(name)}=`;
  const parts = document.cookie.split(";").map((p) => p.trim());
  for (const p of parts) {
    if (!p.startsWith(token)) continue;
    return decodeURIComponent(p.slice(token.length));
  }
  return "";
}

function hasAnalyticsConsent() {
  const consent = readCookie("cookie_consent");
  if (consent === "accepted") return true;
  if (consent === "custom") return readCookie("cookie_analytics") === "1";
  return false;
}

export function trackEvent({ eventName, userId, props }: TrackEventInput) {
  if (!hasAnalyticsConsent()) return;

  const payload = {
    event_name: eventName,
    user_id: userId ?? null,
    props: props ?? {},
  };

  void supabase.from("analytics_events").insert(payload).then(({ error }) => {
    if (error) {
      console.warn("analytics insert skipped:", error.message);
    }
  });
}
