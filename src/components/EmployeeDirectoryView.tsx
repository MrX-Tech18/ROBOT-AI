import { ArrowUpRight, Pause, Play } from 'lucide-react';
import type { BotId, EmployeeProfile } from '../shared/types';
import CuteRobotAvatar from './CuteRobotAvatar';
import { BotStatusLabel } from './StatusText';

interface EmployeeDirectoryViewProps {
  employees: EmployeeProfile[];
  onOpenWorkspace: (botId: BotId) => void;
  onToggleEmployee: (botId: BotId, enabled: boolean) => Promise<void>;
}

export default function EmployeeDirectoryView({
  employees,
  onOpenWorkspace,
  onToggleEmployee,
}: EmployeeDirectoryViewProps) {
  return (
    <div className="space-y-6 max-w-[1440px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-semibold">AI Employee Directory</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Five specialized robot employees with dedicated workstations, AI instructions, and
            connected tools.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {employees.map((emp) => (
          <article
            key={emp.id}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between space-y-5"
          >
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-13 h-13 rounded-xl bg-sky-50 dark:bg-slate-800 border border-sky-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                    <CuteRobotAvatar
                      botId={emp.id}
                      accentHex={emp.colorHex}
                      status={emp.status}
                      size={46}
                      showShadow={false}
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-display text-lg font-semibold truncate">{emp.name}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {emp.title}
                    </p>
                  </div>
                </div>
                <BotStatusLabel status={emp.status} />
              </div>

              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {emp.description}
              </p>

              <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 space-y-1">
                <p className="text-xs font-semibold" style={{ color: emp.colorHex }}>
                  {emp.personality.archetype} · {emp.personality.traits.join(' · ')}
                </p>
                <p className="text-xs italic text-slate-600 dark:text-slate-300">
                  &ldquo;{emp.personality.tagline}&rdquo;
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Voice: <span className="text-slate-700 dark:text-slate-300">{emp.personality.communicationStyle}</span>
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Quirk: <span className="text-slate-700 dark:text-slate-300">{emp.personality.quirk}</span>
                </p>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Core Responsibilities
                </p>
                <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300 list-disc pl-4">
                  {emp.responsibilities.slice(0, 3).map((resp) => (
                    <li key={resp}>{resp}</li>
                  ))}
                </ul>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-slate-500 dark:text-slate-400">Completed</p>
                  <p className="font-mono font-semibold tabular-nums mt-0.5">
                    {emp.tasksCompleted}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 dark:text-slate-400">Failed</p>
                  <p className="font-mono font-semibold tabular-nums mt-0.5">{emp.tasksFailed}</p>
                </div>
                <div>
                  <p className="text-slate-500 dark:text-slate-400">Avg Time</p>
                  <p className="font-mono font-semibold tabular-nums mt-0.5">
                    {(emp.avgResponseMs / 1000).toFixed(1)}s
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tools: <span className="text-slate-700 dark:text-slate-300">{emp.tools.join(' · ')}</span>
              </p>
            </div>

            <div className="flex items-center gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => onOpenWorkspace(emp.id)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors whitespace-nowrap"
              >
                <span>Open {emp.name} Workspace</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onToggleEmployee(emp.id, !emp.enabled)}
                aria-label={`${emp.enabled ? 'Disable' : 'Enable'} ${emp.name}`}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
              >
                {emp.enabled ? (
                  <>
                    <Pause className="w-3.5 h-3.5" />
                    <span>Disable</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    <span>Enable</span>
                  </>
                )}
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
