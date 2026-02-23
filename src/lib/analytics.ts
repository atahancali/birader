import { supabase } from "@/lib/supabase";

type AnalyticsProps = Record<string, string | number | boolean | null | undefined>;

type TrackEventInput = {
  eventName: string;
  userId?: string | null;
  props?: AnalyticsProps;
};

export function trackEvent({ eventName, userId, props }: TrackEventInput) {
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
