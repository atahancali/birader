import type { AppLang } from "@/lib/i18n";

type LoadingPulseProps = {
  lang?: AppLang;
  labelTr?: string;
  labelEn?: string;
  compact?: boolean;
  inline?: boolean;
  fullHeight?: boolean;
  className?: string;
};

export default function LoadingPulse({
  lang = "tr",
  labelTr,
  labelEn,
  compact = false,
  inline = false,
  fullHeight = false,
  className = "",
}: LoadingPulseProps) {
  const label = lang === "en" ? labelEn || "Loading..." : labelTr || "Yukleniyor...";

  return (
    <div
      className={`${fullHeight ? "flex min-h-[40vh] items-center justify-center" : ""} ${className}`.trim()}
      role="status"
      aria-live="polite"
    >
      <div
        className={`${
          inline ? "flex items-center gap-2" : "flex items-center gap-3 rounded-xl border border-white/10 bg-black/25 px-3 py-2"
        }`}
      >
        <div className={`relative ${compact ? "h-5 w-5" : "h-8 w-8"} shrink-0`}>
          <div className="absolute inset-0 rounded-full border border-amber-300/25" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-amber-300 border-r-amber-500/60 animate-spin" />
          <div className="absolute inset-[5px] rounded-full bg-gradient-to-br from-amber-300/50 to-amber-700/40 animate-pulse" />
        </div>
        <div className={`${compact ? "text-xs" : "text-sm"} text-white/80`}>{label}</div>
        <div className="flex items-center gap-1" aria-hidden>
          <span className="h-1.5 w-1.5 rounded-full bg-amber-300/80 animate-pulse" />
          <span className="h-1.5 w-1.5 rounded-full bg-amber-300/60 animate-pulse [animation-delay:120ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-amber-300/40 animate-pulse [animation-delay:240ms]" />
        </div>
      </div>
    </div>
  );
}
