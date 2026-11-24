import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.resolve(process.cwd(), '.data');
const KEY_FILE = path.join(DATA_DIR, 'integrations.key');
const KEY_MODE_FILE = path.join(DATA_DIR, 'integrations.key.mode');

let cachedKey: Buffer | null = null;

export function isEncryptionKeyFromEnv(): boolean {
  return Boolean(process.env.INTEGRATIONS_ENCRYPTION_KEY?.trim());
}

export function getEncryptionKeySource(): 'env' | 'custom_vault' | 'auto_vault' {
  if (isEncryptionKeyFromEnv()) return 'env';
  if (fs.existsSync(KEY_MODE_FILE)) {
    const mode = fs.readFileSync(KEY_MODE_FILE, 'utf8').trim();
    if (mode === 'custom') return 'custom_vault';
  }
  return 'auto_vault';
}

export function deriveKeyFromPassphrase(passphrase: string): Buffer {
  return crypto.createHash('sha256').update(passphrase.trim()).digest();
}

export function getMasterKey(): Buffer {
  const envKey = process.env.INTEGRATIONS_ENCRYPTION_KEY?.trim();
  if (envKey) {
    cachedKey = deriveKeyFromPassphrase(envKey);
    return cachedKey;
  }

  if (cachedKey) return cachedKey;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (fs.existsSync(KEY_FILE)) {
    const hex = fs.readFileSync(KEY_FILE, 'utf8').trim();
    if (/^[0-9a-f]{64}$/i.test(hex)) {
      cachedKey = Buffer.from(hex, 'hex');
      return cachedKey;
    }
  }

  const generated = crypto.randomBytes(32);
  fs.writeFileSync(KEY_FILE, generated.toString('hex'), { mode: 0o600 });
  cachedKey = generated;
  return cachedKey;
}

export function commitCustomVaultKey(passphrase: string): {
  oldKey: Buffer;
  newKey: Buffer;
} {
  if (isEncryptionKeyFromEnv()) {
    throw new Error(
      'INTEGRATIONS_ENCRYPTION_KEY is managed by server environment variables and cannot be overwritten from the UI.'
    );
  }
  const trimmed = passphrase.trim();
  if (trimmed.length < 16) {
    throw new Error('Encryption key passphrase must be at least 16 characters.');
  }

  const oldKey = Buffer.from(getMasterKey());
  const newKey = deriveKeyFromPassphrase(trimmed);

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(KEY_FILE, newKey.toString('hex'), { mode: 0o600 });
  fs.writeFileSync(KEY_MODE_FILE, 'custom', { mode: 0o600 });
  cachedKey = newKey;

  return { oldKey, newKey };
}

export function restoreVaultKeyBuffer(oldKey: Buffer): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(KEY_FILE, oldKey.toString('hex'), { mode: 0o600 });
  cachedKey = oldKey;
}

export interface SecretPayload {
  accessToken?: string;
  refreshToken?: string;
  botToken?: string;
  chatId?: string;
  scope?: string;
  tokenType?: string;
}

export interface OAuthAppCredentialsPayload {
  clientId: string;
  clientSecret: string;
}

export function encryptWithKey(payload: unknown, key: Buffer): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const json = JSON.stringify(payload);
  const encrypted = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptWithKey<T>(
  encoded: string | null | undefined,
  key: Buffer
): T | null {
  if (!encoded) return null;
  const parts = encoded.split(':');
  if (parts.length !== 3) return null;

  try {
    const [ivHex, tagHex, dataHex] = parts;
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(ivHex, 'hex')
    );
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataHex, 'hex')),
      decipher.final(),
    ]);
    return JSON.parse(decrypted.toString('utf8')) as T;
  } catch {
    return null;
  }
}

export function reencryptSecretString(
  encoded: string,
  oldKey: Buffer,
  newKey: Buffer
): string | null {
  const plain = decryptWithKey<unknown>(encoded, oldKey);
  if (plain === null) return null;
  return encryptWithKey(plain, newKey);
}

export function encryptSecretJson(payload: unknown): string {
  return encryptWithKey(payload, getMasterKey());
}

export function decryptSecretJson<T>(encoded: string | null | undefined): T | null {
  return decryptWithKey<T>(encoded, getMasterKey());
}

export function encryptSecretPayload(payload: SecretPayload): string {
  return encryptWithKey(payload, getMasterKey());
}

export function decryptSecretPayload(encoded: string | null | undefined): SecretPayload {
  return decryptWithKey<SecretPayload>(encoded, getMasterKey()) ?? {};
}
