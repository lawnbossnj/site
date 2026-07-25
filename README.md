# Lawn Boss NJ

Static marketing site for **Lawn Boss NJ** — landscaping and hardscaping in Central New Jersey.

## Contact

- **Phone:** (908) 415-1635
- **Email:** sales@lawnbossnj.com
- **Service area:** Middlesex · Monmouth · Ocean counties

## Stack

- UWC (`WebComponent`) SPA under `centralSite/client/`
- Entry: `centralSite/client/index.html` + `index.js`
- App shell: `centralSite/client/modules/app.js`
- User UI: `centralSite/client/components/user/home-page/` only
- Static server: `centralSite/server/index.js` (no API / database)
- Framework: `components/core/` + `components/global/` (UWC library — do not strip)
- Assets: `centralSite/client/images/`, hero video at client root

## Develop

```bash
pnpm start
# or
pnpm dev
```

Serves `centralSite/client/` with SPA fallback to `index.html`.

For GitHub Pages, publish `centralSite/client/` with SPA fallback to `index.html`.
