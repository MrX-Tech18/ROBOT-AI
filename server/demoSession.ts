import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

const DEMO_SESSION_TTL_MS = 30 * 60 * 1000;
const LOCAL_DEMO_SECRET = randomBytes(32);
const DEMO_USER_ID_PATTERN = /^demo_[a-f0-9]{32}$/;

export interface DemoSession {
  userId: string;
  expiresAt: number;
  expired: boolean;
}

function getSigningSecret(): Buffer {
  const configuredSecret = process.env.DEMO_SESSION_SECRET;
  if (configuredSecret) {
    const secret = Buffer.from(configuredSecret, 'utf8');
    if (secret.length < 32) {
      throw new Error('DEMO_SESSION_SECRET must be at least 32 characters long.');
    }
    return createHash('sha256').update('robot-ai-demo-session:').update(secret).digest();
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson) {
    let serviceAccount: unknown;
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
    } catch {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON must contain valid JSON.');
    }
    if (
      typeof serviceAccount === 'object' &&
      serviceAccount !== null &&
      'private_key' in serviceAccount &&
      typeof serviceAccount.private_key === 'string' &&
      serviceAccount.private_key.length >= 32
    ) {
      return createHash('sha256')
        .update('robot-ai-demo-session:')
        .update(serviceAccount.private_key)
        .digest();
    }
  }

  if (process.env.VERCEL) {
    throw new Error('Set DEMO_SESSION_SECRET in Vercel to enable Demo Mode.');
  }
  return LOCAL_DEMO_SECRET;
}

function sign(payload: string): string {
  return createHmac('sha256', getSigningSecret()).update(payload).digest('base64url');
}

export function createDemoSession(userId: string): {
  token: string;
  expiresAt: number;
} {
  if (!DEMO_USER_ID_PATTERN.test(userId)) {
    throw new Error('Invalid demo session identity.');
  }
  const expiresAt = Date.now() + DEMO_SESSION_TTL_MS;
  const payload = Buffer.from(JSON.stringify({ userId, expiresAt })).toString('base64url');
  return { token: `${payload}.${sign(payload)}`, expiresAt };
}

export function getDemoSession(token: string): DemoSession | null {
  const [payload, signature, ...rest] = token.split('.');
  if (!payload || !signature || rest.length > 0) return null;

  let actualSignature: Buffer;
  try {
    actualSignature = Buffer.from(signature, 'base64url');
    const expectedSignature = Buffer.from(sign(payload), 'base64url');
    if (
      actualSignature.length !== expectedSignature.length ||
      !timingSafeEqual(actualSignature, expectedSignature)
    ) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('userId' in parsed) ||
      typeof parsed.userId !== 'string' ||
      !DEMO_USER_ID_PATTERN.test(parsed.userId) ||
      !('expiresAt' in parsed) ||
      typeof parsed.expiresAt !== 'number' ||
      !Number.isSafeInteger(parsed.expiresAt)
    ) {
      return null;
    }
    return {
      userId: parsed.userId,
      expiresAt: parsed.expiresAt,
      expired: parsed.expiresAt <= Date.now(),
    };
  } catch {
    return null;
  }
}

export function deleteDemoSession(token: string): string | null {
  return getDemoSession(token)?.userId ?? null;
}
