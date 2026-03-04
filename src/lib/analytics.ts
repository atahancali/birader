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
const ERROR_TEXT_MAX = 280;

const queue: AnalyticsRow[] = [];
let flushTimer: number | null = null;
let flushing = false;
let lifecycleBound = false;
let errorTrackingBound = false;
let errorTrackingUserId: string | null = null;

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

function clipText(input: unknown, max = ERROR_TEXT_MAX) {
  const raw = String(input ?? "").trim();
  if (!raw) return "";
  return raw.length > max ? `${raw.slice(0, max - 1)}…` : raw;
}

function reasonToText(reason: unknown) {
  if (reason instanceof Error) {
    return clipText(reason.message || reason.name || "error");
  }
  if (typeof reason === "string") return clipText(reason);
  try {
    return clipText(JSON.stringify(reason));
  } catch {
    return "unknown";
  }
}

export function bindGlobalErrorTracking(userId?: string | null) {
  if (typeof window === "undefined") return;
  errorTrackingUserId = userId ?? null;
  if (errorTrackingBound) return;
  errorTrackingBound = true;

  window.addEventListener("error", (event) => {
    try {
      trackEvent({
        eventName: "client_error",
        userId: errorTrackingUserId,
        props: {
          type: "error",
          message: clipText(event.message || "window_error"),
          file: clipText(event.filename || ""),
          line: Number.isFinite(event.lineno) ? Number(event.lineno) : 0,
          column: Number.isFinite(event.colno) ? Number(event.colno) : 0,
        },
      });
    } catch {
      // no-op
    }
  });

  window.addEventListener("unhandledrejection", (event) => {
    try {
      trackEvent({
        eventName: "client_error",
        userId: errorTrackingUserId,
        props: {
          type: "unhandledrejection",
          message: reasonToText(event.reason),
        },
      });
    } catch {
      // no-op
    }
  });
}
