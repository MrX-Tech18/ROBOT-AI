# Deploying to Vercel

Import the repository into Vercel and use the default project root. The included
`vercel.json` builds the Vite frontend into `dist`, serves it as a single-page
app, and rewrites `/api/*` requests to the Express function in `api/index.ts`.
No separate Vercel output or build configuration is needed.
The function explicitly includes `better-sqlite3`'s Linux native prebuilds,
which are resolved dynamically at runtime.

Configure these Vercel environment variables for Production (and Preview if
needed):

- `GEMINI_API_KEY` — server-side Gemini access for AI features.
- `APP_URL` — canonical deployment origin, such as `https://your-project.vercel.app`.
- `FIREBASE_SERVICE_ACCOUNT_JSON` — server-only service-account JSON for the
  same Firebase project as `firebase-applet-config.json`.
- `DEMO_SESSION_SECRET` — recommended 32+ character secret for signing demo
  session cookies. Generate one with `openssl rand -base64 32`. If omitted,
  the server derives the signing key from the Firebase service-account private
  key; without either key, Demo Mode returns a configuration error.

The Firebase client config is public. In Firebase, enable Email/Password and
Google sign-in, add the Vercel hostname to Authentication's authorized
domains, and create a Cloud Firestore database in Native mode. Grant the
service account Firebase Authentication Admin and Cloud Firestore access.
Never put service-account data in frontend code or a `VITE_` variable. The
backend verifies ID tokens and derives each account UID from the verified
token.

Optional live integrations use `MICROSOFT_CLIENT_ID`,
`MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID`, `SLACK_CLIENT_ID`,
`SLACK_CLIENT_SECRET`, and `INTEGRATIONS_ENCRYPTION_KEY`. For durable connector
records, configure `SQL_HOST`, `SQL_USER`, `SQL_PASSWORD`, and `SQL_DB_NAME`.

Actual account profiles are stored at `users/{uid}`, preferences at
`users/{uid}/settings/preferences`, and conversations under
`users/{uid}/chats/{channel}/messages/{messageId}`. Demo sessions use a
separate signed HttpOnly cookie with a 30-minute expiration and an in-memory
rate limit; they never create Firebase Auth users or Firestore user profiles.
Demo session creation does not require Firestore connectivity. Deploy the
ownership rules and TTL configuration with
`firebase deploy --only firestore:rules,firestore:indexes`. Firestore TTL
policies may take additional time to activate after deployment.

Email/password reset is sent by Firebase Authentication. Existing SQL-only
accounts can log in once with their old credentials to migrate into Firebase
Authentication; the SQL password is disabled after that migration. New
registration and Google sign-in use Firebase Authentication directly.

Basic Google sign-in requests only the user's identity. Gmail,
Calendar, and Drive permissions are requested later, when the user connects
that Workspace service. Those sensitive or restricted scopes still require
Google OAuth consent-screen testing access or Google's verification before
they can be used by the general public.

Workspace tasks, notifications, and integration metadata continue to use the
existing SQLite store. On Vercel it uses `/tmp/robot-ai`, which is writable but
temporary and isolated to a function instance; only account profiles,
preferences, saved chat history, and account rate-limit counters are durable
in Firestore. Demo sessions are signed, stateless cookies, and their workspace
data remains temporary. Connector data uses PostgreSQL when `SQL_HOST`,
`SQL_USER`, `SQL_PASSWORD`, and `SQL_DB_NAME` are configured, and otherwise
falls back to the same temporary SQLite file. Use a persistent database for
durable task and integration records.

The local `npm run dev` server and `npm run build` frontend build remain
unchanged.
