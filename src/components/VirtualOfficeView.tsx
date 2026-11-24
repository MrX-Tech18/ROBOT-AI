import { useState, type FormEvent } from 'react';
import { ArrowUpRight, Box, Layers, Pause, Play, Send } from 'lucide-react';
import type { BotId, WorkspacePayload } from '../shared/types';
import CuteRobotAvatar from './CuteRobotAvatar';
import OfficeScene2D from './OfficeScene2D';
import OfficeScene3D from './OfficeScene3D';
import { BotStatusLabel } from './StatusText';

interface VirtualOfficeViewProps {
  workspace: WorkspacePayload;
  theme: 'light' | 'dark';
  selectedBotId: BotId | null;
  commandBusy: boolean;
  commandError?: string | null;
  onSelectBot: (botId: BotId) => void;
  onOpenWorkspace: (botId: BotId) => void;
  onSendCommand: (command: string) => Promise<void>;
  onToggleEmployee: (botId: BotId, enabled: boolean) => Promise<void>;
}

export default function VirtualOfficeView({
  workspace,
  theme,
  commandBusy,
  commandError,
  onSelectBot,
  onOpenWorkspace,
  onSendCommand,
  onToggleEmployee,
}: VirtualOfficeViewProps) {
  const [quickCommand, setQuickCommand] = useState('');
  const [inspectBotId, setInspectBotId] = useState<BotId | null>(null);
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');

  const inspected = inspectBotId
    ? workspace.employees.find((e) => e.id === inspectBotId) ?? null
    : null;

  const handleBotClick = (botId: BotId) => {
    setInspectBotId(botId);
    onSelectBot(botId);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!quickCommand.trim() || commandBusy) return;
    const text = quickCommand;
    setQuickCommand('');
    await onSendCommand(text);
  };

  return (
    <div className="space-y-4 max-w-[1440px] mx-auto">
      {/* Quick CEO Command Bar + 2D/3D View Mode Switcher */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
        <form
          onSubmit={handleSubmit}
          className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
        >
          <label htmlFor="quick-office-command" className="sr-only">
            Send instruction to Alex and AI team
          </label>
          <input
            id="quick-office-command"
            type="text"
            value={quickCommand}
            onChange={(e) => setQuickCommand(e.target.value)}
            placeholder='Give Alex a directive (e.g., "Alex, check what needs my attention today")'
            className="flex-1 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <button
            type="submit"
            disabled={commandBusy || !quickCommand.trim()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium transition-colors whitespace-nowrap shrink-0"
          >
            <Send className="w-4 h-4" />
            <span>{commandBusy ? 'Coordinating...' : 'Dispatch Team'}</span>
          </button>
        </form>

        {/* Client 2D / 3D Switcher Button */}
        <div
          role="group"
          aria-label="Office view mode"
          className="inline-flex items-center gap-1 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 self-start lg:self-auto"
        >
          <button
            type="button"
            onClick={() => setViewMode('2d')}
            aria-pressed={viewMode === '2d'}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              viewMode === '2d'
                ? 'bg-blue-600 text-white'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>2D Office</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('3d')}
            aria-pressed={viewMode === '3d'}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              viewMode === '3d'
                ? 'bg-blue-600 text-white'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            <span>3D Office</span>
          </button>
        </div>
      </div>

      {commandError && (
        <div className="px-4 py-2.5 rounded-lg border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/60 text-xs text-red-700 dark:text-red-300">
          {commandError}
        </div>
      )}

      {/* Main 2D / 3D Virtual Office + Optional Side Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        <div
          className={`${inspected ? 'lg:col-span-8' : 'lg:col-span-12'} ${
            viewMode === '3d' ? 'h-[540px] sm:h-[580px]' : ''
          }`}
        >
          {viewMode === '2d' ? (
            <OfficeScene2D
              employees={workspace.employees}
              metrics={workspace.metrics}
              theme={theme}
              selectedBotId={inspectBotId}
              onSelectBot={handleBotClick}
            />
          ) : (
            <OfficeScene3D
              employees={workspace.employees}
              metrics={workspace.metrics}
              theme={theme}
              selectedBotId={inspectBotId}
              onSelectBot={handleBotClick}
            />
          )}
        </div>

        {inspected && (
          <aside className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-sky-50 dark:bg-slate-800 border border-sky-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                    <CuteRobotAvatar
                      botId={inspected.id}
                      accentHex={inspected.colorHex}
                      status={inspected.status}
                      size={44}
                      showShadow={false}
                    />
                  </div>
                  <div>
                    <h2 className="font-display text-lg font-semibold">{inspected.name}</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {inspected.title}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectBotId(null)}
                  className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white"
                >
                  Close
                </button>
              </div>

              <div className="flex items-center justify-between py-2.5 border-y border-slate-200 dark:border-slate-800 text-xs">
                <span className="text-slate-500 dark:text-slate-400">Live Workstation State</span>
                <BotStatusLabel status={inspected.status} />
              </div>

              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {inspected.description}
              </p>

              <div className="pt-2.5 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Personality &amp; Style
                </p>
                <p className="text-xs font-semibold" style={{ color: inspected.colorHex }}>
                  {inspected.personality.archetype} · {inspected.personality.traits.join(' · ')}
                </p>
                <p className="text-xs italic text-slate-600 dark:text-slate-300">
                  &ldquo;{inspected.personality.tagline}&rdquo;
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {inspected.personality.quirk}
                </p>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Current Assignment
                </p>
                <p className="text-sm text-slate-900 dark:text-slate-100">
                  {inspected.currentTaskTitle || 'Standing by at workstation'}
                </p>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Connected Tools · Desk Prop
                </p>
                <p className="text-xs text-slate-700 dark:text-slate-300">
                  {inspected.tools.join(' · ')} · {inspected.personality.deskProp}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => onOpenWorkspace(inspected.id)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors whitespace-nowrap"
              >
                <span>Open Workspace</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onToggleEmployee(inspected.id, !inspected.enabled)}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
              >
                {inspected.enabled ? (
                  <>
                    <Pause className="w-3.5 h-3.5" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    <span>Resume</span>
                  </>
                )}
              </button>
            </div>
          </aside>
        )}
      </div>

      {/* Live 5-Employee Workstation Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {workspace.employees.map((emp) => (
          <button
            key={emp.id}
            type="button"
            onClick={() => onOpenWorkspace(emp.id)}
            className="text-left p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-500 dark:hover:border-blue-500 transition-colors"
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="flex items-center gap-2 font-display text-sm font-semibold">
                <CuteRobotAvatar
                  botId={emp.id}
                  accentHex={emp.colorHex}
                  status={emp.status}
                  size={28}
                  showShadow={false}
                />
                {emp.name}
              </span>
              <BotStatusLabel status={emp.status} />
            </div>
            <p className="text-[11px] font-medium truncate" style={{ color: emp.colorHex }}>
              {emp.personality.archetype}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{emp.title}</p>
            <p className="text-xs text-slate-700 dark:text-slate-300 truncate mt-1.5">
              {emp.currentTaskTitle || `"${emp.personality.tagline}"`}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
