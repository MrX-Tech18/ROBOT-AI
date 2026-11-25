import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import type { Server } from 'node:http';
import {
  createDemoSession,
  getDemoSession,
} from './demoSession.ts';

test('demo session tokens are signed and reject modified content', () => {
  const previousSecret = process.env.DEMO_SESSION_SECRET;
  process.env.DEMO_SESSION_SECRET = 'x'.repeat(48);
  try {
    const session = createDemoSession(`demo_${'a'.repeat(32)}`);
    assert.equal(getDemoSession(session.token)?.userId, `demo_${'a'.repeat(32)}`);

    const [payload, signature] = session.token.split('.');
    assert.equal(getDemoSession(`${payload}.${signature.slice(1)}x`), null);
    assert.equal(getDemoSession(`${payload}x.${signature}`), null);
  } finally {
    if (previousSecret === undefined) delete process.env.DEMO_SESSION_SECRET;
    else process.env.DEMO_SESSION_SECRET = previousSecret;
  }
});

test('demo sessions work without Firebase service credentials', async (t) => {
  const previous = {
    demoSecret: process.env.DEMO_SESSION_SECRET,
    serviceAccount: process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
    applicationCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    vercel: process.env.VERCEL,
  };
  process.env.DEMO_SESSION_SECRET = 'x'.repeat(48);
  delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  delete process.env.VERCEL;

  let server: Server | undefined;
  let origin = '';
  let cookie = '';
  t.after(async () => {
    if (server?.listening) {
      if (cookie) {
        await fetch(`${origin}/api/demo/session`, {
          method: 'DELETE',
          headers: { Cookie: cookie, Origin: origin },
        }).catch(() => undefined);
      }
      await new Promise<void>((resolve, reject) => {
        server!.close((error) => (error ? reject(error) : resolve()));
      });
    }
    if (previous.demoSecret === undefined) delete process.env.DEMO_SESSION_SECRET;
    else process.env.DEMO_SESSION_SECRET = previous.demoSecret;
    if (previous.serviceAccount === undefined) delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    else process.env.FIREBASE_SERVICE_ACCOUNT_JSON = previous.serviceAccount;
    if (previous.applicationCredentials === undefined) {
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    } else {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = previous.applicationCredentials;
    }
    if (previous.vercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = previous.vercel;
  });

  const { createApp } = await import('../server.ts');
  const app = await createApp({ serveFrontend: false });
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  origin = `http://127.0.0.1:${address.port}`;

  const created = await fetch(`${origin}/api/demo/session`, {
    method: 'POST',
    headers: { Origin: origin },
  });
  assert.equal(created.status, 201, await created.text());
  const setCookie = created.headers.get('set-cookie');
  assert.ok(setCookie);
  cookie = setCookie.split(';', 1)[0];

  const sessionResponse = await fetch(`${origin}/api/auth/me`, {
    headers: { Cookie: cookie },
  });
  assert.equal(sessionResponse.status, 200);
  const session = (await sessionResponse.json()) as {
    mode: string;
    user: { isDemo: boolean };
  };
  assert.equal(session.mode, 'demo');
  assert.equal(session.user.isDemo, true);

  const workspaceResponse = await fetch(`${origin}/api/workspace`, {
    headers: { Cookie: cookie },
  });
  assert.equal(workspaceResponse.status, 200);

  const accountResponse = await fetch(`${origin}/api/users/me`, {
    headers: { Cookie: cookie },
  });
  assert.equal(accountResponse.status, 401);
});
