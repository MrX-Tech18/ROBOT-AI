import type {
  ConnectorDashboardPayload,
  IntegrationConfig,
} from '../src/shared/types.ts';

export class FirebaseAccountConflictError extends Error {
  constructor() {
    super('This email already belongs to an account. Sign in with that account or link it from Firebase.');
    this.name = 'FirebaseAccountConflictError';
  }
}

export function assertFirebaseAccountCanBeLinked(
  firebaseUid: string,
  existingUserId: string
): void {
  if (firebaseUid !== existingUserId) {
    throw new FirebaseAccountConflictError();
  }
}

export function serializeInlineScriptValue(value: unknown): string {
  return (JSON.stringify(value) ?? 'null').replace(/[<>&\u2028\u2029]/g, (char) => {
    switch (char) {
      case '<':
        return '\\u003c';
      case '>':
        return '\\u003e';
      case '&':
        return '\\u0026';
      case '\u2028':
        return '\\u2028';
      default:
        return '\\u2029';
    }
  });
}

export function sanitizeDemoIntegrations(
  integrations: IntegrationConfig[]
): IntegrationConfig[] {
  return integrations.map((integration) => ({
    ...integration,
    connected: false,
    endpointUrl: '',
    accountLabel: '',
    lastTestedAt: null,
    lastStatus: 'Disabled in demo mode',
  }));
}

export function sanitizeDemoConnectorDashboard(
  dashboard: ConnectorDashboardPayload
): ConnectorDashboardPayload {
  return {
    ...dashboard,
    connections: dashboard.connections.map((connection) => ({
      ...connection,
      connectionStatus: 'SANDBOX MODE',
      permissions: [],
      accountLabel: '',
      sandboxMode: true,
      n8nWorkflowName: '',
      n8nWebhookUrl: '',
      n8nEnabled: false,
      tokenExpiresAt: null,
      lastSync: null,
      lastError: null,
      hasStoredSecret: false,
      oauthConfigured: false,
      credentialSource: 'none',
      clientIdHint: null,
    })),
    employeePermissions: [],
    activityLogs: [],
    oauthAppStatuses: {
      outlook: {
        provider: 'outlook',
        configured: false,
        source: 'none',
        clientIdHint: null,
      },
      slack: {
        provider: 'slack',
        configured: false,
        source: 'none',
        clientIdHint: null,
      },
    },
  };
}
