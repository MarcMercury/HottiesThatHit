# HottiesThatHit

Tennis reservation and booking aggregator for the LA area. Live at [www.slapp.fun](https://www.slapp.fun).

## Local development

Secrets live in **Doppler** (`hottiesthathit / prd`) and auto-sync to Vercel. There is no `.env.local` to maintain.

### One-time setup

```bash
# Install Doppler CLI (already in Codespaces; see https://docs.doppler.com/docs/install-cli)
doppler login                  # opens browser; logs you into the Crateso workplace
doppler setup                  # picks `hottiesthathit / prd` automatically (see doppler.yaml)
```

### Running

```bash
npm run dev                    # next dev with secrets injected via `doppler run --`
npm run scrape:la-rec          # one-off scraper run with secrets
```

### Escape hatches

```bash
npm run env:pull               # writes a .env.local snapshot from Doppler (gitignored)
npm run dev:no-doppler         # runs without doppler (uses .env.local if present)
```

## Production

- Vercel project: `web` (HottiesThatHit).
- Doppler `hottiesthathit / prd` syncs to Vercel `Production` env via the Doppler→Vercel integration. Any change in Doppler triggers a Vercel redeploy automatically.
- Cron: `vercel.json` runs `/api/cron/scrape` every 15 min.
