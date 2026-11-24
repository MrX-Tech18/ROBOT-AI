# Deploying to Vercel

Import the repository into Vercel and use the default project root. The included
`vercel.json` builds the Vite frontend into `dist`, serves it as a single-page
app, and rewrites `/api/*` requests to the Express function in `api/index.ts`.
No separate Vercel output or build configuration is needed.

Set `APP_URL` to the canonical deployment origin (for example,
`https://your-project.vercel.app`). The frontend uses the Firebase project in
`firebase-applet-config.json`; enable Google as a Firebase Authentication
provider and add the Vercel hostname to Firebase Authentication's authorized
domains.

The server's primary application data is stored in SQLite. On Vercel it uses
`/tmp/robot-ai`, which is writable but temporary and isolated to a function
instance; it is not suitable for durable user or session data. Connector data
uses PostgreSQL when `SQL_HOST`, `SQL_USER`, `SQL_PASSWORD`, and `SQL_DB_NAME`
are configured, and otherwise falls back to the same temporary SQLite file.
Use a persistent database for production data; this deployment wiring does not
migrate the primary application store from SQLite to PostgreSQL.

The local `npm run dev` server and `npm run build` frontend build remain
unchanged.
