import { ArrowRight } from 'lucide-react';
import type { AppPage, BotId, WorkspacePayload } from '../shared/types';
import {
  BotStatusLabel,
  EmailPriorityLabel,
  TaskStatusLabel,
  formatShortDateTime,
} from './StatusText';

interface DashboardViewProps {
  workspace: WorkspacePayload;
  onNavigate: (page: AppPage, botId?: BotId) => void;
}

export default function DashboardView({ workspace, onNavigate }: DashboardViewProps) {
  const { metrics, employees, tasks, approvals, emails, calendarEvents, logs } = workspace;

  const kpiCards: Array<{ label: string; value: number; note: string; page: AppPage }> = [
    { label: 'Total Tasks', value: metrics.totalTasks, note: 'All tracked directives', page: 'tasks' },
    { label: 'Active Tasks', value: metrics.activeTasks, note: 'Queued or executing', page: 'tasks' },
    {
      label: 'Completed Tasks',
      value: metrics.completedTasks,
      note: 'Verified deliverables',
      page: 'tasks',
    },
    {
      label: 'Pending Approvals',
      value: metrics.pendingApprovals,
      note: 'Awaiting CEO sign-off',
      page: 'approvals',
    },
    { label: 'Failed Tasks', value: metrics.failedTasks, note: 'Requires retry', page: 'tasks' },
    {
      label: 'Emails Processed',
      value: metrics.totalEmailsProcessed,
      note: `${emails.filter((e) => e.phishingFlag).length} phishing blocked`,
      page: 'employee',
    },
    {
      label: 'Upcoming Appointments',
      value: metrics.upcomingAppointments,
      note: `${calendarEvents.filter((c) => c.status === 'conflict').length} conflict flagged`,
      page: 'employee',
    },
    {
      label: 'Automation Events',
      value: logs.length,
      note: 'Recorded workflow runs',
      page: 'history',
    },
  ];

  const pendingApprovalList = approvals.filter((a) => a.status === 'pending');

  return (
    <div className="space-y-6 max-w-[1440px] mx-auto">
      {/* KPI Grid (8 required metrics with tabular numerals) */}
      <section aria-label="Executive KPIs" className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiCards.map((kpi) => (
          <button
            key={kpi.label}
            type="button"
            onClick={() =>
              onNavigate(
                kpi.page,
                kpi.label === 'Emails Processed'
                  ? 'emma'
                  : kpi.label === 'Upcoming Appointments'
                    ? 'sophie'
                    : undefined
              )
            }
            className="text-left p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-500 dark:hover:border-blue-500 transition-colors"
          >
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{kpi.label}</p>
            <p className="font-mono text-2xl sm:text-3xl font-semibold tabular-nums text-slate-900 dark:text-white mt-1.5">
              {kpi.value}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{kpi.note}</p>
          </button>
        ))}
      </section>

      {/* Real-Time Five AI Employees Status */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="font-display text-base font-semibold">AI Workforce Status</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Live state and workload across all five robot stations
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('directory')}
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
          >
            <span>Manage Team</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                <th className="py-2.5 pr-4 font-medium">Employee</th>
                <th className="py-2.5 pr-4 font-medium">Role</th>
                <th className="py-2.5 pr-4 font-medium">Status</th>
                <th className="py-2.5 pr-4 font-medium">Current Activity</th>
                <th className="py-2.5 pr-4 font-medium text-right">Completed</th>
                <th className="py-2.5 font-medium text-right">Workspace</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-sm">
              {employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-3 pr-4 font-medium whitespace-nowrap">
                    <span className="inline-flex items-center gap-2.5">
                      <span
                        className="w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: emp.colorHex }}
                      />
                      <span>{emp.name}</span>
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-xs text-slate-600 dark:text-slate-300">
                    {emp.title}
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap">
                    <BotStatusLabel status={emp.status} />
                  </td>
                  <td className="py-3 pr-4 text-xs text-slate-600 dark:text-slate-300 max-w-xs truncate">
                    {emp.currentTaskTitle || 'Standing by'}
                  </td>
                  <td className="py-3 pr-4 text-right font-mono text-xs tabular-nums">
                    {emp.tasksCompleted}
                  </td>
                  <td className="py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onNavigate('employee', emp.id)}
                      className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Two-Column Operational Split: Approvals + Recent Activity & Upcoming Schedule */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Pending Approvals + Critical Emails */}
        <section className="lg:col-span-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold">Requires CEO Decision</h2>
            <button
              type="button"
              onClick={() => onNavigate('approvals')}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              Open Approval Center
            </button>
          </div>

          {pendingApprovalList.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 py-4">
              All sensitive actions have been reviewed. No pending approvals.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {pendingApprovalList.slice(0, 4).map((apr) => (
                <div key={apr.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      {apr.title}
                    </p>
                    <span className="text-xs font-mono text-amber-600 dark:text-amber-400 shrink-0">
                      Pending
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {apr.botId} · {apr.actionType.replace('_', ' ')} ·{' '}
                    {formatShortDateTime(apr.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-sm font-semibold">Inbox Triage Highlights (Emma)</h3>
              <button
                type="button"
                onClick={() => onNavigate('employee', 'emma')}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Open Emma
              </button>
            </div>
            <div className="space-y-2.5">
              {emails.slice(0, 3).map((mail) => (
                <div key={mail.id} className="text-xs space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-900 dark:text-slate-100 truncate">
                      {mail.subject}
                    </span>
                    <EmailPriorityLabel priority={mail.priority} />
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 truncate">
                    {mail.senderName} ({mail.provider}) · {mail.aiSummary || mail.category}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Upcoming Appointments + Recent Activity */}
        <section className="lg:col-span-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold">
              Upcoming Appointments (Sophie)
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('employee', 'sophie')}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              Open Sophie
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {calendarEvents.slice(0, 4).map((ev) => (
              <div key={ev.id} className="py-2.5 first:pt-0 last:pb-0 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                    {ev.title}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {formatShortDateTime(ev.startIso)} · {ev.location}
                  </p>
                </div>
                <span
                  className={`text-xs font-mono shrink-0 ${
                    ev.status === 'conflict'
                      ? 'text-red-600 dark:text-red-400 font-semibold'
                      : ev.status === 'pending_approval'
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {ev.status === 'conflict' ? 'Conflict' : ev.status}
                </span>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-sm font-semibold">Recent Activity & Tasks</h3>
              <button
                type="button"
                onClick={() => onNavigate('history')}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Full History
              </button>
            </div>
            <div className="space-y-2.5">
              {tasks.slice(0, 3).map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 text-xs">
                  <span className="truncate text-slate-800 dark:text-slate-200">
                    {t.title} · <span className="text-slate-500">{t.assignedTo}</span>
                  </span>
                  <TaskStatusLabel status={t.status} />
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
