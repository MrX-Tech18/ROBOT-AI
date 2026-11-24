import { useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import type {
  ConnectorConnectionView,
  ConnectorDashboardPayload,
  OAuthSetupInstructionPayload,
} from '../../shared/types';

interface ConfigureModalProps {
  connector: ConnectorConnectionView;
  busy: boolean;
  onClose: () => void;
  onSaveConfig: (updates: {
    sandboxMode: boolean;
    n8nWebhookUrl: string;
    n8nEnabled: boolean;
    accountLabel: string;
  }) => Promise<void>;
  onSaveTelegram: (botToken: string, chatId: string) => Promise<void>;
}

export function ConfigureConnectorModal({
  connector,
  busy,
  onClose,
  onSaveConfig,
  onSaveTelegram,
}: ConfigureModalProps) {
  const [sandboxMode, setSandboxMode] = useState(connector.sandboxMode);
  const [n8nWebhookUrl, setN8nWebhookUrl] = useState(connector.n8nWebhookUrl);
  const [n8nEnabled, setN8nEnabled] = useState(connector.n8nEnabled);
  const [accountLabel, setAccountLabel] = useState(connector.accountLabel);
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState(
    connector.serviceName === 'telegram' ? connector.accountLabel : ''
  );
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await onSaveConfig({
        sandboxMode,
        n8nWebhookUrl,
        n8nEnabled,
        accountLabel,
      });
      if (connector.serviceName === 'telegram' && botToken.trim() && chatId.trim()) {
        await onSaveTelegram(botToken.trim(), chatId.trim());
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save configuration.');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="configure-connector-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 id="configure-connector-title" className="font-display text-lg font-semibold">
              Configure {connector.displayName}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {connector.authenticationType} · Workflow: {connector.n8nWorkflowName}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close configuration dialog"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="p-3 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 cursor-pointer">
            <div>
              <p className="text-sm font-medium">Sandbox Mode</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Simulate executions with sample data and block external API writes.
              </p>
            </div>
            <input
              type="checkbox"
              checked={sandboxMode}
              onChange={(e) => setSandboxMode(e.target.checked)}
              className="w-4 h-4 accent-amber-600"
            />
          </label>

          {connector.serviceName === 'telegram' ? (
            <div className="space-y-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
              <p className="text-xs font-semibold flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-cyan-600" />
                <span>Telegram Bot API Credentials (Encrypted Server-Side)</span>
              </p>
              <div>
                <label
                  htmlFor="tg-chat-id"
                  className="block text-xs text-slate-600 dark:text-slate-300 mb-1"
                >
                  Telegram Chat ID
                </label>
                <input
                  id="tg-chat-id"
                  type="text"
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  placeholder="e.g. 123456789"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
                />
              </div>
              <div>
                <label
                  htmlFor="tg-bot-token"
                  className="block text-xs text-slate-600 dark:text-slate-300 mb-1"
                >
                  Telegram Bot Token (Leave blank to keep stored secret)
                </label>
                <input
                  id="tg-bot-token"
                  type="password"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder="123456789:ABCdefGHIjklMNO..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
                />
              </div>
            </div>
          ) : (
            <div>
              <label
                htmlFor="connector-account-label"
                className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
              >
                Workspace Label
              </label>
              <input
                id="connector-account-label"
                type="text"
                value={accountLabel}
                onChange={(e) => setAccountLabel(e.target.value)}
                placeholder="ceo@company.com"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
              />
            </div>
          )}

          <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <label
                htmlFor="n8n-webhook-url"
                className="text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                n8n Webhook URL ({connector.n8nWorkflowName})
              </label>
              <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={n8nEnabled}
                  onChange={(e) => setN8nEnabled(e.target.checked)}
                  className="accent-blue-600"
                />
                <span>Enable Workflow</span>
              </label>
            </div>
            <input
              id="n8n-webhook-url"
              type="url"
              value={n8nWebhookUrl}
              onChange={(e) => setN8nWebhookUrl(e.target.value)}
              placeholder="https://your-n8n-instance.com/webhook/..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-mono"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium whitespace-nowrap"
            >
              {busy ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface OAuthSetupModalProps {
  instructions: OAuthSetupInstructionPayload;
  onClose: () => void;
  onOpenCredentialsVault?: () => void;
}

export function OAuthSetupInstructionsModal({
  instructions,
  onClose,
  onOpenCredentialsVault,
}: OAuthSetupModalProps) {
  const title =
    instructions.provider === 'outlook'
      ? 'Microsoft Outlook OAuth 2.0 Setup Required'
      : 'Slack OAuth 2.0 Setup Required';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="oauth-setup-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
    >
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-amber-600 shrink-0" />
            <h3 id="oauth-setup-title" className="font-display text-lg font-semibold">
              {title}
            </h3>
          </div>
          <button
            type="button"
            aria-label="Close setup instructions"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          Live OAuth cannot start until these app credentials are configured via server
          environment secrets or the encrypted OAuth App Credentials vault:{' '}
          <span className="font-mono font-semibold text-amber-700 dark:text-amber-300">
            {instructions.missingVars.join(', ')}
          </span>
          . Until configured, this connector stays safely in Sandbox Mode.
        </p>

        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2 text-xs">
          <p className="font-semibold text-slate-800 dark:text-slate-200">
            Required Redirect / Callback URLs
          </p>
          <div>
            <span className="text-slate-500">Development URL:</span>
            <p className="font-mono text-[11px] break-all text-blue-700 dark:text-blue-300 mt-0.5">
              {instructions.callbackUrls.dev}
            </p>
          </div>
          <div>
            <span className="text-slate-500">Shared URL:</span>
            <p className="font-mono text-[11px] break-all text-blue-700 dark:text-blue-300 mt-0.5">
              {instructions.callbackUrls.shared}
            </p>
          </div>
        </div>

        <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
          {instructions.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            Stay in Sandbox
          </button>
          {onOpenCredentialsVault && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenCredentialsVault();
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium whitespace-nowrap"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Enter OAuth Credentials</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface OAuthAppCredentialsModalProps {
  dashboard: ConnectorDashboardPayload;
  busy: boolean;
  onClose: () => void;
  onSave: (payload: {
    outlook?: { clientId?: string; clientSecret?: string; tenantId?: string };
    slack?: { clientId?: string; clientSecret?: string };
    encryptionKey?: string;
  }) => Promise<void>;
  onClearProvider: (provider: 'outlook' | 'slack') => Promise<void>;
}

export function OAuthAppCredentialsModal({
  dashboard,
  busy,
  onClose,
  onSave,
  onClearProvider,
}: OAuthAppCredentialsModalProps) {
  const outlookStatus = dashboard.oauthAppStatuses.outlook;
  const slackStatus = dashboard.oauthAppStatuses.slack;
  const envEncryptionManaged = dashboard.encryptionKeySource === 'env';

  const [msClientId, setMsClientId] = useState('');
  const [msClientSecret, setMsClientSecret] = useState('');
  const [msTenantId, setMsTenantId] = useState(outlookStatus.tenantId || 'common');
  const [slackClientId, setSlackClientId] = useState('');
  const [slackClientSecret, setSlackClientSecret] = useState('');
  const [encryptionKey, setEncryptionKey] = useState('');

  const [showMsSecret, setShowMsSecret] = useState(false);
  const [showSlackSecret, setShowSlackSecret] = useState(false);
  const [showEncKey, setShowEncKey] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCopy = (label: string, value: string) => {
    void navigator.clipboard?.writeText(value);
    setCopiedUrl(label);
    setTimeout(() => setCopiedUrl(null), 1800);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const payload: {
      outlook?: { clientId?: string; clientSecret?: string; tenantId?: string };
      slack?: { clientId?: string; clientSecret?: string };
      encryptionKey?: string;
    } = {};

    const hasMsInputs =
      msClientId.trim() !== '' ||
      msClientSecret.trim() !== '' ||
      msTenantId.trim() !== (outlookStatus.tenantId || 'common');
    if (hasMsInputs && outlookStatus.source !== 'env') {
      payload.outlook = {
        ...(msClientId.trim() ? { clientId: msClientId.trim() } : {}),
        ...(msClientSecret.trim() ? { clientSecret: msClientSecret.trim() } : {}),
        tenantId: msTenantId.trim() || 'common',
      };
    }

    const hasSlackInputs =
      slackClientId.trim() !== '' || slackClientSecret.trim() !== '';
    if (hasSlackInputs && slackStatus.source !== 'env') {
      payload.slack = {
        ...(slackClientId.trim() ? { clientId: slackClientId.trim() } : {}),
        ...(slackClientSecret.trim() ? { clientSecret: slackClientSecret.trim() } : {}),
      };
    }

    if (encryptionKey.trim() && !envEncryptionManaged) {
      payload.encryptionKey = encryptionKey.trim();
    }

    if (!payload.outlook && !payload.slack && !payload.encryptionKey) {
      setError('Enter at least one credential field or encryption key before saving.');
      return;
    }

    try {
      await onSave(payload);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to save OAuth credentials.'
      );
    }
  };

  const renderSourceBadge = (
    source: 'env' | 'vault' | 'none',
    clientIdHint: string | null
  ) => {
    if (source === 'env') {
      return (
        <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-mono text-[10px] font-semibold">
          SERVER ENV ({clientIdHint})
        </span>
      );
    }
    if (source === 'vault') {
      return (
        <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-mono text-[10px] font-semibold">
          ENCRYPTED VAULT ({clientIdHint})
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 font-mono text-[10px] font-semibold">
        UNCONFIGURED · SANDBOX
      </span>
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="oauth-vault-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto"
    >
      <div className="w-full max-w-2xl my-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 id="oauth-vault-title" className="font-display text-lg font-semibold">
                OAuth App Credentials & Vault Encryption
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Server environment secrets always take precedence. Values entered here are
                write-only, encrypted with AES-256-GCM on the backend, and never returned to
                the browser.
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close OAuth credentials dialog"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="p-3 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 min-w-0">
          {/* Microsoft Outlook Section */}
          <fieldset className="min-w-0 w-full p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <legend className="text-sm font-semibold text-slate-900 dark:text-white">
                Microsoft Outlook (OAuth 2.0 / Entra ID)
              </legend>
              <div className="flex items-center gap-2">
                {renderSourceBadge(outlookStatus.source, outlookStatus.clientIdHint)}
                {outlookStatus.source === 'vault' && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onClearProvider('outlook')}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-red-200 dark:border-red-900/60 text-[10px] font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 whitespace-nowrap"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear Outlook</span>
                  </button>
                )}
              </div>
            </div>

            {outlookStatus.source === 'env' ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Managed by backend environment variables (MICROSOFT_CLIENT_ID /
                MICROSOFT_CLIENT_SECRET).
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="ms-client-id"
                    className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
                  >
                    MICROSOFT_CLIENT_ID
                  </label>
                  <input
                    id="ms-client-id"
                    type="text"
                    autoComplete="off"
                    value={msClientId}
                    onChange={(e) => setMsClientId(e.target.value)}
                    placeholder={
                      outlookStatus.clientIdHint
                        ? `Saved (${outlookStatus.clientIdHint}) — enter to replace`
                        : 'Application (client) ID GUID'
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
                  />
                </div>

                <div>
                  <label
                    htmlFor="ms-tenant-id"
                    className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
                  >
                    MICROSOFT_TENANT_ID
                  </label>
                  <input
                    id="ms-tenant-id"
                    type="text"
                    autoComplete="off"
                    value={msTenantId}
                    onChange={(e) => setMsTenantId(e.target.value)}
                    placeholder="common"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="ms-client-secret"
                    className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
                  >
                    MICROSOFT_CLIENT_SECRET
                  </label>
                  <div className="relative">
                    <input
                      id="ms-client-secret"
                      type={showMsSecret ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={msClientSecret}
                      onChange={(e) => setMsClientSecret(e.target.value)}
                      placeholder={
                        outlookStatus.source === 'vault'
                          ? 'Stored securely — leave blank to keep existing secret'
                          : 'Enter Microsoft Entra Client Secret value'
                      }
                      className="w-full pl-3 pr-9 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
                    />
                    <button
                      type="button"
                      aria-label={showMsSecret ? 'Hide Microsoft secret' : 'Show Microsoft secret'}
                      onClick={() => setShowMsSecret((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showMsSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-1 space-y-1.5 text-[11px] text-slate-500 dark:text-slate-400 min-w-0">
              <div className="flex items-center justify-between gap-2 min-w-0">
                <span className="min-w-0 flex-1 truncate font-mono">
                  Callback (Dev): {dashboard.callbackUrls.outlookDev}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy('ms-dev', dashboard.callbackUrls.outlookDev)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 text-[10px] hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0 whitespace-nowrap"
                >
                  {copiedUrl === 'ms-dev' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedUrl === 'ms-dev' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <div className="flex items-center justify-between gap-2 min-w-0">
                <span className="min-w-0 flex-1 truncate font-mono">
                  Callback (Shared): {dashboard.callbackUrls.outlookShared}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy('ms-shared', dashboard.callbackUrls.outlookShared)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 text-[10px] hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0 whitespace-nowrap"
                >
                  {copiedUrl === 'ms-shared' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedUrl === 'ms-shared' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
          </fieldset>

          {/* Slack Section */}
          <fieldset className="min-w-0 w-full p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <legend className="text-sm font-semibold text-slate-900 dark:text-white">
                Slack (OAuth 2.0)
              </legend>
              <div className="flex items-center gap-2">
                {renderSourceBadge(slackStatus.source, slackStatus.clientIdHint)}
                {slackStatus.source === 'vault' && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onClearProvider('slack')}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-red-200 dark:border-red-900/60 text-[10px] font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 whitespace-nowrap"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear Slack</span>
                  </button>
                )}
              </div>
            </div>

            {slackStatus.source === 'env' ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Managed by backend environment variables (SLACK_CLIENT_ID / SLACK_CLIENT_SECRET).
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="slack-client-id"
                    className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
                  >
                    SLACK_CLIENT_ID
                  </label>
                  <input
                    id="slack-client-id"
                    type="text"
                    autoComplete="off"
                    value={slackClientId}
                    onChange={(e) => setSlackClientId(e.target.value)}
                    placeholder={
                      slackStatus.clientIdHint
                        ? `Saved (${slackStatus.clientIdHint}) — enter to replace`
                        : 'Slack App Client ID'
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
                  />
                </div>

                <div>
                  <label
                    htmlFor="slack-client-secret"
                    className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
                  >
                    SLACK_CLIENT_SECRET
                  </label>
                  <div className="relative">
                    <input
                      id="slack-client-secret"
                      type={showSlackSecret ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={slackClientSecret}
                      onChange={(e) => setSlackClientSecret(e.target.value)}
                      placeholder={
                        slackStatus.source === 'vault'
                          ? 'Stored securely — leave blank to keep'
                          : 'Slack App Client Secret'
                      }
                      className="w-full pl-3 pr-9 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
                    />
                    <button
                      type="button"
                      aria-label={showSlackSecret ? 'Hide Slack secret' : 'Show Slack secret'}
                      onClick={() => setShowSlackSecret((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showSlackSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-1 space-y-1.5 text-[11px] text-slate-500 dark:text-slate-400 min-w-0">
              <div className="flex items-center justify-between gap-2 min-w-0">
                <span className="min-w-0 flex-1 truncate font-mono">
                  Callback (Dev): {dashboard.callbackUrls.slackDev}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy('sl-dev', dashboard.callbackUrls.slackDev)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 text-[10px] hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0 whitespace-nowrap"
                >
                  {copiedUrl === 'sl-dev' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedUrl === 'sl-dev' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <div className="flex items-center justify-between gap-2 min-w-0">
                <span className="min-w-0 flex-1 truncate font-mono">
                  Callback (Shared): {dashboard.callbackUrls.slackShared}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy('sl-shared', dashboard.callbackUrls.slackShared)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 text-[10px] hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0 whitespace-nowrap"
                >
                  {copiedUrl === 'sl-shared' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedUrl === 'sl-shared' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
          </fieldset>

          {/* INTEGRATIONS_ENCRYPTION_KEY Section */}
          <fieldset className="min-w-0 w-full p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <legend className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-600" />
                <span>INTEGRATIONS_ENCRYPTION_KEY</span>
              </legend>
              <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-mono text-[10px] font-semibold">
                {dashboard.encryptionKeySource === 'env'
                  ? 'SERVER ENV ACTIVE'
                  : dashboard.encryptionKeySource === 'custom_vault'
                    ? 'CUSTOM VAULT KEY ACTIVE'
                    : 'AUTO 256-BIT KEY ACTIVE'}
              </span>
            </div>

            {envEncryptionManaged ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Managed by server environment variable INTEGRATIONS_ENCRYPTION_KEY.
              </p>
            ) : (
              <div>
                <label
                  htmlFor="integrations-encryption-key"
                  className="block text-xs text-slate-600 dark:text-slate-300 mb-1"
                >
                  Optional Master Passphrase (min 16 characters — setting this re-encrypts all
                  stored vault tokens & secrets)
                </label>
                <div className="relative">
                  <input
                    id="integrations-encryption-key"
                    type={showEncKey ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={encryptionKey}
                    onChange={(e) => setEncryptionKey(e.target.value)}
                    placeholder="Leave blank to keep active 256-bit backend encryption key"
                    className="w-full pl-3 pr-9 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
                  />
                  <button
                    type="button"
                    aria-label={showEncKey ? 'Hide encryption key' : 'Show encryption key'}
                    onClick={() => setShowEncKey((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showEncKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )}
          </fieldset>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium whitespace-nowrap"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{busy ? 'Encrypting & Saving...' : 'Encrypt & Save Credentials'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel: string;
  tone?: 'danger' | 'primary';
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

export function ConfirmActionModal({
  title,
  description,
  confirmLabel,
  tone = 'danger',
  busy = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl space-y-4">
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              tone === 'danger'
                ? 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400'
                : 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
            }`}
          >
            {tone === 'danger' ? (
              <ShieldAlert className="w-5 h-5" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
          </div>
          <div>
            <h3 id="confirm-dialog-title" className="font-display text-base font-semibold">
              {title}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-white text-xs font-medium disabled:opacity-50 whitespace-nowrap ${
              tone === 'danger'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {busy ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
