import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { KeyRound, Plug, RefreshCw, Send, Wrench } from 'lucide-react';
import { api } from '../lib/api';
import {
  clearGoogleWorkspaceTokens,
  getCachedGoogleAccessToken,
  signInWithGoogleWorkspace,
} from '../lib/googleWorkspace';
import {
  GOOGLE_WORKSPACE_SCOPES,
  getServiceCatalogEntry,
  hasActiveWorkflowDependency,
  isAllowedPostMessageOrigin,
} from '../shared/connectorLogic';
import type {
  BotId,
  ConnectorConnectionView,
  ConnectorDashboardPayload,
  ConnectorDiagnosticMessage,
  ConnectorPermissionLevel,
  ConnectorServiceKey,
  IntegrationConfig,
  OAuthSetupInstructionPayload,
  WorkspacePayload,
} from '../shared/types';
import GoogleSignInButton from './GoogleSignInButton';
import ConnectorCard from './connectors/ConnectorCard';
import {
  ConfigureConnectorModal,
  ConfirmActionModal,
  OAuthAppCredentialsModal,
  OAuthSetupInstructionsModal,
} from './connectors/ConnectorModals';
import EmployeePermissionsMatrix from './connectors/EmployeePermissionsMatrix';
import SecurityCenterPanel from './connectors/SecurityCenterPanel';

interface IntegrationsViewProps {
  workspace: WorkspacePayload;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onUpdateProfile: (updates: { name: string; companyName: string }) => Promise<void>;
  onSaveIntegration: (
    id: string,
    updates: {
      connected?: boolean;
      endpointUrl?: string;
      accountLabel?: string;
      secretValue?: string;
    }
  ) => Promise<void>;
  onTestIntegration: (id: string) => Promise<{ ok: boolean; statusText?: string }>;
}

