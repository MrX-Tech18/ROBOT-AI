import { useState, type FormEvent } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  Pause,
  Play,
  Send,
  XCircle,
} from 'lucide-react';
import type { AppPage, BotId, WorkspacePayload } from '../shared/types';
import { BotStatusLabel, TaskStatusLabel, formatShortTime } from './StatusText';

interface CommandCenterViewProps {
  workspace: WorkspacePayload;
  commandBusy: boolean;
  error: string | null;
  onSendCommand: (command: string) => Promise<void>;
  onToggleEmployee: (botId: BotId, enabled: boolean) => Promise<void>;
  onCancelTask: (taskId: string) => Promise<void>;
  onNavigate: (page: AppPage, botId?: BotId) => void;
}

const EXAMPLE_COMMANDS = [
  'Alex, check what needs my attention today.',
  'Create a YouTube video about interesting facts about the ocean.',
  'Emma, read my unread emails and prepare replies for important messages.',
  'Max, research five profitable online business ideas with sources.',
  'Sophie, organize my schedule for tomorrow and flag conflicts.',
  "Charlie, create a week's worth of YouTube content ideas.",
];

export default function CommandCenterView({
  workspace,
  commandBusy,
  error,
  onSendCommand,
  onToggleEmployee,
  onCancelTask,
  onNavigate,
}: CommandCenterViewProps) {
  const [input, setInput] = useState('');

  const commandMessages = workspace.chatMessages.filter((m) => m.channel === 'command');
  const recentActiveOrDone = workspace.tasks.slice(0, 5);
  const latestTraceTask = workspace.tasks.find((t) => t.collaborationTrace.length > 0);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || commandBusy) return;
    const text = input;
    setInput('');
    await onSendCommand(text);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-[1440px] mx-auto">
      {/* Central AI Command Chat (8 cols) */}
      <section className="lg:col-span-8 flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 min-h-[620px]">
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-semibold">
              Executive Command Channel (Alex Orchestrator)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Issue natural-language instructions. Alex delegates, sequences, and submits sensitive
              deliverables for CEO approval.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('approvals')}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            Approvals ({workspace.metrics.pendingApprovals})
          </button>
        </div>

        {/* Example Command Buttons */}
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800/80 flex items-center gap-2 overflow-x-auto">
          {EXAMPLE_COMMANDS.map((cmd) => (
            <button
              key={cmd}
              type="button"
              onClick={() => setInput(cmd)}
              className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:border-blue-500 text-xs text-slate-700 dark:text-slate-200 whitespace-nowrap shrink-0 transition-colors"
            >
              {cmd}
            </button>
          ))}
        </div>

        {error && (
          <div
            role="alert"
            className="mx-4 mt-4 p-3 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300"
          >
            {error}
          </div>
        )}

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {commandMessages.map((msg) => {
            const isCeo = msg.sender === 'ceo';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isCeo ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-2 mb-1 text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {isCeo ? 'CEO (You)' : 'Alex · Chief Executive Assistant'}
                  </span>
                  <span>·</span>
                  <span className="font-mono tabular-nums">{formatShortTime(msg.createdAt)}</span>
                </div>
                <div
                  className={`max-w-2xl rounded-xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed ${
                    isCeo
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {msg.text}

                  {msg.metadata?.sources && msg.metadata.sources.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-700 space-y-1">
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        Verified Sources (Max):
                      </p>
                      {msg.metadata.sources.map((src) => (
                        <a
                          key={src.uri}
                          href={src.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline truncate"
                        >
                          <ExternalLink className="w-3 h-3 shrink-0" />
                          <span className="truncate">{src.title}</span>
                        </a>
                      ))}
                    </div>
                  )}

                  {msg.metadata?.approvalId && (
                    <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() => onNavigate('approvals')}
                        className="text-xs font-medium text-amber-600 dark:text-amber-400 hover:underline"
                      >
                        Review & Approve in Approval Center →
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {commandBusy && (
            <div className="text-xs font-mono text-blue-600 dark:text-blue-400">
              Alex is coordinating AI employees and executing workflow steps...
            </div>
          )}
        </div>

        {/* Input Form */}
        <form
          onSubmit={handleSubmit}
          className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center gap-3"
        >
          <label htmlFor="command-center-input" className="sr-only">
            Command instruction for Alex
          </label>
          <input
            id="command-center-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Instruct Alex or any specialist (e.g., Ask Max to research competitors and Charlie to draft a proposal)..."
            className="flex-1 px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <button
            type="submit"
            disabled={commandBusy || !input.trim()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium transition-colors whitespace-nowrap shrink-0"
          >
            <Send className="w-4 h-4" />
            <span>{commandBusy ? 'Executing...' : 'Send Command'}</span>
          </button>
        </form>
      </section>

      {/* Right Collaboration Pipeline & Team Controls (4 cols) */}
      <aside className="lg:col-span-4 space-y-5">
        {/* Live Collaboration Pipeline Trace */}
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <h3 className="font-display text-sm font-semibold mb-1">
            Multi-Bot Collaboration Trace
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            {latestTraceTask ? latestTraceTask.title : 'Latest delegated execution pipeline'}
          </p>

          {!latestTraceTask ? (
            <p className="text-xs text-slate-500 py-4">No collaboration runs recorded yet.</p>
          ) : (
            <ol className="space-y-3">
              {latestTraceTask.collaborationTrace.map((step) => (
                <li
                  key={step.stepNumber}
                  className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 space-y-1"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-slate-900 dark:text-white">
                      Step {step.stepNumber} · {step.botName}
                    </span>
                    <span className="font-mono text-[11px] text-blue-600 dark:text-blue-400">
                      {step.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300">{step.action}</p>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* Employee Pause / Resume Controls */}
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <h3 className="font-display text-sm font-semibold mb-3">Employee Controls</h3>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {workspace.employees.map((emp) => (
              <div key={emp.id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => onNavigate('employee', emp.id)}
                    className="text-sm font-medium hover:text-blue-600 dark:hover:text-blue-400 truncate block"
                  >
                    {emp.name}
                  </button>
                  <BotStatusLabel status={emp.status} />
                </div>
                <button
                  type="button"
                  onClick={() => onToggleEmployee(emp.id, !emp.enabled)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
                >
                  {emp.enabled ? (
                    <>
                      <Pause className="w-3 h-3" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3" />
                      <span>Resume</span>
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Quick Task Queue Control */}
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-sm font-semibold">Recent Tasks</h3>
            <button
              type="button"
              onClick={() => onNavigate('tasks')}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              All Tasks
            </button>
          </div>
          <div className="space-y-2.5">
            {recentActiveOrDone.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between gap-2 text-xs py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{t.title}</p>
                  <TaskStatusLabel status={t.status} />
                </div>
                {(t.status === 'queued' || t.status === 'in_progress') && (
                  <button
                    type="button"
                    onClick={() => onCancelTask(t.id)}
                    aria-label={`Cancel ${t.title}`}
                    className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-950 rounded shrink-0"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                )}
                {t.status === 'completed' && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                )}
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
