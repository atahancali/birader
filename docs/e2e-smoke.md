# E2E Smoke (N1-01)

Bu smoke seti `auth + log + profile + social` akisini tek testte dogrular.

## Gerekli env

```bash
E2E_USER_EMAIL=...
E2E_USER_PASSWORD=...
```

Opsiyonel:

```bash
E2E_BASE_URL=https://staging-or-prod-url
```

- `E2E_BASE_URL` yoksa test yerelde `http://127.0.0.1:3100` uzerinde `npm run dev -- --port 3100` ile otomatik ayaga kalkar.

## Komutlar

```bash
npm run test:e2e
npm run test:e2e:headed
```
