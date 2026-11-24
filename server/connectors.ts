import crypto from 'node:crypto';
import {
  appendConnectorLog,
  deleteConnectorSecret,
  deleteUserOAuthAppConfig,
  disconnectAllUserConnectors,
  ensureUserConnectorsSeeded,
  getConnectorDashboard,
  getConnectorRecord,
  getDecryptedOAuthAppCredentials,
  isProviderOAuthConfiguredForUser,
  loadConnectorSecret,
  rotateAllVaultSecrets,
  saveConnectorSecret,
  saveUserOAuthAppConfig,
  updateConnectorState,
} from './connectorsRepo.ts';
import {
  commitCustomVaultKey,
  isEncryptionKeyFromEnv,
  restoreVaultKeyBuffer,
} from './crypto.ts';
import {
  buildSandboxExecutionPreview,
  canEmployeeUseConnector,
  getServiceCatalogEntry,
} from '../src/shared/connectorLogic.ts';
import { validateWebhookUrl } from '../src/shared/officeLogic.ts';
import type {
  BotId,
  ConnectorDiagnosticMessage,
  ConnectorPermissionLevel,
  ConnectorServiceKey,
  OAuthSetupInstructionPayload,
} from '../src/shared/types.ts';

interface PendingOAuthState {
  userId: string;
  email: string;
  provider: 'outlook' | 'slack';
  redirectUri: string;
  expiresAt: number;
}

const pendingOAuthStates = new Map<string, PendingOAuthState>();

function pruneExpiredOAuthStates() {
  const now = Date.now();
  for (const [key, entry] of pendingOAuthStates.entries()) {
    if (entry.expiresAt <= now) {
      pendingOAuthStates.delete(key);
    }
  }
}

export function getPublicOrigin(reqOrigin?: string): string {
  if (process.env.APP_URL?.trim()) {
    return process.env.APP_URL.trim().replace(/\/$/, '');
  }
  if (reqOrigin?.trim()) {
    return reqOrigin.trim().replace(/\/$/, '');
  }
  return 'https://ais-dev-c5lhwz3c6le3ai2hc4zlxd-1014530368246.asia-east1.run.app';
}

export async function buildMissingOAuthInstructions(
  userId: string,
  provider: 'outlook' | 'slack'
): Promise<OAuthSetupInstructionPayload> {
  const devBase =
    process.env.APP_URL?.trim().replace(/\/$/, '') ||
    'https://ais-dev-c5lhwz3c6le3ai2hc4zlxd-1014530368246.asia-east1.run.app';
  const sharedBase =
    'https://ais-pre-c5lhwz3c6le3ai2hc4zlxd-1014530368246.asia-east1.run.app';

  const creds = await getDecryptedOAuthAppCredentials(userId, provider);

  if (provider === 'outlook') {
    const missingVars: string[] = [];
    if (!creds.clientId) missingVars.push('MICROSOFT_CLIENT_ID');
    if (!creds.clientSecret) missingVars.push('MICROSOFT_CLIENT_SECRET');
    return {
      needsEnvSetup: true,
      provider: 'outlook',
      missingVars,
      callbackUrls: {
        dev: `${devBase}/api/oauth/outlook/callback`,
        shared: `${sharedBase}/api/oauth/outlook/callback`,
      },
      steps: [
        'Open Azure Portal -> Microsoft Entra ID -> App registrations -> New registration.',
        'Add Web Redirect URIs using both the Development and Shared Callback URLs shown below.',
        'Under API permissions, grant Microsoft Graph delegated permissions: User.Read, Mail.Read, Mail.ReadWrite, offline_access.',
        'Create a Client Secret, then either add MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET in AI Studio Secrets or save them securely using the OAuth App Credentials vault button below.',
      ],
    };
  }

  const missingVars: string[] = [];
  if (!creds.clientId) missingVars.push('SLACK_CLIENT_ID');
  if (!creds.clientSecret) missingVars.push('SLACK_CLIENT_SECRET');
  return {
    needsEnvSetup: true,
    provider: 'slack',
    missingVars,
    callbackUrls: {
      dev: `${devBase}/api/oauth/slack/callback`,
      shared: `${sharedBase}/api/oauth/slack/callback`,
    },
    steps: [
      'Open api.slack.com/apps -> Create New App -> From scratch.',
      'Under OAuth & Permissions -> Redirect URLs, add both the Development and Shared Callback URLs below.',
      'Add Bot Token Scopes: chat:write, channels:read, users:read, commands.',
      'Copy Client ID and Client Secret into AI Studio Secrets or save them securely using the OAuth App Credentials vault button below.',
    ],
  };
}

export async function dispatchIntegrationN8nWebhook(params: {
  webhookUrl: string;
  serviceName: ConnectorServiceKey;
  workflowName: string;
  event: string;
  payload: Record<string, unknown>;
}): Promise<{ ok: boolean; statusText: string }> {
  const check = validateWebhookUrl(params.webhookUrl);
  if (!check.valid) {
    return { ok: false, statusText: check.reason || 'Invalid webhook URL' };
  }
  try {
    const res = await fetch(params.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'ROBOT_OFFICE_AI',
        serviceName: params.serviceName,
        workflowName: params.workflowName,
        event: params.event,
        timestamp: new Date().toISOString(),
        ...params.payload,
      }),
      signal: AbortSignal.timeout(7000),
    });
    return {
      ok: res.ok,
      statusText: `HTTP ${res.status} ${res.statusText}`,
    };
  } catch (err) {
    return {
      ok: false,
      statusText: err instanceof Error ? err.message : 'n8n webhook request failed',
    };
  }
}

export async function startThirdPartyOAuth(params: {
  userId: string;
  email: string;
  provider: 'outlook' | 'slack';
  origin: string;
}): Promise<
  | { configured: true; authUrl: string }
  | { configured: false; instructions: OAuthSetupInstructionPayload }