export default function IntegrationsView({
  workspace,
  theme,
  onToggleTheme,
  onUpdateProfile,
  onSaveIntegration,
  onTestIntegration,
}: IntegrationsViewProps) {
  // Existing n8n Workflows 1-5 & CEO Profile state
  const [urls, setUrls] = useState<Record<string, string>>(() =>
    Object.fromEntries(workspace.integrations.map((i) => [i.id, i.endpointUrl]))
  );
  const [busyN8nId, setBusyN8nId] = useState<string | null>(null);
  const [n8nFeedback, setN8nFeedback] = useState<Record<string, string>>({});
  const [ceoName, setCeoName] = useState(workspace.user.name);
  const [companyName, setCompanyName] = useState(workspace.user.companyName);
  const [profileSaved, setProfileSaved] = useState(false);

  // Cloud SQL Connectors state
  const [dashboard, setDashboard] = useState<ConnectorDashboardPayload | null>(null);
  const [loadingConnectors, setLoadingConnectors] = useState(true);
  const [connectorError, setConnectorError] = useState<string | null>(null);
  const [busyService, setBusyService] = useState<ConnectorServiceKey | null>(null);
  const [busyPermKey, setBusyPermKey] = useState<string | null>(null);
  const [securityBusy, setSecurityBusy] = useState(false);
  const [testResults, setTestResults] = useState<
    Record<
      string,
      {
        ok: boolean;
        diagnostic: ConnectorDiagnosticMessage;
        detail: string;
        sandboxSimulated?: boolean;
      }
    >
  >({});
  const [actionPreviews, setActionPreviews] = useState<
    Record<string, { isSandbox: boolean; summary: string }>
  >({});

  // Modals
  const [configuring, setConfiguring] = useState<ConnectorConnectionView | null>(null);
  const [oauthSetup, setOauthSetup] = useState<OAuthSetupInstructionPayload | null>(null);
  const [showOAuthVault, setShowOAuthVault] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] =
    useState<ConnectorConnectionView | null>(null);
  const [confirmDisconnectAll, setConfirmDisconnectAll] = useState(false);
  const [confirmLiveAction, setConfirmLiveAction] =
    useState<ConnectorConnectionView | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoadingConnectors(true);
    setConnectorError(null);
    try {
      const data = await api.getConnectors();
      setDashboard(data);
    } catch (err) {
      setConnectorError(
        err instanceof Error ? err.message : 'Unable to load Workspace & Messaging Connectors.'
      );
    } finally {
      setLoadingConnectors(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  // Receive 3P OAuth popup completion messages
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!isAllowedPostMessageOrigin(event.origin, window.location.origin)) return;
      const data = event.data as
        | { type?: string; provider?: string; ok?: boolean; message?: string }
        | undefined;
      if (data?.type !== 'OAUTH_COMPLETE') return;
      if (data.provider === 'outlook' || data.provider === 'slack') {
        setTestResults((prev) => ({
          ...prev,
          [data.provider!]: {
            ok: Boolean(data.ok),
            diagnostic: data.ok ? 'Connection successful' : 'Invalid configuration',
            detail: data.message || (data.ok ? 'OAuth connected.' : 'OAuth canceled.'),
          },
        }));
      }
      void loadDashboard();
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [loadDashboard]);

  const workflowOrder = ['n8n_alex', 'n8n_emma', 'n8n_max', 'n8n_sophie', 'n8n_charlie'];
  const n8nWorkflows = workspace.integrations
    .filter((i) => i.category === 'automation')
    .sort((a, b) => workflowOrder.indexOf(a.id) - workflowOrder.indexOf(b.id));

  const handleSaveN8n = async (item: IntegrationConfig) => {
    setBusyN8nId(item.id);
    setN8nFeedback((prev) => ({ ...prev, [item.id]: '' }));
    try {
      const url = (urls[item.id] ?? '').trim();
      await onSaveIntegration(item.id, {
        endpointUrl: url,
        connected: Boolean(url),
        accountLabel: url ? 'Webhook Configured' : 'Webhook not configured',
      });
      setN8nFeedback((prev) => ({ ...prev, [item.id]: 'Webhook saved.' }));
    } catch (err) {
      setN8nFeedback((prev) => ({
        ...prev,
        [item.id]: err instanceof Error ? err.message : 'Save failed.',
      }));
    } finally {
      setBusyN8nId(null);
    }
  };

  const handleTestN8n = async (id: string) => {
    setBusyN8nId(id);
    setN8nFeedback((prev) => ({ ...prev, [id]: '' }));
    try {
      const res = await onTestIntegration(id);
      setN8nFeedback((prev) => ({
        ...prev,
        [id]: res.statusText || (res.ok ? 'Connection verified.' : 'Setup required.'),
      }));
    } catch (err) {
      setN8nFeedback((prev) => ({
        ...prev,
        [id]: err instanceof Error ? err.message : 'Test failed.',
      }));
    } finally {
      setBusyN8nId(null);
    }
  };

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    await onUpdateProfile({ name: ceoName, companyName });
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 3000);
  };

  const handleConnectGoogleSuite = async () => {
    setConnectorError(null);
    setBusyService('gmail');
    try {
      const authResult = await signInWithGoogleWorkspace(GOOGLE_WORKSPACE_SCOPES);
      for (const service of ['gmail', 'google_calendar', 'google_drive'] as const) {
        const res = await api.connectGoogleConnector(service, authResult.accessToken);
        setDashboard(res.dashboard);
        setTestResults((prev) => ({
          ...prev,
          [service]: {
            ok: res.ok,
            diagnostic: res.diagnostic,
            detail: res.detail,
          },
        }));
      }
    } catch (err) {
      setConnectorError(
        err instanceof Error ? err.message : 'Google Workspace authentication canceled.'
      );
    } finally {
      setBusyService(null);
    }
  };

  const handleConnect = async (connector: ConnectorConnectionView) => {
    setConnectorError(null);
    if (connector.serviceName === 'telegram') {
      setConfiguring(connector);
      return;
    }

    if (
      connector.serviceName === 'gmail' ||
      connector.serviceName === 'google_calendar' ||
      connector.serviceName === 'google_drive'
    ) {
      setBusyService(connector.serviceName);
      try {
        const scopes = getServiceCatalogEntry(connector.serviceName).requiredGoogleScopes;
        const authRes = await signInWithGoogleWorkspace(scopes);
        const res = await api.connectGoogleConnector(
          connector.serviceName,
          authRes.accessToken
        );
        setDashboard(res.dashboard);
        setTestResults((prev) => ({
          ...prev,
          [connector.serviceName]: {
            ok: res.ok,
            diagnostic: res.diagnostic,
            detail: res.detail,
          },
        }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Google connection failed.';
        setTestResults((prev) => ({
          ...prev,
          [connector.serviceName]: {
            ok: false,
            diagnostic: 'Invalid configuration',
            detail: msg,
          },
        }));
      } finally {
        setBusyService(null);
      }
      return;
    }

    // Outlook or Slack 3P OAuth
    setBusyService(connector.serviceName);
    try {
      const result = await api.startThirdPartyOAuth(connector.serviceName);
      if ('needsEnvSetup' in result) {
        setOauthSetup(result);
        return;
      }
      window.open(
        result.authUrl,
        `oauth_${connector.serviceName}`,
        'width=560,height=680,noopener=false'
      );
      await loadDashboard();
    } catch (err) {
      setConnectorError(
        err instanceof Error ? err.message : 'Unable to start OAuth authorization.'
      );
    } finally {
      setBusyService(null);
    }
  };

  const handleTestConnection = async (connector: ConnectorConnectionView) => {
    setBusyService(connector.serviceName);
    setConnectorError(null);
    try {
      const res = await api.testConnector(
        connector.serviceName,
        getCachedGoogleAccessToken()
      );
      setDashboard(res.dashboard);
      setTestResults((prev) => ({
        ...prev,
        [connector.serviceName]: {
          ok: res.ok,
          diagnostic: res.diagnostic,
          detail: res.detail,
          sandboxSimulated: res.sandboxSimulated,
        },
      }));
    } catch (err) {
      setTestResults((prev) => ({
        ...prev,
        [connector.serviceName]: {
          ok: false,
          diagnostic: 'API unavailable',
          detail: err instanceof Error ? err.message : 'Test failed.',
        },
      }));
    } finally {
      setBusyService(null);
    }
  };

  const handleRefreshToken = async (connector: ConnectorConnectionView) => {
    setBusyService(connector.serviceName);
    setConnectorError(null);
    try {
      const res = await api.refreshConnectorToken(connector.serviceName);
      setDashboard(res.dashboard);
      setTestResults((prev) => ({
        ...prev,
        [connector.serviceName]: {
          ok: res.ok,
          diagnostic: res.diagnostic,
          detail: res.detail,
        },
      }));
    } catch (err) {
      setTestResults((prev) => ({
        ...prev,
        [connector.serviceName]: {
          ok: false,
          diagnostic: 'Authentication expired',
          detail: err instanceof Error ? err.message : 'Token refresh failed.',
        },
      }));
    } finally {
      setBusyService(null);
    }
  };

  const executePreviewNow = async (connector: ConnectorConnectionView) => {
    setBusyService(connector.serviceName);
    setConnectorError(null);
    const defaultBot: Record<ConnectorServiceKey, BotId> = {
      gmail: 'emma',
      outlook: 'emma',
      google_calendar: 'sophie',
      google_drive: 'charlie',
      slack: 'alex',
      telegram: 'alex',
    };
    try {
      const res = await api.executeConnectorAction(
        connector.serviceName,
        {
          employeeId: defaultBot[connector.serviceName],
          action: connector.sandboxMode ? 'Simulated AI sync preview' : 'Live sync check',
          requiredPermission: 'read',
        },
        getCachedGoogleAccessToken()
      );
      setDashboard(res.dashboard);
      setActionPreviews((prev) => ({
        ...prev,
        [connector.serviceName]: {
          isSandbox: res.isSandbox,
          summary: res.summary,
        },
      }));
    } catch (err) {
      setConnectorError(err instanceof Error ? err.message : 'Execution failed.');
    } finally {
      setBusyService(null);
    }
  };

  const handleRunPreview = (connector: ConnectorConnectionView) => {
    if (!connector.sandboxMode && connector.connectionStatus === 'CONNECTED') {
      setConfirmLiveAction(connector);
      return;
    }
    void executePreviewNow(connector);
  };

  const handleConfirmDisconnect = async () => {
    if (!confirmDisconnect) return;
    setSecurityBusy(true);
    try {
      const res = await api.disconnectConnector(confirmDisconnect.serviceName);
      setDashboard(res.dashboard);
      if (
        confirmDisconnect.serviceName === 'gmail' ||
        confirmDisconnect.serviceName === 'google_calendar' ||
        confirmDisconnect.serviceName === 'google_drive'
      ) {
        const stillConnectedGoogle = res.dashboard.connections.some(
          (c) =>
            (c.serviceName === 'gmail' ||
              c.serviceName === 'google_calendar' ||
              c.serviceName === 'google_drive') &&
            c.connectionStatus === 'CONNECTED'
        );
        if (!stillConnectedGoogle) {
          await clearGoogleWorkspaceTokens();
        }
      }
      setTestResults((prev) => {
        const next = { ...prev };
        delete next[confirmDisconnect.serviceName];
        return next;
      });
      setConfirmDisconnect(null);
    } catch (err) {
      setConnectorError(err instanceof Error ? err.message : 'Disconnect failed.');
    } finally {
      setSecurityBusy(false);
    }
  };

  const handleConfirmDisconnectAll = async () => {
    setSecurityBusy(true);
    try {
      const res = await api.disconnectAllConnectors();
      await clearGoogleWorkspaceTokens();
      setDashboard(res.dashboard);
      setTestResults({});
      setActionPreviews({});
      setConfirmDisconnectAll(false);
    } catch (err) {
      setConnectorError(
        err instanceof Error ? err.message : 'Failed to disconnect all integrations.'
      );
    } finally {
      setSecurityBusy(false);
    }
  };

  const handleUpdateEmployeePermission = async (
    serviceName: ConnectorServiceKey,
    employeeId: BotId,
    permissionLevel: ConnectorPermissionLevel,
    enabled: boolean
  ) => {
    const key = `${employeeId}:${serviceName}`;
    setBusyPermKey(key);
    setConnectorError(null);
    try {
      const res = await api.updateEmployeeConnectorPermission(serviceName, employeeId, {
        permissionLevel,
        enabled,
      });
      setDashboard(res.dashboard);
    } catch (err) {
      setConnectorError(
        err instanceof Error ? err.message : 'Failed updating employee permission.'
      );
    } finally {
      setBusyPermKey(null);
    }
  };

  const sandboxCount =
    dashboard?.connections.filter(
      (c) => c.sandboxMode || c.connectionStatus === 'SANDBOX MODE'
    ).length ?? 0;

  return (
    <div className="space-y-8 max-w-[1440px] mx-auto">
      {/* Workspace & Messaging Connectors Header */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <Plug className="w-5 h-5 text-blue-600 shrink-0" />
              <h2 className="font-display text-lg font-semibold">
                Workspace & Messaging Connectors
              </h2>
              {sandboxCount > 0 && (
                <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 font-mono text-[11px] font-semibold">
                  {sandboxCount} IN SANDBOX MODE
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Connect Gmail, Microsoft Outlook, Google Calendar, Google Drive, Slack, and Telegram
              to unlock real AI employee automation. Unconnected services remain safely in Sandbox
              Mode.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap shrink-0">
            <div className="w-48">
              <GoogleSignInButton
                onClick={handleConnectGoogleSuite}
                disabled={busyService !== null}
                label="Connect Google Apps"
              />
            </div>
            <button
              type="button"
              disabled={!dashboard || securityBusy}
              onClick={() => setShowOAuthVault(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-xs font-medium whitespace-nowrap shrink-0"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>OAuth App Credentials</span>
            </button>
            <button
              type="button"
              onClick={() => void loadDashboard()}
              disabled={loadingConnectors}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingConnectors ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {connectorError && (
          <div
            role="alert"
            className="p-3 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300"
          >
            {connectorError}
          </div>
        )}
      </section>

      {/* 6 Connected Service Cards */}
      {loadingConnectors && !dashboard ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500">
          Loading Workspace & Messaging Connectors...
        </div>
      ) : dashboard ? (
        <>
          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {dashboard.connections.map((connector) => (
              <ConnectorCard
                key={connector.serviceName}
                connector={connector}
                busy={busyService === connector.serviceName || securityBusy}
                testFeedback={testResults[connector.serviceName]}
                actionPreview={actionPreviews[connector.serviceName]}
                onConnect={handleConnect}
                onDisconnect={(c) => setConfirmDisconnect(c)}
                onConfigure={(c) => setConfiguring(c)}
                onTestConnection={handleTestConnection}
                onRunPreview={handleRunPreview}
                onRefreshToken={handleRefreshToken}
              />
            ))}
          </section>

          {/* Employee Permissions Matrix */}
          <EmployeePermissionsMatrix
            employees={workspace.employees}
            connections={dashboard.connections}
            permissions={dashboard.employeePermissions}
            busyKey={busyPermKey}
            onUpdatePermission={handleUpdateEmployeePermission}
          />

          {/* n8n Integration Workflows + Central Bot Workflows */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-5">
            <div>
              <h2 className="font-display text-lg font-semibold flex items-center gap-2">
                <Wrench className="w-5 h-5 text-blue-600" />
                <span>n8n Automation Engine (Connectors & Workflows 1–5)</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Connecting a service enables its dedicated n8n workflow; disconnecting stops
                automation. You can also configure each AI employee&apos;s central n8n webhook.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {dashboard.connections.map((conn) => (
                <div
                  key={conn.serviceName}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">{conn.n8nWorkflowName}</p>
                    <p className="text-[11px] font-mono text-slate-500 truncate">
                      {conn.n8nWebhookUrl ? conn.n8nWebhookUrl : 'Webhook not set'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfiguring(conn)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold whitespace-nowrap shrink-0 ${
                      conn.n8nEnabled
                        ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {conn.n8nEnabled ? 'ACTIVE' : 'CONFIGURE'}
                  </button>
                </div>
              ))}
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 pt-2 border-t border-slate-200 dark:border-slate-800">
              {n8nWorkflows.map((wf) => (
                <div
                  key={wf.id}
                  className="py-4 first:pt-2 last:pb-0 grid grid-cols-1 lg:grid-cols-12 gap-3 items-center"
                >
                  <div className="lg:col-span-4">
                    <p className="text-sm font-semibold">{wf.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Status: {wf.connected ? 'Connected' : 'Setup Required'}
                      {wf.lastStatus &&
                      wf.lastStatus !== (wf.connected ? 'Connected' : 'Setup Required')
                        ? ` · ${wf.lastStatus}`
                        : ''}
                    </p>
                  </div>
                  <div className="lg:col-span-5">
                    <input
                      type="url"
                      value={urls[wf.id] ?? ''}
                      onChange={(e) =>
                        setUrls((prev) => ({ ...prev, [wf.id]: e.target.value }))
                      }
                      placeholder="https://your-n8n-instance.com/webhook/..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-mono"
                    />
                    {n8nFeedback[wf.id] && (
                      <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-1">
                        {n8nFeedback[wf.id]}
                      </p>
                    )}
                  </div>
                  <div className="lg:col-span-3 flex items-center gap-2 lg:justify-end">
                    <button
                      type="button"
                      disabled={busyN8nId === wf.id}
                      onClick={() => handleSaveN8n(wf)}
                      className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium whitespace-nowrap"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      disabled={busyN8nId === wf.id}
                      onClick={() => handleTestN8n(wf.id)}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
                    >
                      <Send className="w-3 h-3" />
                      <span>Test</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Security Center & Audit Logs */}
          <SecurityCenterPanel
            connections={dashboard.connections}
            employeePermissions={dashboard.employeePermissions}
            activityLogs={dashboard.activityLogs}
            encryptionKeySource={dashboard.encryptionKeySource}
            busy={securityBusy}
            onRequestDisconnectAll={() => setConfirmDisconnectAll(true)}
            onOpenCredentialsVault={() => setShowOAuthVault(true)}
          />
        </>
      ) : null}

      {/* CEO Profile & Appearance Settings */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="font-display text-lg font-semibold">CEO Profile & Office Preferences</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Manage company identity, appearance theme, and executive defaults.
            </p>
          </div>
          <button
            type="button"
            onClick={onToggleTheme}
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            Theme: {theme === 'dark' ? 'Dark Navy' : 'Clean Light'} (Switch)
          </button>
        </div>

        <form onSubmit={handleSaveProfile} className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
              CEO Display Name
            </label>
            <input
              type="text"
              value={ceoName}
              onChange={(e) => setCeoName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
              Company Name
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium whitespace-nowrap"
            >
              Save Profile
            </button>
            {profileSaved && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400">Saved</span>
            )}
          </div>
        </form>
      </section>

      {/* Modals */}
      {configuring && (
        <ConfigureConnectorModal
          connector={configuring}
          busy={busyService === configuring.serviceName}
          onClose={() => setConfiguring(null)}
          onSaveConfig={async (updates) => {
            setBusyService(configuring.serviceName);
            try {
              const res = await api.updateConnectorConfig(configuring.serviceName, updates);
              setDashboard(res.dashboard);
            } finally {
              setBusyService(null);
            }
          }}
          onSaveTelegram={async (botToken, chatId) => {
            const res = await api.connectTelegramConnector(botToken, chatId);
            setDashboard(res.dashboard);
            setTestResults((prev) => ({
              ...prev,
              telegram: {
                ok: res.ok,
                diagnostic: res.diagnostic,
                detail: res.detail,
              },
            }));
          }}
        />
      )}

      {oauthSetup && (
        <OAuthSetupInstructionsModal
          instructions={oauthSetup}
          onClose={() => setOauthSetup(null)}
          onOpenCredentialsVault={() => setShowOAuthVault(true)}
        />
      )}

      {showOAuthVault && dashboard && (
        <OAuthAppCredentialsModal
          dashboard={dashboard}
          busy={securityBusy}
          onClose={() => setShowOAuthVault(false)}
          onSave={async (payload) => {
            setSecurityBusy(true);
            try {
              const res = await api.saveOAuthAppCredentials(payload);
              setDashboard(res.dashboard);
            } finally {
              setSecurityBusy(false);
            }
          }}
          onClearProvider={async (provider) => {
            setSecurityBusy(true);
            try {
              const res = await api.clearOAuthAppCredentials(provider);
              setDashboard(res.dashboard);
              setTestResults((prev) => {
                const next = { ...prev };
                delete next[provider];
                return next;
              });
            } finally {
              setSecurityBusy(false);
            }
          }}
        />
      )}

      {confirmDisconnect && dashboard && (
        <ConfirmActionModal
          title={`Disconnect ${confirmDisconnect.displayName}?`}
          description={(() => {
            const dep = hasActiveWorkflowDependency(
              confirmDisconnect,
              dashboard.employeePermissions
            );
            return dep.hasDependency
              ? `Warning: ${dep.activeWorkflowCount} active AI employee or n8n workflow(s) currently rely on ${confirmDisconnect.displayName}. Disconnecting will stop automation and revoke stored credentials.`
              : `This will revoke stored credentials and stop any ${confirmDisconnect.displayName} automation workflows.`;
          })()}
          confirmLabel={`Disconnect ${confirmDisconnect.displayName}`}
          tone="danger"
          busy={securityBusy}
          onCancel={() => setConfirmDisconnect(null)}
          onConfirm={handleConfirmDisconnect}
        />
      )}

      {confirmDisconnectAll && (
        <ConfirmActionModal
          title="Disconnect All Integrations?"
          description="This will revoke OAuth access where supported, wipe all encrypted credentials across Gmail, Outlook, Google Calendar, Google Drive, Slack, and Telegram, stop all integration n8n workflows, and switch connectors back to Sandbox Mode."
          confirmLabel="Disconnect All Services"
          tone="danger"
          busy={securityBusy}
          onCancel={() => setConfirmDisconnectAll(false)}
          onConfirm={handleConfirmDisconnectAll}
        />
      )}

      {confirmLiveAction && (
        <ConfirmActionModal
          title={`Run Live Sync on ${confirmLiveAction.displayName}?`}
          description={`You are about to access your live ${confirmLiveAction.displayName} account (${confirmLiveAction.accountLabel || 'Connected Account'}) on behalf of your authorized AI employee. Confirm to proceed.`}
          confirmLabel="Confirm Live Sync"
          tone="primary"
          busy={busyService === confirmLiveAction.serviceName}
          onCancel={() => setConfirmLiveAction(null)}
          onConfirm={async () => {
            const target = confirmLiveAction;
            setConfirmLiveAction(null);
            await executePreviewNow(target);
          }}
        />
      )}
    </div>
  );
}
