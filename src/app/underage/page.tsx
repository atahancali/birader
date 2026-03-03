import Link from "next/link";

export default function UnderagePage() {
  return (
    <main className="min-h-screen max-w-md mx-auto p-4">
      <section className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-4">
        <h1 className="text-xl font-semibold text-amber-200">Erişim Izni Yok</h1>
        <p className="mt-2 text-sm opacity-85">
          Bu içeriğe erişim yalnızca 18 yaş ve üzeri kullanıcılar için açıktır.
        </p>
        <Link href="/" className="mt-4 inline-block text-xs underline opacity-80">
          Ana sayfaya dön
        </Link>
      </section>
    </main>
  );
}
