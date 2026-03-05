# Sprint N1 Hardening Checklist

Bu checklist N1 kapanisinda tek seferde kontrol icindir.

## N1-01 E2E smoke

1. Env ver:
```bash
export E2E_USER_EMAIL="..."
export E2E_USER_PASSWORD="..."
```
2. Test calistir:
```bash
npm run test:e2e
```
3. Beklenen:
- Auth karti / login gecisi
- Log wizard 1->2->3->4 akisi
- Header profil linki ile `/u/:username` acilisi
- Sosyal panel root render

## N1-02 RLS audit + fix

1. Audit:
```sql
-- scripts/sql/n1_rls_audit.sql
```
2. Sonuc:
- `n1_rls_audit_result = PASS` olmali.
3. FAIL ise fix:
```sql
-- scripts/sql/n1_rls_minimum_fixes.sql
```
4. Tekrar audit calistir.

## N1-03 Merkezi API error modeli

- Kod standardi: `code`, `message`, `hint`.
- Kaynak dosya: `/src/lib/apiError.ts`
- Uygulanan yerler:
  - Home (`/src/app/page.tsx`)
  - Social (`/src/components/SocialPanel.tsx`)
  - Public profile (`/src/components/PublicProfileView.tsx`)

## N1-04 Perf threshold alarm

- Sosyal admin kartinda kritik/uyari metrik sayisi gorunmeli.
- Esikler:
  - `critical`: `p95 >= 900ms` veya `fail >= 5%`
  - `warn`: `p95 >= 500ms` veya `fail >= 1%`
- En riskli metrik tek satirda raporlanmali.
