import { supabase } from "@/lib/supabase";

type AnalyticsProps = Record<string, string | number | boolean | null | undefined>;

type TrackEventInput = {
  eventName: string;
  userId?: string | null;
  props?: AnalyticsProps;
};

type AnalyticsRow = {
  event_name: string;
  user_id: string | null;
  props: AnalyticsProps;
};

const ANALYTICS_BATCH_SIZE = 20;
const ANALYTICS_FLUSH_MS = 1500;

const queue: AnalyticsRow[] = [];
let flushTimer: number | null = null;
let flushing = false;
let lifecycleBound = false;

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

function clearFlushTimer() {
  if (flushTimer === null) return;
  window.clearTimeout(flushTimer);
  flushTimer = null;
}

async function flushQueue() {
  if (flushing || !queue.length) return;
  if (!hasAnalyticsConsent()) {
    queue.length = 0;
    clearFlushTimer();
    return;
  }
  flushing = true;
  clearFlushTimer();
  const batch = queue.splice(0, ANALYTICS_BATCH_SIZE);
  const { error } = await supabase.from("analytics_events").insert(batch);
  if (error) {
    queue.unshift(...batch);
    console.warn("analytics batch insert skipped:", error.message);
  }
  flushing = false;
  if (queue.length) {
    flushTimer = window.setTimeout(() => {
      void flushQueue();
    }, ANALYTICS_FLUSH_MS);
  }
}

function ensureLifecycleHooks() {
  if (lifecycleBound || typeof window === "undefined") return;
  lifecycleBound = true;
  const flushSoon = () => {
    void flushQueue();
  };
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushSoon();
  });
  window.addEventListener("pagehide", flushSoon);
}

export function trackEvent({ eventName, userId, props }: TrackEventInput) {
  if (!hasAnalyticsConsent()) return;

  const payload: AnalyticsRow = {
    event_name: eventName,
    user_id: userId ?? null,
    props: props ?? {},
  };

  queue.push(payload);
  ensureLifecycleHooks();
  if (queue.length >= ANALYTICS_BATCH_SIZE) {
    void flushQueue();
    return;
  }
  if (flushTimer === null) {
    flushTimer = window.setTimeout(() => {
      void flushQueue();
    }, ANALYTICS_FLUSH_MS);
  }
}
