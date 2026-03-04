export default function HealthNoticeBar() {
  return (
    <div className="sticky top-0 z-20 border-b border-amber-300/20 bg-gradient-to-r from-amber-500/10 via-black/80 to-amber-500/10 backdrop-blur">
      <div className="mx-auto w-full max-w-5xl px-4 py-2 text-center text-[11px] leading-relaxed text-amber-100/80 sm:text-xs">
        Alkol sağlığa zararlıdır. Sorumlu tüketin. 18 yaş altındakilara alkol satışı ve sunumu yasaktır.
      </div>
    </div>
  );
}
