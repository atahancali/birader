import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="mt-8 border-t border-white/10 bg-black/40 px-4 py-4 text-xs text-white/65">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-2">
        <div className="opacity-75">
          Alkol sağlığa zararlıdır. Sorumlu tüketin. 18 yaş altındakilara alkol satışı ve sunumu yasaktır.
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/privacy" className="underline underline-offset-2">
            Gizlilik Politikası
          </Link>
          <Link href="/terms" className="underline underline-offset-2">
            Kullanım Koşulları
          </Link>
          <a href="mailto:biraderdestek@gmail.com" className="underline underline-offset-2">
            biraderdestek@gmail.com
          </a>
        </div>
        <div className="opacity-60">© [COMPANY_NAME]</div>
      </div>
    </footer>
  );
}
