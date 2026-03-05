# Birader Sonraki Asama Sprint Plani

Bu dosya, tamamlanan 50-madde backlog sonrasi yeni faz icin uygulanacak sprint planidir.

- Cadence: 1 sprint = 1 hafta
- Kural: Her sprintte en az 3 küçük parca commit/push
- Kural: Her parca icin `build` yesil olmadan push yok
- Durum alanlari: `todo` / `in-progress` / `done`

## Sprint N1 - Stabilizasyon ve Guvenlik (in-progress)
Hedef: Kritik akislarda regressionsiz calisan, izlenebilir temel.

- [ ] `N1-01` Auth + log + profile + social icin E2E smoke seti (in-progress)
- [ ] `N1-02` RLS policy audit checklist + eksik policy fixleri (todo)
- [ ] `N1-03` Merkezi API hata modeli (`code`, `message`, `hint`) standardi (todo)
- [ ] `N1-04` Hata/latency metrikleri icin admin kartlarinda threshold alarmi (todo)

Push parcasi onerisi:
1. Test altyapisi
2. Policy/DB fixleri
3. UI hata mesajlari + izleme

N1 notlari:
- 2026-03-05: `N1-01` icin Playwright smoke altyapisi + auth/log/profile/social smoke senaryosu eklendi (ilk pass).

## Sprint N2 - Performans (todo)
Hedef: Sosyal panel ve heatmap ilk acilisini hizlandirmak.

- [ ] `N2-01` Sosyal feed sorgulari icin cursor + lightweight projection (todo)
- [ ] `N2-02` Progressive hydration sınırlarını optimize etme (todo)
- [ ] `N2-03` Heatmap/stat component memoization turu (todo)
- [ ] `N2-04` DB index ve RPC plan revizyonu (`EXPLAIN ANALYZE`) (todo)

Push parcasi onerisi:
1. Query/RPC iyilestirmeleri
2. Frontend render optimizasyonlari
3. Perf raporu ve before/after olcumu

## Sprint N3 - Growth ve Retention (todo)
Hedef: Kullanici geri donus ve haftalik aktifligi artirmak.

- [ ] `N3-01` Haftalik recap strip + trend KPI (todo)
- [ ] `N3-02` Rozet ilerleme paneli (`hedefe kalan`) (todo)
- [ ] `N3-03` Inaktif kullanici win-back bildirimleri (3/7 gun) (todo)
- [ ] `N3-04` Social feed kalite filtreleri (gorev odakli) (todo)

Push parcasi onerisi:
1. Recap + rozet ilerleme
2. Bildirim kurallari
3. A/B metrik tagleme

## Sprint N4 - Sosyal Derinlesme (todo)
Hedef: Feed etkileşimini ve takip iliskisini kuvvetlendirmek.

- [ ] `N4-01` Yorum/like etkileşimlerinde optimistik UI + rollback (todo)
- [ ] `N4-02` Bildirim deep-link reliability turu (todo)
- [ ] `N4-03` Follow graph cache tablosu + refresh job (todo)
- [ ] `N4-04` Leaderboard segmentleri (all/followed/local) performans iyilestirme (todo)

## Sprint N5 - Operasyon ve Admin (todo)
Hedef: Uygulamayi veriyle yonetilebilir hale getirmek.

- [ ] `N5-01` Admin dashboard: DAU, logs, retention, fail rate tek bakis (todo)
- [ ] `N5-02` Gunluk KPI snapshot SQL gorevi (todo)
- [ ] `N5-03` Moderasyon queue SLA metrikleri (todo)
- [ ] `N5-04` Product suggestion pipeline (new -> in_progress -> done) raporu (todo)

## Sprint N6 - Mobil Hazirlik (todo)
Hedef: Web + mobile parity ve dagitima hazirlik.

- [ ] `N6-01` Responsive parity checklist (PC web / mobil web) (todo)
- [ ] `N6-02` PWA install + app deep-link test matrisi (todo)
- [ ] `N6-03` Shared design token cleanup (todo)
- [ ] `N6-04` Crash-free metric ve release checklist (todo)

## Uygulama Stratejisi

1. Sprint N1'i bitir, N2'ye gec.
2. Her sprint sonunda metrik ozetini bu dosyaya ekle.
3. Her sprintte en az bir SQL ve bir UI iyilestirmesi hedefle.
