import LoadingPulse from "@/components/LoadingPulse";

export default function AppLoading() {
  return (
    <main className="min-h-screen max-w-5xl mx-auto p-4">
      <LoadingPulse
        labelTr="Birader yukleniyor..."
        labelEn="Birader is loading..."
        fullHeight
      />
    </main>
  );
}
