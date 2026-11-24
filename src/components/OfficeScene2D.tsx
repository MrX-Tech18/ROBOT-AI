import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, RotateCcw, Sun } from 'lucide-react';
import type { BotId, BotStatus, EmployeeProfile, OfficeMetrics } from '../shared/types';
import CuteRobotAvatar from './CuteRobotAvatar';

interface OfficeScene2DProps {
  employees: EmployeeProfile[];
  metrics: OfficeMetrics;
  theme: 'light' | 'dark';
  selectedBotId: BotId | null;
  onSelectBot: (botId: BotId) => void;
}

type FocusPresetId =
  | 'overview'
  | 'reception'
  | 'ceo'
  | 'meeting'
  | 'billiard'
  | 'pantry'
  | 'sleep'
  | BotId;

const FOCUS_PRESETS: Array<{ id: FocusPresetId; label: string }> = [
  { id: 'overview', label: 'Office Overview' },
  { id: 'reception', label: 'Reception' },
  { id: 'ceo', label: 'CEO Office' },
  { id: 'meeting', label: 'Meeting Room' },
  { id: 'billiard', label: 'Billiard' },
  { id: 'pantry', label: 'Pantry & Coffee' },
  { id: 'sleep', label: 'Quiet Lounge' },
  { id: 'alex', label: 'Alex' },
  { id: 'emma', label: 'Emma' },
  { id: 'max', label: 'Max' },
  { id: 'sophie', label: 'Sophie' },
  { id: 'charlie', label: 'Charlie' },
];

const ROOM_PRESETS: ReadonlySet<FocusPresetId> = new Set([
  'overview',
  'reception',
  'ceo',
  'meeting',
  'billiard',
  'pantry',
  'sleep',
]);

const STATUS_LABELS: Record<BotStatus, string> = {
  idle: 'Idle · Ready',
  thinking: 'Thinking...',
  working: 'Working',
  completed: 'Completed',
  error: 'Alert · Error',
  waiting: 'Awaiting Approval',
  paused: 'Paused',
};

const OFFICE_PHOTO_URL = '/src/assets/images/modern_corporate_office_1795508082718.jpg';

function Plant2D({ className = '' }: { className?: string }) {
  return (
    <svg
      width="42"
      height="54"
      viewBox="0 0 42 54"
      fill="none"
      className={`select-none shrink-0 ${className}`}
      aria-hidden="true"
    >
      <ellipse cx="21" cy="49" rx="12" ry="3" fill="#0F172A" fillOpacity="0.12" />
      <path d="M21 29 C13 21, 7 21, 6 13 C14 12, 19 18, 21 25 Z" fill="#3B8754" />
      <path d="M21 29 C29 21, 35 21, 36 13 C28 12, 23 18, 21 25 Z" fill="#2E7044" />
      <path d="M21 27 C17 15, 18 7, 21 4 C24 7, 25 15, 21 27 Z" fill="#4D9E68" />
      <path d="M12 29 L30 29 L27.5 47 C27.5 48.2, 14.5 48.2, 14.5 47 Z" fill="#EFE8DC" stroke="#D6CBB8" strokeWidth="1.2" />
      <rect x="10.5" y="27" width="21" height="4" rx="2" fill="#E6DDD0" />
    </svg>
  );
}

function Bookshelf2D({ className = '' }: { className?: string }) {
  return (
    <svg
      width="58"
      height="54"
      viewBox="0 0 58 54"
      fill="none"
      className={`select-none shrink-0 ${className}`}
      aria-hidden="true"
    >
      <rect x="4" y="4" width="50" height="46" rx="2.5" fill="#C8A378" stroke="#A68259" strokeWidth="1.2" />
      <rect x="7" y="7" width="44" height="11" fill="#F5F0E8" />
      <rect x="7" y="21" width="44" height="11" fill="#F5F0E8" />
      <rect x="7" y="35" width="44" height="12" fill="#E2E8F0" />
      <line x1="29" y1="35" x2="29" y2="47" stroke="#94A3B8" strokeWidth="1" />
      <rect x="10" y="9" width="4" height="9" rx="0.5" fill="#5B8EC9" />
      <rect x="15" y="8" width="4" height="10" rx="0.5" fill="#475569" />
      <rect x="20" y="10" width="4" height="8" rx="0.5" fill="#D6C7B2" />
      <rect x="35" y="9" width="12" height="9" rx="1" fill="#DFD3C0" />
      <rect x="12" y="23" width="10" height="9" rx="1" fill="#CBD5E1" />
      <rect x="28" y="22" width="4" height="10" rx="0.5" fill="#5B8EC9" />
      <rect x="33" y="24" width="4" height="8" rx="0.5" fill="#64748B" />
      <rect x="38" y="22" width="4" height="10" rx="0.5" fill="#94A3B8" />
    </svg>
  );
}

