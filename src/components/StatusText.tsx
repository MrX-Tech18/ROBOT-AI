import type { BotStatus, EmailPriority, TaskStatus } from '../shared/types';

export function BotStatusLabel({ status }: { status: BotStatus }) {
  const styles: Record<BotStatus, { text: string; color: string }> = {
    idle: { text: 'Idle · Ready', color: 'text-sky-600 dark:text-sky-400' },
    thinking: { text: 'Thinking', color: 'text-purple-600 dark:text-purple-400' },
    working: { text: 'Working', color: 'text-blue-600 dark:text-blue-400' },
    completed: { text: 'Completed', color: 'text-emerald-600 dark:text-emerald-400' },
    error: { text: 'Alert · Error', color: 'text-red-600 dark:text-red-400' },
    waiting: { text: 'Waiting Approval', color: 'text-amber-600 dark:text-amber-400' },
    paused: { text: 'Paused', color: 'text-slate-500 dark:text-slate-400' },
  };
  const item = styles[status];
  return (
    <span className={`text-xs font-mono font-medium whitespace-nowrap shrink-0 ${item.color}`}>
      {item.text}
    </span>
  );
}

export function TaskStatusLabel({ status }: { status: TaskStatus }) {
  const styles: Record<TaskStatus, { text: string; color: string }> = {
    queued: { text: 'Queued', color: 'text-slate-600 dark:text-slate-400' },
    in_progress: { text: 'In Progress', color: 'text-blue-600 dark:text-blue-400' },
    waiting_approval: { text: 'Awaiting Approval', color: 'text-amber-600 dark:text-amber-400' },
    completed: { text: 'Completed', color: 'text-emerald-600 dark:text-emerald-400' },
    failed: { text: 'Failed', color: 'text-red-600 dark:text-red-400' },
    cancelled: { text: 'Cancelled', color: 'text-slate-500 dark:text-slate-500' },
  };
  const item = styles[status];
  return (
    <span className={`text-xs font-mono font-medium whitespace-nowrap shrink-0 ${item.color}`}>
      {item.text}
    </span>
  );
}

export function EmailPriorityLabel({ priority }: { priority: EmailPriority }) {
  const map: Record<EmailPriority, { label: string; color: string }> = {
    P1: { label: 'P1 · Critical', color: 'text-red-600 dark:text-red-400 font-semibold' },
    P2: { label: 'P2 · Important', color: 'text-amber-600 dark:text-amber-400 font-semibold' },
    P3: { label: 'P3 · Normal', color: 'text-blue-600 dark:text-blue-400' },
    P4: { label: 'P4 · Low', color: 'text-slate-500 dark:text-slate-400' },
    P5: { label: 'P5 · Spam / Phishing', color: 'text-rose-600 dark:text-rose-400 font-semibold' },
  };
  const item = map[priority];
  return (
    <span className={`text-xs font-mono whitespace-nowrap shrink-0 ${item.color}`}>
      {item.label}
    </span>
  );
}

export function formatShortTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatShortDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
