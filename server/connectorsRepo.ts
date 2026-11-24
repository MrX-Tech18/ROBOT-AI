import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../src/db/index.ts';
import {
  employeeIntegrations,
  integrationActivityLogs,
  integrationConnections,
  integrationSecrets,
  oauthAppConfigs,
  users,
} from '../src/db/schema.ts';
import {
  decryptSecretJson,
  decryptSecretPayload,
  encryptSecretJson,
  encryptSecretPayload,
  getEncryptionKeySource,
  reencryptSecretString,
  type OAuthAppCredentialsPayload,
  type SecretPayload,
} from './crypto.ts';
import {
  evaluateTokenExpirationStatus,
  getServiceCatalogEntry,
  maskCredentialValue,
  normalizeMicrosoftTenantId,
  SERVICE_CATALOG,
} from '../src/shared/connectorLogic.ts';
import type {
  BotId,
  ConnectorActivityLogView,
  ConnectorAuthType,
  ConnectorConnectionStatus,
  ConnectorConnectionView,
  ConnectorDashboardPayload,
  ConnectorPermissionLevel,
  ConnectorServiceKey,
  CredentialSource,
  EmployeeConnectorPermissionView,
  OAuthAppCredentialStatus,
} from '../src/shared/types.ts';

const BOT_IDS: BotId[] = ['alex', 'emma', 'max', 'sophie', 'charlie'];

const DEV_BASE_URL =
  process.env.APP_URL?.replace(/\/$/, '') ||
  'https://ais-dev-c5lhwz3c6le3ai2hc4zlxd-1014530368246.asia-east1.run.app';
const SHARED_BASE_URL =
  'https://ais-pre-c5lhwz3c6le3ai2hc4zlxd-1014530368246.asia-east1.run.app';

let sqliteFallbackDb: Database.Database | null = null;
let pgUnavailableCached = false;

function getSqliteFallbackDb(): Database.Database {
  if (sqliteFallbackDb) return sqliteFallbackDb;
  const dataDir = path.resolve(process.cwd(), '.data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const dbPath = path.join(dataDir, 'robot_office.db');
  const instance = new Database(dbPath);
  instance.pragma('journal_mode = WAL');
  instance.pragma('foreign_keys = ON');
  instance.exec(`
    CREATE TABLE IF NOT EXISTS connector_users (
      uid TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS connector_connections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      service_name TEXT NOT NULL,
      display_name TEXT NOT NULL,
      connection_status TEXT NOT NULL DEFAULT 'SANDBOX MODE',
      authentication_type TEXT NOT NULL,
      permissions_json TEXT NOT NULL DEFAULT '[]',
      account_label TEXT NOT NULL DEFAULT '',
      sandbox_mode INTEGER NOT NULL DEFAULT 1,
      n8n_workflow_name TEXT NOT NULL,
      n8n_webhook_url TEXT NOT NULL DEFAULT '',
      n8n_enabled INTEGER NOT NULL DEFAULT 0,
      token_expires_at TEXT,
      last_sync TEXT,
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(user_id, service_name)
    );

    CREATE TABLE IF NOT EXISTS connector_secrets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      integration_id INTEGER NOT NULL UNIQUE,
      encrypted_payload TEXT NOT NULL,
      token_expires_at TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (integration_id) REFERENCES connector_connections(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS connector_employee_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id TEXT NOT NULL,
      integration_id INTEGER NOT NULL,
      permission_level TEXT NOT NULL DEFAULT 'read',
      enabled INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      UNIQUE(employee_id, integration_id),
      FOREIGN KEY (integration_id) REFERENCES connector_connections(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS connector_activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      integration_id INTEGER NOT NULL,
      employee_id TEXT,
      action TEXT NOT NULL,
      status TEXT NOT NULL,
      is_sandbox INTEGER NOT NULL DEFAULT 1,
      timestamp TEXT NOT NULL,
      error_message TEXT,
      FOREIGN KEY (integration_id) REFERENCES connector_connections(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS connector_oauth_app_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      client_id_hint TEXT NOT NULL,
      tenant_id TEXT,
      encrypted_credentials TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(user_id, provider)
    );
  `);
  sqliteFallbackDb = instance;
  return instance;
}

function isPgConnectionUnavailableError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: string; message?: string; cause?: unknown };
  const code = e.code || '';
  const msg = (e.message || '').toLowerCase();
  if (
    code === 'ENOENT' ||
    code === 'ECONNREFUSED' ||
    code === '42P01' ||
    msg.includes('enoent') ||
    msg.includes('connection terminated') ||
    msg.includes('does not exist')
  ) {
    return true;
  }
  if (e.cause) {
    return isPgConnectionUnavailableError(e.cause);
  }
  return false;
}

async function withPgFallback<T>(
  pgFn: () => Promise<T>,
  sqliteFn: (sqlite: Database.Database) => T
): Promise<T> {
  if (pgUnavailableCached) {
    return sqliteFn(getSqliteFallbackDb());
  }
  try {
    return await pgFn();
  } catch (err) {
    if (isPgConnectionUnavailableError(err)) {
      pgUnavailableCached = true;
      return sqliteFn(getSqliteFallbackDb());
    }
    throw err;
  }
}

