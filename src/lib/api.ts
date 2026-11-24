import type {
  BotId,
  ConnectorDashboardPayload,
  ConnectorDiagnosticMessage,
  ConnectorPermissionLevel,
  ConnectorServiceKey,
  EmployeePermissions,
  OAuthSetupInstructionPayload,
  UserProfile,
  WorkspacePayload,
} from '../shared/types';

let inMemoryToken: string | null = null;

export function setAuthToken(token: string | null): void {
  inMemoryToken = token;
}

export function getAuthToken(): string | null {
  return inMemoryToken;
}

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (inMemoryToken) {
    headers.set('Authorization', `Bearer ${inMemoryToken}`);
  }

  const res = await fetch(url, { ...options, headers });
  const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`) as Error & {
      payload?: unknown;
    };
    err.payload = data;
    throw err;
  }
  return data;
}

export const api = {
  async login(email: string, password: string): Promise<{ token: string; user: UserProfile }> {
    const res = await apiFetch<{ token: string; user: UserProfile }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setAuthToken(res.token);
    return res;
  },

  async loginWithFirebase(idToken: string): Promise<{ token: string; user: UserProfile }> {
    setAuthToken(idToken);
    const res = await apiFetch<{ token: string; user: UserProfile }>('/api/auth/firebase', {
      method: 'POST',
    });
    setAuthToken(res.token);
    return res;
  },

  async register(params: {
    name: string;
    email: string;
    companyName: string;
    password: string;
  }): Promise<{ token: string; user: UserProfile }> {
    const res = await apiFetch<{ token: string; user: UserProfile }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    setAuthToken(res.token);
    return res;
  },

  async enterDemo(): Promise<{ token: string; user: UserProfile }> {
    const res = await apiFetch<{ token: string; user: UserProfile }>('/api/auth/demo', {
      method: 'POST',
    });
    setAuthToken(res.token);
    return res;
  },

  async logout(): Promise<void> {
    if (inMemoryToken) {
      await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    }
    setAuthToken(null);
  },

  async getWorkspace(): Promise<WorkspacePayload> {
    return apiFetch<WorkspacePayload>('/api/workspace');
  },

  async updateProfile(updates: {
    theme?: 'light' | 'dark';
    name?: string;
    companyName?: string;
  }): Promise<{ user: UserProfile }> {
    return apiFetch<{ user: UserProfile }>('/api/settings/profile', {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  async sendCommand(command: string): Promise<{
    workspace: WorkspacePayload;
    taskId: string;
    approvalId?: string;
  }> {
    return apiFetch('/api/command', {
      method: 'POST',
      body: JSON.stringify({ command }),
    });
  },

  async chatWithEmployee(botId: BotId, message: string): Promise<{ workspace: WorkspacePayload }> {
    return apiFetch(`/api/employees/${botId}/chat`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  },

  async updateEmployee(
    botId: BotId,
    updates: {
      enabled?: boolean;
      systemPrompt?: string;
      permissions?: EmployeePermissions;
      status?: 'idle' | 'paused';
    }
  ): Promise<{ workspace: WorkspacePayload }> {
    return apiFetch(`/api/employees/${botId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  async createTask(params: {
    title: string;
    description: string;
    assignedTo: BotId;
    priority: 'critical' | 'high' | 'normal' | 'low';
    runImmediately: boolean;
  }): Promise<{ workspace: WorkspacePayload }> {
    return apiFetch('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  async updateTaskStatus(
    taskId: string,
    status: 'cancelled' | 'completed' | 'queued'
  ): Promise<{ workspace: WorkspacePayload }> {
    return apiFetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  async addEmail(params: {
    provider: 'gmail' | 'outlook';
    senderName: string;
    senderEmail: string;
    subject: string;
    body: string;
  }): Promise<{ workspace: WorkspacePayload }> {
    return apiFetch('/api/emails', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  async triageEmails(): Promise<{ workspace: WorkspacePayload; message?: string }> {
    return apiFetch('/api/emails/triage', { method: 'POST' });
  },

  async addCalendarEvent(params: {
    title: string;
    startIso: string;
    endIso: string;
    attendees: string[];
    location: string;
    notes: string;
    sendExternalInvite: boolean;
  }): Promise<{ workspace: WorkspacePayload }> {
    return apiFetch('/api/calendar', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  async decideApproval(
    approvalId: string,
    decision: 'approved' | 'rejected',
    note?: string
  ): Promise<{ workspace: WorkspacePayload }> {
    return apiFetch(`/api/approvals/${approvalId}/decide`, {
      method: 'POST',
      body: JSON.stringify({ decision, note }),
    });
  },

  async markNotificationsRead(): Promise<{ workspace: WorkspacePayload }> {
    return apiFetch('/api/notifications/read', { method: 'POST' });
  },

  async updateIntegration(
    integrationId: string,
    updates: {
      connected?: boolean;
      endpointUrl?: string;
      accountLabel?: string;
      secretValue?: string;
    }
  ): Promise<{ workspace: WorkspacePayload }> {
    return apiFetch(`/api/integrations/${integrationId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async testIntegration(
    integrationId: string
  ): Promise<{ ok: boolean; statusText?: string; workspace: WorkspacePayload }> {
    return apiFetch(`/api/integrations/${integrationId}/test`, {
      method: 'POST',
    });
  },

  // --- Cloud SQL Workspace & Messaging Connectors ---
  async getConnectors(): Promise<ConnectorDashboardPayload> {
    return apiFetch<ConnectorDashboardPayload>('/api/connectors');
  },

  async connectGoogleConnector(
    service: 'gmail' | 'google_calendar' | 'google_drive',
    googleAccessToken: string
  ): Promise<{
    ok: boolean;
    diagnostic: ConnectorDiagnosticMessage;
    detail: string;
    dashboard: ConnectorDashboardPayload;
  }> {
    return apiFetch(`/api/connectors/${service}/connect-google`, {
      method: 'POST',
      headers: {
        'X-Google-Access-Token': googleAccessToken,
      },
    });
  },

  async connectTelegramConnector(
    botToken: string,
    chatId: string
  ): Promise<{
    ok: boolean;
    diagnostic: ConnectorDiagnosticMessage;
    detail: string;
    dashboard: ConnectorDashboardPayload;
  }> {
    return apiFetch('/api/connectors/telegram/connect-telegram', {
      method: 'POST',
      body: JSON.stringify({ botToken, chatId }),
    });
  },

  async startThirdPartyOAuth(
    provider: 'outlook' | 'slack'
  ): Promise<{ authUrl: string } | OAuthSetupInstructionPayload> {
    const headers = new Headers({ 'Content-Type': 'application/json' });
    if (inMemoryToken) {
      headers.set('Authorization', `Bearer ${inMemoryToken}`);
    }
    const res = await fetch(`/api/oauth/${provider}/start`, {
      method: 'POST',
      headers,
    });
    const data = (await res.json()) as
      | { authUrl: string }
      | OAuthSetupInstructionPayload
      | { error?: string };
    if (!res.ok) {
      if ('needsEnvSetup' in data && data.needsEnvSetup) {
        return data;
      }
      throw new Error(('error' in data && data.error) || 'OAuth start failed.');
    }
    if ('needsEnvSetup' in data && data.needsEnvSetup) {
      return data;
    }
    return data as { authUrl: string };
  },

  async updateConnectorConfig(
    service: ConnectorServiceKey,
    updates: {
      sandboxMode?: boolean;
      n8nWebhookUrl?: string;
      n8nEnabled?: boolean;
      accountLabel?: string;
    }
  ): Promise<{ dashboard: ConnectorDashboardPayload }> {
    return apiFetch(`/api/connectors/${service}/config`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  async testConnector(
    service: ConnectorServiceKey,
    googleAccessToken?: string | null
  ): Promise<{
    ok: boolean;
    diagnostic: ConnectorDiagnosticMessage;
    detail: string;
    sandboxSimulated: boolean;
    dashboard: ConnectorDashboardPayload;
  }> {
    const headers: Record<string, string> = {};
    if (googleAccessToken) {
      headers['X-Google-Access-Token'] = googleAccessToken;
    }
    return apiFetch(`/api/connectors/${service}/test`, {
      method: 'POST',
      headers,
    });
  },

  async executeConnectorAction(
    service: ConnectorServiceKey,
    params: {
      employeeId: BotId;
      action: string;
      requiredPermission?: ConnectorPermissionLevel;
      payload?: Record<string, unknown>;
    },
    googleAccessToken?: string | null
  ): Promise<{
    isSandbox: boolean;
    badge: 'SANDBOX' | 'LIVE';
    summary: string;
    data: Record<string, unknown>;
    dashboard: ConnectorDashboardPayload;
  }> {
    const headers: Record<string, string> = {};
    if (googleAccessToken) {
      headers['X-Google-Access-Token'] = googleAccessToken;
    }
    return apiFetch(`/api/connectors/${service}/execute`, {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });
  },

  async disconnectConnector(
    service: ConnectorServiceKey
  ): Promise<{ dashboard: ConnectorDashboardPayload }> {
    return apiFetch(`/api/connectors/${service}/disconnect`, {
      method: 'POST',
    });
  },

  async disconnectAllConnectors(): Promise<{ dashboard: ConnectorDashboardPayload }> {
    return apiFetch('/api/connectors/disconnect-all', {
      method: 'POST',
    });
  },

  async saveOAuthAppCredentials(params: {
    outlook?: { clientId?: string; clientSecret?: string; tenantId?: string };
    slack?: { clientId?: string; clientSecret?: string };
    encryptionKey?: string;
  }): Promise<{ ok: boolean; updated: string[]; dashboard: ConnectorDashboardPayload }> {
    return apiFetch('/api/connectors/oauth-apps', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  async clearOAuthAppCredentials(
    provider: 'outlook' | 'slack'
  ): Promise<{ ok: boolean; dashboard: ConnectorDashboardPayload }> {
    return apiFetch(`/api/connectors/oauth-apps/${provider}`, {
      method: 'DELETE',
    });
  },

  async refreshConnectorToken(service: ConnectorServiceKey): Promise<{
    ok: boolean;
    diagnostic: ConnectorDiagnosticMessage;
    detail: string;
    dashboard: ConnectorDashboardPayload;
  }> {
    return apiFetch(`/api/connectors/${service}/refresh`, {
      method: 'POST',
    });
  },

  async updateEmployeeConnectorPermission(
    service: ConnectorServiceKey,
    employeeId: BotId,
    updates: {
      permissionLevel?: ConnectorPermissionLevel;
      enabled?: boolean;
    }
  ): Promise<{ dashboard: ConnectorDashboardPayload }> {
    return apiFetch(`/api/connectors/${service}/employees/${employeeId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },
};


