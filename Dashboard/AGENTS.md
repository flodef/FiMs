# FiMs Dashboard — agent notes

Mobile PWA replacing the Google Sheet "Strategy" dashboard. Bun + Vite + React 19 + TypeScript + TailwindCSS v3 (`tailwind.config.ts`). All icons from `@tabler/icons-react`. Serverless API routes live in `api/` (Vercel functions convention).

## Commands

- `bun test` — fixture tests reproducing the Strategy sheet cells
- `bun run typecheck` — tsc across app / node (api) / service-worker configs
- `bun run lint` — eslint
- `bun run build` — vite build + service worker (`dist/sw.js`) + manifest
- `bunx prettier --write .` — formatting (config in package.json)

## Versioning

V1 starts at `1.0.0` (shown in Settings from `package.json`). Every commit touching `Dashboard/` bumps the patch version (`1.0.0` → `1.0.1`…), done automatically by the local hook `.git/hooks/pre-commit` (skipped if the commit already changes `"version"` by hand — use that for minor/major bumps). The hook is not versioned: if it's missing, bump `package.json` manually in each commit.

## Fixture mode

`http://localhost:<port>/?fixture` loads `src/lib/__fixtures__/sheet-2026-11-06.json` instead of `/api/dashboard`. Gated on localhost hostname — unreachable in production. Used for screenshots/tests.

**Fixture test expectations come from the Google Sheet snapshot of 2026-11-06 — never edit them to make tests pass.** If a computed value differs, fix the code or report the mismatch.

## Environment variables (names only — see `.env.example`)

`GOOGLE_API_KEY`, `JUPITER_API_KEY`, `DASHBOARD_PASSWORD`, `AUTH_SECRET`, `CRON_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `DATABASE_URL` (Neon Postgres — optional locally; app degrades to no persistence). Schema: `db/schema.sql` (`kv` + `push_subscriptions` + `tracked_positions` tables). `tracked_positions` holds user-added positions (manual / jupiter wallet / kamino wallet) managed via `api/positions.ts` (auth required); they feed `Inputs.extraPositions` — displayed and added to €/day totals but never injected into the sheet formula rows.

Auth fails closed: without `DASHBOARD_PASSWORD` + `AUTH_SECRET`, `/api/login` returns 500 and all authed routes return 401.

## Scheduling

Alert checks run via `GET|POST /api/cron` (auth: `Authorization: Bearer ${CRON_SECRET}` or `x-cron-secret` header). Scheduling is via **cron-job.org every 10 min — never Vercel cron** (Hobby plan limit breaks deploys).
