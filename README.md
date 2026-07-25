# Lawn Boss NJ

Static marketing site for **Lawn Boss NJ** — landscaping and hardscaping in Central New Jersey.

## Contact

- **Phone:** (908) 415-1635
- **Email:** sales@lawnbossnj.com
- **Service area:** Middlesex · Monmouth · Ocean counties

## Stack

- Site root: **`docs/`** (GitHub Pages–ready)
- Entry: `docs/index.html` + `docs/index.js`
- App shell: `docs/modules/app.js`
- User UI: `docs/components/user/home-page/`
- Framework: `docs/components/core/` + `docs/components/global/` (UWC)
- Static server: `server/index.js` (serves `docs/`, SPA fallback to `index.html`)

## Develop

```bash
pnpm start
# or
pnpm dev
```

Default: `http://localhost:5180/`

## Deploy

Publish the `docs/` folder (GitHub Pages from `/docs` on the default branch).