> {
  await ensureUserConnectorsSeeded(params.userId, params.email);

  const creds = await getDecryptedOAuthAppCredentials(params.userId, params.provider);
  if (!creds.configured) {
    return {
      configured: false,
      instructions: await buildMissingOAuthInstructions(params.userId, params.provider),
    };
  }

  pruneExpiredOAuthStates();
  const state = crypto.randomBytes(24).toString('hex');
  const redirectUri = `${params.origin}/api/oauth/${params.provider}/callback`;

  pendingOAuthStates.set(state, {
    userId: params.userId,
    email: params.email,
    provider: params.provider,
    redirectUri,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });

  const conn = await getConnectorRecord(params.userId, params.provider);
  if (conn) {
    await updateConnectorState(conn.id, {
      connectionStatus: 'CONNECTING',
      sandboxMode: false,
      lastError: null,
    });
    await appendConnectorLog({
      integrationId: conn.id,
      action: `Started ${params.provider === 'outlook' ? 'Microsoft Outlook' : 'Slack'} OAuth 2.0 flow (${creds.source} credentials)`,
      status: 'warning',
      isSandbox: false,
    });
  }

  if (params.provider === 'outlook') {
    const tenant = creds.tenantId || 'common';
    const url = new URL(
      `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/authorize`
    );
    url.searchParams.set('client_id', creds.clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_mode', 'query');
    url.searchParams.set(
      'scope',
      'User.Read Mail.Read Mail.ReadWrite offline_access'
    );
    url.searchParams.set('prompt', 'select_account');
    url.searchParams.set('state', state);
    return { configured: true, authUrl: url.toString() };
  }

  const slackUrl = new URL('https://slack.com/oauth/v2/authorize');
  slackUrl.searchParams.set('client_id', creds.clientId);
  slackUrl.searchParams.set(
    'scope',
    'chat:write,channels:read,users:read,commands'
  );
  slackUrl.searchParams.set('redirect_uri', redirectUri);
  slackUrl.searchParams.set('state', state);
  return { configured: true, authUrl: slackUrl.toString() };
}

export async function completeThirdPartyOAuthCallback(params: {
  provider: 'outlook' | 'slack';
  code?: string;
  state?: string;
  oauthError?: string;
}): Promise<{ ok: boolean; message: string }> {
  pruneExpiredOAuthStates();
  const pending = params.state ? pendingOAuthStates.get(params.state) : undefined;
  if (params.state) {
    pendingOAuthStates.delete(params.state);
  }

  if (params.oauthError) {
    if (pending && pending.provider === params.provider) {
      const errConn = await getConnectorRecord(pending.userId, params.provider);
      if (errConn) {
        const msg = `Provider denied authorization: ${params.oauthError}`;
        await updateConnectorState(errConn.id, {
          connectionStatus: 'ERROR',
          lastError: msg,
        });
        await appendConnectorLog({
          integrationId: errConn.id,
          action: `${params.provider === 'outlook' ? 'Outlook' : 'Slack'} authorization denied`,
          status: 'error',
          isSandbox: false,
          errorMessage: msg,
        });
      }
    }
    return { ok: false, message: `Provider denied authorization: ${params.oauthError}` };
  }

  if (!params.state || !params.code) {
    return { ok: false, message: 'Missing OAuth code or state parameter.' };
  }

  if (!pending || pending.provider !== params.provider || pending.expiresAt <= Date.now()) {
    return { ok: false, message: 'Invalid or expired OAuth state (CSRF validation failed).' };
  }

  const conn = await getConnectorRecord(pending.userId, params.provider);
  if (!conn) {
    return { ok: false, message: 'Connector record not found.' };
  }

  const creds = await getDecryptedOAuthAppCredentials(pending.userId, params.provider);
  if (!creds.configured) {
    const msg = `OAuth credentials for ${params.provider} are not configured on the server.`;
    await updateConnectorState(conn.id, {
      connectionStatus: 'SANDBOX MODE',
      sandboxMode: true,
      lastError: msg,
    });
    return { ok: false, message: msg };
  }

  try {
    if (params.provider === 'outlook') {
      const tenant = creds.tenantId || 'common';
      const tokenRes = await fetch(
        `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: creds.clientId,
            client_secret: creds.clientSecret,
            grant_type: 'authorization_code',
            code: params.code,
            redirect_uri: pending.redirectUri,
          }),
          signal: AbortSignal.timeout(10000),
        }
      );
      const tokenJson = (await tokenRes.json()) as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
        scope?: string;
        error_description?: string;
      };
      if (!tokenRes.ok || !tokenJson.access_token) {
        throw new Error(tokenJson.error_description || 'Microsoft token exchange failed.');
      }

      // Verify profile AND actual mailbox read access before marking CONNECTED
      const meRes = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${tokenJson.access_token}` },
        signal: AbortSignal.timeout(8000),
      });
      if (!meRes.ok) {
        throw new Error(`Microsoft Graph /me verification failed (HTTP ${meRes.status}).`);
      }
      const meJson = (await meRes.json()) as {
        mail?: string;
        userPrincipalName?: string;
        displayName?: string;
      };

      const mailCheckRes = await fetch(
        'https://graph.microsoft.com/v1.0/me/messages?$top=1',
        {
          headers: { Authorization: `Bearer ${tokenJson.access_token}` },
          signal: AbortSignal.timeout(8000),
        }
      );
      if (!mailCheckRes.ok) {
        throw new Error(
          `Microsoft Graph mailbox verification failed (HTTP ${mailCheckRes.status}). Ensure Mail.Read is granted.`
        );
      }

      const accountLabel =
        meJson.mail || meJson.userPrincipalName || meJson.displayName || pending.email;
      const expiresAt = tokenJson.expires_in
        ? new Date(Date.now() + tokenJson.expires_in * 1000)
        : null;

      await saveConnectorSecret(
        conn.id,
        {
          accessToken: tokenJson.access_token,
          refreshToken: tokenJson.refresh_token,
          scope: tokenJson.scope,
        },
        expiresAt
      );

      await updateConnectorState(conn.id, {
        connectionStatus: 'CONNECTED',
        sandboxMode: false,
        accountLabel,
        permissions: (tokenJson.scope || 'User.Read Mail.Read Mail.ReadWrite').split(/\s+/),
        tokenExpiresAt: expiresAt,
        lastSync: new Date(),
        lastError: null,
        n8nEnabled: Boolean(conn.n8nWebhookUrl),
      });

      await appendConnectorLog({
        integrationId: conn.id,
        action: `Verified & connected Microsoft Outlook (${accountLabel})`,
        status: 'success',
        isSandbox: false,
      });

      return { ok: true, message: `Connected Outlook as ${accountLabel}` };
    }

    // Slack OAuth v2 exchange
    const slackRes = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        code: params.code,
        redirect_uri: pending.redirectUri,
      }),
      signal: AbortSignal.timeout(10000),
    });
    const slackJson = (await slackRes.json()) as {
      ok?: boolean;
      access_token?: string;
      scope?: string;
      team?: { name?: string };
      error?: string;
    };
    if (!slackRes.ok || !slackJson.ok || !slackJson.access_token) {
      throw new Error(slackJson.error || 'Slack token exchange failed.');
    }

    // Verify live token via Slack auth.test before saving or marking CONNECTED
    const verifyRes = await fetch('https://slack.com/api/auth.test', {
      method: 'POST',
      headers: { Authorization: `Bearer ${slackJson.access_token}` },
      signal: AbortSignal.timeout(8000),
    });
    const verifyJson = (await verifyRes.json()) as {
      ok?: boolean;
      team?: string;
      user?: string;
      error?: string;
    };
    if (!verifyRes.ok || !verifyJson.ok) {
      throw new Error(verifyJson.error || 'Slack auth.test verification failed.');
    }

    const teamName = verifyJson.team || slackJson.team?.name;
    const accountLabel = teamName ? `Workspace: ${teamName}` : 'Slack Workspace';

    await saveConnectorSecret(conn.id, {
      accessToken: slackJson.access_token,
      scope: slackJson.scope,
    });

    await updateConnectorState(conn.id, {
      connectionStatus: 'CONNECTED',
      sandboxMode: false,
      accountLabel,
      permissions: (slackJson.scope || 'chat:write,channels:read').split(','),
      tokenExpiresAt: null,
      lastSync: new Date(),
      lastError: null,
      n8nEnabled: Boolean(conn.n8nWebhookUrl),
    });

    await appendConnectorLog({
      integrationId: conn.id,
      action: `Verified & connected Slack (${accountLabel})`,
      status: 'success',
      isSandbox: false,
    });

    return { ok: true, message: `Connected ${accountLabel}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'OAuth connection failed';
    await updateConnectorState(conn.id, {
      connectionStatus: 'ERROR',
      lastError: msg,
    });
    await appendConnectorLog({
      integrationId: conn.id,
      action: `Failed ${params.provider} OAuth callback`,
      status: 'error',
      isSandbox: false,
      errorMessage: msg,
    });
    return { ok: false, message: msg };
  }
}

async function verifyGoogleWorkspaceToken(
  serviceName: 'gmail' | 'google_calendar' | 'google_drive',
  accessToken: string
): Promise<{
  ok: boolean;
  diagnostic: ConnectorDiagnosticMessage;
  detail: string;
  accountLabel?: string;
  grantedScopes?: string[];
  expiresAt?: Date | null;
}> {
  if (!accessToken.trim()) {
    return {
      ok: false,
      diagnostic: 'Invalid configuration',
      detail: 'Missing Google access token. Connect via Sign in with Google first.',
    };
  }

  try {
    const infoRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`,
      { signal: AbortSignal.timeout(7000) }
    );
    if (!infoRes.ok) {
      return {
        ok: false,
        diagnostic: 'Authentication expired',
        detail: 'Google access token expired or invalid. Re-authenticate with Google.',
      };
    }
    const info = (await infoRes.json()) as {
      scope?: string;
      email?: string;
      expires_in?: string;
    };
    const granted = (info.scope || '').split(/\s+/).filter(Boolean);
    const required = getServiceCatalogEntry(serviceName).requiredGoogleScopes;
    const hasAll = required.every((s) => granted.includes(s));
    if (!hasAll) {
      return {
        ok: false,
        diagnostic: 'Missing permissions',
        detail: `Required permissions were not granted (${required.join(', ')}).`,
        grantedScopes: granted,
      };
    }

    const expiresSeconds = Number(info.expires_in || 3600);
    const expiresAt = new Date(Date.now() + expiresSeconds * 1000);

    let apiUrl = 'https://gmail.googleapis.com/gmail/v1/users/me/profile';
    if (serviceName === 'google_calendar') {
      apiUrl = 'https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=3';
    } else if (serviceName === 'google_drive') {
      apiUrl = 'https://www.googleapis.com/drive/v3/about?fields=user,storageQuota';
    }

    const apiRes = await fetch(apiUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(8000),
    });

    if (apiRes.status === 401) {
      return {
        ok: false,
        diagnostic: 'Authentication expired',
        detail: 'Google API rejected the token (401). Please reconnect.',
      };
    }
    if (apiRes.status === 403) {
      return {
        ok: false,
        diagnostic: 'Missing permissions',
        detail: 'Google API returned 403 insufficient permissions or API disabled.',
      };
    }
    if (!apiRes.ok) {
      return {
        ok: false,
        diagnostic: 'API unavailable',
        detail: `Google API returned HTTP ${apiRes.status}.`,
      };
    }

    const body = (await apiRes.json()) as {
      emailAddress?: string;
      user?: { emailAddress?: string; displayName?: string };
    };
    const accountLabel =
      body.emailAddress || body.user?.emailAddress || info.email || 'Google Account';

    return {
      ok: true,
      diagnostic: 'Connection successful',
      detail: `Verified live access for ${accountLabel}.`,
      accountLabel,
      grantedScopes: required,
      expiresAt,
    };
  } catch (err) {
    return {
      ok: false,
      diagnostic: 'API unavailable',
      detail: err instanceof Error ? err.message : 'Unable to reach Google APIs.',
    };
  }
}

