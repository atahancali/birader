import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Kullanım Koşulları | Birader",
  robots: {
    index: false,
    follow: false,
  },
};

export default function TermsPage() {
  return (
    <main className="min-h-screen max-w-3xl mx-auto p-4">
      <section className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6">
        <h1 className="text-2xl font-semibold text-amber-200">Kullanım Koşulları</h1>
        <p className="mt-2 text-sm opacity-80">
          Bu koşullar, Birader uygulamasının kullanımına ilişkin kuralları ve tarafların sorumluluklarını düzenler.
        </p>

        <div className="mt-5 space-y-4 text-sm leading-6">
          <section>
            <h2 className="font-semibold text-amber-100">1. Hizmetin Tanımı</h2>
            <p>Birader, kullanıcıların kişisel bira tüketim kayıtlarını tutmasına yardımcı olan bir takip uygulamasıdır.</p>
          </section>

          <section>
            <h2 className="font-semibold text-amber-100">2. Kullanım Koşulları</h2>
            <p>
              Uygulama yalnızca 18 yaş ve üzeri kullanıcılar içindir. Kullanıcı, hesabını hukuka uygun şekilde kullanmayı ve
              üçüncü kişilerin haklarını ihlal etmemeyi kabul eder.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-amber-100">3. Sorumluluk Reddi</h2>
            <p>Bu uygulama alkol tüketimini özendirmez; yalnızca kişisel takip aracıdır.</p>
          </section>

          <section>
            <h2 className="font-semibold text-amber-100">4. Sağlık Uyarısı</h2>
            <p>Aşırı alkol tüketimi sağlığa zararlıdır.</p>
          </section>

          <section>
            <h2 className="font-semibold text-amber-100">5. Fikri Mülkiyet</h2>
            <p>
              Uygulamanın yazılımı, tasarımı ve içerikleri ilgili mevzuat kapsamında korunur. "Birader" bu aşamada proje adı
              olarak kullanılmaktadır; tescilli marka beyanı değildir. İzinsiz kullanım yasaktır.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-amber-100">6. Hesap Silme ve Veri Silme Hakkı</h2>
            <p>
              Kullanıcı, hesap ayarlarından hesabını kalıcı olarak silebilir. Bu işlemle birlikte ilgili kişisel veriler silme
              politikasına uygun şekilde kaldırılır.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-amber-100">7. Değişiklik Hakkı</h2>
            <p>
              Hizmet sağlayıcı, mevzuat veya operasyonel ihtiyaçlar doğrultusunda bu koşullarda değişiklik yapma hakkını saklı
              tutar.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-amber-100">8. Uygulanacak Hukuk</h2>
            <p>Bu koşullar Türkiye Cumhuriyeti hukukuna tabidir.</p>
          </section>
        </div>

        <Link href="/" className="mt-6 inline-block text-xs underline opacity-80">
          Ana sayfaya dön
        </Link>
      </section>
    </main>
  );
}
