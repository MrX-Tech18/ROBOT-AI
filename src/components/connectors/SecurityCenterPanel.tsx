import { KeyRound, Lock, ShieldAlert } from 'lucide-react';
import type {
  ConnectorActivityLogView,
  ConnectorConnectionView,
  EmployeeConnectorPermissionView,
} from '../../shared/types';
import { formatShortDateTime } from '../StatusText';

interface SecurityCenterPanelProps {
  connections: ConnectorConnectionView[];
  employeePermissions: EmployeeConnectorPermissionView[];
  activityLogs: ConnectorActivityLogView[];
  encryptionKeySource: 'env' | 'custom_vault' | 'auto_vault';
  busy: boolean;
  onRequestDisconnectAll: () => void;
  onOpenCredentialsVault: () => void;
}

export default function SecurityCenterPanel({
  connections,
  employeePermissions,
  activityLogs,
  encryptionKeySource,
  busy,
  onRequestDisconnectAll,
  onOpenCredentialsVault,
}: SecurityCenterPanelProps) {
  const connectedApps = connections.filter((c) => c.connectionStatus === 'CONNECTED');
  const authorizedEmployees = new Set(
    employeePermissions
      .filter((p) => p.enabled && p.permissionLevel !== 'none')
      .map((p) => p.employeeId)
  );

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="font-display text-lg font-semibold flex items-center gap-2">
            <Lock className="w-5 h-5 text-emerald-600" />
            <span>Security Center & Audit Logs</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Tokens and bot secrets are encrypted at rest on the server and never exposed to client
            code.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            type="button"
            disabled={busy}
            onClick={onOpenCredentialsVault}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium whitespace-nowrap shrink-0"
          >
            <KeyRound className="w-3.5 h-3.5 text-blue-600" />
            <span>OAuth & Encryption Keys</span>
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={onRequestDisconnectAll}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-medium whitespace-nowrap shrink-0"
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Disconnect All Integrations</span>
          </button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
          <p className="text-xs text-slate-500 dark:text-slate-400">Connected Applications</p>
          <p className="font-display text-2xl font-bold tabular-nums mt-1">
            {connectedApps.length} / {connections.length}
          </p>
        </div>
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
          <p className="text-xs text-slate-500 dark:text-slate-400">Authorized AI Employees</p>
          <p className="font-display text-2xl font-bold tabular-nums mt-1">
            {authorizedEmployees.size} / 5
          </p>
        </div>
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
          <p className="text-xs text-slate-500 dark:text-slate-400">Credential Protection</p>
          <p className="font-mono text-sm font-semibold text-emerald-700 dark:text-emerald-400 mt-1.5">
            {encryptionKeySource === 'env'
              ? 'AES-256-GCM (Server Env Key)'
              : encryptionKeySource === 'custom_vault'
                ? 'AES-256-GCM (Custom Vault Key)'
                : 'AES-256-GCM Backend Vault'}
          </p>
        </div>
      </div>

      {/* Token & Permission Ledger */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[760px]">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
              <th className="py-2 pr-4 font-medium">Application</th>
              <th className="py-2 pr-4 font-medium">Authorized Employees</th>
              <th className="py-2 pr-4 font-medium">Granted Permissions</th>
              <th className="py-2 pr-4 font-medium">Last Authentication / Sync</th>
              <th className="py-2 font-medium text-right">Token Expiration</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {connections.map((conn) => {
              const activeEmps = employeePermissions
                .filter(
                  (p) =>
                    p.serviceName === conn.serviceName &&
                    p.enabled &&
                    p.permissionLevel !== 'none'
                )
                .map((p) => `${p.employeeId} (${p.permissionLevel})`);

              return (
                <tr key={conn.serviceName}>
                  <td className="py-2.5 pr-4 font-semibold text-slate-900 dark:text-slate-100">
                    {conn.displayName}
                  </td>
                  <td className="py-2.5 pr-4 text-slate-600 dark:text-slate-300">
                    {activeEmps.length > 0 ? activeEmps.join(', ') : 'None assigned'}
                  </td>
                  <td className="py-2.5 pr-4 font-mono text-[11px] text-slate-500 dark:text-slate-400 max-w-xs truncate">
                    {conn.permissions.length > 0
                      ? conn.permissions.join(', ')
                      : 'Sandbox (no live scopes)'}
                  </td>
                  <td className="py-2.5 pr-4 font-mono tabular-nums text-slate-500">
                    {conn.lastSync ? formatShortDateTime(conn.lastSync) : '—'}
                  </td>
                  <td className="py-2.5 text-right font-mono">
                    <span
                      className={
                        conn.tokenExpirationStatus === 'Valid'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : conn.tokenExpirationStatus === 'Expired'
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-amber-600 dark:text-amber-400'
                      }
                    >
                      {conn.tokenExpirationStatus}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Connection History / Integration Activity Logs */}
      <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
        <h3 className="font-display text-sm font-semibold">Connection History</h3>
        {activityLogs.length === 0 ? (
          <p className="text-xs text-slate-500 py-3">
            No integration events logged yet. Run a connection test or simulated sandbox run above.
          </p>
        ) : (
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl">
            {activityLogs.slice(0, 25).map((log) => (
              <div
                key={log.id}
                className="px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold text-slate-800 dark:text-slate-100 shrink-0">
                    {log.displayName}
                  </span>
                  {log.isSandbox && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 font-mono text-[10px] shrink-0">
                      SANDBOX
                    </span>
                  )}
                  <span className="text-slate-600 dark:text-slate-300 truncate">
                    {log.action}
                    {log.errorMessage ? ` — ${log.errorMessage}` : ''}
                  </span>
                </div>
                <span className="font-mono text-[11px] tabular-nums text-slate-400 shrink-0">
                  {formatShortDateTime(log.timestamp)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