export async function connectGoogleService(params: {
  userId: string;
  email: string;
  serviceName: 'gmail' | 'google_calendar' | 'google_drive';
  googleAccessToken: string;
}) {
  await ensureUserConnectorsSeeded(params.userId, params.email);
  const conn = await getConnectorRecord(params.userId, params.serviceName);
  if (!conn) {
    throw new Error('Connector not found.');
  }

  const check = await verifyGoogleWorkspaceToken(
    params.serviceName,
    params.googleAccessToken
  );

  if (!check.ok) {
    await updateConnectorState(conn.id, {
      connectionStatus: 'ERROR',
      sandboxMode: false,
      lastError: `${check.diagnostic}: ${check.detail}`,
    });
    await appendConnectorLog({
      integrationId: conn.id,
      action: `Failed connecting ${conn.displayName}`,
      status: 'error',
      isSandbox: false,
      errorMessage: `${check.diagnostic} — ${check.detail}`,
    });
    return { ok: false, diagnostic: check.diagnostic, detail: check.detail };
  }

  await saveConnectorSecret(
    conn.id,
    {
      accessToken: params.googleAccessToken,
      scope: check.grantedScopes?.join(' '),
    },
    check.expiresAt ?? null
  );

  await updateConnectorState(conn.id, {
    connectionStatus: 'CONNECTED',
    sandboxMode: false,
    accountLabel: check.accountLabel || params.email,
    permissions: check.grantedScopes ?? [],
    tokenExpiresAt: check.expiresAt ?? null,
    lastSync: new Date(),
    lastError: null,
    n8nEnabled: Boolean(conn.n8nWebhookUrl),
  });

  await appendConnectorLog({
    integrationId: conn.id,
    action: `Connected ${conn.displayName} (${check.accountLabel})`,
    status: 'success',
    isSandbox: false,
  });

  return { ok: true, diagnostic: check.diagnostic, detail: check.detail };
}

