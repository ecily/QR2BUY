# qr2buy frontend

The operative project state is documented in [`../docs/QR2BUY_CONTEXT.md`](../docs/QR2BUY_CONTEXT.md). Read that file first before changing this application.

This directory contains the React/Vite frontend for the productive DE/EN landing page, session-isolated live demo, demo product journey and existing product/admin routes. API calls use same-origin `/api`. A Frontpage session controls the physical prototype only after explicit operator pairing; pairing secrets are never persisted.

Local checks:

```bash
npm test
npm run lint
npm run build
```

DigitalOcean builds this directory as the `qr2buy-frontend` Static Site and publishes `dist` with an SPA fallback. Deployment details and current verified test counts belong in the central context document.
