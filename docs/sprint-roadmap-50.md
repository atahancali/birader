# Birader 50-Madde Yol Haritasi (Sprint Bazli)

Bu dosya 50 maddelik backlog'un sprintlere bolunmus ve isaretlenebilir halidir.

- Cadence: 1 sprint = 1 hafta
- Efor olcegi:
  - `XS`: 0.5 gun
  - `S`: 1 gun
  - `M`: 2-3 gun
  - `L`: 4-5 gun
- Durum:
  - `todo`
  - `in-progress`
  - `done`

## Sprint 1 (Hizli Kazanim + Olcum)
Hedef: performansi olcebilir, alarm verebilir ve cache/queue kismini stabilize edebilir hale gelmek.

- [x] `#01` Feed/Sosyal SQL sorgulari icin `EXPLAIN ANALYZE` turu (`M`, `done`)
- [x] `#05` Sosyal sorgular icin eksik index taramasi + index ekleme (`M`, `done`)
- [x] `#06` `social_perf_overview_24h` admin kartina tasima (`S`, `done`)
- [x] `#08` Hata orani esik asiminda admin uyarisi (`M`, `done`)
- [x] `#09` p95 yavas metrikleri kirmizi esik ile isaretleme (`S`, `done`)
- [x] `#10` Frontend error tracking (Sentry vb.) entegrasyonu (`M`, `done`)
- [x] `#11` API idempotency key standardi (`S`, `done`)
- [x] `#13` Log aksiyonlarina server-side rate limit (`M`, `done`)

## Sprint 2 (Check-in Guvenligi + Veri Butunlugu)
Hedef: log akisinda duplicate, veri tutarliligi ve geri alma senaryolarini kapatmak.

- [x] `#12` Coklu log akisi icin merkezi double-submit korumasi (`S`, `done`)
- [x] `#14` Eski tarih toplu giriste import-preview adimi (`M`, `done`)
- [x] `#15` Gelecek tarihe log atmayi tum entry pointlerde engelleme (`S`, `done`)
- [x] `#16` Log silme icin soft-delete + undo (`L`, `done`)
- [x] `#17` Bira katalog normalize (`beer_master`, `beer_alias`) (`L`, `done`)
- [x] `#18` Custom beer adlarini moderasyon kuyruguna dusurme (`M`, `done`)
- [x] `#19` Format/olcu/marka alanlarini normalize kolonlara tasima (`M`, `done`)
- [x] `#20` Favori bira 3 limitini DB trigger ile kesinlestirme (`S`, `done`)

## Sprint 3 (Heatmap/Grid + Geo UX)
Hedef: harita deneyimini temiz, hizli ve tutarli yapmak.

- [x] `#21` Favori degistirme modalini tek ortak komponent yapisi (`S`, `done`)
- [x] `#22` Heatmap hucre detayinda gunun tum loglarini tek sorgu (`M`, `done`)
- [x] `#23` Heatmap/Grid tercihini profilde kalici saklama (`S`, `done`)
- [x] `#24` Gelecek gunleri koyu + kilit ikonuyla gosterme (`S`, `done`)
- [x] `#25` Legend yerlesimini responsive breakpoint bazli duzenleme (`M`, `done`)
- [x] `#26` Cografi haritada il/ilce katman ayristirma (`L`, `done`)
- [x] `#27` Il/ilce seciminde typo toleransli oneriler (`M`, `done`)
- [x] `#28` Lokasyonsuz loglari geo analizden kesin dislama (`S`, `done`)

## Sprint 4 (Sosyal Motor + Leaderboard)
Hedef: sosyal akis/leaderboard bildirimi daha stabil ve tutarli hale getirmek.

- [x] `#02` Feed icin tam cursor pagination standardi (`M`, `done`)
- [x] `#03` Ilk ekran progressive hydration (`M`, `done`)
- [x] `#04` Realtime debounce/throttle stratejisini tek noktada toplama (`M`, `done`)
- [x] `#29` Leaderboard'da friends + me pinned tum periyotlar (`M`, `done`)
- [x] `#30` Leaderboard haftalik/aylik snapshot tablosu (`M`, `done`)
- [x] `#31` Haftanin nabzi ticker query optimizasyonu (`S`, `done`)
- [x] `#32` Sosyal akis all/followed filtrelerini user pref olarak saklama (`S`, `done`)
- [x] `#33` 24h/7d default stratejisi icin A/B test setup (`M`, `done`)

## Sprint 5 (Bildirim + Kimlik + Hesap)
Hedef: profile, takip ve bildirim akisini daha net ve guvenli hale getirmek.

- [x] `#34` Bildirim deep-link highlight animasyon duzeltme (`S`, `done`)
- [x] `#35` Takipci/takip edilen ekranini ayri sayfaya tasiyip arama ekleme (`M`, `done`)
- [x] `#36` "Seni takip ediyor" etiketini profil + listede ortaklastirma (`S`, `done`)
- [x] `#37` Kimlik modelini netlestirme (`login_username/display_name/handle`) (`L`, `done`)
- [x] `#38` Nick degisim gecmisini kullaniciya gorunur yapma (`S`, `done`)
- [ ] `#39` Avatar upload size/format kontrol + otomatik sikistirma (`M`, `todo`)
- [ ] `#40` Avatar moderasyon hatti (basit NSFW/abuse) (`M`, `todo`)

## Sprint 6 (Onboarding + I18N + Tasarim Tutarliligi)
Hedef: yeni kullanici akisinda tekrar eden sikintilari kapatmak ve metin/tasarim kalitesini arttirmak.

- [ ] `#41` Tutorial gosterimini DB flag ile kalici stabilize etme (`S`, `todo`)
- [ ] `#42` TR/EN key parity tamamlama (`M`, `todo`)
- [ ] `#43` EN metin QA turu (tasma/baglam/ton) (`S`, `todo`)
- [ ] `#44` Footer/legal/health metinlerini tum viewportlarda toparlama (`S`, `todo`)
- [ ] `#45` Rating UI'yi tamamen yarim/tam yildiz sistemine tasima (`M`, `todo`)
- [ ] `#46` Loading state'leri tek "beer pour" animasyon setinde birlestirme (`M`, `todo`)

## Sprint 7 (Platform + Dagitim)
Hedef: cihaz gecislerinde deneyimi ve ulasim kabiliyetini arttirmak.

- [ ] `#47` Mobil/Desktop/App icin breakpoint tabanli layout matrisi (`M`, `todo`)
- [ ] `#48` PWA install banner + app deep-link akisi (`M`, `todo`)
- [ ] `#07` `social_perf_daily` icin haftalik trend view (`S`, `todo`)

## Sprint 8 (Uyumluluk + Admin Operasyon)
Hedef: yasal/operasyonel takip ve yonetim ekranlarini tamamlamak.

- [ ] `#49` KVKK/GDPR veri disa aktarma endpoint'i (`L`, `todo`)
- [ ] `#50` Admin panelde growth + perf + moderation KPI tek ekran (`L`, `todo`)

## Yurutme Notu
- Aktif sprint: `Sprint 3`
- Aktif paket: `#39 + #40`
- Kural: Her madde bitince bu dosyada durum `done` olacak.
- Kural: Sprint disina tasan isler bir sonraki sprint'e re-planlanacak.
