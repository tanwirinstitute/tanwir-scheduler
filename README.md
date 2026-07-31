# Tanwir Scheduler

TypeScript/Express service on Render.com that runs Tanwir Institute's scheduled backend jobs against Firestore.

## Status

| Pipeline | State | Trigger |
|---|---|---|
| Zakat scholarship consent | Active | `runScheduledTask` (cron / `POST /trigger-sync`) |
| Squarespace course sync | Disabled, mid-rewrite | — (models/services retained as reference) |

**Zakat scholarship consent**: finds `scholarships` documents that are unapproved (no `status` field) and have `zakat == "yes"`, emails each applicant a one-time consent link via the Tanwir mail API, and records `consented` + `consentedAt` when they click it.

## Requirements

- Node.js ≥ 18
- Firebase project with Firestore + a service account
- Tanwir mail API bearer token (`ZAKAT_MAIL_API_TOKEN`)

## Setup

```bash
npm install
cp .env.example .env   # fill in the values below
npm run dev             # runs index.ts directly via tsx, no build step
```

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Run `index.ts` directly with `tsx watch` (hot reload, no build) |
| `npm run build` | Type-check and compile `**/*.ts` → `dist/` |
| `npm start` | Build, then run `dist/index.js` (used by Render) |
| `npm run sync` | Build, then run `dist/scripts/runSync.js` once and exit (used by the cron job) |
| `npm run lint` | ESLint |

## Environment variables

| Variable | Purpose | Default |
|---|---|---|
| `PORT` | HTTP port | `3000` |
| `LOG_LEVEL` | `ERROR` \| `WARN` \| `INFO` \| `DEBUG` | `INFO` |
| `FIREBASE_SERVICE_ACCOUNT_BASE64` | Base64-encoded service account JSON (preferred on Render) | — |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Raw service account JSON (local dev alternative) | — |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to service account file (local dev alternative) | — |
| `SCHOLARSHIPS_COLLECTION` | Firestore collection scanned for zakat consent | `scholarships` |
| `ZAKAT_MAIL_API_URL` | Base URL of the mail API | `https://email.tanwir.institute` |
| `ZAKAT_MAIL_API_TOKEN` | Bearer token for the mail API | — (required) |
| `APP_BASE_URL` | Public URL of this service; consent links are `<APP_BASE_URL>/consent/<docId>` | — (required) |
| `CRON_SCHEDULE` | Reference schedule for the external cron trigger | `0 2 * * *` |
| `SQUARESPACE_API_KEY` / `SQUARESPACE_API_URL` | Only used by the disabled course-sync pipeline | — |
| `FIRESTORE_COLLECTION` | Only used by the disabled course-sync pipeline | `authorizedUsers` |

Set exactly one of the three Firebase credential options.

## API

| Endpoint | Description |
|---|---|
| `GET /` | Health check |
| `POST /trigger-sync` | Manually run the scheduled task |
| `GET /consent/:docId` | Consent link target from the applicant email; idempotent |

## Deployment (Render)

- **Build Command**: `npm install`
- **Start Command**: `npm start` (compiles via a `prestart` hook, then runs `dist/index.js`)
- A separate Render Cron Job runs `npm run sync` on `CRON_SCHEDULE` to trigger the pipeline outside of HTTP.
- Add every variable from `.env.example` to the Render service's environment.

## Project structure

```
index.ts                 Express app, health check, /consent route, runScheduledTask
scripts/runSync.ts        Cron entry point — calls runScheduledTask once and exits
services/
  scholarships.ts          Firestore queries/writes for the consent pipeline
  zakatMailer.ts            Mail API client
  firebase.ts                Firebase Admin init, shared getDb(), legacy saveToFirestore
  squarespace.ts            Legacy Squarespace client (disabled pipeline)
  dataProcessor.ts          Legacy order → course model processing (disabled pipeline)
models/                   Legacy course-model mappers (disabled pipeline)
types/                    Shared TypeScript interfaces
utils/logger.ts           Leveled console logger
```

## License

MIT
