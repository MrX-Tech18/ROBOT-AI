import { useEffect, useState, type FormEvent } from 'react';
import {
  Calendar,
  ExternalLink,
  Mail,
  Pause,
  Play,
  Save,
  Send,
  ShieldAlert,
} from 'lucide-react';
import CuteRobotAvatar from './CuteRobotAvatar';
import type {
  BotId,
  EmployeePermissions,
  WorkspacePayload,
} from '../shared/types';
import {
  BotStatusLabel,
  EmailPriorityLabel,
  TaskStatusLabel,
  formatShortDateTime,
  formatShortTime,
} from './StatusText';

interface EmployeeWorkspaceViewProps {
  workspace: WorkspacePayload;
  botId: BotId;
  onSelectBot: (botId: BotId) => void;
  onChat: (botId: BotId, message: string) => Promise<void>;
  onUpdateEmployee: (
    botId: BotId,
    updates: {
      enabled?: boolean;
      systemPrompt?: string;
      permissions?: EmployeePermissions;
    }
  ) => Promise<void>;
  onTriageEmails: () => Promise<void>;
  onAddEmail: (params: {
    provider: 'gmail' | 'outlook';
    senderName: string;
    senderEmail: string;
    subject: string;
    body: string;
  }) => Promise<void>;
  onAddCalendarEvent: (params: {
    title: string;
    startIso: string;
    endIso: string;
    attendees: string[];
    location: string;
    notes: string;
    sendExternalInvite: boolean;
  }) => Promise<void>;
}