export async function connectTelegramService(params: {
  userId: string;
  email: string;
  botToken: string;
  chatId: string;
}) {
  await ensureUserConnectorsSeeded(params.userId, params.email);
  const conn = await getConnectorRecord(params.userId, 'telegram');
  if (!conn) throw new Error('Telegram connector not found.');

  const trimmedToken = params.botToken.trim();
  const trimmedChat = params.chatId.trim();

  if (!trimmedToken || !trimmedChat) {
    await updateConnectorState(conn.id, {
      connectionStatus: 'ERROR',
      sandboxMode: false,
      lastError: 'Invalid configuration: Bot Token and Chat ID are required.',
    });
    return {
      ok: false,
      diagnostic: 'Invalid configuration' as ConnectorDiagnosticMessage,
      detail: 'Both Telegram Bot Token and Chat ID are required.',
    };
  }

  try {
    const meRes = await fetch(
      `https://api.telegram.org/bot${encodeURIComponent(trimmedToken)}/getMe`,
      { signal: AbortSignal.timeout(7000) }
    );
    const meJson = (await meRes.json()) as {
      ok?: boolean;
      result?: { username?: string };
      description?: string;
    };

    if (meRes.status === 401 || meRes.status === 404 || !meJson.ok) {
      const detail = meJson.description || 'Invalid Telegram Bot Token.';
      await updateConnectorState(conn.id, {
        connectionStatus: 'ERROR',
        sandboxMode: false,
        lastError: `Invalid configuration: ${detail}`,
      });
      await appendConnectorLog({
        integrationId: conn.id,
        action: 'Telegram verification failed',
        status: 'error',
        isSandbox: false,
        errorMessage: detail,
      });
      return {
        ok: false,
        diagnostic: 'Invalid configuration' as ConnectorDiagnosticMessage,
        detail,
      };
    }

    const botLabel = meJson.result?.username
      ? `@${meJson.result.username} (Chat ${trimmedChat})`
      : `Chat ${trimmedChat}`;

    await saveConnectorSecret(conn.id, {
      botToken: trimmedToken,
      chatId: trimmedChat,
    });

    await updateConnectorState(conn.id, {
      connectionStatus: 'CONNECTED',
      sandboxMode: false,
      accountLabel: botLabel,
      permissions: ['sendMessage', 'getMe', 'ceo_alerts'],
      tokenExpiresAt: null,
      lastSync: new Date(),
      lastError: null,
      n8nEnabled: Boolean(conn.n8nWebhookUrl),
    });

    await appendConnectorLog({
      integrationId: conn.id,
      action: `Connected Telegram Bot ${botLabel}`,
      status: 'success',
      isSandbox: false,
    });

    return {
      ok: true,
      diagnostic: 'Connection successful' as ConnectorDiagnosticMessage,
      detail: `Verified Telegram Bot ${botLabel}.`,
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'Telegram API unreachable.';
    await updateConnectorState(conn.id, {
      connectionStatus: 'ERROR',
      sandboxMode: false,
      lastError: `API unavailable: ${detail}`,
    });
    return {
      ok: false,
      diagnostic: 'API unavailable' as ConnectorDiagnosticMessage,
      detail,
    };
  }
}

async function refreshOutlookTokenIfNeeded(
  userId: string,
  integrationId: number,
  currentExpiresAt: Date | null,
  forceRefresh: boolean = false
): Promise<{
  ok: boolean;
  accessToken: string | null;
  detail: string;
}> {
  const secrets = await loadConnectorSecret(integrationId);
  if (!secrets.accessToken) {
    return {
      ok: false,
      accessToken: null,
      detail: 'Microsoft Outlook is not authenticated yet.',
    };
  }

  const isExpired =
    currentExpiresAt !== null && currentExpiresAt.getTime() <= Date.now() + 60_000;
  if (!isExpired && !forceRefresh) {
    return {
      ok: true,
      accessToken: secrets.accessToken,
      detail: 'Access token is valid.',
    };
  }

  const creds = await getDecryptedOAuthAppCredentials(userId, 'outlook');
  if (!secrets.refreshToken || !creds.configured) {
    if (isExpired) {
      await updateConnectorState(integrationId, {
        connectionStatus: 'ERROR',
        lastError:
          'Authentication expired: No refresh token or Outlook OAuth app config available.',
      });
      return {
        ok: false,
        accessToken: null,
        detail: 'Access token expired and refresh token is unavailable.',
      };
    }
    return {
      ok: true,
      accessToken: secrets.accessToken,
      detail: 'Using active access token.',
    };
  }

  try {
    const tenant = creds.tenantId || 'common';
    const res = await fetch(
      `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: creds.clientId,
          client_secret: creds.clientSecret,
          grant_type: 'refresh_token',
          refresh_token: secrets.refreshToken,
          scope: 'User.Read Mail.Read Mail.ReadWrite offline_access',
        }),
        signal: AbortSignal.timeout(9000),
      }
    );
    const json = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
      error_description?: string;
    };
    if (!res.ok || !json.access_token) {
      const errDetail =
        json.error_description || `Microsoft token refresh rejected (HTTP ${res.status}).`;
      await updateConnectorState(integrationId, {
        connectionStatus: 'ERROR',
        lastError: `Authentication expired: ${errDetail}`,
      });
      await appendConnectorLog({
        integrationId,
        action: 'Microsoft Outlook token refresh failed',
        status: 'error',
        isSandbox: false,
        errorMessage: errDetail,
      });
      return { ok: false, accessToken: null, detail: errDetail };
    }

    const nextExpires = json.expires_in
      ? new Date(Date.now() + json.expires_in * 1000)
      : null;

    await saveConnectorSecret(
      integrationId,
      {
        accessToken: json.access_token,
        refreshToken: json.refresh_token || secrets.refreshToken,
        scope: json.scope || secrets.scope,
      },
      nextExpires
    );
    await updateConnectorState(integrationId, {
      connectionStatus: 'CONNECTED',
      tokenExpiresAt: nextExpires,
      lastSync: new Date(),
      lastError: null,
    });
    await appendConnectorLog({
      integrationId,
      action: 'Refreshed Microsoft Outlook OAuth access token',
      status: 'success',
      isSandbox: false,
    });
    return {
      ok: true,
      accessToken: json.access_token,
      detail: 'Microsoft Outlook access token refreshed successfully.',
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'Token refresh request failed.';
    return {
      ok: !isExpired,
      accessToken: isExpired ? null : secrets.accessToken,
      detail,
    };
  }
}

export async function refreshConnectorToken(params: {
  userId: string;
  email: string;
  serviceName: ConnectorServiceKey;
}): Promise<{
  ok: boolean;
  diagnostic: ConnectorDiagnosticMessage;
  detail: string;
}> {
  await ensureUserConnectorsSeeded(params.userId, params.email);
  const conn = await getConnectorRecord(params.userId, params.serviceName);
  if (!conn) throw new Error('Connector not found.');

  if (conn.sandboxMode || conn.connectionStatus === 'SANDBOX MODE') {
    return {
      ok: false,
      diagnostic: 'Invalid configuration',
      detail: 'Connector is in Sandbox Mode. Connect a live account first.',
    };
  }

  if (params.serviceName !== 'outlook') {
    return {
      ok: false,
      diagnostic: 'Invalid configuration',
      detail: `${conn.displayName} uses ${conn.authenticationType} tokens managed via reconnect.`,
    };
  }

  const refreshResult = await refreshOutlookTokenIfNeeded(
    params.userId,
    conn.id,
    conn.tokenExpiresAt,
    true
  );
  return {
    ok: refreshResult.ok,
    diagnostic: refreshResult.ok ? 'Connection successful' : 'Authentication expired',
    detail: refreshResult.detail,
  };
}

export async function testConnectorConnection(params: {
  userId: string;
  email: string;
  serviceName: ConnectorServiceKey;
  googleAccessToken?: string;
}): Promise<{
  ok: boolean;
  diagnostic: ConnectorDiagnosticMessage;
  detail: string;
  sandboxSimulated: boolean;
}> {
  await ensureUserConnectorsSeeded(params.userId, params.email);
  const conn = await getConnectorRecord(params.userId, params.serviceName);
  if (!conn) throw new Error('Connector not found.');

  if (conn.sandboxMode || conn.connectionStatus === 'SANDBOX MODE') {
    await updateConnectorState(conn.id, {
      connectionStatus: 'SANDBOX MODE',
      lastSync: new Date(),
      lastError: null,
    });
    await appendConnectorLog({
      integrationId: conn.id,
      action: `[SANDBOX] Connection test simulated for ${conn.displayName}`,
      status: 'sandbox',
      isSandbox: true,
    });
    return {
      ok: true,
      diagnostic: 'Connection successful',
      detail:
        '[SANDBOX] Simulated check succeeded with sample data. External accounts were not contacted.',
      sandboxSimulated: true,
    };
  }

  const secrets = await loadConnectorSecret(conn.id);

  if (
    params.serviceName === 'gmail' ||
    params.serviceName === 'google_calendar' ||
    params.serviceName === 'google_drive'
  ) {
    const token = params.googleAccessToken?.trim() || secrets.accessToken || '';
    if (!token) {
      await updateConnectorState(conn.id, {
        connectionStatus: 'NOT CONNECTED',
        lastError: 'Invalid configuration: Connect with Google to test live access.',
      });
      await appendConnectorLog({
        integrationId: conn.id,
        action: `Test failed for ${conn.displayName}`,
        status: 'error',
        isSandbox: false,
        errorMessage: 'Invalid configuration',
      });
      return {
        ok: false,
        diagnostic: 'Invalid configuration',
        detail: 'No Google OAuth token is active. Click Connect to sign in with Google.',
        sandboxSimulated: false,
      };
    }

    const res = await verifyGoogleWorkspaceToken(params.serviceName, token);
    await updateConnectorState(conn.id, {
      connectionStatus: res.ok ? 'CONNECTED' : 'ERROR',
      lastSync: res.ok ? new Date() : conn.lastSync,
      lastError: res.ok ? null : `${res.diagnostic}: ${res.detail}`,
    });
    await appendConnectorLog({
      integrationId: conn.id,
      action: `Connection test (${res.diagnostic})`,
      status: res.ok ? 'success' : 'error',
      isSandbox: false,
      errorMessage: res.ok ? null : res.detail,
    });
    return {
      ok: res.ok,
      diagnostic: res.diagnostic,
      detail: res.detail,
      sandboxSimulated: false,
    };
  }

  if (params.serviceName === 'outlook') {
    const outlookCreds = await getDecryptedOAuthAppCredentials(params.userId, 'outlook');
    if (!outlookCreds.configured) {
      return {
        ok: false,
        diagnostic: 'Invalid configuration',
        detail:
          'MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET are not configured. Use OAuth App Credentials or AI Studio Secrets.',
        sandboxSimulated: false,
      };
    }
    const tokenResult = await refreshOutlookTokenIfNeeded(
      params.userId,
      conn.id,
      conn.tokenExpiresAt
    );
    if (!tokenResult.ok || !tokenResult.accessToken) {
      return {
        ok: false,
        diagnostic: 'Authentication expired',
        detail: tokenResult.detail,
        sandboxSimulated: false,
      };
    }
    try {
      const res = await fetch('https://graph.microsoft.com/v1.0/me/messages?$top=1', {
        headers: { Authorization: `Bearer ${tokenResult.accessToken}` },
        signal: AbortSignal.timeout(8000),
      });
      const diagnostic: ConnectorDiagnosticMessage = res.ok
        ? 'Connection successful'
        : res.status === 401
          ? 'Authentication expired'
          : res.status === 403
            ? 'Missing permissions'
            : 'API unavailable';
      const detail = res.ok
        ? 'Verified live Microsoft Graph Mail.Read access.'
        : `Microsoft Graph returned HTTP ${res.status}.`;
      await updateConnectorState(conn.id, {
        connectionStatus: res.ok ? 'CONNECTED' : 'ERROR',
        lastSync: res.ok ? new Date() : conn.lastSync,
        lastError: res.ok ? null : `${diagnostic}: ${detail}`,
      });
      await appendConnectorLog({
        integrationId: conn.id,
        action: `Outlook connection test (${diagnostic})`,
        status: res.ok ? 'success' : 'error',
        isSandbox: false,
        errorMessage: res.ok ? null : detail,
      });
      return { ok: res.ok, diagnostic, detail, sandboxSimulated: false };
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Microsoft Graph unavailable.';
      return {
        ok: false,
        diagnostic: 'API unavailable',
        detail,
        sandboxSimulated: false,
      };
    }
  }

  if (params.serviceName === 'slack') {
    const slackCreds = await getDecryptedOAuthAppCredentials(params.userId, 'slack');
    if (!slackCreds.configured) {
      return {
        ok: false,
        diagnostic: 'Invalid configuration',
        detail:
          'SLACK_CLIENT_ID and SLACK_CLIENT_SECRET are not configured. Use OAuth App Credentials or AI Studio Secrets.',
        sandboxSimulated: false,
      };
    }
    if (!secrets.accessToken) {
      return {
        ok: false,
        diagnostic: 'Invalid configuration',
        detail: 'Slack workspace is not connected yet.',
        sandboxSimulated: false,
      };
    }
    try {
      const res = await fetch('https://slack.com/api/auth.test', {
        method: 'POST',
        headers: { Authorization: `Bearer ${secrets.accessToken}` },
        signal: AbortSignal.timeout(7000),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; team?: string };
      const ok = Boolean(res.ok && json.ok);
      const diagnostic: ConnectorDiagnosticMessage = ok
        ? 'Connection successful'
        : json.error === 'token_expired' || json.error === 'invalid_auth'
          ? 'Authentication expired'
          : json.error === 'missing_scope'
            ? 'Missing permissions'
            : 'API unavailable';
      const detail = ok
        ? `Slack auth.test succeeded (${json.team || 'Workspace'}).`
        : json.error || `Slack HTTP ${res.status}`;
      await updateConnectorState(conn.id, {
        connectionStatus: ok ? 'CONNECTED' : 'ERROR',
        lastSync: ok ? new Date() : conn.lastSync,
        lastError: ok ? null : `${diagnostic}: ${detail}`,
      });
      await appendConnectorLog({
        integrationId: conn.id,
        action: `Slack connection test (${diagnostic})`,
        status: ok ? 'success' : 'error',
        isSandbox: false,
        errorMessage: ok ? null : detail,
      });
      return { ok, diagnostic, detail, sandboxSimulated: false };
    } catch (err) {
      return {
        ok: false,
        diagnostic: 'API unavailable',
        detail: err instanceof Error ? err.message : 'Slack API unreachable.',
        sandboxSimulated: false,
      };
    }
  }

  // Telegram
  if (!secrets.botToken || !secrets.chatId) {
    return {
      ok: false,
      diagnostic: 'Invalid configuration',
      detail: 'Configure Telegram Bot Token and Chat ID first.',
      sandboxSimulated: false,
    };
  }
  return connectTelegramService({
    userId: params.userId,
    email: params.email,
    botToken: secrets.botToken,
    chatId: secrets.chatId,
  }).then((r) => ({ ...r, sandboxSimulated: false }));
}

export async function disconnectConnectorService(params: {
  userId: string;
  email: string;
  serviceName: ConnectorServiceKey;
}) {
  await ensureUserConnectorsSeeded(params.userId, params.email);
  const conn = await getConnectorRecord(params.userId, params.serviceName);
  if (!conn) throw new Error('Connector not found.');

  const secrets = await loadConnectorSecret(conn.id);

  // Best-effort token revocation on supported OAuth providers
  if (secrets.accessToken) {
    if (
      params.serviceName === 'gmail' ||
      params.serviceName === 'google_calendar' ||
      params.serviceName === 'google_drive'
    ) {
      await fetch(
        `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(secrets.accessToken)}`,
        { method: 'POST', signal: AbortSignal.timeout(5000) }
      ).catch(() => undefined);
    } else if (params.serviceName === 'slack') {
      await fetch('https://slack.com/api/auth.revoke', {
        method: 'POST',
        headers: { Authorization: `Bearer ${secrets.accessToken}` },
        signal: AbortSignal.timeout(5000),
      }).catch(() => undefined);
    } else if (params.serviceName === 'outlook') {
      await fetch('https://graph.microsoft.com/v1.0/me/revokeSignInSessions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${secrets.accessToken}` },
        signal: AbortSignal.timeout(5000),
      }).catch(() => undefined);
    }
  }

  await deleteConnectorSecret(conn.id);
  const stillConfigured = await isProviderOAuthConfiguredForUser(
    params.userId,
    params.serviceName
  );
  const revertToSandbox = !stillConfigured || params.serviceName === 'telegram';

  await updateConnectorState(conn.id, {
    connectionStatus: revertToSandbox ? 'SANDBOX MODE' : 'NOT CONNECTED',
    permissions: [],
    accountLabel: '',
    sandboxMode: revertToSandbox,
    n8nEnabled: false,
    tokenExpiresAt: null,
    lastError: null,
  });

  await appendConnectorLog({
    integrationId: conn.id,
    action: `Disconnected ${conn.displayName}, revoked credentials, and stopped automation workflow`,
    status: 'warning',
    isSandbox: revertToSandbox,
  });
}

