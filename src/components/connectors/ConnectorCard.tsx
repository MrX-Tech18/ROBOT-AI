import { Activity, Plug, RefreshCw, Settings2, Unplug } from 'lucide-react';
import type {
  ConnectorConnectionStatus,
  ConnectorConnectionView,
  ConnectorDiagnosticMessage,
} from '../../shared/types';
import ServiceLogo from './ServiceLogo';
import { formatShortDateTime } from '../StatusText';

interface ConnectorCardProps {
  connector: ConnectorConnectionView;
  busy: boolean;
  testFeedback?: {
    ok: boolean;
    diagnostic: ConnectorDiagnosticMessage;
    detail: string;
    sandboxSimulated?: boolean;
  };
  actionPreview?: {
    isSandbox: boolean;
    summary: string;
  };
  onConnect: (connector: ConnectorConnectionView) => void;
  onDisconnect: (connector: ConnectorConnectionView) => void;
  onConfigure: (connector: ConnectorConnectionView) => void;
  onTestConnection: (connector: ConnectorConnectionView) => void;
  onRunPreview: (connector: ConnectorConnectionView) => void;
  onRefreshToken?: (connector: ConnectorConnectionView) => void;
}

function getStatusStyles(status: ConnectorConnectionStatus): string {
  switch (status) {
    case 'CONNECTED':
      return 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60';
    case 'CONNECTING':
      return 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60';
    case 'ERROR':
      return 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/60';
    case 'SANDBOX MODE':
      return 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60';
    case 'NOT CONNECTED':
    default:
      return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700';
  }
}

export default function ConnectorCard({
  connector,
  busy,
  testFeedback,
  actionPreview,
  onConnect,
  onDisconnect,
  onConfigure,
  onTestConnection,
  onRunPreview,
  onRefreshToken,
}: ConnectorCardProps) {
  const isConnected = connector.connectionStatus === 'CONNECTED';
  const isConnecting = connector.connectionStatus === 'CONNECTING';
  const isSandbox = connector.sandboxMode || connector.connectionStatus === 'SANDBOX MODE';

  return (
    <article
      data-testid={`connector-card-${connector.serviceName}`}
      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between space-y-4"
    >
      <div className="space-y-4">
        {/* Card Header: Logo, Name, Auth Type, Status */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <ServiceLogo service={connector.serviceName} size={40} />
            <div className="min-w-0">
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white truncate">
                {connector.displayName}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {connector.authenticationType}
                {connector.accountLabel ? ` · ${connector.accountLabel}` : ''}
              </p>
            </div>
          </div>

          <span
            className={`px-2.5 py-1 rounded-md border text-[11px] font-mono font-semibold whitespace-nowrap shrink-0 ${getStatusStyles(
              connector.connectionStatus
            )}`}
          >
            {connector.connectionStatus}
          </span>
        </div>

        {/* Description */}
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          {connector.description}
        </p>

        {/* Sync & Workflow Metadata */}
        <div className="grid grid-cols-2 gap-2.5 p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 text-xs">
          <div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Last Sync</p>
            <p className="font-mono text-slate-800 dark:text-slate-200 tabular-nums mt-0.5 truncate">
              {connector.lastSync ? formatShortDateTime(connector.lastSync) : 'Never synced'}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">n8n Workflow</p>
            <p className="font-mono text-slate-800 dark:text-slate-200 mt-0.5 truncate">
              {connector.n8nEnabled ? 'Active' : 'Standby'}
            </p>
          </div>
          {(connector.serviceName === 'outlook' || connector.serviceName === 'slack') && (
            <div className="col-span-2 pt-1.5 border-t border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-3 min-w-0">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
                OAuth App
              </span>
              <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300 truncate min-w-0 text-right">
                {connector.credentialSource === 'env'
                  ? `Env (${connector.clientIdHint || 'Set'})`
                  : connector.credentialSource === 'vault'
                    ? `Vault (${connector.clientIdHint || 'Set'})`
                    : 'Not Configured'}
              </span>
            </div>
          )}
        </div>

        {/* Available Permissions */}
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Available Permissions
          </p>
          <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
            {connector.availablePermissions.map((perm) => (
              <li key={perm} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-600 shrink-0" />
                <span className="truncate">{perm}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Diagnostic / Error / Sandbox Preview Banner */}
        {(testFeedback || connector.lastError || actionPreview) && (
          <div className="space-y-2">
            {testFeedback && (
              <div
                className={`p-2.5 rounded-lg border text-xs ${
                  testFeedback.ok
                    ? 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200'
                    : 'border-red-200 dark:border-red-900/50 bg-red-50/70 dark:bg-red-950/30 text-red-800 dark:text-red-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2 font-medium">
                  <span>{testFeedback.diagnostic}</span>
                  {testFeedback.sandboxSimulated && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-200/80 dark:bg-amber-900 text-amber-900 dark:text-amber-100 font-mono text-[10px]">
                      SANDBOX
                    </span>
                  )}
                </div>
                <p className="mt-1 opacity-90">{testFeedback.detail}</p>
              </div>
            )}

            {!testFeedback && connector.lastError && (
              <div className="p-2.5 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50/70 dark:bg-red-950/30 text-xs text-red-800 dark:text-red-200">
                {connector.lastError}
              </div>
            )}

            {actionPreview && (
              <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-700 dark:text-slate-300">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-medium">Execution Output</span>
                  <span
                    className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-semibold ${
                      actionPreview.isSandbox
                        ? 'bg-amber-200/80 dark:bg-amber-900 text-amber-900 dark:text-amber-100'
                        : 'bg-emerald-200/80 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100'
                    }`}
                  >
                    {actionPreview.isSandbox ? 'SANDBOX' : 'LIVE'}
                  </span>
                </div>
                <p>{actionPreview.summary}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons: Connect, Disconnect, Configure, Test Connection */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={busy || isConnecting}
            onClick={() => onConnect(connector)}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0"
          >
            <Plug className="w-3.5 h-3.5" />
            <span>{isConnecting ? 'Connecting...' : isConnected ? 'Reconnect' : 'Connect'}</span>
          </button>

          <button
            type="button"
            disabled={busy || (!isConnected && !connector.hasStoredSecret && !connector.n8nEnabled)}
            onClick={() => onDisconnect(connector)}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-45 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
          >
            <Unplug className="w-3.5 h-3.5" />
            <span>Disconnect</span>
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => onConfigure(connector)}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>Configure</span>
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => onTestConnection(connector)}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Test Connection</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onRunPreview(connector)}
            className="flex-1 py-1.5 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-medium transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <span>{isSandbox ? 'Run Simulated Test' : 'Verify Live Sync'}</span>
            {isSandbox && (
              <span className="px-1.5 py-0.5 rounded bg-amber-200/80 dark:bg-amber-900 text-amber-900 dark:text-amber-100 font-mono text-[10px]">
                SANDBOX
              </span>
            )}
          </button>

          {connector.serviceName === 'outlook' && isConnected && onRefreshToken && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onRefreshToken(connector)}
              className="inline-flex items-center gap-1 py-1.5 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-medium whitespace-nowrap shrink-0"
              title="Refresh Microsoft OAuth access token"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Refresh Token</span>
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