export function getEnvOAuthCredentials(provider: 'outlook' | 'slack'): {
  clientId: string;
  clientSecret: string;
  tenantId?: string;
} | null {
  if (provider === 'outlook') {
    const clientId = process.env.MICROSOFT_CLIENT_ID?.trim() || '';
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET?.trim() || '';
    if (clientId && clientSecret) {
      return {
        clientId,
        clientSecret,
        tenantId: normalizeMicrosoftTenantId(process.env.MICROSOFT_TENANT_ID),
      };
    }
    return null;
  }
  const clientId = process.env.SLACK_CLIENT_ID?.trim() || '';
  const clientSecret = process.env.SLACK_CLIENT_SECRET?.trim() || '';
  if (clientId && clientSecret) {
    return { clientId, clientSecret };
  }
  return null;
}

export async function getDecryptedOAuthAppCredentials(
  userId: string,
  provider: 'outlook' | 'slack'
): Promise<{
  configured: boolean;
  source: CredentialSource;
  clientId: string;
  clientSecret: string;
  tenantId?: string;
}> {
  const envCreds = getEnvOAuthCredentials(provider);
  if (envCreds) {
    return {
      configured: true,
      source: 'env',
      clientId: envCreds.clientId,
      clientSecret: envCreds.clientSecret,
      tenantId: envCreds.tenantId,
    };
  }

  try {
    const row = await withPgFallback(
      async () => {
        const rows = await db
          .select()
          .from(oauthAppConfigs)
          .where(
            and(
              eq(oauthAppConfigs.userId, userId),
              eq(oauthAppConfigs.provider, provider)
            )
          );
        return rows[0]
          ? {
              encryptedCredentials: rows[0].encryptedCredentials,
              tenantId: rows[0].tenantId,
            }
          : null;
      },
      (sqlite) => {
        const r = sqlite
          .prepare(
            `SELECT encrypted_credentials, tenant_id FROM connector_oauth_app_configs WHERE user_id = ? AND provider = ?`
          )
          .get(userId, provider) as
          | { encrypted_credentials: string; tenant_id: string | null }
          | undefined;
        return r
          ? { encryptedCredentials: r.encrypted_credentials, tenantId: r.tenant_id }
          : null;
      }
    );

    if (!row) {
      return {
        configured: false,
        source: 'none',
        clientId: '',
        clientSecret: '',
        tenantId: provider === 'outlook' ? 'common' : undefined,
      };
    }

    const decrypted = decryptSecretJson<OAuthAppCredentialsPayload>(
      row.encryptedCredentials
    );
    if (!decrypted?.clientId || !decrypted?.clientSecret) {
      return {
        configured: false,
        source: 'none',
        clientId: '',
        clientSecret: '',
        tenantId: provider === 'outlook' ? 'common' : undefined,
      };
    }

    return {
      configured: true,
      source: 'vault',
      clientId: decrypted.clientId,
      clientSecret: decrypted.clientSecret,
      tenantId:
        provider === 'outlook'
          ? normalizeMicrosoftTenantId(row.tenantId || process.env.MICROSOFT_TENANT_ID)
          : undefined,
    };
  } catch (error) {
    console.error('Failed loading OAuth app credentials:', error);
    throw new Error('Failed to load OAuth application configuration.', { cause: error });
  }
}

export async function getOAuthAppStatuses(userId: string): Promise<{
  outlook: OAuthAppCredentialStatus;
  slack: OAuthAppCredentialStatus;
}> {
  const buildStatus = async (
    provider: 'outlook' | 'slack'
  ): Promise<OAuthAppCredentialStatus> => {
    const envCreds = getEnvOAuthCredentials(provider);
    if (envCreds) {
      return {
        provider,
        configured: true,
        source: 'env',
        clientIdHint: maskCredentialValue(envCreds.clientId),
        ...(provider === 'outlook' ? { tenantId: envCreds.tenantId || 'common' } : {}),
      };
    }

    const vaultRow = await withPgFallback(
      async () => {
        const rows = await db
          .select({
            clientIdHint: oauthAppConfigs.clientIdHint,
            tenantId: oauthAppConfigs.tenantId,
          })
          .from(oauthAppConfigs)
          .where(
            and(
              eq(oauthAppConfigs.userId, userId),
              eq(oauthAppConfigs.provider, provider)
            )
          );
        return rows[0] ?? null;
      },
      (sqlite) => {
        const r = sqlite
          .prepare(
            `SELECT client_id_hint, tenant_id FROM connector_oauth_app_configs WHERE user_id = ? AND provider = ?`
          )
          .get(userId, provider) as
          | { client_id_hint: string; tenant_id: string | null }
          | undefined;
        return r ? { clientIdHint: r.client_id_hint, tenantId: r.tenant_id } : null;
      }
    );

    if (vaultRow) {
      return {
        provider,
        configured: true,
        source: 'vault',
        clientIdHint: vaultRow.clientIdHint,
        ...(provider === 'outlook'
          ? { tenantId: vaultRow.tenantId || 'common' }
          : {}),
      };
    }

    return {
      provider,
      configured: false,
      source: 'none',
      clientIdHint: null,
      ...(provider === 'outlook' ? { tenantId: 'common' } : {}),
    };
  };

  const [outlook, slack] = await Promise.all([
    buildStatus('outlook'),
    buildStatus('slack'),
  ]);
  return { outlook, slack };
}

