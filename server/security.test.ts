import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertFirebaseAccountCanBeLinked,
  FirebaseAccountConflictError,
  sanitizeDemoConnectorDashboard,
  sanitizeDemoIntegrations,
  serializeInlineScriptValue,
} from './security.ts';
import type {
  ConnectorDashboardPayload,
  IntegrationConfig,
} from '../src/shared/types.ts';

test('Firebase users cannot claim an existing account by matching its email', () => {
  assert.throws(
    () => assertFirebaseAccountCanBeLinked('firebase-uid', 'password-user-id'),
    FirebaseAccountConflictError
  );
  assert.doesNotThrow(() =>
    assertFirebaseAccountCanBeLinked('firebase-uid', 'firebase-uid')
  );
});

test('inline script serialization escapes HTML-sensitive characters', () => {
  const serialized = serializeInlineScriptValue({
    message: '</script><script>alert(1)</script>&',
  });

  assert.equal(serialized.includes('<'), false);
  assert.equal(serialized.includes('&'), false);
  assert.deepEqual(JSON.parse(serialized), {
    message: '</script><script>alert(1)</script>&',
  });
});

test('demo integration payloads hide credentials and endpoint details', () => {
  const integrations: IntegrationConfig[] = [
    {
      id: 'n8n_alex',
      name: 'Alex Workflow',
      category: 'automation',
      connected: true,
      endpointUrl: 'https://hooks.example.test/secret',
      accountLabel: 'private account',
      lastTestedAt: '2025-01-01T00:00:00.000Z',
      lastStatus: 'Connected',
    },
  ];

  assert.deepEqual(sanitizeDemoIntegrations(integrations), [
    {
      ...integrations[0],
      connected: false,
      endpointUrl: '',
      accountLabel: '',
      lastTestedAt: null,
      lastStatus: 'Disabled in demo mode',
    },
  ]);
});

test('demo connector dashboard hides stored connection and activity details', () => {
  const dashboard = {
    connections: [
      {
        id: 1,
        serviceName: 'gmail',
        displayName: 'Gmail',
        description: 'Mail',
        connectionStatus: 'CONNECTED',
        authenticationType: 'Google OAuth 2.0',
        permissions: ['mail.read'],
        availablePermissions: ['mail.read'],
        accountLabel: 'private@example.test',
        sandboxMode: false,
        n8nWorkflowName: 'Private workflow',
        n8nWebhookUrl: 'https://hooks.example.test/private',
        n8nEnabled: true,
        tokenExpiresAt: '2025-01-01T00:00:00.000Z',
        tokenExpirationStatus: 'Valid',
        lastSync: '2025-01-01T00:00:00.000Z',
        lastError: 'private error',
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
        hasStoredSecret: true,
        oauthConfigured: true,
        credentialSource: 'vault',
        clientIdHint: 'secret-client',
      },
    ],
    employeePermissions: [],
    activityLogs: [],
    oauthAppStatuses: {
      outlook: {
        provider: 'outlook',
        configured: true,
        source: 'env',
        clientIdHint: 'secret-client',
      },
      slack: {
        provider: 'slack',
        configured: true,
        source: 'env',
        clientIdHint: 'secret-client',
      },
    },
    encryptionKeySource: 'env',
    callbackUrls: {
      outlookDev: 'http://localhost/api/oauth/outlook/callback',
      outlookShared: 'https://app.example.test/api/oauth/outlook/callback',
      slackDev: 'http://localhost/api/oauth/slack/callback',
      slackShared: 'https://app.example.test/api/oauth/slack/callback',
    },
  } satisfies ConnectorDashboardPayload;

  const sanitized = sanitizeDemoConnectorDashboard(dashboard);
  assert.equal(sanitized.connections[0].connectionStatus, 'SANDBOX MODE');
  assert.equal(sanitized.connections[0].n8nWebhookUrl, '');
  assert.equal(sanitized.connections[0].hasStoredSecret, false);
  assert.equal(sanitized.oauthAppStatuses.outlook.configured, false);
  assert.equal(sanitized.oauthAppStatuses.outlook.clientIdHint, null);
});
