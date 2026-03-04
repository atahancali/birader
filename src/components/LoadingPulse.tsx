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
  const glassHeight = compact ? "h-8" : "h-10";
  const glassWidth = compact ? "w-6" : "w-7";
  const textSize = compact ? "text-xs" : "text-sm";

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
        <div className={`relative ${glassHeight} ${glassWidth} shrink-0`}>
          <div className="absolute inset-0 overflow-hidden rounded-b-[9px] rounded-t-[4px] border border-amber-100/45 bg-black/35">
            <div
              className="absolute inset-x-0 bottom-0 origin-bottom bg-gradient-to-t from-amber-700/95 via-amber-500/90 to-amber-300/85"
              style={{ height: "88%", animation: "beer-fill 2s ease-in-out infinite" }}
            />
            <div
              className="absolute inset-x-0 top-[8%] h-[20%] bg-gradient-to-b from-white/90 via-amber-50/75 to-white/30"
              style={{ animation: "beer-foam 2s ease-in-out infinite" }}
            />
            <div
              className="absolute inset-y-0 left-[-20%] w-1/2 bg-gradient-to-r from-transparent via-white/35 to-transparent"
              style={{ animation: "glass-shine 2.4s ease-in-out infinite" }}
            />
            <span
              className="absolute left-[24%] bottom-[20%] h-1 w-1 rounded-full bg-amber-100/80"
              style={{ animation: "bubble-rise 1.4s ease-out infinite" }}
            />
            <span
              className="absolute left-[56%] bottom-[16%] h-1 w-1 rounded-full bg-amber-50/75"
              style={{ animation: "bubble-rise 1.6s ease-out infinite 180ms" }}
            />
          </div>
          <div className="absolute right-[-4px] top-[20%] h-[45%] w-[7px] rounded-r-full border border-l-0 border-amber-100/35 bg-transparent" />
        </div>
        <div className={`${textSize} text-white/80`}>{label}</div>
        <div className="flex items-center gap-1" aria-hidden>
          <span className="h-1.5 w-1.5 rounded-full bg-amber-300/80 animate-pulse" />
          <span className="h-1.5 w-1.5 rounded-full bg-amber-300/60 animate-pulse [animation-delay:120ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-amber-300/40 animate-pulse [animation-delay:240ms]" />
        </div>
      </div>
    </div>
  );
}