function DeskProp2D({ botId, colorHex }: { botId: BotId; colorHex: string }) {
  if (botId === 'alex') {
    return (
      <svg width="20" height="18" viewBox="0 0 20 18" fill="none" aria-hidden="true">
        <rect x="3" y="2" width="14" height="15" rx="2" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="1.2" />
        <rect x="6" y="0.5" width="8" height="3" rx="1" fill={colorHex} />
        <line x1="6" y1="8" x2="14" y2="8" stroke="#64748B" strokeWidth="1.3" strokeLinecap="round" />
        <line x1="6" y1="12" x2="12" y2="12" stroke="#64748B" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    );
  }
  if (botId === 'emma') {
    return (
      <svg width="22" height="16" viewBox="0 0 22 16" fill="none" aria-hidden="true">
        <rect x="1.5" y="2" width="19" height="12" rx="2" fill="#F8FAFC" stroke="#94A3B8" strokeWidth="1.2" />
        <path d="M2.5 3.5 L11 9.5 L19.5 3.5" stroke={colorHex} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (botId === 'max') {
    return (
      <svg width="20" height="18" viewBox="0 0 20 18" fill="none" aria-hidden="true">
        <circle cx="10" cy="8" r="5.5" fill="#DBEAFE" stroke="#64748B" strokeWidth="1.2" />
        <ellipse cx="10" cy="8" rx="2.5" ry="5.5" stroke={colorHex} strokeWidth="1.1" />
        <line x1="6" y1="16" x2="14" y2="16" stroke="#64748B" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
  }
  if (botId === 'sophie') {
    return (
      <svg width="20" height="18" viewBox="0 0 20 18" fill="none" aria-hidden="true">
        <circle cx="10" cy="9.5" r="6" fill="#FFFFFF" stroke="#C8A378" strokeWidth="1.4" />
        <path d="M10 6.5 V9.5 L12.5 11" stroke={colorHex} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="20" height="18" viewBox="0 0 20 18" fill="none" aria-hidden="true">
      <rect x="2" y="5" width="16" height="11" rx="1.5" fill="#F5F0E8" stroke="#94A3B8" strokeWidth="1.2" />
      <rect x="4" y="8" width="12" height="1.5" rx="0.7" fill={colorHex} />
    </svg>
  );
}

function WorkstationCard2D({
  employee,
  selected,
  dimmed,
  onClick,
}: {
  employee: EmployeeProfile;
  selected: boolean;
  dimmed: boolean;
  onClick: () => void;
}) {
  const isAlert = employee.status === 'error';
  const isWaiting = employee.status === 'waiting';
  const isBusy = employee.status === 'working' || employee.status === 'thinking';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Open ${employee.name} workstation (${employee.personality.archetype}, ${STATUS_LABELS[employee.status]})`}
      className={`group relative w-full text-left rounded-xl border p-4 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
        selected
          ? 'border-blue-600 dark:border-blue-400 bg-white dark:bg-slate-900 shadow-md ring-2 ring-blue-500/20 z-10'
          : 'border-stone-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 hover:border-blue-400 dark:hover:border-blue-500 hover:-translate-y-0.5 shadow-sm'
      } ${dimmed ? 'opacity-50' : 'opacity-100'}`}
    >
      {/* Employee Header & Live Status */}
      <div className="flex items-center justify-between gap-2 mb-0.5">
        <span className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5 min-w-0 truncate">
          <span
            className="w-2.5 h-2.5 rounded-sm shrink-0"
            style={{ backgroundColor: employee.colorHex }}
          />
          <span className="truncate">{employee.name}</span>
        </span>
        <span
          className={`text-[11px] font-mono font-medium whitespace-nowrap shrink-0 ${
            isAlert
              ? 'text-red-600 dark:text-red-400'
              : isWaiting
                ? 'text-amber-600 dark:text-amber-400'
                : isBusy
                  ? 'text-blue-600 dark:text-blue-400'
                  : employee.status === 'completed'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          {STATUS_LABELS[employee.status]}
        </span>
      </div>
      <p className="text-[11px] font-medium truncate mb-2 text-slate-500 dark:text-slate-400">
        {employee.personality.archetype} · {employee.personality.traits.slice(0, 2).join(' · ')}
      </p>

      {/* Modern Corporate Workstation Scene: Ergonomic Chair + Employee + Oak Desk + Desktop PC */}
      <div className="relative flex flex-col items-center pt-2 pb-2 rounded-lg bg-[#F5F3EE] dark:bg-slate-800/60 border border-stone-200/70 dark:border-slate-700/60">
        {/* Subtle Ergonomic Mesh Office Chair Backrest */}
        <div
          className="absolute top-3 w-14 h-12 rounded-t-xl border border-slate-300 dark:border-slate-600 bg-slate-200/80 dark:bg-slate-700/70 pointer-events-none"
          aria-hidden="true"
        />

        {/* Cute Floating AI Employee */}
        <div className="relative z-10 -mb-5 transition-transform duration-200 group-hover:scale-105">
          <CuteRobotAvatar
            botId={employee.id}
            accentHex={employee.colorHex}
            status={employee.status}
            size={84}
            showShadow={false}
          />
        </div>

        {/* Natural Oak Workstation Desk + Desktop PC Tower & Monitor */}
        <div className="relative z-20 w-full max-w-[224px] px-2">
          {/* Desktop PC Tower on Right Corner */}
          <div
            className="absolute right-3 bottom-5 w-4 h-9 rounded-sm bg-slate-700 dark:bg-slate-600 border border-slate-500/50 shadow-sm flex flex-col items-center pt-1.5"
            aria-hidden="true"
          >
            <span className="w-1.5 h-0.5 rounded-full bg-sky-300" />
          </div>

          {/* Signature Personal Desk Prop on Left Corner */}
          <div className="absolute left-3 bottom-5 z-30">
            <DeskProp2D botId={employee.id} colorHex={employee.colorHex} />
          </div>

          {/* Clean Light-Mode Widescreen Desktop Monitor */}
          <div className="mx-auto w-[118px] rounded-md border border-slate-400 dark:border-slate-500 bg-white dark:bg-slate-900 p-1.5 shadow-sm">
            <div className="flex items-center gap-1 mb-1">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: employee.colorHex }}
              />
              <div className="h-1 flex-1 rounded-full bg-slate-200 dark:bg-slate-700" />
            </div>
            <div className="space-y-1">
              <div className="h-1 w-4/5 rounded-full bg-blue-200 dark:bg-blue-700/70" />
              <div className="h-1 w-3/5 rounded-full bg-slate-200 dark:bg-slate-700" />
              <div className="h-1 w-11/12 rounded-full bg-stone-200 dark:bg-slate-600" />
            </div>
          </div>
          {/* Brushed Aluminum Monitor Stand */}
          <div className="mx-auto w-4 h-1.5 bg-slate-300 dark:bg-slate-500" />

          {/* Natural Oak Desktop Surface */}
          <div className="w-full h-5 rounded-md border border-[#B08A5D] bg-[#D1AE83] dark:bg-[#8A6743] flex items-center justify-between px-3 shadow-sm">
            <div className="w-12 h-1.5 rounded-sm bg-stone-100/90" />
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-1.5 rounded-sm bg-slate-700/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-white/95 border border-stone-300" />
            </div>
          </div>
        </div>
      </div>

      {/* Role, Assignment & Interactive Cue */}
      <div className="mt-2.5 pt-2 border-t border-stone-100 dark:border-slate-800 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
            {employee.title}
          </p>
          <p className="text-xs text-slate-800 dark:text-slate-200 truncate mt-0.5">
            {employee.currentTaskTitle || `"${employee.personality.tagline}"`}
          </p>
        </div>
        <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400 opacity-80 group-hover:opacity-100 whitespace-nowrap shrink-0">
          Open →
        </span>
      </div>
    </button>
  );
}

export default function OfficeScene2D({
  employees,
  metrics,
  theme,
  selectedBotId,
  onSelectBot,
}: OfficeScene2DProps) {
  const [activePreset, setActivePreset] = useState<FocusPresetId>('overview');
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);

  useEffect(() => {
    if (selectedBotId) {
      setActivePreset(selectedBotId);
    } else if (!ROOM_PRESETS.has(activePreset)) {
      setActivePreset('overview');
    }
  }, [selectedBotId, activePreset]);

  const byId = (id: BotId) => employees.find((e) => e.id === id);
  const alex = byId('alex');
  const emma = byId('emma');
  const max = byId('max');
  const sophie = byId('sophie');
  const charlie = byId('charlie');

  const handlePresetClick = (presetId: FocusPresetId) => {
    setActivePreset(presetId);
    if (
      presetId === 'alex' ||
      presetId === 'emma' ||
      presetId === 'max' ||
      presetId === 'sophie' ||
      presetId === 'charlie'
    ) {
      onSelectBot(presetId);
    }
  };

  const isBotDimmed = (id: BotId) =>
    activePreset !== 'overview' && activePreset !== id;

  return (
    <div
      data-testid="virtual-office-2d"
      className={`relative w-full min-h-[540px] rounded-2xl border overflow-hidden flex flex-col justify-between p-4 sm:p-5 space-y-4 ${
        theme === 'dark'
          ? 'border-slate-800 bg-slate-950'
          : 'border-stone-200 bg-[#F5F4F0]'
      }`}
    >
      {/* Architectural Daylight Office Header Banner + Live Operations Summary */}
      <div className="relative rounded-xl overflow-hidden border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="relative min-h-[190px] sm:h-48 w-full overflow-hidden bg-gradient-to-r from-[#EDE8DF] via-[#F5F3EE] to-[#E2EAF2] dark:from-slate-800 dark:to-slate-900">
          {!photoFailed && (
            <img
              src={OFFICE_PHOTO_URL}
              alt="Modern open-plan corporate office interior with natural daylight windows, oak desks, glass meeting room, and indoor plants"
              referrerPolicy="no-referrer"
              onError={() => setPhotoFailed(true)}
              className="absolute inset-0 w-full h-full object-cover object-center"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/45 to-slate-950/15" />
          <div className="relative z-10 min-h-[190px] sm:h-full p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-end justify-end sm:justify-between gap-3">
            <div className="text-white">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-sky-200 mb-0.5">
                <Sun className="w-3.5 h-3.5" />
                <span>Natural Daylight · Open-Plan Corporate Interior</span>
              </div>
              <h2 className="font-display text-base sm:text-lg font-semibold tracking-tight">
                Robot Office AI · Studio Floorplan
              </h2>
            </div>

            {/* Clean Light-Surface Live Metrics */}
            <div className="grid grid-cols-4 gap-2 bg-white/95 dark:bg-slate-900/95 text-slate-900 dark:text-slate-100 rounded-lg border border-stone-200/80 dark:border-slate-700 px-3 py-1.5 shadow-sm">
              <div className="text-center px-1">
                <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Tasks</p>
                <p className="font-mono text-sm font-bold tabular-nums">{metrics.totalTasks}</p>
              </div>
              <div className="text-center px-1 border-l border-stone-200 dark:border-slate-700">
                <p className="text-[10px] font-medium text-blue-600 dark:text-blue-400">Active</p>
                <p className="font-mono text-sm font-bold tabular-nums">{metrics.activeTasks}</p>
              </div>
              <div className="text-center px-1 border-l border-stone-200 dark:border-slate-700">
                <p className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">Done</p>
                <p className="font-mono text-sm font-bold tabular-nums">{metrics.completedTasks}</p>
              </div>
              <div className="text-center px-1 border-l border-stone-200 dark:border-slate-700">
                <p className="text-[10px] font-medium text-amber-600 dark:text-amber-400">Sign-off</p>
                <p className="font-mono text-sm font-bold tabular-nums">{metrics.pendingApprovals}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Architectural Rooms Row: Reception Area · Main CEO Office · Conference & Meeting Room */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-stretch">
        {/* Reception Area (4 cols) */}
        <button
          type="button"
          onClick={() => setActivePreset(activePreset === 'reception' ? 'overview' : 'reception')}
          className={`md:col-span-4 text-left rounded-xl border p-3.5 transition-all ${
            activePreset === 'reception'
              ? 'border-blue-600 bg-white dark:bg-slate-900 shadow-md ring-2 ring-blue-500/20'
              : 'border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-400'
          } ${
            activePreset !== 'overview' && activePreset !== 'reception'
              ? 'opacity-55'
              : 'opacity-100'
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="font-display text-xs font-bold text-slate-900 dark:text-white">
              Reception Area
            </span>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Visitor Lounge
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <svg width="116" height="54" viewBox="0 0 116 54" fill="none" aria-hidden="true">
              {/* Cream rug */}
              <rect x="4" y="4" width="108" height="46" rx="6" fill="#F5F0E8" />
              {/* Oak & white reception desk */}
              <rect x="10" y="9" width="52" height="15" rx="3" fill="#C8A378" stroke="#A68259" strokeWidth="1.2" />
              <rect x="14" y="12" width="18" height="7" rx="1.5" fill="#FFFFFF" />
              {/* Cream visitor sofa */}
              <rect x="68" y="28" width="38" height="16" rx="4" fill="#E6DDD0" stroke="#C5B9A5" strokeWidth="1.2" />
              <rect x="74" y="13" width="24" height="10" rx="2" fill="#C8A378" />
            </svg>
            <div className="text-right text-xs text-slate-600 dark:text-slate-300 space-y-0.5 min-w-0">
              <p className="font-medium text-slate-900 dark:text-white truncate">Front Desk</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                Oak counter &amp; sofa
              </p>
            </div>
          </div>
        </button>

        {/* CEO Private Office (4 cols) */}
        <button
          type="button"
          onClick={() => setActivePreset(activePreset === 'ceo' ? 'overview' : 'ceo')}
          className={`md:col-span-4 text-left rounded-xl border p-3.5 transition-all ${
            activePreset === 'ceo'
              ? 'border-blue-600 bg-white dark:bg-slate-900 shadow-md ring-2 ring-blue-500/20'
              : 'border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-400'
          } ${
            activePreset !== 'overview' && activePreset !== 'ceo' ? 'opacity-55' : 'opacity-100'
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="font-display text-xs font-bold text-slate-900 dark:text-white">
              CEO Private Office
            </span>
            <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400">
              Glass Partition
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <svg width="116" height="54" viewBox="0 0 116 54" fill="none" aria-hidden="true">
              {/* Cream executive carpet */}
              <rect x="4" y="4" width="108" height="46" rx="6" fill="#EFEAE1" stroke="#CBD5E1" strokeWidth="1.2" />
              {/* Executive leather chair */}
              <rect x="40" y="6" width="36" height="12" rx="6" fill="#D6C7B2" stroke="#A89882" strokeWidth="1.2" />
              {/* Large Walnut Executive Desk */}
              <rect x="14" y="20" width="88" height="22" rx="4" fill="#8C6244" stroke="#6E4B32" strokeWidth="1.2" />
              {/* Desktop monitor & blotter */}
              <rect x="42" y="24" width="32" height="12" rx="2" fill="#F8FAFC" stroke="#94A3B8" strokeWidth="1" />
              <circle cx="88" cy="31" r="4" fill="#FFFFFF" />
            </svg>
            <div className="text-right text-xs text-slate-600 dark:text-slate-300 space-y-0.5 min-w-0">
              <p className="font-medium text-slate-900 dark:text-white truncate">Executive Suite</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {metrics.pendingApprovals} pending sign-off
              </p>
            </div>
          </div>
        </button>

        {/* Small Conference & Meeting Room (4 cols) */}
        <button
          type="button"
          onClick={() => setActivePreset(activePreset === 'meeting' ? 'overview' : 'meeting')}
          className={`md:col-span-4 text-left rounded-xl border p-3.5 transition-all ${
            activePreset === 'meeting'
              ? 'border-blue-600 bg-white dark:bg-slate-900 shadow-md ring-2 ring-blue-500/20'
              : 'border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-400'
          } ${
            activePreset !== 'overview' && activePreset !== 'meeting'
              ? 'opacity-55'
              : 'opacity-100'
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="font-display text-xs font-bold text-slate-900 dark:text-white">
              Conference &amp; Meeting Room
            </span>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Glass Partition
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <svg width="116" height="54" viewBox="0 0 116 54" fill="none" aria-hidden="true">
              {/* Soft gray carpet */}
              <rect x="4" y="4" width="108" height="46" rx="6" fill="#E5E7EB" stroke="#CBD5E1" strokeWidth="1.2" />
              {/* 6 soft-blue ergonomic chairs */}
              <circle cx="34" cy="11" r="4.8" fill="#5B8EC9" />
              <circle cx="58" cy="10" r="4.8" fill="#5B8EC9" />
              <circle cx="82" cy="11" r="4.8" fill="#5B8EC9" />
              <circle cx="34" cy="43" r="4.8" fill="#5B8EC9" />
              <circle cx="58" cy="44" r="4.8" fill="#5B8EC9" />
              <circle cx="82" cy="43" r="4.8" fill="#5B8EC9" />
              {/* Natural oak conference table */}
              <rect x="20" y="17" width="76" height="20" rx="5" fill="#C8A378" stroke="#A68259" strokeWidth="1.2" />
              <rect x="44" y="23" width="28" height="8" rx="2" fill="#F8FAFC" />
            </svg>
            <div className="text-right text-xs text-slate-600 dark:text-slate-300 space-y-0.5 min-w-0">
              <p className="font-medium text-slate-900 dark:text-white truncate">6-Seat Oak Table</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {metrics.upcomingAppointments} scheduled events
              </p>
            </div>
          </div>
        </button>
      </div>

      {/* Main Open-Plan Workstations Zone: Natural Daylight Windows + Storage + 5 Workstations */}
      <div className="rounded-xl border border-stone-200 dark:border-slate-800 bg-[#ECEAE4] dark:bg-slate-900/60 p-4 space-y-4">
        {/* Daylight Window Strip & Storage Indicator */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-stone-300/70 dark:border-slate-800">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
            <span className="inline-block w-8 h-2 rounded-sm bg-sky-200 border border-slate-300 dark:border-slate-600" />
            <span>Open-Plan Workspace · Large Daylight Windows · Oak &amp; Light-Gray Flooring</span>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            5 Workstations · Storage Cabinets &amp; Bookshelves · Indoor Plants
          </span>
        </div>

        {/* Back/Middle Row: Emma · Max · Sophie · Charlie */}
        <div
          className={`grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-stretch ${
            selectedBotId ? 'xl:grid-cols-2' : 'xl:grid-cols-4'
          }`}
        >
          {emma && (
            <WorkstationCard2D
              employee={emma}
              selected={selectedBotId === 'emma'}
              dimmed={isBotDimmed('emma')}
              onClick={() => onSelectBot('emma')}
            />
          )}
          {max && (
            <WorkstationCard2D
              employee={max}
              selected={selectedBotId === 'max'}
              dimmed={isBotDimmed('max')}
              onClick={() => onSelectBot('max')}
            />
          )}
          {sophie && (
            <WorkstationCard2D
              employee={sophie}
              selected={selectedBotId === 'sophie'}
              dimmed={isBotDimmed('sophie')}
              onClick={() => onSelectBot('sophie')}
            />
          )}
          {charlie && (
            <WorkstationCard2D
              employee={charlie}
              selected={selectedBotId === 'charlie'}
              dimmed={isBotDimmed('charlie')}
              onClick={() => onSelectBot('charlie')}
            />
          )}
        </div>

        {/* Front Central Desk + Flanking Bookshelves & Indoor Plants: Alex */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-5 pt-1">
          <div className="hidden sm:flex items-center gap-3">
            <Bookshelf2D />
            <Plant2D />
          </div>
          {alex && (
            <div className="w-full sm:w-[330px]">
              <WorkstationCard2D
                employee={alex}
                selected={selectedBotId === 'alex'}
                dimmed={isBotDimmed('alex')}
                onClick={() => onSelectBot('alex')}
              />
            </div>
          )}
          <div className="hidden sm:flex items-center gap-3">
            <Plant2D />
            <Bookshelf2D />
          </div>
        </div>
      </div>

      {/* Harmonized Startup Break & Rest Zones: Pantry & Coffee · Billiard · Quiet Rest Lounge */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 items-stretch">
        {/* Pantry & Coffee Bar */}
        <button
          type="button"
          onClick={() => setActivePreset(activePreset === 'pantry' ? 'overview' : 'pantry')}
          className={`text-left rounded-xl border p-3.5 transition-all ${
            activePreset === 'pantry'
              ? 'border-blue-600 bg-white dark:bg-slate-900 shadow-md ring-2 ring-blue-500/20'
              : 'border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-400'
          } ${
            activePreset !== 'overview' && activePreset !== 'pantry' ? 'opacity-55' : 'opacity-100'
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="font-display text-xs font-bold text-slate-900 dark:text-white">
              Pantry &amp; Coffee Bar
            </span>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Break Kitchen
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <svg width="126" height="58" viewBox="0 0 126 58" fill="none" aria-hidden="true" className="shrink-0">
              <rect x="6" y="6" width="26" height="46" rx="3" fill="#CBD5E1" stroke="#94A3B8" strokeWidth="1.2" />
              <line x1="6" y1="25" x2="32" y2="25" stroke="#64748B" strokeWidth="1.2" />
              <rect x="36" y="33" width="84" height="19" rx="2.5" fill="#C8A378" />
              <rect x="36" y="30" width="84" height="4.5" rx="1.5" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1" />
              <rect x="44" y="10" width="32" height="3.5" rx="1.5" fill="#C8A378" />
              <rect x="47" y="4" width="6" height="6" rx="1" fill="#DFD3C0" />
              <rect x="57" y="4" width="6" height="6" rx="1" fill="#5B8EC9" />
              <rect x="67" y="4" width="6" height="6" rx="1" fill="#86EFAC" />
              <rect x="80" y="12" width="24" height="18" rx="2.5" fill="#334155" />
              <path d="M86 6 H98 L96 12 H88 Z" fill="#78350F" />
              <rect x="109" y="22" width="8" height="8" rx="1.5" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1" />
            </svg>
            <div className="text-right text-xs text-slate-600 dark:text-slate-300 space-y-0.5 min-w-0">
              <p className="font-medium text-slate-900 dark:text-white truncate">Espresso &amp; Fridge</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                Oak counter &amp; mugs
              </p>
            </div>
          </div>
        </button>

        {/* Billiard Break Corner */}
        <button
          type="button"
          onClick={() => setActivePreset(activePreset === 'billiard' ? 'overview' : 'billiard')}
          className={`text-left rounded-xl border p-3.5 transition-all ${
            activePreset === 'billiard'
              ? 'border-blue-600 bg-white dark:bg-slate-900 shadow-md ring-2 ring-blue-500/20'
              : 'border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-400'
          } ${
            activePreset !== 'overview' && activePreset !== 'billiard'
              ? 'opacity-55'
              : 'opacity-100'
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="font-display text-xs font-bold text-slate-900 dark:text-white">
              Billiard Break Lounge
            </span>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Team Recreation
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <svg width="126" height="58" viewBox="0 0 126 58" fill="none" aria-hidden="true" className="shrink-0">
              <rect x="6" y="7" width="108" height="44" rx="5" fill="#7C5338" stroke="#5E3E29" strokeWidth="1.2" />
              <rect x="13" y="13" width="94" height="32" rx="3" fill="#3B7A6C" />
              <circle cx="15" cy="15" r="3.5" fill="#1E293B" />
              <circle cx="60" cy="14" r="3.2" fill="#1E293B" />
              <circle cx="105" cy="15" r="3.5" fill="#1E293B" />
              <circle cx="15" cy="43" r="3.5" fill="#1E293B" />
              <circle cx="60" cy="44" r="3.2" fill="#1E293B" />
              <circle cx="105" cy="43" r="3.5" fill="#1E293B" />
              <circle cx="32" cy="29" r="3" fill="#FFFFFF" />
              <circle cx="76" cy="29" r="2.8" fill="#FACC15" />
              <circle cx="82" cy="25.5" r="2.8" fill="#EF4444" />
              <circle cx="82" cy="32.5" r="2.8" fill="#3B82F6" />
              <line x1="18" y1="5" x2="118" y2="8" stroke="#C2935E" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
            <div className="text-right text-xs text-slate-600 dark:text-slate-300 space-y-0.5 min-w-0">
              <p className="font-medium text-slate-900 dark:text-white truncate">Walnut Pool Table</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                Sage felt &amp; cues
              </p>
            </div>
          </div>
        </button>

        {/* Quiet Rest / Nap Nook */}
        <button
          type="button"
          onClick={() => setActivePreset(activePreset === 'sleep' ? 'overview' : 'sleep')}
          className={`text-left rounded-xl border p-3.5 transition-all ${
            activePreset === 'sleep'
              ? 'border-blue-600 bg-white dark:bg-slate-900 shadow-md ring-2 ring-blue-500/20'
              : 'border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-400'
          } ${
            activePreset !== 'overview' && activePreset !== 'sleep' ? 'opacity-55' : 'opacity-100'
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="font-display text-xs font-bold text-slate-900 dark:text-white">
              Quiet Rest Lounge
            </span>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Recharge Nook
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <svg width="126" height="58" viewBox="0 0 126 58" fill="none" aria-hidden="true" className="shrink-0">
              <rect x="4" y="7" width="118" height="44" rx="6" fill="#EFEAE1" stroke="#DFD3C0" strokeWidth="1.2" />
              <rect x="10" y="11" width="38" height="36" rx="4" fill="#C8A378" />
              <rect x="13" y="14" width="32" height="11" rx="3" fill="#FFFFFF" />
              <rect x="13" y="27" width="32" height="17" rx="2.5" fill="#5B8EC9" />
              <rect x="54" y="14" width="18" height="18" rx="3" fill="#C8A378" />
              <circle cx="63" cy="23" r="4.5" fill="#FEF3C7" stroke="#E5C07B" strokeWidth="1" />
              <rect x="78" y="11" width="38" height="36" rx="4" fill="#C8A378" />
              <rect x="81" y="14" width="32" height="11" rx="3" fill="#FFFFFF" />
              <rect x="81" y="27" width="32" height="17" rx="2.5" fill="#DFD3C0" />
            </svg>
            <div className="text-right text-xs text-slate-600 dark:text-slate-300 space-y-0.5 min-w-0">
              <p className="font-medium text-slate-900 dark:text-white truncate">2 Oak Daybeds</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                Cream linens &amp; lamp
              </p>
            </div>
          </div>
        </button>
      </div>

      {/* Bottom Collapsible Room & Workstation Dock */}
      <div className="flex flex-col items-center pt-1">
        <button
          type="button"
          onClick={() => setDockCollapsed((v) => !v)}
          className="mb-1.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-100 border border-stone-200 dark:border-slate-700 shadow-sm hover:bg-stone-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
        >
          {dockCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              <span>Show Office Controls</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              <span>Hide Controls</span>
            </>
          )}
        </button>

        {!dockCollapsed && (
          <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-x-auto max-w-full">
            {FOCUS_PRESETS.map((preset) => {
              const active = activePreset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handlePresetClick(preset.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-stone-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setActivePreset('overview')}
              aria-label="Reset office overview"
              title="Reset office overview"
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-800 transition-colors shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
