# Birader Product Direction (Web + Mobile)

## 1) PC web / mobil web / native app ayri mi olmali?
- Kisa cevap: tam ayri kod tabani acmaya gerek yok.
- Oncelik: tek tasarim sistemi + responsive layout.
- Ayrisma:
  - `Desktop web`: daha genis dashboard, cok kolon.
  - `Mobile web`: tek kolon, hizli log odakli.
  - `Native app`: push, kamera, offline, store dagitimi.

## 2) App download embed yaklasimi
- Web header altinda `App Store` + `Google Play` CTA.
- PWA destekli cihazda `Ana ekrana ekle` butonu.
- Store URL'leri release zamani gercek linklerle guncellenmeli.

## 3) Performans odaklari
- Supabase/Vercel region uyumu.
- Buyuk listelerde cursor pagination.
- Agir panelleri lazy render.
- RLS sorgulari ve index gozden gecirme.

## 4) Yurtdisi erisim kontrolu
- `scripts/ops/check-global-access.sh` ile DNS + HTTP + TTFB olc.
- EU/US farkini karsilastir.
- Gerekirse WAF/rate-limit ayarlarini hafiflet.