export async function disconnectAllConnectorsWithAudit(
  userId: string,
  email: string
) {
  await ensureUserConnectorsSeeded(userId, email);
  const dashboard = await getConnectorDashboard(userId, email);

  // Best-effort revoke live tokens before wiping
  for (const conn of dashboard.connections) {
    if (conn.hasStoredSecret) {
      const secrets = await loadConnectorSecret(conn.id);
      if (secrets.accessToken) {
        if (conn.serviceName === 'slack') {
          await fetch('https://slack.com/api/auth.revoke', {
            method: 'POST',
            headers: { Authorization: `Bearer ${secrets.accessToken}` },
            signal: AbortSignal.timeout(4000),
          }).catch(() => undefined);
        } else if (conn.serviceName === 'outlook') {
          await fetch('https://graph.microsoft.com/v1.0/me/revokeSignInSessions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${secrets.accessToken}` },
            signal: AbortSignal.timeout(4000),
          }).catch(() => undefined);
        } else if (
          conn.serviceName === 'gmail' ||
          conn.serviceName === 'google_calendar' ||
          conn.serviceName === 'google_drive'
        ) {
          await fetch(
            `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(secrets.accessToken)}`,
            { method: 'POST', signal: AbortSignal.timeout(4000) }
          ).catch(() => undefined);
        }
      }
    }
  }

  const ids = await disconnectAllUserConnectors(userId);
  for (const id of ids) {
    await appendConnectorLog({
      integrationId: id,
      action: 'Security Center: Disconnected all integrations and wiped stored credentials',
      status: 'warning',
      isSandbox: true,
    });
  }
}

