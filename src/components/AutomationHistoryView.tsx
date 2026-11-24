import { useState } from 'react';
import type { AutomationLog, BotId, WorkspacePayload } from '../shared/types';
import { formatShortDateTime } from './StatusText';

interface AutomationHistoryViewProps {
  workspace: WorkspacePayload;
}

export default function AutomationHistoryView({ workspace }: AutomationHistoryViewProps) {
  const [botFilter, setBotFilter] = useState<'all' | BotId>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | AutomationLog['status']>('all');

  const filtered = workspace.logs.filter((log) => {
    if (botFilter !== 'all' && log.botId !== botFilter) return false;
    if (statusFilter !== 'all' && log.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6 max-w-[1440px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold">Automation & Collaboration History</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Execution traces across AI orchestrations, multi-bot handoffs, n8n workflows, and
            approval audits.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            aria-label="Filter by employee"
            value={botFilter}
            onChange={(e) => setBotFilter(e.target.value as 'all' | BotId)}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium"
          >
            <option value="all">All Employees</option>
            {workspace.employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as 'all' | AutomationLog['status'])
            }
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium"
          >
            <option value="all">All Statuses</option>
            <option value="success">Success</option>
            <option value="pending">Pending</option>
            <option value="error">Error</option>
          </select>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        {filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            No automation events match the selected filters.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4 font-medium">Workflow</th>
                  <th className="py-3 px-4 font-medium">Bot</th>
                  <th className="py-3 px-4 font-medium">Event</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium text-right">Duration</th>
                  <th className="py-3 px-4 font-medium text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {log.workflowName}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {log.botId}
                    </td>
                    <td className="py-3 px-4 max-w-md">
                      <p className="text-slate-900 dark:text-slate-100">{log.message}</p>
                      {log.details && (
                        <p className="text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {log.details}
                        </p>
                      )}
                    </td>
                    <td
                      className={`py-3 px-4 font-mono font-semibold whitespace-nowrap ${
                        log.status === 'success'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : log.status === 'pending'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {log.status.toUpperCase()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-500 whitespace-nowrap">
                      {log.durationMs > 0 ? `${log.durationMs}ms` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-500 whitespace-nowrap">
                      {formatShortDateTime(log.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
