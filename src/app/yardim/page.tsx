import Link from "next/link";

export default function HelpPage() {
  return (
    <main className="min-h-screen max-w-md mx-auto p-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Birader Yardım</h1>
        <Link href="/" className="text-xs underline opacity-80">
          Ana sayfa
        </Link>
      </div>

      <section className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold">0. Interaktif Tur</div>
          <Link href="/?tutorial=1" className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-xs">
            Turu Baslat
          </Link>
        </div>
        <div className="mt-2 text-sm opacity-85">
          Uygulama icinde adim adim sekme degistiren turu ac. Log, sosyal, harita, istatistik akisini tek tek gosterir.
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm font-semibold">1. Hızlı Log</div>
        <div className="mt-2 text-sm opacity-85">`Logla` adımlarını takip et: format, bira, detay, onay.</div>
      </section>

      <section className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm font-semibold">2. Geriye Dönük Toplu Log</div>
        <div className="mt-2 text-sm opacity-85">Tarih geçmişse adet girip listeye ekle. 10 adet üstü yok. Toplu ekleme için `Eminim` onayı gerekli.</div>
      </section>

      <section className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm font-semibold">3. Heatmap ve Gün Detayı</div>
        <div className="mt-2 text-sm opacity-85">Haritadan güne dokun, gün detayında bira ekleyebilir veya `Secimli ekrana git` ile wizard’a geçebilirsin.</div>
      </section>

      <section className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm font-semibold">4. Sosyal ve Öneri</div>
        <div className="mt-2 text-sm opacity-85">Sosyalde takip/akış/leaderboard var. Sağ alttaki `Oneri` butonuyla istek ve bug bildirebilirsin.</div>
      </section>
    </main>
  );
}