export async function saveOAuthAppCredentialsBundle(params: {
  userId: string;
  email: string;
  outlook?: { clientId?: string; clientSecret?: string; tenantId?: string };
  slack?: { clientId?: string; clientSecret?: string };
  encryptionKey?: string;
}): Promise<{ updated: string[] }> {
  await ensureUserConnectorsSeeded(params.userId, params.email);
  const updated: string[] = [];

  if (params.encryptionKey && params.encryptionKey.trim()) {
    if (isEncryptionKeyFromEnv()) {
      throw new Error(
        'INTEGRATIONS_ENCRYPTION_KEY is configured via server environment variables and cannot be changed in the UI.'
      );
    }
    const { oldKey, newKey } = commitCustomVaultKey(params.encryptionKey.trim());
    try {
      await rotateAllVaultSecrets(oldKey, newKey);
      updated.push('INTEGRATIONS_ENCRYPTION_KEY');
    } catch (err) {
      restoreVaultKeyBuffer(oldKey);
      throw new Error('Failed rotating encrypted vault records.', { cause: err });
    }
  }

  if (
    params.outlook &&
    (params.outlook.clientId?.trim() ||
      params.outlook.clientSecret?.trim() ||
      params.outlook.tenantId?.trim())
  ) {
    await saveUserOAuthAppConfig({
      userId: params.userId,
      email: params.email,
      provider: 'outlook',
      clientId: params.outlook.clientId,
      clientSecret: params.outlook.clientSecret,
      tenantId: params.outlook.tenantId,
    });
    const conn = await getConnectorRecord(params.userId, 'outlook');
    if (conn) {
      if (conn.connectionStatus === 'SANDBOX MODE') {
        await updateConnectorState(conn.id, {
          connectionStatus: 'NOT CONNECTED',
          sandboxMode: false,
          lastError: null,
        });
      }
      await appendConnectorLog({
        integrationId: conn.id,
        action: 'Updated encrypted Microsoft Outlook OAuth app credentials in backend vault',
        status: 'success',
        isSandbox: false,
      });
    }
    updated.push('Microsoft Outlook OAuth');
  }

  if (
    params.slack &&
    (params.slack.clientId?.trim() || params.slack.clientSecret?.trim())
  ) {
    await saveUserOAuthAppConfig({
      userId: params.userId,
      email: params.email,
      provider: 'slack',
      clientId: params.slack.clientId,
      clientSecret: params.slack.clientSecret,
    });
    const conn = await getConnectorRecord(params.userId, 'slack');
    if (conn) {
      if (conn.connectionStatus === 'SANDBOX MODE') {
        await updateConnectorState(conn.id, {
          connectionStatus: 'NOT CONNECTED',
          sandboxMode: false,
          lastError: null,
        });
      }
      await appendConnectorLog({
        integrationId: conn.id,
        action: 'Updated encrypted Slack OAuth app credentials in backend vault',
        status: 'success',
        isSandbox: false,
      });
    }
    updated.push('Slack OAuth');
  }

  return { updated };
}

