import { useState, type ReactNode } from 'react';
import {
  Activity,
  Bell,
  Box,
  CheckSquare,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Menu,
  Moon,
  Settings,
  Sun,
  Terminal,
  Users,
  X,
} from 'lucide-react';
import type {
  AppPage,
  BotId,
  EmployeeProfile,
  NotificationItem,
  UserProfile,
} from '../shared/types';
import { formatShortTime } from './StatusText';

interface AppShellProps {
  user: UserProfile;
  theme: 'light' | 'dark';
  activePage: AppPage;
  selectedBotId: BotId;
  employees: EmployeeProfile[];
  pendingApprovals: number;
  notifications: NotificationItem[];
  onNavigate: (page: AppPage, botId?: BotId) => void;
  onToggleTheme: () => void;
  onMarkNotificationsRead: () => void;
  onLogout: () => void;
  children: ReactNode;
}

const PAGE_LABELS: Record<AppPage, string> = {
  office: 'Virtual Office',
  dashboard: 'CEO Dashboard',
  command: 'AI Command Center',
  directory: 'Employee Directory',
  employee: 'Employee Workspace',
  tasks: 'Task Management',
  approvals: 'Approval Center',
  history: 'Automation History',
  integrations: 'Integrations & Settings',
};

export default function AppShell({
  user,
  theme,
  activePage,
  selectedBotId,
  employees,
  pendingApprovals,
  notifications,
  onNavigate,
  onToggleTheme,
  onMarkNotificationsRead,
  onLogout,
  children,
}: AppShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const navItems: Array<{
    id: AppPage;
    label: string;
    icon: typeof Box;
    count?: number;
  }> = [
    { id: 'office', label: 'Virtual Office', icon: Box },
    { id: 'dashboard', label: 'CEO Dashboard', icon: LayoutDashboard },
    { id: 'command', label: 'AI Command Center', icon: Terminal },
    { id: 'directory', label: 'Employee Directory', icon: Users },
    { id: 'tasks', label: 'Task Management', icon: ListTodo },
    { id: 'approvals', label: 'Approval Center', icon: CheckSquare, count: pendingApprovals },
    { id: 'history', label: 'Automation History', icon: Activity },
    { id: 'integrations', label: 'Integrations & Settings', icon: Settings },
  ];

  const handleSelectNav = (page: AppPage, botId?: BotId) => {
    onNavigate(page, botId);
    setMobileMenuOpen(false);
  };

  const activeEmployee = employees.find((e) => e.id === selectedBotId);
  const breadcrumbText =
    activePage === 'employee' && activeEmployee
      ? `Employee Workspace / ${activeEmployee.name}`
      : PAGE_LABELS[activePage];

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Mobile Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Left Workspace Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => handleSelectNav('office')}
            className="font-display text-base font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
          >
            ROBOT OFFICE AI
          </button>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close navigation"
            className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          <nav aria-label="Main navigation" className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                activePage === item.id || (item.id === 'directory' && activePage === 'employee');
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectNav(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.count !== undefined && item.count > 0 && (
                    <span
                      className={`text-xs font-mono tabular-nums ${
                        isActive ? 'text-blue-100' : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Direct Employee Quick-Jump */}
          <div>
            <p className="px-3 mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              AI Workforce
            </p>
            <div className="space-y-1">
              {employees.map((emp) => {
                const isSelected = activePage === 'employee' && selectedBotId === emp.id;
                return (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => handleSelectNav('employee', emp.id)}
                    className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-colors ${
                      isSelected
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <span
                        className="w-2 h-2 rounded-sm shrink-0"
                        style={{ backgroundColor: emp.colorHex }}
                      />
                      <span className="truncate">{emp.name}</span>
                    </span>
                    <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500 shrink-0">
                      {emp.enabled ? emp.status : 'paused'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
          <div className="px-2 py-1">
            <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
              {user.name}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {user.companyName}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </button>
            <button
              type="button"
              onClick={onLogout}
              aria-label="Sign out"
              className="inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Exit</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar (Clean 3-Zone Contract) */}
        <header className="h-16 px-4 sm:px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-8 shrink-0">
          {/* Zone 1: Mobile trigger + Breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="font-display text-base sm:text-lg font-semibold text-slate-900 dark:text-white truncate">
              {breadcrumbText}
            </h1>
          </div>

          {/* Zone 2: Concise Top Nav Links */}
          <nav className="hidden xl:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
            <button
              type="button"
              onClick={() => onNavigate('office')}
              className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Office View
            </button>
            <button
              type="button"
              onClick={() => onNavigate('dashboard')}
              className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Dashboard
            </button>
            <button
              type="button"
              onClick={() => onNavigate('approvals')}
              className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Approvals ({pendingApprovals})
            </button>
            <button
              type="button"
              onClick={() => onNavigate('integrations')}
              className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Integrations
            </button>
          </nav>

          {/* Zone 3: Notifications & Primary Action */}
          <div className="flex items-center gap-3 shrink-0 relative">
            <button
              type="button"
              onClick={() => setNotifOpen((v) => !v)}
              aria-label={`Notifications (${unreadCount} unread)`}
              className="relative p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-md bg-blue-600 text-white text-[10px] font-mono tabular-nums leading-none">
                  {unreadCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => onNavigate('command')}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0"
            >
              Command Alex
            </button>

            {notifOpen && (
              <div className="absolute right-0 top-12 z-50 w-80 sm:w-96 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                  <span className="font-display text-sm font-semibold">Notifications</span>
                  <button
                    type="button"
                    onClick={() => {
                      onMarkNotificationsRead();
                      setNotifOpen(false);
                    }}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Mark all read
                  </button>
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                  {notifications.length === 0 ? (
                    <p className="py-6 text-center text-xs text-slate-500">No notifications yet.</p>
                  ) : (
                    notifications.slice(0, 12).map((n) => (
                      <div key={n.id} className="py-3 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-xs font-semibold ${
                              n.read
                                ? 'text-slate-600 dark:text-slate-400'
                                : 'text-slate-900 dark:text-white'
                            }`}
                          >
                            {n.title}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400 shrink-0">
                            {formatShortTime(n.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Active Page Viewport */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
