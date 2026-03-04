import { supabase } from "@/lib/supabase";

type JsonScalar = string | number | boolean | null;
type JsonValue = JsonScalar | JsonValue[] | { [key: string]: JsonValue };

type PerfEventInput = {
  userId?: string | null;
  metricKey: string;
  durationMs?: number | null;
  rowCount?: number | null;
  ok?: boolean;
  source?: string;
  context?: Record<string, JsonValue | undefined>;
};

type PerfRow = {
  user_id: string | null;
  metric_key: string;
  duration_ms: number | null;
  row_count: number | null;
  ok: boolean;
  source: string;
  context: Record<string, JsonValue>;
};

const PERF_BATCH_SIZE = 20;
const PERF_FLUSH_MS = 2000;

const queue: PerfRow[] = [];
let flushTimer: number | null = null;
let flushing = false;
let perfDisabled = false;

function clearFlushTimer() {
  if (flushTimer === null) return;
  window.clearTimeout(flushTimer);
  flushTimer = null;
}

function safeContext(input?: Record<string, JsonValue | undefined>) {
  if (!input) return {};
  const out: Record<string, JsonValue> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    out[key] = value;
  }
  return out;
}

async function flushQueue() {
  if (perfDisabled || flushing || !queue.length) return;
  flushing = true;
  clearFlushTimer();
  const batch = queue.splice(0, PERF_BATCH_SIZE);
  const { error } = await supabase.from("social_perf_events").insert(batch);
  if (error) {
    const lower = String(error.message || "").toLowerCase();
    if (lower.includes("does not exist") || lower.includes("relation")) {
      perfDisabled = true;
      queue.length = 0;
    } else {
      queue.unshift(...batch);
    }
  }
  flushing = false;
  if (queue.length && !perfDisabled) {
    flushTimer = window.setTimeout(() => {
      void flushQueue();
    }, PERF_FLUSH_MS);
  }
}

export function trackPerfEvent({
  userId,
  metricKey,
  durationMs = null,
  rowCount = null,
  ok = true,
  source = "web",
  context,
}: PerfEventInput) {
  if (perfDisabled || typeof window === "undefined") return;
  const duration = durationMs === null || durationMs === undefined ? null : Math.max(0, Math.round(durationMs));
  const rows = rowCount === null || rowCount === undefined ? null : Math.max(0, Math.round(rowCount));
  queue.push({
    user_id: userId ?? null,
    metric_key: metricKey,
    duration_ms: duration,
    row_count: rows,
    ok: Boolean(ok),
    source,
    context: safeContext(context),
  });
  if (queue.length >= PERF_BATCH_SIZE) {
    void flushQueue();
    return;
  }
  if (flushTimer === null) {
    flushTimer = window.setTimeout(() => {
      void flushQueue();
    }, PERF_FLUSH_MS);
  }
}

export async function measurePerf<T>(
  metricKey: string,
  run: () => Promise<T>,
  payload: Omit<PerfEventInput, "metricKey" | "durationMs" | "ok"> = {}
) {
  const started = typeof performance !== "undefined" ? performance.now() : Date.now();
  try {
    const data = await run();
    const ended = typeof performance !== "undefined" ? performance.now() : Date.now();
    trackPerfEvent({
      ...payload,
      metricKey,
      durationMs: ended - started,
      ok: true,
    });
    return data;
  } catch (error: any) {
    const ended = typeof performance !== "undefined" ? performance.now() : Date.now();
    trackPerfEvent({
      ...payload,
      metricKey,
      durationMs: ended - started,
      ok: false,
      context: {
        ...(payload.context || {}),
        error: String(error?.message || "unknown"),
      },
    });
    throw error;
  }
}
