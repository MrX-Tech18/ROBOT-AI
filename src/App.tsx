import { useCallback, useEffect, useState } from 'react';
import { api } from './lib/api';
import { clearGoogleWorkspaceTokens } from './lib/googleWorkspace';
import type {
  AppPage,
  BotId,
  EmployeePermissions,
  UserProfile,
  WorkspacePayload,
} from './shared/types';
import AuthScreen from './components/AuthScreen';
import AppShell from './components/AppShell';
import VirtualOfficeView from './components/VirtualOfficeView';
import DashboardView from './components/DashboardView';
import CommandCenterView from './components/CommandCenterView';
import EmployeeDirectoryView from './components/EmployeeDirectoryView';
import EmployeeWorkspaceView from './components/EmployeeWorkspaceView';
import TaskManagementView from './components/TaskManagementView';
import ApprovalCenterView from './components/ApprovalCenterView';
import AutomationHistoryView from './components/AutomationHistoryView';
import IntegrationsView from './components/IntegrationsView';

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [workspace, setWorkspace] = useState<WorkspacePayload | null>(null);
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);

  const [activePage, setActivePage] = useState<AppPage>('office');
  const [selectedBotId, setSelectedBotId] = useState<BotId>('alex');
  const [commandBusy, setCommandBusy] = useState(false);
  const [commandError, setCommandError] = useState<string | null>(null);

  // Sync Tailwind v4 dark class on <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const hydrateWorkspace = useCallback(async (loggedInUser: UserProfile) => {
    setUser(loggedInUser);
    setTheme(loggedInUser.theme);
    setLoadingWorkspace(true);
    try {
      const data = await api.getWorkspace();
      setWorkspace(data);
    } finally {
      setLoadingWorkspace(false);
    }
  }, []);

  // Support ?autostart=1 for automated / direct demo launch
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      api
        .enterDemo()
        .then((res) => hydrateWorkspace(res.user))
        .catch(() => undefined);
    }
  }, [hydrateWorkspace]);

  const handleToggleTheme = async () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    if (user) {
      const res = await api.updateProfile({ theme: next }).catch(() => null);
      if (res) setUser(res.user);
    }
  };

  const handleNavigate = (page: AppPage, botId?: BotId) => {
    if (botId) setSelectedBotId(botId);
    setActivePage(page);
  };

  const handleOpenEmployeeWorkspace = (botId: BotId) => {
    setSelectedBotId(botId);
    setActivePage('employee');
  };

  const handleSendCommand = async (command: string) => {
    setCommandBusy(true);
    setCommandError(null);
    try {
      const res = await api.sendCommand(command);
      setWorkspace(res.workspace);
    } catch (err) {
      setCommandError(err instanceof Error ? err.message : 'Command failed.');
      const refreshed = await api.getWorkspace().catch(() => null);
      if (refreshed) setWorkspace(refreshed);
    } finally {
      setCommandBusy(false);
    }
  };

  const handleToggleEmployee = async (botId: BotId, enabled: boolean) => {
    const res = await api.updateEmployee(botId, { enabled });
    setWorkspace(res.workspace);
  };

  const handleUpdateEmployee = async (
    botId: BotId,
    updates: {
      enabled?: boolean;
      systemPrompt?: string;
      permissions?: EmployeePermissions;
    }
  ) => {
    const res = await api.updateEmployee(botId, updates);
    setWorkspace(res.workspace);
  };

  const handleChatWithEmployee = async (botId: BotId, message: string) => {
    const res = await api.chatWithEmployee(botId, message);
    setWorkspace(res.workspace);
  };

  const handleCreateTask = async (params: {
    title: string;
    description: string;
    assignedTo: BotId;
    priority: 'critical' | 'high' | 'normal' | 'low';
    runImmediately: boolean;
  }) => {
    const res = await api.createTask(params);
    setWorkspace(res.workspace);
  };

  const handleUpdateTaskStatus = async (
    taskId: string,
    status: 'cancelled' | 'completed' | 'queued'
  ) => {
    const res = await api.updateTaskStatus(taskId, status);
    setWorkspace(res.workspace);
  };

  const handleDecideApproval = async (
    approvalId: string,
    decision: 'approved' | 'rejected',
    note?: string
  ) => {
    const res = await api.decideApproval(approvalId, decision, note);
    setWorkspace(res.workspace);
  };

  const handleLogout = async () => {
    await api.logout();
    await clearGoogleWorkspaceTokens();
    setUser(null);
    setWorkspace(null);
    setActivePage('office');
  };

  if (!user) {
    return (
      <AuthScreen
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onAuthenticated={hydrateWorkspace}
      />
    );
  }

  if (loadingWorkspace || !workspace) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="font-display text-lg font-semibold">Initializing Virtual Office...</p>
          <p className="text-xs font-mono text-slate-500">
            Loading 5 AI workstations and office telemetry
          </p>
        </div>
      </div>
    );
  }

  return (
    <AppShell
      user={user}
      theme={theme}
      activePage={activePage}
      selectedBotId={selectedBotId}
      employees={workspace.employees}
      pendingApprovals={workspace.metrics.pendingApprovals}
      notifications={workspace.notifications}
      onNavigate={handleNavigate}
      onToggleTheme={handleToggleTheme}
      onMarkNotificationsRead={async () => {
        const res = await api.markNotificationsRead();
        setWorkspace(res.workspace);
      }}
      onLogout={handleLogout}
    >
      {activePage === 'office' && (
        <VirtualOfficeView
          workspace={workspace}
          theme={theme}
          selectedBotId={selectedBotId}
          commandBusy={commandBusy}
          commandError={commandError}
          onSelectBot={setSelectedBotId}
          onOpenWorkspace={handleOpenEmployeeWorkspace}
          onSendCommand={handleSendCommand}
          onToggleEmployee={handleToggleEmployee}
        />
      )}

      {activePage === 'dashboard' && (
        <DashboardView workspace={workspace} onNavigate={handleNavigate} />
      )}

      {activePage === 'command' && (
        <CommandCenterView
          workspace={workspace}
          commandBusy={commandBusy}
          error={commandError}
          onSendCommand={handleSendCommand}
          onToggleEmployee={handleToggleEmployee}
          onCancelTask={(taskId) => handleUpdateTaskStatus(taskId, 'cancelled')}
          onNavigate={handleNavigate}
        />
      )}

      {activePage === 'directory' && (
        <EmployeeDirectoryView
          employees={workspace.employees}
          onOpenWorkspace={handleOpenEmployeeWorkspace}
          onToggleEmployee={handleToggleEmployee}
        />
      )}

      {activePage === 'employee' && (
        <EmployeeWorkspaceView
          workspace={workspace}
          botId={selectedBotId}
          onSelectBot={setSelectedBotId}
          onChat={handleChatWithEmployee}
          onUpdateEmployee={handleUpdateEmployee}
          onTriageEmails={async () => {
            const res = await api.triageEmails();
            setWorkspace(res.workspace);
          }}
          onAddEmail={async (params) => {
            const res = await api.addEmail(params);
            setWorkspace(res.workspace);
          }}
          onAddCalendarEvent={async (params) => {
            const res = await api.addCalendarEvent(params);
            setWorkspace(res.workspace);
          }}
        />
      )}

      {activePage === 'tasks' && (
        <TaskManagementView
          workspace={workspace}
          onCreateTask={handleCreateTask}
          onUpdateTaskStatus={handleUpdateTaskStatus}
        />
      )}

      {activePage === 'approvals' && (
        <ApprovalCenterView workspace={workspace} onDecide={handleDecideApproval} />
      )}

      {activePage === 'history' && <AutomationHistoryView workspace={workspace} />}

      {activePage === 'integrations' && (
        <IntegrationsView
          workspace={workspace}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          onUpdateProfile={async (updates) => {
            const res = await api.updateProfile(updates);
            setUser(res.user);
            const refreshed = await api.getWorkspace();
            setWorkspace(refreshed);
          }}
          onSaveIntegration={async (id, updates) => {
            const res = await api.updateIntegration(id, updates);
            setWorkspace(res.workspace);
          }}
          onTestIntegration={async (id) => {
            const res = await api.testIntegration(id);
            setWorkspace(res.workspace);
            return { ok: res.ok, statusText: res.statusText };
          }}
        />
      )}
    </AppShell>
  );
}
