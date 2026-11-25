import { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { api } from './lib/api';
import { auth, authPersistenceReady } from './lib/firebase';
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

function getSessionKey(profile: UserProfile): string {
  return `${profile.isDemo ? 'demo' : 'account'}:${profile.id}`;
}

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [workspace, setWorkspace] = useState<WorkspacePayload | null>(null);
  const [restoringSession, setRestoringSession] = useState(true);
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [activePage, setActivePage] = useState<AppPage>('office');
  const [selectedBotId, setSelectedBotId] = useState<BotId>('alex');
  const [commandBusy, setCommandBusy] = useState(false);
  const [commandError, setCommandError] = useState<string | null>(null);
  const activeSessionKey = useRef<string | null>(null);

  // Sync Tailwind v4 dark class on <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const hydrateWorkspace = useCallback(async (loggedInUser: UserProfile) => {
    const sessionKey = getSessionKey(loggedInUser);
    activeSessionKey.current = sessionKey;
    setUser(loggedInUser);
    setWorkspace(null);
    setTheme(loggedInUser.theme);
    setActivePage('office');
    setSelectedBotId('alex');
    setAuthError(null);
    setCommandError(null);
    setLoadingWorkspace(true);
    try {
      const data = await api.getWorkspace();
      if (activeSessionKey.current !== sessionKey) return;
      if (!loggedInUser.isDemo) {
        const savedChats = await api.getUserChats();
        if (activeSessionKey.current !== sessionKey) return;
        if (savedChats.messages.length > 0) {
          data.chatMessages = savedChats.messages;
        } else if (data.chatMessages.length > 0) {
          await api.saveUserChats(data.chatMessages);
        }
      }
      if (activeSessionKey.current === sessionKey) setWorkspace(data);
    } catch (error) {
      if (activeSessionKey.current === sessionKey) {
        activeSessionKey.current = null;
        setUser(null);
        setWorkspace(null);
      }
      throw error;
    } finally {
      if (activeSessionKey.current === sessionKey) setLoadingWorkspace(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const restoreSession = async () => {
      try {
        await authPersistenceReady;
        if (auth.currentUser) {
          const session = await api.getCurrentSession();
          if (!session) {
            await auth.signOut().catch(() => undefined);
            throw new Error('Your sign-in session has expired. Please sign in again.');
          }
          if (session.mode === 'account') {
            if (active) await hydrateWorkspace(session.user);
            return;
          }
          throw new Error('Unable to restore the Firebase account session.');
        }
        const session = await api.getCurrentSession();
        if (session) {
          if (active) await hydrateWorkspace(session.user);
          return;
        }
        if (new URLSearchParams(window.location.search).get('autostart') === '1') {
          const demo = await api.enterDemo();
          if (active) await hydrateWorkspace(demo.user);
        }
      } catch (error) {
        if (active) {
          setAuthError(error instanceof Error ? error.message : 'Unable to restore the previous session.');
        }
      } finally {
        if (active) setRestoringSession(false);
      }
    };
    void restoreSession();
    return () => {
      active = false;
    };
  }, [hydrateWorkspace]);

  useEffect(() => {
    return onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser && user && !user.isDemo) {
        activeSessionKey.current = null;
        setUser(null);
        setWorkspace(null);
        setActivePage('office');
        setSelectedBotId('alex');
        setCommandError(null);
        setTheme('dark');
      }
    });
  }, [user]);

  const persistUserChats = useCallback(
    async (messages: WorkspacePayload['chatMessages']) => {
      if (!user || user.isDemo) return;
      const sessionKey = getSessionKey(user);
      if (activeSessionKey.current !== sessionKey) return;
      try {
        await api.saveUserChats(messages);
      } catch {
        if (activeSessionKey.current === sessionKey) {
          setCommandError('Your conversation is available now but could not be saved to your account.');
        }
      }
    },
    [user]
  );

  const handleToggleTheme = async () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    if (user) {
      const sessionKey = getSessionKey(user);
      const res = await api.updateProfile({ theme: next }).catch(() => null);
      if (res && activeSessionKey.current === sessionKey) {
        setUser(res.user);
        setTheme(res.user.theme);
      }
    }
  };

  const handleNavigate = (page: AppPage, botId?: BotId) => {
    if (user?.isDemo && page === 'integrations') return;
    if (botId) setSelectedBotId(botId);
    setActivePage(page);
  };

  const handleOpenEmployeeWorkspace = (botId: BotId) => {
    setSelectedBotId(botId);
    setActivePage('employee');
  };

  const handleSendCommand = async (command: string) => {
    const sessionKey = user ? getSessionKey(user) : null;
    setCommandBusy(true);
    setCommandError(null);
    try {
      const res = await api.sendCommand(command);
      if (!sessionKey || activeSessionKey.current !== sessionKey) return;
      setWorkspace(res.workspace);
      await persistUserChats(res.workspace.chatMessages);
    } catch (err) {
      if (!sessionKey || activeSessionKey.current !== sessionKey) return;
      setCommandError(err instanceof Error ? err.message : 'Command failed.');
      const refreshed = await api.getWorkspace().catch(() => null);
      if (refreshed && activeSessionKey.current === sessionKey) {
        setWorkspace(refreshed);
        await persistUserChats(refreshed.chatMessages);
      }
    } finally {
      if (sessionKey && activeSessionKey.current === sessionKey) setCommandBusy(false);
    }
  };

  const handleToggleEmployee = async (botId: BotId, enabled: boolean) => {
    const sessionKey = user ? getSessionKey(user) : null;
    const res = await api.updateEmployee(botId, { enabled });
    if (sessionKey && activeSessionKey.current === sessionKey) setWorkspace(res.workspace);
  };

  const handleUpdateEmployee = async (
    botId: BotId,
    updates: {
      enabled?: boolean;
      systemPrompt?: string;
      permissions?: EmployeePermissions;
    }
  ) => {
    const sessionKey = user ? getSessionKey(user) : null;
    const res = await api.updateEmployee(botId, updates);
    if (sessionKey && activeSessionKey.current === sessionKey) setWorkspace(res.workspace);
  };

  const handleChatWithEmployee = async (botId: BotId, message: string) => {
    const sessionKey = user ? getSessionKey(user) : null;
    const res = await api.chatWithEmployee(botId, message);
    if (!sessionKey || activeSessionKey.current !== sessionKey) return;
    setWorkspace(res.workspace);
    await persistUserChats(res.workspace.chatMessages);
  };

  const handleCreateTask = async (params: {
    title: string;
    description: string;
    assignedTo: BotId;
    priority: 'critical' | 'high' | 'normal' | 'low';
    runImmediately: boolean;
  }) => {
    const sessionKey = user ? getSessionKey(user) : null;
    const res = await api.createTask(params);
    if (sessionKey && activeSessionKey.current === sessionKey) setWorkspace(res.workspace);
  };

  const handleUpdateTaskStatus = async (
    taskId: string,
    status: 'cancelled' | 'completed' | 'queued'
  ) => {
    const sessionKey = user ? getSessionKey(user) : null;
    const res = await api.updateTaskStatus(taskId, status);
    if (sessionKey && activeSessionKey.current === sessionKey) setWorkspace(res.workspace);
  };

  const handleDecideApproval = async (
    approvalId: string,
    decision: 'approved' | 'rejected',
    note?: string
  ) => {
    const sessionKey = user ? getSessionKey(user) : null;
    const res = await api.decideApproval(approvalId, decision, note);
    if (sessionKey && activeSessionKey.current === sessionKey) setWorkspace(res.workspace);
  };

  const handleLogout = async () => {
    const wasDemo = user?.isDemo;
    activeSessionKey.current = null;
    setUser(null);
    setWorkspace(null);
    setRestoringSession(true);
    setActivePage('office');
    setSelectedBotId('alex');
    setCommandBusy(false);
    setCommandError(null);
    setTheme('dark');
    try {
      if (wasDemo) {
        await api.exitDemo();
      } else {
        await api.logout();
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Unable to invalidate the server session.');
    } finally {
      await clearGoogleWorkspaceTokens();
      setRestoringSession(false);
      const url = new URL(window.location.href);
      url.searchParams.delete('autostart');
      window.history.replaceState({}, '', url);
    }
  };

  if (restoringSession) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex items-center justify-center">
        <p className="font-display text-lg font-semibold">Restoring your session...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthScreen
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onAuthenticated={hydrateWorkspace}
        authError={authError}
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
        const sessionKey = getSessionKey(user);
        const res = await api.markNotificationsRead();
        if (activeSessionKey.current === sessionKey) setWorkspace(res.workspace);
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
            const sessionKey = getSessionKey(user);
            const res = await api.triageEmails();
            if (activeSessionKey.current === sessionKey) setWorkspace(res.workspace);
          }}
          onAddEmail={async (params) => {
            const sessionKey = getSessionKey(user);
            const res = await api.addEmail(params);
            if (activeSessionKey.current === sessionKey) setWorkspace(res.workspace);
          }}
          onAddCalendarEvent={async (params) => {
            const sessionKey = getSessionKey(user);
            const res = await api.addCalendarEvent(params);
            if (activeSessionKey.current === sessionKey) setWorkspace(res.workspace);
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
            const sessionKey = getSessionKey(user);
            const res = await api.updateProfile(updates);
            if (activeSessionKey.current !== sessionKey) return;
            setUser(res.user);
            const refreshed = await api.getWorkspace();
            if (activeSessionKey.current === sessionKey) setWorkspace(refreshed);
          }}
          onSaveIntegration={async (id, updates) => {
            const sessionKey = getSessionKey(user);
            const res = await api.updateIntegration(id, updates);
            if (activeSessionKey.current === sessionKey) setWorkspace(res.workspace);
          }}
          onTestIntegration={async (id) => {
            const sessionKey = getSessionKey(user);
            const res = await api.testIntegration(id);
            if (activeSessionKey.current === sessionKey) setWorkspace(res.workspace);
            return { ok: res.ok, statusText: res.statusText };
          }}
        />
      )}
    </AppShell>
  );
}
