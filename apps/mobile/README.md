# Birader Mobile (Expo MVP)

Bu klasor, mevcut Birader Supabase backend'ine baglanan ilk mobil MVP iskeletidir.

## 1) Kurulum

```bash
cd apps/mobile
cp .env.example .env
npm install
```

`.env` icine kendi Supabase bilgilerini yaz:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## 2) Calistirma

```bash
npm run start
```

Root'tan calistirmak icin:

```bash
npm run mobile:start
```

## MVP kapsam

- E-posta/sifre ile giris-kayit
- Oturum kaliciligi (AsyncStorage)
- Son 30 check-in listeleme
- Cikis

## Sonraki adimlar

- Webdeki adimli log ekranini mobilde birebir kurma
- Sosyal feed + yorum + bildirim
- Harita/heatmap ekranlari