export async function saveUserOAuthAppConfig(params: {
  userId: string;
  email: string;
  provider: 'outlook' | 'slack';
  clientId?: string;
  clientSecret?: string;
  tenantId?: string;
}): Promise<void> {
  await ensureUserConnectorsSeeded(params.userId, params.email);
  const existing = await getDecryptedOAuthAppCredentials(params.userId, params.provider);

  const nextClientId = (params.clientId ?? '').trim() || (existing.source === 'vault' ? existing.clientId : '');
  const nextClientSecret =
    (params.clientSecret ?? '').trim() ||
    (existing.source === 'vault' ? existing.clientSecret : '');

  if (!nextClientId || !nextClientSecret) {
    throw new Error(
      `${params.provider === 'outlook' ? 'Microsoft Outlook' : 'Slack'} requires both Client ID and Client Secret.`
    );
  }

  const normalizedTenant =
    params.provider === 'outlook'
      ? normalizeMicrosoftTenantId(params.tenantId ?? existing.tenantId)
      : null;

  const encryptedCredentials = encryptSecretJson({
    clientId: nextClientId,
    clientSecret: nextClientSecret,
  });
  const clientIdHint = maskCredentialValue(nextClientId);
  const now = new Date();
  const nowIso = now.toISOString();

  await withPgFallback(
    async () => {
      await db
        .insert(oauthAppConfigs)
        .values({
          userId: params.userId,
          provider: params.provider,
          clientIdHint,
          tenantId: normalizedTenant,
          encryptedCredentials,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [oauthAppConfigs.userId, oauthAppConfigs.provider],
          set: {
            clientIdHint,
            tenantId: normalizedTenant,
            encryptedCredentials,
            updatedAt: now,
          },
        });
    },
    (sqlite) => {
      sqlite
        .prepare(
          `INSERT INTO connector_oauth_app_configs
             (user_id, provider, client_id_hint, tenant_id, encrypted_credentials, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(user_id, provider) DO UPDATE SET
             client_id_hint = excluded.client_id_hint,
             tenant_id = excluded.tenant_id,
             encrypted_credentials = excluded.encrypted_credentials,
             updated_at = excluded.updated_at`
        )
        .run(
          params.userId,
          params.provider,
          clientIdHint,
          normalizedTenant,
          encryptedCredentials,
          nowIso,
          nowIso
        );
    }
  );
}

export async function deleteUserOAuthAppConfig(
  userId: string,
  provider: 'outlook' | 'slack'
): Promise<void> {
  await withPgFallback(
    async () => {
      await db
        .delete(oauthAppConfigs)
        .where(
          and(
            eq(oauthAppConfigs.userId, userId),
            eq(oauthAppConfigs.provider, provider)
          )
        );
    },
    (sqlite) => {
      sqlite
        .prepare(
          `DELETE FROM connector_oauth_app_configs WHERE user_id = ? AND provider = ?`
        )
        .run(userId, provider);
    }
  );
}

export async function rotateAllVaultSecrets(
  oldKey: Buffer,
  newKey: Buffer
): Promise<void> {
  await withPgFallback(
    async () => {
      await db.transaction(async (tx) => {
        const secrets = await tx.select().from(integrationSecrets);
        for (const row of secrets) {
          const reenc = reencryptSecretString(row.encryptedPayload, oldKey, newKey);
          if (reenc) {
            await tx
              .update(integrationSecrets)
              .set({ encryptedPayload: reenc, updatedAt: new Date() })
              .where(eq(integrationSecrets.id, row.id));
          }
        }
        const appRows = await tx.select().from(oauthAppConfigs);
        for (const row of appRows) {
          const reenc = reencryptSecretString(row.encryptedCredentials, oldKey, newKey);
          if (reenc) {
            await tx
              .update(oauthAppConfigs)
              .set({ encryptedCredentials: reenc, updatedAt: new Date() })
              .where(eq(oauthAppConfigs.id, row.id));
          }
        }
      });
    },
    (sqlite) => {
      const tx = sqlite.transaction(() => {
        const nowIso = new Date().toISOString();
        const secrets = sqlite
          .prepare(`SELECT id, encrypted_payload FROM connector_secrets`)
          .all() as Array<{ id: number; encrypted_payload: string }>;
        const updateSecret = sqlite.prepare(
          `UPDATE connector_secrets SET encrypted_payload = ?, updated_at = ? WHERE id = ?`
        );
        for (const row of secrets) {
          const reenc = reencryptSecretString(row.encrypted_payload, oldKey, newKey);
          if (reenc) updateSecret.run(reenc, nowIso, row.id);
        }

        const appRows = sqlite
          .prepare(`SELECT id, encrypted_credentials FROM connector_oauth_app_configs`)
          .all() as Array<{ id: number; encrypted_credentials: string }>;
        const updateApp = sqlite.prepare(
          `UPDATE connector_oauth_app_configs SET encrypted_credentials = ?, updated_at = ? WHERE id = ?`
        );
        for (const row of appRows) {
          const reenc = reencryptSecretString(row.encrypted_credentials, oldKey, newKey);
          if (reenc) updateApp.run(reenc, nowIso, row.id);
        }
      });
      tx();
    }
  );
}

