import { ShieldCheck } from 'lucide-react';
import type {
  BotId,
  ConnectorConnectionView,
  ConnectorPermissionLevel,
  ConnectorServiceKey,
  EmployeeConnectorPermissionView,
  EmployeeProfile,
} from '../../shared/types';

interface EmployeePermissionsMatrixProps {
  employees: EmployeeProfile[];
  connections: ConnectorConnectionView[];
  permissions: EmployeeConnectorPermissionView[];
  busyKey: string | null;
  onUpdatePermission: (
    serviceName: ConnectorServiceKey,
    employeeId: BotId,
    permissionLevel: ConnectorPermissionLevel,
    enabled: boolean
  ) => Promise<void>;
}

const LEVELS: ConnectorPermissionLevel[] = ['none', 'read', 'write', 'admin'];

export default function EmployeePermissionsMatrix({
  employees,
  connections,
  permissions,
  busyKey,
  onUpdatePermission,
}: EmployeePermissionsMatrixProps) {
  const lookup = (botId: BotId, serviceName: ConnectorServiceKey) =>
    permissions.find(
      (p) => p.employeeId === botId && p.serviceName === serviceName
    );

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="font-display text-lg font-semibold flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            <span>AI Employee Integration Permissions</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Control which external services and permission tiers each AI employee may access.
          </p>
        </div>
        <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
          Least-Privilege RBAC Matrix
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[820px]">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
              <th className="py-2.5 pr-4 font-medium">AI Employee</th>
              {connections.map((conn) => (
                <th key={conn.serviceName} className="py-2.5 px-2 font-medium text-center">
                  {conn.displayName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {employees.map((emp) => (
              <tr key={emp.id}>
                <td className="py-3 pr-4">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    {emp.name}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {emp.title}
                  </p>
                </td>
                {connections.map((conn) => {
                  const rec = lookup(emp.id, conn.serviceName);
                  const level = rec?.permissionLevel ?? 'none';
                  const enabled = rec?.enabled ?? false;
                  const cellKey = `${emp.id}:${conn.serviceName}`;
                  const isBusy = busyKey === cellKey;

                  return (
                    <td key={conn.serviceName} className="py-3 px-2">
                      <div className="flex flex-col items-center gap-1.5">
                        <label className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            aria-label={`Enable ${conn.displayName} for ${emp.name}`}
                            disabled={isBusy}
                            checked={enabled}
                            onChange={(e) =>
                              onUpdatePermission(
                                conn.serviceName,
                                emp.id,
                                e.target.checked && level === 'none' ? 'read' : level,
                                e.target.checked
                              )
                            }
                            className="w-3.5 h-3.5 accent-blue-600"
                          />
                          <span
                            className={`text-[11px] font-medium ${
                              enabled
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-slate-400'
                            }`}
                          >
                            {enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </label>

                        <select
                          aria-label={`${emp.name} permission level for ${conn.displayName}`}
                          disabled={isBusy}
                          value={level}
                          onChange={(e) => {
                            const nextLevel = e.target.value as ConnectorPermissionLevel;
                            onUpdatePermission(
                              conn.serviceName,
                              emp.id,
                              nextLevel,
                              nextLevel === 'none' ? false : enabled
                            );
                          }}
                          className="px-2 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-[11px] font-mono"
                        >
                          {LEVELS.map((lvl) => (
                            <option key={lvl} value={lvl}>
                              {lvl}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