export async function clearOAuthAppCredentials(params: {
  userId: string;
  email: string;
  provider: 'outlook' | 'slack';
}): Promise<void> {
  await ensureUserConnectorsSeeded(params.userId, params.email);
  await disconnectConnectorService({
    userId: params.userId,
    email: params.email,
    serviceName: params.provider,
  });
  await deleteUserOAuthAppConfig(params.userId, params.provider);

  const stillConfigured = await isProviderOAuthConfiguredForUser(
    params.userId,
    params.provider
  );
  const conn = await getConnectorRecord(params.userId, params.provider);
  if (conn) {
    if (!stillConfigured) {
      await updateConnectorState(conn.id, {
        connectionStatus: 'SANDBOX MODE',
        sandboxMode: true,
        lastError: null,
      });
    }
    await appendConnectorLog({
      integrationId: conn.id,
      action: `Cleared vault OAuth app credentials for ${conn.displayName}`,
      status: 'warning',
      isSandbox: !stillConfigured,
    });
  }
}

export async function executeConnectorAction(params: {
  userId: string;
  email: string;
  serviceName: ConnectorServiceKey;
  employeeId: BotId;
  employeeName: string;
  action: string;
  requiredPermission?: ConnectorPermissionLevel;
  googleAccessToken?: string;
  payload?: Record<string, unknown>;
}) {
  const dashboard = await getConnectorDashboard(params.userId, params.email);
  const permCheck = canEmployeeUseConnector(
    dashboard.employeePermissions,
    params.employeeId,
    params.serviceName,
    params.requiredPermission ?? 'read'
  );
  const conn = dashboard.connections.find(
    (c) => c.serviceName === params.serviceName
  );
  if (!conn) throw new Error('Connector not found.');

  if (!permCheck.allowed) {
    await appendConnectorLog({
      integrationId: conn.id,
      employeeId: params.employeeId,
      action: `Blocked ${params.employeeName} from ${params.action}`,
      status: 'error',
      isSandbox: conn.sandboxMode,
      errorMessage: permCheck.reason,
    });
    throw new Error(permCheck.reason || 'Employee permission denied.');
  }

  if (conn.sandboxMode || conn.connectionStatus !== 'CONNECTED') {
    const simulated = buildSandboxExecutionPreview(
      params.serviceName,
      params.action,
      params.employeeName
    );
    await appendConnectorLog({
      integrationId: conn.id,
      employeeId: params.employeeId,
      action: `[SANDBOX] ${params.employeeName}: ${params.action}`,
      status: 'sandbox',
      isSandbox: true,
    });
    return {
      isSandbox: true,
      badge: simulated.badge,
      summary: simulated.summary,
      data: simulated.sampleData,
    };
  }

  const secrets = await loadConnectorSecret(conn.id);
  const token = params.googleAccessToken?.trim() || secrets.accessToken || '';

  if (params.serviceName === 'gmail') {
    const res = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5',
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(8000),
      }
    );
    const json = (await res.json()) as { messages?: Array<{ id: string }> };
    if (!res.ok) throw new Error(`Gmail API returned HTTP ${res.status}`);
    await updateConnectorState(conn.id, { lastSync: new Date() });
    await appendConnectorLog({
      integrationId: conn.id,
      employeeId: params.employeeId,
      action: `${params.employeeName} synced live Gmail threads`,
      status: 'success',
      isSandbox: false,
    });
    return {
      isSandbox: false,
      badge: 'LIVE' as const,
      summary: `${params.employeeName} fetched ${json.messages?.length ?? 0} Gmail message IDs from ${conn.accountLabel}.`,
      data: json,
    };
  }

  if (params.serviceName === 'google_calendar') {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=5&timeMin=${encodeURIComponent(
        new Date().toISOString()
      )}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(8000),
      }
    );
    const json = (await res.json()) as {
      items?: Array<{ summary?: string; start?: { dateTime?: string; date?: string } }>;
    };
    if (!res.ok) throw new Error(`Google Calendar API returned HTTP ${res.status}`);
    await updateConnectorState(conn.id, { lastSync: new Date() });
    await appendConnectorLog({
      integrationId: conn.id,
      employeeId: params.employeeId,
      action: `${params.employeeName} synced upcoming Google Calendar events`,
      status: 'success',
      isSandbox: false,
    });
    return {
      isSandbox: false,
      badge: 'LIVE' as const,
      summary: `${params.employeeName} retrieved ${json.items?.length ?? 0} upcoming calendar events.`,
      data: json,
    };
  }

  if (params.serviceName === 'google_drive') {
    const res = await fetch(
      'https://www.googleapis.com/drive/v3/files?pageSize=8&fields=files(id,name,mimeType,modifiedTime)',
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(8000),
      }
    );
    const json = (await res.json()) as {
      files?: Array<{ id: string; name: string; mimeType: string }>;
    };
    if (!res.ok) throw new Error(`Google Drive API returned HTTP ${res.status}`);
    await updateConnectorState(conn.id, { lastSync: new Date() });
    await appendConnectorLog({
      integrationId: conn.id,
      employeeId: params.employeeId,
      action: `${params.employeeName} listed authorized Google Drive files`,
      status: 'success',
      isSandbox: false,
    });
    return {
      isSandbox: false,
      badge: 'LIVE' as const,
      summary: `${params.employeeName} found ${json.files?.length ?? 0} authorized Drive files.`,
      data: json,
    };
  }

  if (params.serviceName === 'outlook') {
    const tokenRes = await refreshOutlookTokenIfNeeded(
      params.userId,
      conn.id,
      conn.tokenExpiresAt ? new Date(conn.tokenExpiresAt) : null
    );
    if (!tokenRes.ok || !tokenRes.accessToken) {
      throw new Error(tokenRes.detail || 'Microsoft Outlook authentication expired.');
    }
    const res = await fetch('https://graph.microsoft.com/v1.0/me/messages?$top=5', {
      headers: { Authorization: `Bearer ${tokenRes.accessToken}` },
      signal: AbortSignal.timeout(8000),
    });
    const json = (await res.json()) as { value?: Array<{ subject?: string }> };
    if (!res.ok) throw new Error(`Microsoft Graph API returned HTTP ${res.status}`);
    await updateConnectorState(conn.id, { lastSync: new Date() });
    await appendConnectorLog({
      integrationId: conn.id,
      employeeId: params.employeeId,
      action: `${params.employeeName} synced live Outlook messages`,
      status: 'success',
      isSandbox: false,
    });
    return {
      isSandbox: false,
      badge: 'LIVE' as const,
      summary: `${params.employeeName} fetched ${json.value?.length ?? 0} Outlook messages.`,
      data: json,
    };
  }

  if (params.serviceName === 'slack') {
    const res = await fetch('https://slack.com/api/conversations.list?limit=5', {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(7000),
    });
    const json = (await res.json()) as { ok?: boolean; channels?: Array<{ name: string }> };
    if (!res.ok || !json.ok) throw new Error('Slack API query failed.');
    await updateConnectorState(conn.id, { lastSync: new Date() });
    await appendConnectorLog({
      integrationId: conn.id,
      employeeId: params.employeeId,
      action: `${params.employeeName} verified Slack channels`,
      status: 'success',
      isSandbox: false,
    });
    return {
      isSandbox: false,
      badge: 'LIVE' as const,
      summary: `${params.employeeName} listed ${json.channels?.length ?? 0} Slack channels.`,
      data: json,
    };
  }

  // Telegram live send
  const msgText = String(
    params.payload?.message ||
      `ROBOT OFFICE AI (${params.employeeName}): ${params.action}`
  );
  const res = await fetch(
    `https://api.telegram.org/bot${encodeURIComponent(secrets.botToken || '')}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: secrets.chatId,
        text: msgText,
      }),
      signal: AbortSignal.timeout(7000),
    }
  );
  if (!res.ok) throw new Error(`Telegram API returned HTTP ${res.status}`);
  await updateConnectorState(conn.id, { lastSync: new Date() });
  await appendConnectorLog({
    integrationId: conn.id,
    employeeId: params.employeeId,
    action: `${params.employeeName} sent live Telegram notification`,
    status: 'success',
    isSandbox: false,
  });
  return {
    isSandbox: false,
    badge: 'LIVE' as const,
    summary: `${params.employeeName} delivered a live Telegram alert.`,
    data: { delivered: true },
  };
}
