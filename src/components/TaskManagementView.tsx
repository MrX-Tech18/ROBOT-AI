import { useState, type FormEvent } from 'react';
import { ExternalLink, Plus, XCircle } from 'lucide-react';
import type { BotId, TaskRecord, TaskStatus, WorkspacePayload } from '../shared/types';
import { TaskStatusLabel, formatShortDateTime } from './StatusText';

interface TaskManagementViewProps {
  workspace: WorkspacePayload;
  onCreateTask: (params: {
    title: string;
    description: string;
    assignedTo: BotId;
    priority: 'critical' | 'high' | 'normal' | 'low';
    runImmediately: boolean;
  }) => Promise<void>;
  onUpdateTaskStatus: (
    taskId: string,
    status: 'cancelled' | 'completed' | 'queued'
  ) => Promise<void>;
}

export default function TaskManagementView({
  workspace,
  onCreateTask,
  onUpdateTaskStatus,
}: TaskManagementViewProps) {
  const [filter, setFilter] = useState<'all' | TaskStatus>('all');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    workspace.tasks[0]?.id ?? null
  );
  const [showCreator, setShowCreator] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedTo, setAssignedTo] = useState<BotId>('max');
  const [priority, setPriority] = useState<'critical' | 'high' | 'normal' | 'low'>('normal');
  const [runImmediately, setRunImmediately] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredTasks =
    filter === 'all'
      ? workspace.tasks
      : workspace.tasks.filter((t) => t.status === filter);

  const selectedTask: TaskRecord | null =
    workspace.tasks.find((t) => t.id === selectedTaskId) ?? filteredTasks[0] ?? null;

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      await onCreateTask({
        title,
        description,
        assignedTo,
        priority,
        runImmediately,
      });
      setTitle('');
      setDescription('');
      setShowCreator(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1440px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-x-auto">
          {(
            [
              ['all', 'All'],
              ['in_progress', 'Active'],
              ['waiting_approval', 'Approval'],
              ['completed', 'Completed'],
              ['failed', 'Failed'],
              ['cancelled', 'Cancelled'],
            ] as const
          ).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setFilter(val)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                filter === val
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setShowCreator((v) => !v)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Assign Manual Task</span>
        </button>
      </div>

      {showCreator && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-semibold">Assign Task Manually</h3>
            <button
              type="button"
              onClick={() => setShowCreator(false)}
              className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white"
            >
              Cancel
            </button>
          </div>
          {error && (
            <p className="text-xs text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Task Title
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Research top 5 AI workflow competitors"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Assign To
                </label>
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value as BotId)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                >
                  {workspace.employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) =>
                    setPriority(e.target.value as 'critical' | 'high' | 'normal' | 'low')
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                >
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="normal">Normal</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
              Instructions / Deliverable Requirements
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Include verified facts, pricing comparison, and executive takeaways..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={runImmediately}
                onChange={(e) => setRunImmediately(e.target.checked)}
              />
              <span>Execute immediately with AI employee</span>
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium"
            >
              {submitting ? 'Executing...' : runImmediately ? 'Assign & Execute' : 'Queue Task'}
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Task List (6 cols) */}
        <section className="lg:col-span-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold">
              Tasks ({filteredTasks.length})
            </h2>
          </div>
          {filteredTasks.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">
              No tasks match this filter.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[600px] overflow-y-auto">
              {filteredTasks.map((t) => {
                const selected = selectedTask?.id === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTaskId(t.id)}
                    className={`w-full text-left p-4 transition-colors ${
                      selected
                        ? 'bg-blue-50 dark:bg-blue-950/30'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold truncate">{t.title}</p>
                      <TaskStatusLabel status={t.status} />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Assigned: {t.assignedTo} · Priority: {t.priority} ·{' '}
                      {formatShortDateTime(t.updatedAt)}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Task Output & Collaboration Inspector (6 cols) */}
        <section className="lg:col-span-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          {!selectedTask ? (
            <p className="text-sm text-slate-500 py-10 text-center">
              Select a task to inspect deliverable output and collaboration trace.
            </p>
          ) : (
            <>
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="font-display text-lg font-semibold">{selectedTask.title}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Owner: {selectedTask.assignedTo} · Created by {selectedTask.createdBy} ·{' '}
                    <TaskStatusLabel status={selectedTask.status} />
                  </p>
                </div>
                {(selectedTask.status === 'queued' || selectedTask.status === 'in_progress') && (
                  <button
                    type="button"
                    onClick={() => onUpdateTaskStatus(selectedTask.id, 'cancelled')}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-900 text-red-600 dark:text-red-400 text-xs font-medium hover:bg-red-50 dark:hover:bg-red-950/40 shrink-0"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Cancel</span>
                  </button>
                )}
              </div>

              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Brief
                </p>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  {selectedTask.description}
                </p>
              </div>

              {selectedTask.output && (
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                    Deliverable Output
                  </p>
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">
                    {selectedTask.output}
                  </div>
                </div>
              )}

              {selectedTask.sources.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                    Verified Source Citations
                  </p>
                  <div className="space-y-1">
                    {selectedTask.sources.map((src) => (
                      <a
                        key={src.uri}
                        href={src.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline truncate"
                      >
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{src.title}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {selectedTask.collaborationTrace.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                    Collaboration Steps
                  </p>
                  <ol className="space-y-2">
                    {selectedTask.collaborationTrace.map((st) => (
                      <li
                        key={st.stepNumber}
                        className="text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-800"
                      >
                        <span className="font-semibold">
                          Step {st.stepNumber} ({st.botName}):{' '}
                        </span>
                        <span className="text-slate-600 dark:text-slate-300">{st.action}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