export async function isProviderOAuthConfiguredForUser(
  userId: string,
  serviceName: ConnectorServiceKey
): Promise<boolean> {
  switch (serviceName) {
    case 'gmail':
    case 'google_calendar':
    case 'google_drive':
    case 'telegram':
      return true;
    case 'outlook':
    case 'slack': {
      const creds = await getDecryptedOAuthAppCredentials(userId, serviceName);
      return creds.configured;
    }
  }
}

export async function upsertCloudSqlUser(uid: string, email: string) {
  try {
    return await withPgFallback(
      async () => {
        const result = await db
          .insert(users)
          .values({ uid, email })
          .onConflictDoUpdate({
            target: users.uid,
            set: { email },
          })
          .returning();
        return result[0];
      },
      (sqlite) => {
        const nowIso = new Date().toISOString();
        sqlite
          .prepare(
            `INSERT INTO connector_users (uid, email, created_at)
             VALUES (?, ?, ?)
             ON CONFLICT(uid) DO UPDATE SET email = excluded.email`
          )
          .run(uid, email, nowIso);
        return { id: 0, uid, email, createdAt: new Date(nowIso) };
      }
    );
  } catch (error) {
    console.error('Database user upsert failed:', error);
    throw new Error('Failed to synchronize workspace user record.', { cause: error });
  }
}

export async function ensureUserConnectorsSeeded(
  userId: string,
  email: string
): Promise<void> {
  try {
    await upsertCloudSqlUser(userId, email);

    await withPgFallback(
      async () => {
        for (const entry of SERVICE_CATALOG) {
          await db
            .insert(integrationConnections)
            .values({
              userId,
              serviceName: entry.serviceName,
              displayName: entry.displayName,
              connectionStatus: 'SANDBOX MODE',
              authenticationType: entry.authenticationType,
              permissions: [],
              accountLabel: '',
              sandboxMode: true,
              n8nWorkflowName: entry.n8nWorkflowName,
              n8nWebhookUrl: '',
              n8nEnabled: false,
            })
            .onConflictDoNothing({
              target: [
                integrationConnections.userId,
                integrationConnections.serviceName,
              ],
            });
        }

        const connections = await db
          .select()
          .from(integrationConnections)
          .where(eq(integrationConnections.userId, userId));

        for (const conn of connections) {
          const entry = getServiceCatalogEntry(conn.serviceName as ConnectorServiceKey);
          for (const botId of BOT_IDS) {
            const def = entry.defaultEmployees[botId];
            await db
              .insert(employeeIntegrations)
              .values({
                employeeId: botId,
                integrationId: conn.id,
                permissionLevel: def.level,
                enabled: def.enabled,
              })
              .onConflictDoNothing({
                target: [
                  employeeIntegrations.employeeId,
                  employeeIntegrations.integrationId,
                ],
              });
          }
        }
      },
      (sqlite) => {
        const nowIso = new Date().toISOString();
        const insertConn = sqlite.prepare(`
          INSERT OR IGNORE INTO connector_connections
            (user_id, service_name, display_name, connection_status, authentication_type, permissions_json, account_label, sandbox_mode, n8n_workflow_name, n8n_webhook_url, n8n_enabled, created_at, updated_at)
          VALUES (?, ?, ?, 'SANDBOX MODE', ?, '[]', '', 1, ?, '', 0, ?, ?)
        `);
        for (const entry of SERVICE_CATALOG) {
          insertConn.run(
            userId,
            entry.serviceName,
            entry.displayName,
            entry.authenticationType,
            entry.n8nWorkflowName,
            nowIso,
            nowIso
          );
        }

        const connections = sqlite
          .prepare(`SELECT id, service_name FROM connector_connections WHERE user_id = ?`)
          .all(userId) as Array<{ id: number; service_name: string }>;

        const insertEmp = sqlite.prepare(`
          INSERT OR IGNORE INTO connector_employee_permissions
            (employee_id, integration_id, permission_level, enabled, updated_at)
          VALUES (?, ?, ?, ?, ?)
        `);
        for (const conn of connections) {
          const entry = getServiceCatalogEntry(conn.service_name as ConnectorServiceKey);
          for (const botId of BOT_IDS) {
            const def = entry.defaultEmployees[botId];
            insertEmp.run(botId, conn.id, def.level, def.enabled ? 1 : 0, nowIso);
          }
        }
      }
    );
  } catch (error) {
    console.error('Failed seeding user connectors:', error);
    throw new Error('Failed to initialize workspace connectors.', { cause: error });
  }
}

