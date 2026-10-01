# Catalog Sync console

The operations console for [Catalog Sync](../README.md): React + TypeScript on
Vite, talking to the Django Ninja API.

It lists every sync run with its created/updated/unchanged counts, drills into a
single run's event timeline (pages fetched, rate-limit backoffs, upserts,
errors), browses the synced catalog, and triggers a run on demand.

## Development

```bash
npm install
npm run dev
```

`vite.config.ts` proxies `/api` to `http://localhost:8000`, so run the Django
server alongside it. See the root README for the backend setup.

## Build

```bash
npm run build    # outputs to dist/, served as static output by Vercel
```