export default function EmployeeWorkspaceView({
  workspace,
  botId,
  onSelectBot,
  onChat,
  onUpdateEmployee,
  onTriageEmails,
  onAddEmail,
  onAddCalendarEvent,
}: EmployeeWorkspaceViewProps) {
  const employee = workspace.employees.find((e) => e.id === botId) ?? workspace.employees[0];

  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const [promptDraft, setPromptDraft] = useState(employee.systemPrompt);
  const [permsDraft, setPermsDraft] = useState<EmployeePermissions>(employee.permissions);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSavedMsg, setConfigSavedMsg] = useState<string | null>(null);

  // Emma email tool state
  const [emailBusy, setEmailBusy] = useState(false);
  const [newMailProvider, setNewMailProvider] = useState<'gmail' | 'outlook'>('gmail');
  const [newMailFrom, setNewMailFrom] = useState('');
  const [newMailSubject, setNewMailSubject] = useState('');
  const [newMailBody, setNewMailBody] = useState('');

  // Sophie calendar tool state
  const [calTitle, setCalTitle] = useState('');
  const [calStart, setCalStart] = useState('');
  const [calEnd, setCalEnd] = useState('');
  const [calAttendees, setCalAttendees] = useState('');
  const [calSendInvite, setCalSendInvite] = useState(true);
  const [calBusy, setCalBusy] = useState(false);

  useEffect(() => {
    setPromptDraft(employee.systemPrompt);
    setPermsDraft(employee.permissions);
    setConfigSavedMsg(null);
    setChatError(null);
  }, [employee.id, employee.systemPrompt, employee.permissions]);

  const botMessages = workspace.chatMessages.filter((m) => m.channel === employee.id);
  const botTasks = workspace.tasks.filter((t) => t.assignedTo === employee.id);

  const handleChatSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatBusy) return;
    setChatError(null);
    setChatBusy(true);
    const text = chatInput;
    setChatInput('');
    try {
      await onChat(employee.id, text);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Chat failed.');
    } finally {
      setChatBusy(false);
    }
  };

  const handleSaveConfig = async (e: FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    setConfigSavedMsg(null);
    try {
      await onUpdateEmployee(employee.id, {
        systemPrompt: promptDraft,
        permissions: permsDraft,
      });
      setConfigSavedMsg('AI instructions and permissions saved.');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleAddEmail = async (e: FormEvent) => {
    e.preventDefault();
    if (!newMailFrom.trim() || !newMailSubject.trim() || !newMailBody.trim()) return;
    setEmailBusy(true);
    try {
      await onAddEmail({
        provider: newMailProvider,
        senderName: newMailFrom.split('@')[0],
        senderEmail: newMailFrom,
        subject: newMailSubject,
        body: newMailBody,
      });
      setNewMailFrom('');
      setNewMailSubject('');
      setNewMailBody('');
    } finally {
      setEmailBusy(false);
    }
  };

  const handleAddCalendar = async (e: FormEvent) => {
    e.preventDefault();
    if (!calTitle.trim() || !calStart || !calEnd) return;
    setCalBusy(true);
    try {
      await onAddCalendarEvent({
        title: calTitle,
        startIso: new Date(calStart).toISOString(),
        endIso: new Date(calEnd).toISOString(),
        attendees: calAttendees
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        location: 'Google Meet',
        notes: 'Scheduled via Sophie Assistant',
        sendExternalInvite: calSendInvite,
      });
      setCalTitle('');
      setCalAttendees('');
    } finally {
      setCalBusy(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1440px] mx-auto">
      {/* Employee Switcher Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-x-auto">
        {workspace.employees.map((emp) => (
          <button
            key={emp.id}
            type="button"
            onClick={() => onSelectBot(emp.id)}
            className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 ${
              emp.id === employee.id
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span
              className="w-2 h-2 rounded-sm"
              style={{ backgroundColor: emp.colorHex }}
            />
            <span>
              {emp.name} · {emp.title}
            </span>
          </button>
        ))}
      </div>

      {/* Employee Profile Header */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-xl bg-sky-50 dark:bg-slate-800 border border-sky-200 dark:border-slate-700 flex items-center justify-center shrink-0">
            <CuteRobotAvatar
              botId={employee.id}
              accentHex={employee.colorHex}
              status={employee.status}
              size={50}
              showShadow={false}
            />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-display text-xl font-bold">{employee.name}</h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {employee.title} · {employee.department}
              </span>
              <BotStatusLabel status={employee.status} />
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 max-w-3xl">
              {employee.description}
            </p>
            <p className="text-xs font-medium" style={{ color: employee.colorHex }}>
              {employee.personality.archetype} · {employee.personality.traits.join(' · ')} —{' '}
              <span className="italic text-slate-600 dark:text-slate-300 font-normal">
                &ldquo;{employee.personality.tagline}&rdquo;
              </span>
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Tools: {employee.tools.join(' · ')} · Quirk: {employee.personality.quirk}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="grid grid-cols-3 gap-4 pr-4 border-r border-slate-200 dark:border-slate-800 text-xs">
            <div>
              <p className="text-slate-500 dark:text-slate-400">Done</p>
              <p className="font-mono text-base font-semibold tabular-nums">
                {employee.tasksCompleted}
              </p>
            </div>
            <div>
              <p className="text-slate-500 dark:text-slate-400">Failed</p>
              <p className="font-mono text-base font-semibold tabular-nums">
                {employee.tasksFailed}
              </p>
            </div>
            <div>
              <p className="text-slate-500 dark:text-slate-400">Latency</p>
              <p className="font-mono text-base font-semibold tabular-nums">
                {(employee.avgResponseMs / 1000).toFixed(1)}s
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onUpdateEmployee(employee.id, { enabled: !employee.enabled })}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              employee.enabled
                ? 'border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {employee.enabled ? (
              <>
                <Pause className="w-4 h-4" />
                <span>Disable Bot</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>Enable Bot</span>
              </>
            )}
          </button>
        </div>
      </section>

      {/* Main Split: Personal Chat + Specialist Tools / Task History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Personal Chat Interface (7 cols) */}
        <section className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col min-h-[500px]">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800">
            <h3 className="font-display text-base font-semibold">
              Direct Workspace Chat with {employee.name}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Current task: {employee.currentTaskTitle || 'Available for direct instructions'}
            </p>
          </div>

          {chatError && (
            <div
              role="alert"
              className="mx-4 mt-3 p-3 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300"
            >
              {chatError}
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {botMessages.length === 0 ? (
              <div className="py-10 text-center space-y-2">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Start a direct session with {employee.name}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  {employee.id === 'max'
                    ? 'Ask Max to research competitors, market trends, or summarize articles with live Google Search citations.'
                    : employee.id === 'emma'
                      ? 'Ask Emma to summarize critical P1/P2 emails or draft a response.'
                      : employee.id === 'sophie'
                        ? 'Ask Sophie to build your daily agenda or resolve calendar overlaps.'
                        : employee.id === 'charlie'
                          ? 'Ask Charlie to write a YouTube script, business proposal, or social calendar.'
                          : 'Ask Alex for a cross-team status report or task prioritization.'}
                </p>
              </div>
            ) : (
              botMessages.map((msg) => {
                const isCeo = msg.sender === 'ceo';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isCeo ? 'items-end' : 'items-start'}`}
                  >
                    <span className="text-[11px] text-slate-400 mb-1 font-mono">
                      {isCeo ? 'CEO' : employee.name} · {formatShortTime(msg.createdAt)}
                    </span>
                    <div
                      className={`max-w-xl rounded-xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed ${
                        isCeo
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      {msg.text}
                      {msg.metadata?.sources && msg.metadata.sources.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-700 space-y-1">
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
                    </div>
                  </div>
                );
              })
            )}
            {chatBusy && (
              <p className="text-xs font-mono text-blue-600 dark:text-blue-400">
                {employee.name} is thinking...
              </p>
            )}
          </div>

          <form
            onSubmit={handleChatSubmit}
            className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center gap-3"
          >
            <label htmlFor="employee-chat-input" className="sr-only">
              Message {employee.name}
            </label>
            <input
              id="employee-chat-input"
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              disabled={!employee.enabled}
              placeholder={
                employee.enabled
                  ? `Message ${employee.name} directly...`
                  : `${employee.name} is currently disabled`
              }
              className="flex-1 px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!employee.enabled || chatBusy || !chatInput.trim()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium transition-colors shrink-0"
            >
              <Send className="w-4 h-4" />
              <span>Send</span>
            </button>
          </form>
        </section>

        {/* Right Column: AI Instructions, Permissions & Task History (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* AI Instructions & Permissions */}
          <form
            onSubmit={handleSaveConfig}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-semibold">
                AI Prompt & Permissions
              </h3>
              <button
                type="submit"
                disabled={savingConfig}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingConfig ? 'Saving...' : 'Save'}</span>
              </button>
            </div>

            {configSavedMsg && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400">{configSavedMsg}</p>
            )}

            <div>
              <label
                htmlFor="bot-system-prompt"
                className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5"
              >
                System Instructions
              </label>
              <textarea
                id="bot-system-prompt"
                rows={4}
                value={promptDraft}
                onChange={(e) => setPromptDraft(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              {(
                [
                  ['requireApprovalForSensitive', 'Require CEO Approval'],
                  ['canAccessWeb', 'Internet Search Access'],
                  ['canAssignTasks', 'Delegate Tasks'],
                  ['canScheduleExternalMeetings', 'External Calendar Invites'],
                  ['canSendExternalMessages', 'Auto-Send Messages'],
                  ['canDeleteData', 'Permanent Deletion'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={permsDraft[key]}
                    onChange={(e) =>
                      setPermsDraft((prev) => ({ ...prev, [key]: e.target.checked }))
                    }
                    className="rounded border-slate-300 dark:border-slate-700 text-blue-600"
                  />
                  <span className="text-slate-700 dark:text-slate-300">{label}</span>
                </label>
              ))}
            </div>
          </form>

          {/* Task History & Completed Work */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
            <h3 className="font-display text-base font-semibold">
              {employee.name} Task History & Completed Work
            </h3>
            {botTasks.length === 0 ? (
              <p className="text-xs text-slate-500 py-4">
                No tasks assigned directly to {employee.name} yet.
              </p>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {botTasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold truncate">{task.title}</p>
                      <TaskStatusLabel status={task.status} />
                    </div>
                    {task.output && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3 whitespace-pre-wrap">
                        {task.output}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Specialist Interactive Tool Panels */}
      {employee.id === 'emma' && (
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-base font-semibold flex items-center gap-2">
                <Mail className="w-4 h-4 text-purple-600" />
                <span>Emma Email Triage & Phishing Monitor (Gmail / Outlook)</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                P1 Critical · P2 Important · P3 Normal · P4 Low · P5 Spam/Suspicious. All replies
                require CEO approval before sending.
              </p>
            </div>
            <button
              type="button"
              onClick={async () => {
                setEmailBusy(true);
                try {
                  await onTriageEmails();
                } finally {
                  setEmailBusy(false);
                }
              }}
              disabled={emailBusy}
              className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-medium whitespace-nowrap"
            >
              {emailBusy ? 'Analyzing Inbox...' : 'Run AI Inbox Triage'}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-3">
              {workspace.emails.map((mail) => (
                <div
                  key={mail.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-semibold truncate">{mail.subject}</span>
                      {mail.phishingFlag && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          Phishing Quarantined
                        </span>
                      )}
                    </div>
                    <EmailPriorityLabel priority={mail.priority} />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {mail.senderName} &lt;{mail.senderEmail}&gt; · {mail.provider.toUpperCase()} ·{' '}
                    {mail.status.replace('_', ' ')}
                  </p>
                  <p className="text-xs text-slate-700 dark:text-slate-300">{mail.body}</p>
                  {mail.aiSummary && (
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      Emma Summary: {mail.aiSummary}
                    </p>
                  )}
                  {mail.draftReply && (
                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs">
                      <span className="font-semibold">Draft Reply: </span>
                      {mail.draftReply}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <form
              onSubmit={handleAddEmail}
              className="lg:col-span-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 space-y-3 h-fit"
            >
              <h4 className="font-display text-sm font-semibold">Ingest Test Email for Triage</h4>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Provider</label>
                <select
                  value={newMailProvider}
                  onChange={(e) => setNewMailProvider(e.target.value as 'gmail' | 'outlook')}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                >
                  <option value="gmail">Gmail</option>
                  <option value="outlook">Outlook</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Sender Email</label>
                <input
                  type="email"
                  required
                  value={newMailFrom}
                  onChange={(e) => setNewMailFrom(e.target.value)}
                  placeholder="client@enterprise.com"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Subject</label>
                <input
                  type="text"
                  required
                  value={newMailSubject}
                  onChange={(e) => setNewMailSubject(e.target.value)}
                  placeholder="Urgent contract renewal terms"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Message Body</label>
                <textarea
                  rows={3}
                  required
                  value={newMailBody}
                  onChange={(e) => setNewMailBody(e.target.value)}
                  placeholder="Paste email body for Emma to classify and draft..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                />
              </div>
              <button
                type="submit"
                disabled={emailBusy}
                className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium"
              >
                {emailBusy ? 'Analyzing...' : 'Receive & Triage with Emma'}
              </button>
            </form>
          </div>
        </section>
      )}

      {employee.id === 'sophie' && (
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-5">
          <div>
            <h3 className="font-display text-base font-semibold flex items-center gap-2">
              <Calendar className="w-4 h-4 text-pink-600" />
              <span>Sophie Schedule & Conflict Manager (Google Calendar)</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Automatically checks overlapping slots and routes external invitations to Approval
              Center.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-3">
              {workspace.calendarEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">{ev.title}</p>
                    <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                      {formatShortDateTime(ev.startIso)} → {formatShortTime(ev.endIso)}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      {ev.location} · Attendees: {ev.attendees.join(', ') || 'Internal'}
                    </p>
                    {ev.notes && <p className="text-xs text-slate-500">{ev.notes}</p>}
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
                    {ev.status}
                  </span>
                </div>
              ))}
            </div>

            <form
              onSubmit={handleAddCalendar}
              className="lg:col-span-5 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 space-y-3 h-fit"
            >
              <h4 className="font-display text-sm font-semibold">Schedule Appointment</h4>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Meeting Title</label>
                <input
                  type="text"
                  required
                  value={calTitle}
                  onChange={(e) => setCalTitle(e.target.value)}
                  placeholder="Investor Demo Briefing"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Start</label>
                  <input
                    type="datetime-local"
                    required
                    value={calStart}
                    onChange={(e) => setCalStart(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">End</label>
                  <input
                    type="datetime-local"
                    required
                    value={calEnd}
                    onChange={(e) => setCalEnd(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">
                  Attendees (comma-separated)
                </label>
                <input
                  type="text"
                  value={calAttendees}
                  onChange={(e) => setCalAttendees(e.target.value)}
                  placeholder="partner@acme.io, cto@company.com"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                />
              </div>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={calSendInvite}
                  onChange={(e) => setCalSendInvite(e.target.checked)}
                />
                <span>Require CEO approval before sending external invites</span>
              </label>
              <button
                type="submit"
                disabled={calBusy}
                className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium"
              >
                {calBusy ? 'Checking Conflicts...' : 'Create Calendar Event'}
              </button>
            </form>
          </div>
        </section>
      )}
    </div>
  );
}