interface NormalizedConnectionRow {
  id: number;
  userId: string;
  serviceName: string;
  displayName: string;
  connectionStatus: string;
  authenticationType: string;
  permissions: string[];
  accountLabel: string;
  sandboxMode: boolean;
  n8nWorkflowName: string;
  n8nWebhookUrl: string;
  n8nEnabled: boolean;
  tokenExpiresAt: Date | null;
  lastSync: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function mapSqliteConnectionRow(r: Record<string, unknown>): NormalizedConnectionRow {
  return {
    id: Number(r.id),
    userId: String(r.user_id),
    serviceName: String(r.service_name),
    displayName: String(r.display_name),
    connectionStatus: String(r.connection_status),
    authenticationType: String(r.authentication_type),
    permissions: JSON.parse(String(r.permissions_json || '[]')) as string[],
    accountLabel: String(r.account_label || ''),
    sandboxMode: Boolean(r.sandbox_mode),
    n8nWorkflowName: String(r.n8n_workflow_name),
    n8nWebhookUrl: String(r.n8n_webhook_url || ''),
    n8nEnabled: Boolean(r.n8n_enabled),
    tokenExpiresAt: r.token_expires_at ? new Date(String(r.token_expires_at)) : null,
    lastSync: r.last_sync ? new Date(String(r.last_sync)) : null,
    lastError: r.last_error ? String(r.last_error) : null,
    createdAt: new Date(String(r.created_at)),
    updatedAt: new Date(String(r.updated_at)),
  };
}

export async function getConnectorRecord(
  userId: string,
  serviceName: ConnectorServiceKey
): Promise<NormalizedConnectionRow | null> {
  try {
    return await withPgFallback(
      async () => {
        const rows = await db
          .select()
          .from(integrationConnections)
          .where(
            and(
              eq(integrationConnections.userId, userId),
              eq(integrationConnections.serviceName, serviceName)
            )
          );
        return rows[0] ?? null;
      },
      (sqlite) => {
        const r = sqlite
          .prepare(
            `SELECT * FROM connector_connections WHERE user_id = ? AND service_name = ?`
          )
          .get(userId, serviceName) as Record<string, unknown> | undefined;
        return r ? mapSqliteConnectionRow(r) : null;
      }
    );
  } catch (error) {
    console.error('Database query failed in getConnectorRecord:', error);
    throw new Error('Failed to load connector record.', { cause: error });
  }
}

export async function getConnectorDashboard(
  userId: string,
  email: string
): Promise<ConnectorDashboardPayload> {
  try {
    await ensureUserConnectorsSeeded(userId, email);

    const { connRows, secretIds, empRows, logRows } = await withPgFallback(
      async () => {
        const conns = await db
          .select()
          .from(integrationConnections)
          .where(eq(integrationConnections.userId, userId));
        const connIds = conns.map((c) => c.id);

        const secrets = connIds.length
          ? await db
              .select({ integrationId: integrationSecrets.integrationId })
              .from(integrationSecrets)
              .where(inArray(integrationSecrets.integrationId, connIds))
          : [];

        const emps = connIds.length
          ? await db
              .select()
              .from(employeeIntegrations)
              .where(inArray(employeeIntegrations.integrationId, connIds))
          : [];

        const logs = connIds.length
          ? await db
              .select()
              .from(integrationActivityLogs)
              .where(inArray(integrationActivityLogs.integrationId, connIds))
              .orderBy(desc(integrationActivityLogs.timestamp))
              .limit(80)
          : [];

        return {
          connRows: conns as NormalizedConnectionRow[],
          secretIds: secrets.map((s) => s.integrationId),
          empRows: emps.map((e) => ({
            id: e.id,
            employeeId: e.employeeId,
            integrationId: e.integrationId,
            permissionLevel: e.permissionLevel,
            enabled: e.enabled,
            updatedAt: e.updatedAt,
          })),
          logRows: logs.map((l) => ({
            id: l.id,
            integrationId: l.integrationId,
            employeeId: l.employeeId,
            action: l.action,
            status: l.status,
            isSandbox: l.isSandbox,
            timestamp: l.timestamp,
            errorMessage: l.errorMessage,
          })),
        };
      },
      (sqlite) => {
        const rawConns = sqlite
          .prepare(`SELECT * FROM connector_connections WHERE user_id = ?`)
          .all(userId) as Array<Record<string, unknown>>;
        const conns = rawConns.map(mapSqliteConnectionRow);
        const connIds = conns.map((c) => c.id);
        if (connIds.length === 0) {
          return { connRows: [], secretIds: [], empRows: [], logRows: [] };
        }
        const placeholders = connIds.map(() => '?').join(',');
        const secrets = sqlite
          .prepare(
            `SELECT integration_id FROM connector_secrets WHERE integration_id IN (${placeholders})`
          )
          .all(...connIds) as Array<{ integration_id: number }>;

        const emps = sqlite
          .prepare(
            `SELECT id, employee_id, integration_id, permission_level, enabled, updated_at
             FROM connector_employee_permissions WHERE integration_id IN (${placeholders})`
          )
          .all(...connIds) as Array<{
          id: number;
          employee_id: string;
          integration_id: number;
          permission_level: string;
          enabled: number;
          updated_at: string;
        }>;

        const logs = sqlite
          .prepare(
            `SELECT id, integration_id, employee_id, action, status, is_sandbox, timestamp, error_message
             FROM connector_activity_logs WHERE integration_id IN (${placeholders})
             ORDER BY id DESC LIMIT 80`
          )
          .all(...connIds) as Array<{
          id: number;
          integration_id: number;
          employee_id: string | null;
          action: string;
          status: string;
          is_sandbox: number;
          timestamp: string;
          error_message: string | null;
        }>;

        return {
          connRows: conns,
          secretIds: secrets.map((s) => s.integration_id),
          empRows: emps.map((e) => ({
            id: e.id,
            employeeId: e.employee_id,
            integrationId: e.integration_id,
            permissionLevel: e.permission_level,
            enabled: Boolean(e.enabled),
            updatedAt: new Date(e.updated_at),
          })),
          logRows: logs.map((l) => ({
            id: l.id,
            integrationId: l.integration_id,
            employeeId: l.employee_id,
            action: l.action,
            status: l.status,
            isSandbox: Boolean(l.is_sandbox),
            timestamp: new Date(l.timestamp),
            errorMessage: l.error_message,
          })),
        };
      }
    );

    const oauthAppStatuses = await getOAuthAppStatuses(userId);
    const secretSet = new Set(secretIds);
    const connById = new Map(connRows.map((c) => [c.id, c]));
    const orderIndex = new Map(
      SERVICE_CATALOG.map((item, idx) => [item.serviceName, idx])
    );

    const connections: ConnectorConnectionView[] = connRows
      .sort(
        (a, b) =>
          (orderIndex.get(a.serviceName as ConnectorServiceKey) ?? 99) -
          (orderIndex.get(b.serviceName as ConnectorServiceKey) ?? 99)
      )
      .map((row) => {
        const serviceKey = row.serviceName as ConnectorServiceKey;
        const catalog = getServiceCatalogEntry(serviceKey);
        const status = row.connectionStatus as ConnectorConnectionStatus;
        const expiresIso = row.tokenExpiresAt ? row.tokenExpiresAt.toISOString() : null;

        let oauthConfigured = true;
        let credentialSource: CredentialSource = 'env';
        let clientIdHint: string | null = null;
        if (serviceKey === 'outlook') {
          oauthConfigured = oauthAppStatuses.outlook.configured;
          credentialSource = oauthAppStatuses.outlook.source;
          clientIdHint = oauthAppStatuses.outlook.clientIdHint;
        } else if (serviceKey === 'slack') {
          oauthConfigured = oauthAppStatuses.slack.configured;
          credentialSource = oauthAppStatuses.slack.source;
          clientIdHint = oauthAppStatuses.slack.clientIdHint;
        } else if (serviceKey === 'telegram') {
          oauthConfigured = secretSet.has(row.id);
          credentialSource = secretSet.has(row.id) ? 'vault' : 'none';
        }

        return {
          id: row.id,
          serviceName: serviceKey,
          displayName: row.displayName,
          description: catalog.description,
          connectionStatus: status,
          authenticationType: row.authenticationType as ConnectorAuthType,
          permissions: Array.isArray(row.permissions) ? row.permissions : [],
          availablePermissions: catalog.availablePermissions,
          accountLabel: row.accountLabel,
          sandboxMode: row.sandboxMode,
          n8nWorkflowName: row.n8nWorkflowName,
          n8nWebhookUrl: row.n8nWebhookUrl,
          n8nEnabled: row.n8nEnabled,
          tokenExpiresAt: expiresIso,
          tokenExpirationStatus: evaluateTokenExpirationStatus(
            expiresIso,
            row.sandboxMode,
            status === 'CONNECTED'
          ),
          lastSync: row.lastSync ? row.lastSync.toISOString() : null,
          lastError: row.lastError ?? null,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
          hasStoredSecret: secretSet.has(row.id),
          oauthConfigured,
          credentialSource,
          clientIdHint,
        };
      });

    const employeePermissions: EmployeeConnectorPermissionView[] = empRows
      .map((row) => {
        const conn = connById.get(row.integrationId);
        if (!conn) return null;
        return {
          id: row.id,
          employeeId: row.employeeId as BotId,
          integrationId: row.integrationId,
          serviceName: conn.serviceName as ConnectorServiceKey,
          permissionLevel: row.permissionLevel as ConnectorPermissionLevel,
          enabled: row.enabled,
          updatedAt: row.updatedAt.toISOString(),
        };
      })
      .filter((item): item is EmployeeConnectorPermissionView => item !== null);

    const activityLogs: ConnectorActivityLogView[] = logRows
      .map((row) => {
        const conn = connById.get(row.integrationId);
        if (!conn) return null;
        return {
          id: row.id,
          integrationId: row.integrationId,
          serviceName: conn.serviceName as ConnectorServiceKey,
          displayName: conn.displayName,
          employeeId: (row.employeeId as BotId | null) ?? null,
          action: row.action,
          status: row.status as ConnectorActivityLogView['status'],
          isSandbox: row.isSandbox,
          timestamp: row.timestamp.toISOString(),
          errorMessage: row.errorMessage ?? null,
        };
      })
      .filter((item): item is ConnectorActivityLogView => item !== null);

    return {
      connections,
      employeePermissions,
      activityLogs,
      oauthAppStatuses,
      encryptionKeySource: getEncryptionKeySource(),
      callbackUrls: {
        outlookDev: `${DEV_BASE_URL}/api/oauth/outlook/callback`,
        outlookShared: `${SHARED_BASE_URL}/api/oauth/outlook/callback`,
        slackDev: `${DEV_BASE_URL}/api/oauth/slack/callback`,
        slackShared: `${SHARED_BASE_URL}/api/oauth/slack/callback`,
      },
    };
  } catch (error) {
    console.error('Database query failed in getConnectorDashboard:', error);
    throw new Error('Failed to load integrations dashboard.', { cause: error });
  }
}

export async function updateConnectorState(
  integrationId: number,
  updates: {
    connectionStatus?: ConnectorConnectionStatus;
    permissions?: string[];
    accountLabel?: string;
    sandboxMode?: boolean;
    n8nWebhookUrl?: string;
    n8nEnabled?: boolean;
    tokenExpiresAt?: Date | null;
    lastSync?: Date | null;
    lastError?: string | null;
  }
) {
  try {
    return await withPgFallback(
      async () => {
        const result = await db
          .update(integrationConnections)
          .set({
            ...updates,
            updatedAt: new Date(),
          })
          .where(eq(integrationConnections.id, integrationId))
          .returning();
        return result[0] ?? null;
      },
      (sqlite) => {
        const setParts: string[] = ['updated_at = ?'];
        const values: unknown[] = [new Date().toISOString()];
        if (updates.connectionStatus !== undefined) {
          setParts.push('connection_status = ?');
          values.push(updates.connectionStatus);
        }
        if (updates.permissions !== undefined) {
          setParts.push('permissions_json = ?');
          values.push(JSON.stringify(updates.permissions));
        }
        if (updates.accountLabel !== undefined) {
          setParts.push('account_label = ?');
          values.push(updates.accountLabel);
        }
        if (updates.sandboxMode !== undefined) {
          setParts.push('sandbox_mode = ?');
          values.push(updates.sandboxMode ? 1 : 0);
        }
        if (updates.n8nWebhookUrl !== undefined) {
          setParts.push('n8n_webhook_url = ?');
          values.push(updates.n8nWebhookUrl);
        }
        if (updates.n8nEnabled !== undefined) {
          setParts.push('n8n_enabled = ?');
          values.push(updates.n8nEnabled ? 1 : 0);
        }
        if (updates.tokenExpiresAt !== undefined) {
          setParts.push('token_expires_at = ?');
          values.push(updates.tokenExpiresAt ? updates.tokenExpiresAt.toISOString() : null);
        }
        if (updates.lastSync !== undefined) {
          setParts.push('last_sync = ?');
          values.push(updates.lastSync ? updates.lastSync.toISOString() : null);
        }
        if (updates.lastError !== undefined) {
          setParts.push('last_error = ?');
          values.push(updates.lastError);
        }
        values.push(integrationId);
        sqlite
          .prepare(
            `UPDATE connector_connections SET ${setParts.join(', ')} WHERE id = ?`
          )
          .run(...values);
        const r = sqlite
          .prepare(`SELECT * FROM connector_connections WHERE id = ?`)
          .get(integrationId) as Record<string, unknown> | undefined;
        return r ? mapSqliteConnectionRow(r) : null;
      }
    );
  } catch (error) {
    console.error('Database update failed in updateConnectorState:', error);
    throw new Error('Failed to update connector state.', { cause: error });
  }
}

export async function saveConnectorSecret(
  integrationId: number,
  payload: SecretPayload,
  tokenExpiresAt: Date | null = null
): Promise<void> {
  try {
    const encryptedPayload = encryptSecretPayload(payload);
    const now = new Date();
    await withPgFallback(
      async () => {
        await db
          .insert(integrationSecrets)
          .values({
            integrationId,
            encryptedPayload,
            tokenExpiresAt,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: integrationSecrets.integrationId,
            set: {
              encryptedPayload,
              tokenExpiresAt,
              updatedAt: now,
            },
          });
      },
      (sqlite) => {
        sqlite
          .prepare(
            `INSERT INTO connector_secrets (integration_id, encrypted_payload, token_expires_at, updated_at)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(integration_id) DO UPDATE SET
               encrypted_payload = excluded.encrypted_payload,
               token_expires_at = excluded.token_expires_at,
               updated_at = excluded.updated_at`
          )
          .run(
            integrationId,
            encryptedPayload,
            tokenExpiresAt ? tokenExpiresAt.toISOString() : null,
            now.toISOString()
          );
      }
    );
  } catch (error) {
    console.error('Database secret save failed:', error);
    throw new Error('Failed to securely store connector credentials.', { cause: error });
  }
}

export async function loadConnectorSecret(
  integrationId: number
): Promise<SecretPayload> {
  try {
    const encoded = await withPgFallback(
      async () => {
        const rows = await db
          .select()
          .from(integrationSecrets)
          .where(eq(integrationSecrets.integrationId, integrationId));
        return rows[0]?.encryptedPayload ?? null;
      },
      (sqlite) => {
        const r = sqlite
          .prepare(
            `SELECT encrypted_payload FROM connector_secrets WHERE integration_id = ?`
          )
          .get(integrationId) as { encrypted_payload: string } | undefined;
        return r?.encrypted_payload ?? null;
      }
    );
    return decryptSecretPayload(encoded);
  } catch (error) {
    console.error('Database secret load failed:', error);
    throw new Error('Failed to read connector credentials.', { cause: error });
  }
}

export async function deleteConnectorSecret(integrationId: number): Promise<void> {
  try {
    await withPgFallback(
      async () => {
        await db
          .delete(integrationSecrets)
          .where(eq(integrationSecrets.integrationId, integrationId));
      },
      (sqlite) => {
        sqlite
          .prepare(`DELETE FROM connector_secrets WHERE integration_id = ?`)
          .run(integrationId);
      }
    );
  } catch (error) {
    console.error('Database secret delete failed:', error);
    throw new Error('Failed to remove stored connector credentials.', { cause: error });
  }
}

export async function appendConnectorLog(params: {
  integrationId: number;
  employeeId?: BotId | null;
  action: string;
  status: 'success' | 'error' | 'sandbox' | 'warning';
  isSandbox: boolean;
  errorMessage?: string | null;
}): Promise<void> {
  try {
    await withPgFallback(
      async () => {
        await db.insert(integrationActivityLogs).values({
          integrationId: params.integrationId,
          employeeId: params.employeeId ?? null,
          action: params.action,
          status: params.status,
          isSandbox: params.isSandbox,
          errorMessage: params.errorMessage ?? null,
        });
      },
      (sqlite) => {
        sqlite
          .prepare(
            `INSERT INTO connector_activity_logs (integration_id, employee_id, action, status, is_sandbox, timestamp, error_message)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            params.integrationId,
            params.employeeId ?? null,
            params.action,
            params.status,
            params.isSandbox ? 1 : 0,
            new Date().toISOString(),
            params.errorMessage ?? null
          );
      }
    );
  } catch (error) {
    console.error('Database log insert failed:', error);
    throw new Error('Failed to record integration activity log.', { cause: error });
  }
}

export async function setEmployeeConnectorPermission(params: {
  integrationId: number;
  employeeId: BotId;
  permissionLevel: ConnectorPermissionLevel;
  enabled: boolean;
}) {
  try {
    const now = new Date();
    return await withPgFallback(
      async () => {
        const result = await db
          .insert(employeeIntegrations)
          .values({
            integrationId: params.integrationId,
            employeeId: params.employeeId,
            permissionLevel: params.permissionLevel,
            enabled: params.enabled,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [
              employeeIntegrations.employeeId,
              employeeIntegrations.integrationId,
            ],
            set: {
              permissionLevel: params.permissionLevel,
              enabled: params.enabled,
              updatedAt: now,
            },
          })
          .returning();
        return result[0];
      },
      (sqlite) => {
        sqlite
          .prepare(
            `INSERT INTO connector_employee_permissions (employee_id, integration_id, permission_level, enabled, updated_at)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(employee_id, integration_id) DO UPDATE SET
               permission_level = excluded.permission_level,
               enabled = excluded.enabled,
               updated_at = excluded.updated_at`
          )
          .run(
            params.employeeId,
            params.integrationId,
            params.permissionLevel,
            params.enabled ? 1 : 0,
            now.toISOString()
          );
        return {
          id: 0,
          employeeId: params.employeeId,
          integrationId: params.integrationId,
          permissionLevel: params.permissionLevel,
          enabled: params.enabled,
          updatedAt: now,
        };
      }
    );
  } catch (error) {
    console.error('Database employee permission update failed:', error);
    throw new Error('Failed to update employee connector permissions.', { cause: error });
  }
}

export async function disconnectAllUserConnectors(userId: string): Promise<number[]> {
  try {
    return await withPgFallback(
      async () => {
        const connRows = await db
          .select()
          .from(integrationConnections)
          .where(eq(integrationConnections.userId, userId));

        const ids = connRows.map((c) => c.id);
        if (ids.length === 0) return [];

        await db
          .delete(integrationSecrets)
          .where(inArray(integrationSecrets.integrationId, ids));

        await db
          .update(integrationConnections)
          .set({
            connectionStatus: 'SANDBOX MODE',
            permissions: [],
            accountLabel: '',
            sandboxMode: true,
            n8nEnabled: false,
            tokenExpiresAt: null,
            lastError: null,
            updatedAt: new Date(),
          })
          .where(eq(integrationConnections.userId, userId));

        return ids;
      },
      (sqlite) => {
        const conns = sqlite
          .prepare(`SELECT id FROM connector_connections WHERE user_id = ?`)
          .all(userId) as Array<{ id: number }>;
        const ids = conns.map((c) => c.id);
        if (ids.length === 0) return [];
        const placeholders = ids.map(() => '?').join(',');
        sqlite
          .prepare(
            `DELETE FROM connector_secrets WHERE integration_id IN (${placeholders})`
          )
          .run(...ids);
        sqlite
          .prepare(
            `UPDATE connector_connections
             SET connection_status = 'SANDBOX MODE', permissions_json = '[]', account_label = '',
                 sandbox_mode = 1, n8n_enabled = 0, token_expires_at = NULL, last_error = NULL, updated_at = ?
             WHERE user_id = ?`
          )
          .run(new Date().toISOString(), userId);
        return ids;
      }
    );
  } catch (error) {
    console.error('Database disconnect all failed:', error);
    throw new Error('Failed to disconnect all integrations.', { cause: error });
  }
}
