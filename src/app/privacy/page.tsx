import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Gizlilik Politikası | Birader",
  robots: {
    index: false,
    follow: false,
  },
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen max-w-3xl mx-auto p-4">
      <section className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6">
        <h1 className="text-2xl font-semibold text-amber-200">Gizlilik Politikası</h1>
        <p className="mt-2 text-sm opacity-80">
          Bu metin, Birader uygulamasında kişisel verilerin KVKK ve GDPR kapsamında nasıl işlendiğini açıklar.
        </p>

        <div className="mt-5 space-y-4 text-sm leading-6">
          <section>
            <h2 className="font-semibold text-amber-100">1. Veri Sorumlusu</h2>
            <p>
              Veri sorumlusu: <strong>[COMPANY_NAME]</strong>
              <br />
              İletişim e-postası: <strong>biraderdestek@gmail.com</strong>
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-amber-100">2. Toplanan Veriler</h2>
            <p>
              Uygulama kapsamında e-posta adresi, kullanıcı hesabı bilgileri, bira log kayıtları, puanlar, konum metni,
              zaman damgaları ve kullanım sırasında oluşturulan teknik kayıtlar toplanabilir.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-amber-100">3. Verilerin İşlenme Amacı</h2>
            <p>
              Veriler, hesabın oluşturulması ve yönetilmesi, kişisel takip deneyiminin sağlanması, güvenlik kontrollerinin
              yürütülmesi, yasal yükümlülüklerin yerine getirilmesi ve hizmet kalitesinin iyileştirilmesi amaçlarıyla işlenir.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-amber-100">4. Hukuki Dayanak (KVKK md. 5 ve md. 6)</h2>
            <p>
              Kişisel veriler; açık rıza, sözleşmenin kurulması/ifası, veri sorumlusunun hukuki yükümlülüğü ve meşru menfaat
              hukuki sebeplerine dayanılarak işlenir. Özel nitelikli veri işlenmesi durumunda KVKK md. 6 hükümleri uygulanır.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-amber-100">5. Verilerin Saklanma Süresi</h2>
            <p>
              Veriler, ilgili mevzuatta öngörülen süreler ve işleme amacı için gerekli olan makul süre boyunca saklanır; süre
              sonunda silinir, yok edilir veya anonim hale getirilir.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-amber-100">6. Kullanıcı Hakları</h2>
            <p>
              Kullanıcılar; verilerine erişim, düzeltme, silme, işlemeye itiraz ve veri taşınabilirliği (uygulanabildiği ölçüde)
              haklarına sahiptir. Talepler için iletişim bölümündeki e-posta kullanılabilir.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-amber-100">7. Üçüncü Taraflarla Paylaşım</h2>
            <p>
              Veriler, yasal zorunluluklar veya hizmetin teknik olarak sunulması için gerekli altyapı sağlayıcıları dışında
              üçüncü kişilerle paylaşılmaz. Zorunlu paylaşımlar mevzuatla sınırlı şekilde yapılır.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-amber-100">8. İletişim</h2>
            <p>
              KVKK/GDPR kapsamındaki talepleriniz için:{" "}
              <a href="mailto:biraderdestek@gmail.com" className="underline">
                biraderdestek@gmail.com
              </a>
            </p>
          </section>
        </div>

        <Link href="/" className="mt-6 inline-block text-xs underline opacity-80">
          Ana sayfaya dön
        </Link>
      </section>
    </main>
  );
}
