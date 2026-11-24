import { useState } from 'react';
import { Check, ShieldCheck, X } from 'lucide-react';
import type { WorkspacePayload } from '../shared/types';
import { formatShortDateTime } from './StatusText';

interface ApprovalCenterViewProps {
  workspace: WorkspacePayload;
  onDecide: (
    approvalId: string,
    decision: 'approved' | 'rejected',
    note?: string
  ) => Promise<void>;
}

export default function ApprovalCenterView({
  workspace,
  onDecide,
}: ApprovalCenterViewProps) {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const pending = workspace.approvals.filter((a) => a.status === 'pending');
  const history = workspace.approvals.filter((a) => a.status !== 'pending');

  const handleDecision = async (id: string, decision: 'approved' | 'rejected') => {
    setBusyId(id);
    try {
      await onDecide(id, decision, notes[id]);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-[1440px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-semibold flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            <span>CEO Approval Center</span>
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Sensitive actions (sending emails, deletions, social publishing, external calendar
            invites, shared docs, financial actions) require explicit CEO authorization.
          </p>
        </div>
        <span className="font-mono text-xs text-amber-600 dark:text-amber-400 tabular-nums shrink-0">
          {pending.length} Pending · {history.length} Audited
        </span>
      </div>

      {/* Pending Approvals Queue */}
      <section className="space-y-4">
        <h3 className="font-display text-base font-semibold">Pending Authorization</h3>
        {pending.length === 0 ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500">
            No sensitive actions awaiting approval right now.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {pending.map((apr) => (
              <article
                key={apr.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-mono text-amber-600 dark:text-amber-400">
                        {apr.actionType.replace('_', ' ')} · Requested by {apr.botId}
                      </p>
                      <h4 className="font-display text-base font-semibold mt-0.5">{apr.title}</h4>
                    </div>
                    <span className="text-xs font-mono text-slate-400 shrink-0">
                      {formatShortDateTime(apr.createdAt)}
                    </span>
                  </div>

                  <p className="text-sm text-slate-600 dark:text-slate-300">{apr.summary}</p>

                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-700 dark:text-slate-300 max-h-40 overflow-y-auto whitespace-pre-wrap">
                    {JSON.stringify(apr.payload, null, 2)}
                  </div>
                </div>

                <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <input
                    type="text"
                    value={notes[apr.id] || ''}
                    onChange={(e) =>
                      setNotes((prev) => ({ ...prev, [apr.id]: e.target.value }))
                    }
                    placeholder="Optional audit note..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
                  />
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={busyId === apr.id}
                      onClick={() => handleDecision(apr.id, 'approved')}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold tracking-wide transition-colors"
                    >
                      <Check className="w-4 h-4" />
                      <span>APPROVE</span>
                    </button>
                    <button
                      type="button"
                      disabled={busyId === apr.id}
                      onClick={() => handleDecision(apr.id, 'rejected')}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-semibold tracking-wide transition-colors"
                    >
                      <X className="w-4 h-4" />
                      <span>REJECT</span>
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Complete Audit History */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <h3 className="font-display text-base font-semibold mb-4">Approval Audit History</h3>
        {history.length === 0 ? (
          <p className="text-sm text-slate-500 py-4">No approval decisions logged yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 pr-4 font-medium">Action</th>
                  <th className="py-2.5 pr-4 font-medium">Employee</th>
                  <th className="py-2.5 pr-4 font-medium">Decision</th>
                  <th className="py-2.5 pr-4 font-medium">Audit Note</th>
                  <th className="py-2.5 font-medium text-right">Decided At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {history.map((item) => (
                  <tr key={item.id}>
                    <td className="py-3 pr-4 font-medium text-slate-900 dark:text-slate-100">
                      {item.title}
                    </td>
                    <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">{item.botId}</td>
                    <td
                      className={`py-3 pr-4 font-mono font-semibold ${
                        item.status === 'approved'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {item.status.toUpperCase()}
                    </td>
                    <td className="py-3 pr-4 text-slate-500 dark:text-slate-400">
                      {item.decisionNote || '—'}
                    </td>
                    <td className="py-3 text-right font-mono tabular-nums text-slate-500">
                      {item.decidedAt ? formatShortDateTime(item.decidedAt) : '—'}
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
