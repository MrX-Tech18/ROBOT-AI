import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import {
  addAutomationLog,
  addCalendarEvent,
  addChatMessage,
  addEmailItem,
  addNotification,
  createApproval,
  createSession,
  createTask,
  createUser,
  decideApproval,
  deleteSession,
  findUserByEmail,
  getEmployeesForUser,
  getIntegrationsForUser,
  getIntegrationSecret,
  getOrCreateDemoUser,
  getOrCreateFirebaseUser,
  getUserByToken,
  getWorkspacePayload,
  markAllNotificationsRead,
  updateEmailAnalysis,
  updateEmployeeState,
  updateIntegration,
  updateTask,
  updateUserSettings,
  verifyPassword,
} from './server/db.ts';
import { adminAuth } from './src/lib/firebase-admin.ts';
import {
  FirebaseAccountConflictError,
  sanitizeDemoConnectorDashboard,
  serializeInlineScriptValue,
} from './server/security.ts';
import {
  appendConnectorLog,
  getConnectorDashboard,
  getConnectorRecord,
  setEmployeeConnectorPermission,
  updateConnectorState,
} from './server/connectorsRepo.ts';
import {
  clearOAuthAppCredentials,
  completeThirdPartyOAuthCallback,
  connectGoogleService,
  connectTelegramService,
  disconnectAllConnectorsWithAudit,
  disconnectConnectorService,
  dispatchIntegrationN8nWebhook,
  executeConnectorAction,
  getPublicOrigin,
  refreshConnectorToken,
  saveOAuthAppCredentialsBundle,
  startThirdPartyOAuth,
  testConnectorConnection,
} from './server/connectors.ts';
import {
  analyzeEmailWithEmma,
  chatWithSpecialist,
  executeSpecialistStep,
  planCommandWithAlex,
} from './server/ai.ts';
import {
  classifyEmailPriority,
  validateWebhookUrl,
} from './src/shared/officeLogic.ts';
import type {
  ApprovalActionType,
  BotId,
  CollaborationStep,
  ConnectorPermissionLevel,
  ConnectorServiceKey,
  EmployeePermissions,
  SourceCitation,
  UserProfile,
} from './src/shared/types.ts';

declare global {
  namespace Express {
    interface Request {
      user?: UserProfile;
      token?: string;
    }
  }
}

const isProduction = process.env.NODE_ENV === 'production';

async function dispatchN8nWorkflow(params: {
  userId: string;
  isDemo?: boolean;
  botId: BotId;
  workflowName: string;
  payload: Record<string, unknown>;
}): Promise<{ triggered: boolean; statusText: string }> {
  if (params.isDemo) {
    return { triggered: false, statusText: 'External integrations are disabled for demo accounts.' };
  }
  const integrationId = `n8n_${params.botId}`;
  const integrations = getIntegrationsForUser(params.userId);
  const target = integrations.find((i) => i.id === integrationId);
  if (!target || !target.connected || !target.endpointUrl) {
    return { triggered: false, statusText: 'n8n webhook not configured' };
  }

  const check = validateWebhookUrl(target.endpointUrl);
  if (!check.valid) {
    addAutomationLog({
      userId: params.userId,
      workflowName: params.workflowName,
      botId: params.botId,
      eventType: 'n8n_webhook',
      message: `Blocked invalid n8n webhook URL for ${params.botId}`,
      details: check.reason ?? null,
      status: 'error',
    });
    return { triggered: false, statusText: check.reason || 'Invalid webhook URL' };
  }

  const startMs = Date.now();
  try {
    const res = await fetch(target.endpointUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'ROBOT_OFFICE_AI',
        botId: params.botId,
        workflow: params.workflowName,
        timestamp: new Date().toISOString(),
        ...params.payload,
      }),
      signal: AbortSignal.timeout(8000),
    });

    const durationMs = Date.now() - startMs;
    const statusText = `HTTP ${res.status} ${res.statusText}`;
    addAutomationLog({
      userId: params.userId,
      workflowName: params.workflowName,
      botId: params.botId,
      eventType: 'n8n_webhook',
      message: `Dispatched n8n webhook (${statusText})`,
      details: `Endpoint: ${target.endpointUrl}`,
      status: res.ok ? 'success' : 'error',
      durationMs,
    });
    return { triggered: true, statusText };
  } catch (err) {
    const durationMs = Date.now() - startMs;
    const msg = err instanceof Error ? err.message : 'Webhook request failed';
    addAutomationLog({
      userId: params.userId,
      workflowName: params.workflowName,
      botId: params.botId,
      eventType: 'n8n_webhook',
      message: `n8n webhook failed: ${msg}`,
      details: `Endpoint: ${target.endpointUrl}`,
      status: 'error',
      durationMs,
    });
    return { triggered: true, statusText: `Failed: ${msg}` };
  }
}

async function dispatchTelegramAlert(params: {
  userId: string;
  isDemo?: boolean;
  title: string;
  message: string;
}): Promise<void> {
  if (params.isDemo) return;
  const integrations = getIntegrationsForUser(params.userId);
  const tg = integrations.find((i) => i.id === 'telegram');
  if (!tg || !tg.connected || !tg.accountLabel) return;
  const botToken = getIntegrationSecret(params.userId, 'telegram');
  if (!botToken) return;

  try {
    const res = await fetch(`https://api.telegram.org/bot${encodeURIComponent(botToken)}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: tg.accountLabel,
        text: `ROBOT OFFICE AI\n${params.title}\n\n${params.message}`,
      }),
      signal: AbortSignal.timeout(6000),
    });
    addAutomationLog({
      userId: params.userId,
      workflowName: 'Telegram CEO Alerts',
      botId: 'alex',
      eventType: 'n8n_webhook',
      message: res.ok
        ? `Sent Telegram notification: ${params.title}`
        : `Telegram API returned HTTP ${res.status}`,
      status: res.ok ? 'success' : 'error',
    });
  } catch (err) {
    addAutomationLog({
      userId: params.userId,
      workflowName: 'Telegram CEO Alerts',
      botId: 'alex',
      eventType: 'error',
      message: err instanceof Error ? err.message : 'Telegram alert failed',
      status: 'error',
    });
  }
}

const WORKFLOW_NAMES: Record<BotId, string> = {
  alex: 'Workflow 1: Alex Orchestrator',
  emma: 'Workflow 2: Emma Email Management',
  max: 'Workflow 3: Max Research Assistant',
  sophie: 'Workflow 4: Sophie Calendar Management',
  charlie: 'Workflow 5: Charlie Content and Administration',
};

async function requireAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const sessionUser = getUserByToken(token);
  if (sessionUser) {
    req.user = sessionUser;
    req.token = token;
    next();
    return;
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const email = decoded.email || `${decoded.uid}@google-workspace.local`;
    const user = getOrCreateFirebaseUser({
      uid: decoded.uid,
      email,
      name: decoded.name,
    });
    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    if (error instanceof FirebaseAccountConflictError) {
      res.status(409).json({ error: error.message });
      return;
    }
    res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
  }
}

function requireNonDemoUser(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  if (req.user?.isDemo) {
    res.status(403).json({ error: 'External integrations are disabled for the shared demo account.' });
    return;
  }
  next();
}

export async function createApp(options: { serveFrontend?: boolean } = {}) {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'robot-office-ai' });
  });

  // --- Auth Routes ---
  app.post('/api/auth/register', (req, res) => {
    const { name, email, companyName, password } = req.body as {
      name?: string;
      email?: string;
      companyName?: string;
      password?: string;
    };

    if (!name?.trim() || !email?.trim() || !password) {
      res.status(400).json({ error: 'Name, email, and password are required.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters.' });
      return;
    }
    if (findUserByEmail(email.trim())) {
      res.status(409).json({ error: 'An account with that email already exists.' });
      return;
    }

    const user = createUser({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      companyName: companyName?.trim() || 'Autonomous Ventures Inc.',
      password,
    });
    const token = createSession(user.id);
    res.status(201).json({ token, user });
  });

  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email?.trim() || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }
    const found = findUserByEmail(email.trim());
    if (!found || found.is_demo === 1 || !verifyPassword(password, found.password_hash)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const user: UserProfile = {
      id: found.id,
      name: found.name,
      email: found.email,
      companyName: found.company_name,
      theme: found.theme,
      isDemo: false,
    };
    const token = createSession(user.id);
    res.json({ token, user });
  });

  app.post('/api/auth/demo', (_req, res) => {
    const user = getOrCreateDemoUser();
    const token = createSession(user.id);
    res.json({ token, user });
  });

  app.post('/api/auth/firebase', async (req, res) => {
    const authHeader = req.headers.authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!idToken) {
      res.status(401).json({ error: 'Missing Firebase ID token.' });
      return;
    }
    try {
      const decoded = await adminAuth.verifyIdToken(idToken);
      const email = decoded.email || `${decoded.uid}@google-workspace.local`;
      const user = getOrCreateFirebaseUser({
        uid: decoded.uid,
        email,
        name: decoded.name,
      });
      res.json({ token: idToken, user });
    } catch (error) {
      if (error instanceof FirebaseAccountConflictError) {
        res.status(409).json({ error: error.message });
        return;
      }
      res.status(401).json({ error: 'Invalid Firebase authentication token.' });
    }
  });

  app.post('/api/auth/logout', requireAuth, (req, res) => {
    if (req.token) deleteSession(req.token);
    res.json({ ok: true });
  });

  app.get('/api/auth/me', requireAuth, (req, res) => {
    res.json({ user: req.user });
  });

  // --- Workspace Hydration ---
  app.get('/api/workspace', requireAuth, (req, res) => {
    const payload = getWorkspacePayload(req.user!);
    res.json(payload);
  });

  app.patch('/api/settings/profile', requireAuth, (req, res) => {
    const { theme, name, companyName } = req.body as {
      theme?: 'light' | 'dark';
      name?: string;
      companyName?: string;
    };
    const updated = updateUserSettings(req.user!.id, { theme, name, companyName });
    if (!updated) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    res.json({ user: updated });
  });

  // --- CEO Command Center (Alex Orchestrator + Multi-Bot Collaboration) ---
  app.post('/api/command', requireAuth, async (req, res) => {
    const user = req.user!;
    const { command } = req.body as { command?: string };
    const trimmed = command?.trim() || '';
    if (!trimmed) {
      res.status(400).json({ error: 'Please enter an instruction for Alex and your team.' });
      return;
    }

    const initial = getWorkspacePayload(user);
    const alex = initial.employees.find((e) => e.id === 'alex')!;
    if (!alex.enabled) {
      res.status(409).json({
        error: 'Alex (Chief Executive Assistant) is currently paused. Resume Alex to orchestrate commands.',
      });
      return;
    }

    addChatMessage({
      userId: user.id,
      channel: 'command',
      sender: 'ceo',
      text: trimmed,
    });

    const startTotal = Date.now();
    let activeTaskId: string | null = null;
    let activeBotId: BotId = 'alex';

    try {
      updateEmployeeState(user.id, 'alex', {
        status: 'thinking',
        currentTaskTitle: `Planning: ${trimmed.slice(0, 48)}`,
      });

      const plan = await planCommandWithAlex({
        command: trimmed,
        employees: initial.employees,
        pendingApprovalsCount: initial.metrics.pendingApprovals,
        unreadEmailsCount: initial.emails.filter((e) => e.status === 'unread').length,
        upcomingMeetingsCount: initial.metrics.upcomingAppointments,
      });

      // Verify assigned bots are enabled
      const disabledBots = plan.steps
        .map((s) => initial.employees.find((e) => e.id === s.botId))
        .filter((e) => e && !e.enabled)
        .map((e) => e!.name);

      if (disabledBots.length > 0) {
        updateEmployeeState(user.id, 'alex', {
          status: 'error',
          currentTaskId: null,
          currentTaskTitle: null,
        });
        const errMsg = `Cannot execute workflow because ${disabledBots.join(', ')} is currently disabled/paused. Enable them in the Employee Directory or Workspace.`;
        addAutomationLog({
          userId: user.id,
          workflowName: WORKFLOW_NAMES.alex,
          botId: 'alex',
          eventType: 'error',
          message: errMsg,
          status: 'error',
        });
        addChatMessage({
          userId: user.id,
          channel: 'command',
          sender: 'alex',
          text: errMsg,
        });
        res.status(409).json({ error: errMsg, workspace: getWorkspacePayload(user) });
        return;
      }

      const mainTask = createTask({
        userId: user.id,
        title: plan.taskTitle,
        description: trimmed,
        assignedTo: plan.steps[plan.steps.length - 1]?.botId ?? 'alex',
        createdBy: 'ceo',
        status: 'in_progress',
        priority: plan.priority,
      });
      activeTaskId = mainTask.id;

      const trace: CollaborationStep[] = [
        {
          stepNumber: 1,
          botId: 'alex',
          botName: 'Alex',
          action: 'Received CEO directive and generated collaboration plan',
          status: 'completed',
          summary: plan.alexSummary,
          timestamp: new Date().toISOString(),
        },
      ];

      addAutomationLog({
        userId: user.id,
        workflowName: WORKFLOW_NAMES.alex,
        botId: 'alex',
        eventType: 'orchestration',
        message: `Planned workflow "${plan.taskTitle}" (${plan.steps.map((s) => s.botId).join(' -> ')})`,
        details: plan.alexSummary,
        status: 'success',
        durationMs: Date.now() - startTotal,
      });

      let previousOutput = '';
      const collectedSources: SourceCitation[] = [];

      for (let i = 0; i < plan.steps.length; i++) {
        const step = plan.steps[i];
        const bot = initial.employees.find((e) => e.id === step.botId)!;
        const stepStart = Date.now();

        activeBotId = step.botId;
        updateEmployeeState(user.id, step.botId, {
          status: 'working',
          currentTaskId: mainTask.id,
          currentTaskTitle: step.instruction.slice(0, 60),
        });

        const result = await executeSpecialistStep({
          employee: bot,
          instruction: step.instruction,
          previousOutput: step.dependsOnPrevious ? previousOutput : undefined,
          emails: initial.emails,
          calendarEvents: initial.calendarEvents,
          tasks: initial.tasks,
        });

        const stepDuration = Date.now() - stepStart;
        previousOutput = result.output;
        if (result.sources.length > 0) {
          collectedSources.push(...result.sources);
        }

        const isLast = i === plan.steps.length - 1;
        const waitingApproval = isLast && plan.requiresApproval;

        trace.push({
          stepNumber: trace.length + 1,
          botId: step.botId,
          botName: bot.name,
          action: step.instruction,
          status: waitingApproval ? 'waiting_approval' : 'completed',
          summary: result.output.slice(0, 260) + (result.output.length > 260 ? '...' : ''),
          timestamp: new Date().toISOString(),
        });

        addAutomationLog({
          userId: user.id,
          workflowName: WORKFLOW_NAMES[step.botId],
          botId: step.botId,
          eventType: plan.steps.length > 1 ? 'collaboration' : 'execution',
          message: `${bot.name} completed: ${step.instruction.slice(0, 90)}`,
          details:
            result.sources.length > 0
              ? `Sources cited: ${result.sources.map((s) => s.uri).join(', ')}`
              : null,
          status: waitingApproval ? 'pending' : 'success',
          durationMs: stepDuration,
        });

        await dispatchN8nWorkflow({
          userId: user.id,
          isDemo: user.isDemo,
          botId: step.botId,
          workflowName: WORKFLOW_NAMES[step.botId],
          payload: {
            taskId: mainTask.id,
            instruction: step.instruction,
            outputPreview: result.output.slice(0, 400),
          },
        });

        updateEmployeeState(user.id, step.botId, {
          status: waitingApproval ? 'waiting' : 'completed',
          currentTaskId: waitingApproval ? mainTask.id : null,
          currentTaskTitle: waitingApproval ? mainTask.title : null,
          incrementCompleted: !waitingApproval,
          lastResponseMs: stepDuration,
        });
      }

      // Final Alex review step if multi-bot
      if (plan.steps.length > 1) {
        trace.push({
          stepNumber: trace.length + 1,
          botId: 'alex',
          botName: 'Alex',
          action: plan.requiresApproval
            ? 'Reviewed team deliverable and submitted to CEO Approval Center'
            : 'Reviewed team deliverable and finalized task',
          status: plan.requiresApproval ? 'waiting_approval' : 'completed',
          summary: `Coordinated ${plan.steps.map((s) => s.botId).join(' -> ')} pipeline.`,
          timestamp: new Date().toISOString(),
        });
      }

      let approvalId: string | undefined;
      if (plan.requiresApproval) {
        const finalBot = plan.steps[plan.steps.length - 1]?.botId ?? 'alex';
        const approval = createApproval({
          userId: user.id,
          taskId: mainTask.id,
          botId: finalBot,
          actionType: plan.approvalActionType ?? 'share_document',
          title: plan.approvalTitle || `Approve Deliverable: ${plan.taskTitle}`,
          summary: `${plan.alexSummary} Deliverable ready for CEO review before external action.`,
          payload: {
            taskId: mainTask.id,
            deliverablePreview: previousOutput.slice(0, 800),
            sources: collectedSources,
          },
        });
        approvalId = approval.id;

        addNotification({
          userId: user.id,
          type: 'approval',
          title: `Approval Required: ${approval.title}`,
          message: `Completed by ${plan.steps.map((s) => s.botId).join(' & ')}. Review in Approval Center.`,
          botId: finalBot,
        });

        void dispatchTelegramAlert({
          userId: user.id,
          isDemo: user.isDemo,
          title: `Approval Required: ${approval.title}`,
          message: previousOutput.slice(0, 280),
        });
      } else {
        addNotification({
          userId: user.id,
          type: 'task',
          title: `Task Completed: ${plan.taskTitle}`,
          message: `${plan.steps.map((s) => s.botId).join(' -> ')} finished execution.`,
          botId: plan.steps[plan.steps.length - 1]?.botId ?? 'alex',
        });
      }

      const dedupedSources = Array.from(
        new Map(collectedSources.map((s) => [s.uri, s])).values()
      );

      updateTask(user.id, mainTask.id, {
        status: plan.requiresApproval ? 'waiting_approval' : 'completed',
        output: previousOutput,
        sources: dedupedSources,
        collaborationTrace: trace,
      });

      updateEmployeeState(user.id, 'alex', {
        status: plan.requiresApproval ? 'waiting' : 'completed',
        currentTaskId: null,
        currentTaskTitle: null,
        incrementCompleted: true,
        lastResponseMs: Date.now() - startTotal,
      });

      const summaryReply = `${plan.alexSummary}\n\n${previousOutput}${
        plan.requiresApproval
          ? '\n\nAction held for your sign-off in the Approval Center.'
          : ''
      }`;

      addChatMessage({
        userId: user.id,
        channel: 'command',
        sender: 'alex',
        text: summaryReply,
        metadata: {
          delegatedBots: plan.steps.map((s) => s.botId),
          taskIds: [mainTask.id],
          sources: dedupedSources,
          approvalId,
        },
      });

      res.json({
        workspace: getWorkspacePayload(user),
        taskId: mainTask.id,
        approvalId,
      });
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : 'AI orchestration failed.';
      let msg = rawMsg;
      try {
        const parsedErr = JSON.parse(rawMsg) as { error?: { message?: string } };
        if (parsedErr?.error?.message) {
          msg = parsedErr.error.message;
        }
      } catch {
        // Keep rawMsg if not JSON
      }

      if (activeTaskId) {
        updateTask(user.id, activeTaskId, {
          status: 'failed',
          output: `Execution failed: ${msg}`,
        });
      }
      if (activeBotId && activeBotId !== 'alex') {
        updateEmployeeState(user.id, activeBotId, {
          status: 'error',
          currentTaskId: null,
          currentTaskTitle: null,
          incrementFailed: true,
        });
      }
      updateEmployeeState(user.id, 'alex', {
        status: 'error',
        currentTaskId: null,
        currentTaskTitle: null,
        incrementFailed: activeBotId === 'alex',
      });
      addAutomationLog({
        userId: user.id,
        workflowName: WORKFLOW_NAMES[activeBotId] ?? WORKFLOW_NAMES.alex,
        botId: activeBotId,
        eventType: 'error',
        message: `Command failed: ${msg}`,
        status: 'error',
        durationMs: Date.now() - startTotal,
      });
      addNotification({
        userId: user.id,
        type: 'error',
        title: 'Automation Execution Failed',
        message: msg,
        botId: activeBotId,
      });
      res.status(502).json({ error: msg, workspace: getWorkspacePayload(user) });
    }
  });

  // --- Employee Workspace Controls & Personal Chat ---
  app.patch('/api/employees/:id', requireAuth, (req, res) => {
    const user = req.user!;
    const botId = req.params.id as BotId;
    const employees = getEmployeesForUser(user.id);
    if (!employees.some((e) => e.id === botId)) {
      res.status(404).json({ error: 'Employee not found.' });
      return;
    }

    const { enabled, systemPrompt, permissions, status } = req.body as {
      enabled?: boolean;
      systemPrompt?: string;
      permissions?: EmployeePermissions;
      status?: 'idle' | 'paused';
    };

    updateEmployeeState(user.id, botId, {
      enabled,
      systemPrompt,
      permissions,
      status,
    });

    addAutomationLog({
      userId: user.id,
      workflowName: WORKFLOW_NAMES[botId],
      botId,
      eventType: 'execution',
      message:
        enabled !== undefined
          ? `${botId} was ${enabled ? 'resumed / enabled' : 'paused / disabled'} by CEO`
          : `Updated AI configuration for ${botId}`,
      status: 'success',
    });

    res.json({ workspace: getWorkspacePayload(user) });
  });

  app.post('/api/employees/:id/chat', requireAuth, async (req, res) => {
    const user = req.user!;
    const botId = req.params.id as BotId;
    const { message } = req.body as { message?: string };
    const trimmed = message?.trim() || '';
    if (!trimmed) {
      res.status(400).json({ error: 'Message cannot be empty.' });
      return;
    }

    const workspace = getWorkspacePayload(user);
    const employee = workspace.employees.find((e) => e.id === botId);
    if (!employee) {
      res.status(404).json({ error: 'Employee not found.' });
      return;
    }
    if (!employee.enabled) {
      res.status(409).json({
        error: `${employee.name} is currently paused. Enable ${employee.name} to chat.`,
      });
      return;
    }

    addChatMessage({
      userId: user.id,
      channel: botId,
      sender: 'ceo',
      text: trimmed,
    });

    const startMs = Date.now();
    try {
      updateEmployeeState(user.id, botId, {
        status: 'thinking',
        currentTaskTitle: `Chatting with CEO`,
      });

      const history = workspace.chatMessages
        .filter((m) => m.channel === botId)
        .map((m) => ({ sender: m.sender, text: m.text }));

      const { reply, sources } = await chatWithSpecialist({
        employee,
        message: trimmed,
        history,
        emails: workspace.emails,
        calendarEvents: workspace.calendarEvents,
        tasks: workspace.tasks,
      });

      updateEmployeeState(user.id, botId, {
        status: 'completed',
        currentTaskTitle: null,
        lastResponseMs: Date.now() - startMs,
      });

      addChatMessage({
        userId: user.id,
        channel: botId,
        sender: botId,
        text: reply,
        metadata: sources.length > 0 ? { sources } : undefined,
      });

      addAutomationLog({
        userId: user.id,
        workflowName: WORKFLOW_NAMES[botId],
        botId,
        eventType: 'execution',
        message: `${employee.name} answered CEO workspace inquiry`,
        status: 'success',
        durationMs: Date.now() - startMs,
      });

      res.json({ workspace: getWorkspacePayload(user) });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Employee chat failed.';
      updateEmployeeState(user.id, botId, {
        status: 'error',
        currentTaskTitle: null,
        incrementFailed: true,
      });
      res.status(502).json({ error: msg, workspace: getWorkspacePayload(user) });
    }
  });

  // --- Manual Task Management ---
  app.post('/api/tasks', requireAuth, async (req, res) => {
    const user = req.user!;
    const { title, description, assignedTo, priority, runImmediately } = req.body as {
      title?: string;
      description?: string;
      assignedTo?: BotId;
      priority?: 'critical' | 'high' | 'normal' | 'low';
      runImmediately?: boolean;
    };

    if (!title?.trim() || !assignedTo) {
      res.status(400).json({ error: 'Task title and assigned employee are required.' });
      return;
    }

    const workspace = getWorkspacePayload(user);
    const employee = workspace.employees.find((e) => e.id === assignedTo);
    if (!employee) {
      res.status(404).json({ error: 'Assigned employee not found.' });
      return;
    }
    if (!employee.enabled) {
      res.status(409).json({
        error: `${employee.name} is disabled. Resume ${employee.name} before assigning tasks.`,
      });
      return;
    }

    const task = createTask({
      userId: user.id,
      title: title.trim(),
      description: description?.trim() || title.trim(),
      assignedTo,
      createdBy: 'ceo',
      status: runImmediately ? 'in_progress' : 'queued',
      priority: priority ?? 'normal',
    });

    if (!runImmediately) {
      addAutomationLog({
        userId: user.id,
        workflowName: WORKFLOW_NAMES[assignedTo],
        botId: assignedTo,
        eventType: 'execution',
        message: `Queued manual task "${task.title}" for ${employee.name}`,
        status: 'success',
      });
      res.status(201).json({ workspace: getWorkspacePayload(user), task });
      return;
    }

    const startMs = Date.now();
    try {
      updateEmployeeState(user.id, assignedTo, {
        status: 'working',
        currentTaskId: task.id,
        currentTaskTitle: task.title,
      });

      const result = await executeSpecialistStep({
        employee,
        instruction: `${task.title}\n${task.description}`,
        emails: workspace.emails,
        calendarEvents: workspace.calendarEvents,
        tasks: workspace.tasks,
      });

      updateTask(user.id, task.id, {
        status: 'completed',
        output: result.output,
        sources: result.sources,
        collaborationTrace: [
          {
            stepNumber: 1,
            botId: assignedTo,
            botName: employee.name,
            action: task.title,
            status: 'completed',
            summary: result.output.slice(0, 220),
            timestamp: new Date().toISOString(),
          },
        ],
      });

      updateEmployeeState(user.id, assignedTo, {
        status: 'completed',
        currentTaskId: null,
        currentTaskTitle: null,
        incrementCompleted: true,
        lastResponseMs: Date.now() - startMs,
      });

      addAutomationLog({
        userId: user.id,
        workflowName: WORKFLOW_NAMES[assignedTo],
        botId: assignedTo,
        eventType: 'execution',
        message: `Executed manual task "${task.title}"`,
        status: 'success',
        durationMs: Date.now() - startMs,
      });

      res.status(201).json({ workspace: getWorkspacePayload(user), task });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Task execution failed.';
      updateTask(user.id, task.id, { status: 'failed', output: msg });
      updateEmployeeState(user.id, assignedTo, {
        status: 'error',
        currentTaskId: null,
        currentTaskTitle: null,
        incrementFailed: true,
      });
      res.status(502).json({ error: msg, workspace: getWorkspacePayload(user) });
    }
  });

  app.patch('/api/tasks/:id', requireAuth, (req, res) => {
    const user = req.user!;
    const { status } = req.body as { status?: 'cancelled' | 'completed' | 'queued' };
    if (!status) {
      res.status(400).json({ error: 'Status is required.' });
      return;
    }
    const updated = updateTask(user.id, req.params.id, { status });
    if (!updated) {
      res.status(404).json({ error: 'Task not found.' });
      return;
    }
    updateEmployeeState(user.id, updated.assignedTo, {
      status: 'idle',
      currentTaskId: null,
      currentTaskTitle: null,
    });
    res.json({ workspace: getWorkspacePayload(user) });
  });

  // --- Emma Email Actions ---
  app.post('/api/emails', requireAuth, async (req, res) => {
    const user = req.user!;
    const { provider, senderName, senderEmail, subject, body } = req.body as {
      provider?: 'gmail' | 'outlook';
      senderName?: string;
      senderEmail?: string;
      subject?: string;
      body?: string;
    };

    if (!senderEmail?.trim() || !subject?.trim() || !body?.trim()) {
      res.status(400).json({ error: 'Sender email, subject, and body are required.' });
      return;
    }

    const baseline = classifyEmailPriority(subject, body, senderEmail);
    const email = addEmailItem({
      userId: user.id,
      provider: provider ?? 'gmail',
      senderName: senderName?.trim() || senderEmail.split('@')[0],
      senderEmail: senderEmail.trim(),
      subject: subject.trim(),
      body: body.trim(),
      priority: baseline.priority,
      category: baseline.category,
      phishingFlag: baseline.phishingFlag,
      phishingReason: baseline.phishingReason,
      status: 'unread',
    });

    // Have Emma immediately analyze via Gemini if enabled
    const emma = getEmployeesForUser(user.id).find((e) => e.id === 'emma');
    if (emma?.enabled) {
      try {
        updateEmployeeState(user.id, 'emma', {
          status: 'working',
          currentTaskTitle: `Triaging: ${email.subject.slice(0, 40)}`,
        });
        const analysis = await analyzeEmailWithEmma(email);
        updateEmailAnalysis(user.id, email.id, {
          priority: analysis.priority,
          category: analysis.category,
          phishingFlag: analysis.phishingFlag,
          phishingReason: analysis.phishingReason,
          aiSummary: analysis.summary,
          draftReply: analysis.draftReply,
          status: analysis.draftReply ? 'pending_approval' : 'triaged',
        });

        if (analysis.draftReply && !analysis.phishingFlag) {
          createApproval({
            userId: user.id,
            taskId: null,
            botId: 'emma',
            actionType: 'send_email',
            title: `Send ${analysis.priority} Reply to ${email.senderName}`,
            summary: analysis.summary,
            payload: {
              emailId: email.id,
              to: email.senderEmail,
              subject: `Re: ${email.subject}`,
              body: analysis.draftReply,
            },
          });
        }

        if (analysis.priority === 'P1' || analysis.phishingFlag) {
          addNotification({
            userId: user.id,
            type: 'email',
            title: analysis.phishingFlag
              ? `P5 Phishing Quarantined: ${email.subject}`
              : `P1 Critical Email: ${email.subject}`,
            message: analysis.summary,
            botId: 'emma',
          });
        }

        updateEmployeeState(user.id, 'emma', {
          status: analysis.draftReply ? 'waiting' : 'completed',
          currentTaskTitle: null,
          incrementCompleted: true,
        });
      } catch (err) {
        updateEmployeeState(user.id, 'emma', { status: 'error', currentTaskTitle: null });
        const msg = err instanceof Error ? err.message : 'Emma AI triage failed.';
        res.status(502).json({ error: msg, workspace: getWorkspacePayload(user) });
        return;
      }
    }

    res.status(201).json({ workspace: getWorkspacePayload(user) });
  });

  app.post('/api/emails/triage', requireAuth, async (req, res) => {
    const user = req.user!;
    const workspace = getWorkspacePayload(user);
    const emma = workspace.employees.find((e) => e.id === 'emma')!;
    if (!emma.enabled) {
      res.status(409).json({ error: 'Emma is paused. Enable Emma to triage emails.' });
      return;
    }

    const untriaged = workspace.emails.filter((e) => e.status === 'unread' || !e.aiSummary);
    if (untriaged.length === 0) {
      res.json({ workspace, message: 'All inbox messages are already triaged.' });
      return;
    }

    try {
      updateEmployeeState(user.id, 'emma', {
        status: 'working',
        currentTaskTitle: `Triaging ${untriaged.length} emails`,
      });
      for (const email of untriaged.slice(0, 4)) {
        const analysis = await analyzeEmailWithEmma(email);
        updateEmailAnalysis(user.id, email.id, {
          priority: analysis.priority,
          category: analysis.category,
          phishingFlag: analysis.phishingFlag,
          phishingReason: analysis.phishingReason,
          aiSummary: analysis.summary,
          draftReply: analysis.draftReply,
          status: analysis.draftReply ? 'pending_approval' : 'triaged',
        });
        if (analysis.draftReply && !analysis.phishingFlag) {
          createApproval({
            userId: user.id,
            taskId: null,
            botId: 'emma',
            actionType: 'send_email',
            title: `Send ${analysis.priority} Reply to ${email.senderName}`,
            summary: analysis.summary,
            payload: {
              emailId: email.id,
              to: email.senderEmail,
              subject: `Re: ${email.subject}`,
              body: analysis.draftReply,
            },
          });
        }
      }
      updateEmployeeState(user.id, 'emma', {
        status: 'completed',
        currentTaskTitle: null,
        incrementCompleted: true,
      });
      addAutomationLog({
        userId: user.id,
        workflowName: WORKFLOW_NAMES.emma,
        botId: 'emma',
        eventType: 'execution',
        message: `Triaged ${untriaged.length} unread messages and drafted replies`,
        status: 'success',
      });
      res.json({ workspace: getWorkspacePayload(user) });
    } catch (err) {
      updateEmployeeState(user.id, 'emma', { status: 'error', currentTaskTitle: null });
      const msg = err instanceof Error ? err.message : 'Email triage failed.';
      res.status(502).json({ error: msg, workspace: getWorkspacePayload(user) });
    }
  });

  // --- Sophie Calendar Actions ---
  app.post('/api/calendar', requireAuth, (req, res) => {
    const user = req.user!;
    const { title, startIso, endIso, attendees, location, notes, sendExternalInvite } =
      req.body as {
        title?: string;
        startIso?: string;
        endIso?: string;
        attendees?: string[];
        location?: string;
        notes?: string;
        sendExternalInvite?: boolean;
      };

    if (!title?.trim() || !startIso || !endIso) {
      res.status(400).json({ error: 'Event title, start time, and end time are required.' });
      return;
    }

    const event = addCalendarEvent({
      userId: user.id,
      title: title.trim(),
      startIso,
      endIso,
      attendees: Array.isArray(attendees) ? attendees : [],
      location: location?.trim() || 'Google Meet',
      notes: notes?.trim() || '',
      createdByBot: true,
      requiresApproval: Boolean(sendExternalInvite),
    });

    if (sendExternalInvite || event.status === 'conflict') {
      createApproval({
        userId: user.id,
        taskId: null,
        botId: 'sophie',
        actionType: 'send_invite',
        title:
          event.status === 'conflict'
            ? `Resolve Conflict & Send Invite: ${event.title}`
            : `Send External Calendar Invite: ${event.title}`,
        summary:
          event.status === 'conflict'
            ? 'Sophie flagged an overlapping appointment. Approve to send anyway or reject to reschedule.'
            : `Sophie prepared a calendar invitation for ${event.attendees.join(', ') || 'external guests'}.`,
        payload: {
          eventId: event.id,
          startIso: event.startIso,
          endIso: event.endIso,
          attendees: event.attendees,
        },
      });
    }

    addAutomationLog({
      userId: user.id,
      workflowName: WORKFLOW_NAMES.sophie,
      botId: 'sophie',
      eventType: 'execution',
      message:
        event.status === 'conflict'
          ? `Scheduled "${event.title}" with conflict flag`
          : `Scheduled "${event.title}"`,
      status: event.status === 'conflict' ? 'pending' : 'success',
    });

    res.status(201).json({ workspace: getWorkspacePayload(user), event });
  });

  // --- Approval Center ---
  app.post('/api/approvals/:id/decide', requireAuth, (req, res) => {
    const user = req.user!;
    const { decision, note } = req.body as {
      decision?: 'approved' | 'rejected';
      note?: string;
    };

    if (decision !== 'approved' && decision !== 'rejected') {
      res.status(400).json({ error: 'Decision must be "approved" or "rejected".' });
      return;
    }

    const updated = decideApproval(user.id, req.params.id, decision, note?.trim() || null);
    if (!updated) {
      res.status(404).json({ error: 'Approval item not found.' });
      return;
    }

    // If email send approval, update email status cleanly
    const emailId = updated.payload?.emailId as string | undefined;
    if (emailId) {
      updateEmailAnalysis(user.id, emailId, {
        status: decision === 'approved' ? 'sent' : 'triaged',
      });
    }

    addAutomationLog({
      userId: user.id,
      workflowName: WORKFLOW_NAMES[updated.botId],
      botId: updated.botId,
      eventType: 'approval',
      message: `CEO ${decision.toUpperCase()} "${updated.title}"`,
      details: note?.trim() || null,
      status: decision === 'approved' ? 'success' : 'error',
    });

    addNotification({
      userId: user.id,
      type: 'approval',
      title: `Action ${decision === 'approved' ? 'Approved' : 'Rejected'}`,
      message: updated.title,
      botId: updated.botId,
    });

    res.json({ workspace: getWorkspacePayload(user), approval: updated });
  });

  // --- Notifications ---
  app.post('/api/notifications/read', requireAuth, (req, res) => {
    markAllNotificationsRead(req.user!.id);
    res.json({ workspace: getWorkspacePayload(req.user!) });
  });

  // --- Integrations & n8n Webhooks ---
  app.put('/api/integrations/:id', requireAuth, requireNonDemoUser, (req, res) => {
    const user = req.user!;
    const { connected, endpointUrl, accountLabel, secretValue } = req.body as {
      connected?: boolean;
      endpointUrl?: string;
      accountLabel?: string;
      secretValue?: string;
    };

    if (endpointUrl !== undefined && endpointUrl.trim() !== '') {
      const urlCheck = validateWebhookUrl(endpointUrl);
      if (!urlCheck.valid) {
        res.status(400).json({ error: urlCheck.reason });
        return;
      }
    }

    const updated = updateIntegration(user.id, req.params.id, {
      connected,
      endpointUrl: endpointUrl?.trim(),
      accountLabel: accountLabel?.trim(),
      secretValue: secretValue?.trim(),
      lastStatus: connected ? 'Configured' : 'Setup Required',
    });

    if (!updated) {
      res.status(404).json({ error: 'Integration not found.' });
      return;
    }

    addAutomationLog({
      userId: user.id,
      workflowName: updated.name,
      botId: 'alex',
      eventType: 'execution',
      message: `Updated integration settings for ${updated.name}`,
      status: 'success',
    });

    res.json({ workspace: getWorkspacePayload(user), integration: updated });
  });

  app.post('/api/integrations/:id/test', requireAuth, requireNonDemoUser, async (req, res) => {
    const user = req.user!;
    const integrations = getIntegrationsForUser(user.id);
    const target = integrations.find((i) => i.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'Integration not found.' });
      return;
    }

    if (target.id.startsWith('n8n_')) {
      if (!target.endpointUrl) {
        res.status(400).json({ error: 'Configure an n8n webhook URL before testing.' });
        return;
      }
      const botId = target.id.replace('n8n_', '') as BotId;
      const result = await dispatchN8nWorkflow({
        userId: user.id,
        isDemo: user.isDemo,
        botId,
        workflowName: target.name,
        payload: { event: 'connection_test', testedBy: user.email },
      });
      const ok = !result.statusText.startsWith('Failed') && !result.statusText.startsWith('HTTP 4') && !result.statusText.startsWith('HTTP 5');
      updateIntegration(user.id, target.id, {
        connected: ok,
        lastTestedAt: new Date().toISOString(),
        lastStatus: result.statusText,
      });
      res.json({ ok, statusText: result.statusText, workspace: getWorkspacePayload(user) });
      return;
    }

    if (target.id === 'telegram') {
      const token = getIntegrationSecret(user.id, 'telegram');
      if (!token || !target.accountLabel) {
        res.status(400).json({ error: 'Enter Telegram Bot Token and Chat ID first.' });
        return;
      }
      try {
        const tgRes = await fetch(
          `https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: target.accountLabel,
              text: 'ROBOT OFFICE AI: Telegram alerts connected and verified.',
            }),
            signal: AbortSignal.timeout(6000),
          }
        );
        const statusText = `HTTP ${tgRes.status} ${tgRes.statusText}`;
        updateIntegration(user.id, 'telegram', {
          connected: tgRes.ok,
          lastTestedAt: new Date().toISOString(),
          lastStatus: statusText,
        });
        res.json({ ok: tgRes.ok, statusText, workspace: getWorkspacePayload(user) });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Telegram request failed';
        updateIntegration(user.id, 'telegram', {
          connected: false,
          lastTestedAt: new Date().toISOString(),
          lastStatus: msg,
        });
        res.status(502).json({ error: msg, workspace: getWorkspacePayload(user) });
      }
      return;
    }

    updateIntegration(user.id, target.id, {
      lastTestedAt: new Date().toISOString(),
      lastStatus: target.connected ? 'Verified' : 'Setup Required',
    });
    res.json({ ok: target.connected, workspace: getWorkspacePayload(user) });
  });

  // --- Cloud SQL Workspace & Messaging Connectors ---
  const VALID_SERVICES = new Set<ConnectorServiceKey>([
    'gmail',
    'outlook',
    'google_calendar',
    'google_drive',
    'slack',
    'telegram',
  ]);
  const VALID_PERMISSIONS = new Set<ConnectorPermissionLevel>([
    'none',
    'read',
    'write',
    'admin',
  ]);

  app.get('/api/connectors', requireAuth, async (req, res) => {
    try {
      const dashboard = await getConnectorDashboard(req.user!.id, req.user!.email);
      res.json(
        req.user!.isDemo ? sanitizeDemoConnectorDashboard(dashboard) : dashboard
      );
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to load connectors.',
      });
    }
  });

  app.post('/api/connectors/:service/connect-google', requireAuth, requireNonDemoUser, async (req, res) => {
    const service = req.params.service as ConnectorServiceKey;
    if (service !== 'gmail' && service !== 'google_calendar' && service !== 'google_drive') {
      res.status(400).json({ error: 'Unsupported Google Workspace connector.' });
      return;
    }
    const googleToken =
      (req.headers['x-google-access-token'] as string | undefined) || '';
    try {
      const result = await connectGoogleService({
        userId: req.user!.id,
        email: req.user!.email,
        serviceName: service,
        googleAccessToken: googleToken,
      });
      const dashboard = await getConnectorDashboard(req.user!.id, req.user!.email);
      res.status(result.ok ? 200 : 400).json({ ...result, dashboard });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Google Workspace connection failed.',
      });
    }
  });

  app.post('/api/connectors/:service/connect-telegram', requireAuth, requireNonDemoUser, async (req, res) => {
    if (req.params.service !== 'telegram') {
      res.status(400).json({ error: 'Invalid endpoint for this service.' });
      return;
    }
    const { botToken, chatId } = req.body as { botToken?: string; chatId?: string };
    try {
      const result = await connectTelegramService({
        userId: req.user!.id,
        email: req.user!.email,
        botToken: botToken || '',
        chatId: chatId || '',
      });
      const dashboard = await getConnectorDashboard(req.user!.id, req.user!.email);
      res.status(result.ok ? 200 : 400).json({ ...result, dashboard });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Telegram connection failed.',
      });
    }
  });

  app.post('/api/oauth/:provider/start', requireAuth, requireNonDemoUser, async (req, res) => {
    const provider = req.params.provider;
    if (provider !== 'outlook' && provider !== 'slack') {
      res.status(400).json({ error: 'Unsupported OAuth provider.' });
      return;
    }
    const originHeader = req.headers.origin;
    const reqOrigin =
      typeof originHeader === 'string' && originHeader.startsWith('http')
        ? originHeader
        : `${req.protocol}://${req.get('host')}`;
    try {
      const result = await startThirdPartyOAuth({
        userId: req.user!.id,
        email: req.user!.email,
        provider,
        origin: getPublicOrigin(reqOrigin),
      });
      if (!result.configured) {
        res.status(200).json(result.instructions);
        return;
      }
      res.json({ authUrl: result.authUrl });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed starting OAuth flow.',
      });
    }
  });

  const handleOAuthCallback = async (req: express.Request, res: express.Response) => {
    const provider = req.params.provider;
    if (provider !== 'outlook' && provider !== 'slack') {
      res.status(400).send('Invalid provider');
      return;
    }
    const code = typeof req.query.code === 'string' ? req.query.code : undefined;
    const state = typeof req.query.state === 'string' ? req.query.state : undefined;
    const oauthError =
      typeof req.query.error === 'string' ? req.query.error : undefined;

    const result = await completeThirdPartyOAuthCallback({
      provider,
      code,
      state,
      oauthError,
    });

    const safePayload = serializeInlineScriptValue({
      type: 'OAUTH_COMPLETE',
      provider,
      ok: result.ok,
      message: result.message,
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!doctype html>
<html>
  <head><title>Authorization Complete</title></head>
  <body style="font-family:sans-serif;padding:24px;background:#0f172a;color:#f8fafc;">
    <p>${result.ok ? 'Connection verified. Returning to ROBOT OFFICE AI...' : 'Authorization was not completed.'}</p>
    <script>
      (function () {
        var payload = ${safePayload};
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(payload, window.location.origin);
        }
        window.close();
      })();
    </script>
  </body>
</html>`);
  };

  app.get('/api/oauth/:provider/callback', handleOAuthCallback);
  app.get('/api/oauth/:provider/callback/', handleOAuthCallback);

  app.patch('/api/connectors/:service/config', requireAuth, requireNonDemoUser, async (req, res) => {
    const service = req.params.service as ConnectorServiceKey;
    if (!VALID_SERVICES.has(service)) {
      res.status(400).json({ error: 'Unknown connector service.' });
      return;
    }
    const { sandboxMode, n8nWebhookUrl, n8nEnabled, accountLabel } = req.body as {
      sandboxMode?: boolean;
      n8nWebhookUrl?: string;
      n8nEnabled?: boolean;
      accountLabel?: string;
    };

    if (n8nWebhookUrl !== undefined && n8nWebhookUrl.trim() !== '') {
      const check = validateWebhookUrl(n8nWebhookUrl);
      if (!check.valid) {
        res.status(400).json({ error: check.reason });
        return;
      }
    }

    try {
      const conn = await getConnectorRecord(req.user!.id, service);
      if (!conn) {
        res.status(404).json({ error: 'Connector not found.' });
        return;
      }

      const nextSandbox =
        sandboxMode !== undefined ? Boolean(sandboxMode) : conn.sandboxMode;
      let nextStatus = conn.connectionStatus;
      if (sandboxMode === true) {
        nextStatus = 'SANDBOX MODE';
      } else if (sandboxMode === false && conn.connectionStatus === 'SANDBOX MODE') {
        nextStatus = 'NOT CONNECTED';
      }

      await updateConnectorState(conn.id, {
        sandboxMode: nextSandbox,
        connectionStatus: nextStatus as any,
        n8nWebhookUrl:
          n8nWebhookUrl !== undefined ? n8nWebhookUrl.trim() : conn.n8nWebhookUrl,
        n8nEnabled:
          n8nEnabled !== undefined ? Boolean(n8nEnabled) : conn.n8nEnabled,
        accountLabel:
          accountLabel !== undefined ? accountLabel.trim() : conn.accountLabel,
      });

      await appendConnectorLog({
        integrationId: conn.id,
        action: `Updated configuration for ${conn.displayName}${nextSandbox ? ' (SANDBOX MODE)' : ''}`,
        status: nextSandbox ? 'sandbox' : 'success',
        isSandbox: nextSandbox,
      });

      const dashboard = await getConnectorDashboard(req.user!.id, req.user!.email);
      res.json({ dashboard });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed updating connector config.',
      });
    }
  });

  app.post('/api/connectors/:service/test', requireAuth, requireNonDemoUser, async (req, res) => {
    const service = req.params.service as ConnectorServiceKey;
    if (!VALID_SERVICES.has(service)) {
      res.status(400).json({ error: 'Unknown connector service.' });
      return;
    }
    const googleToken =
      (req.headers['x-google-access-token'] as string | undefined) || undefined;
    try {
      const result = await testConnectorConnection({
        userId: req.user!.id,
        email: req.user!.email,
        serviceName: service,
        googleAccessToken: googleToken,
      });

      // Optionally ping configured n8n webhook when not in Sandbox Mode
      const conn = await getConnectorRecord(req.user!.id, service);
      if (conn && conn.n8nEnabled && conn.n8nWebhookUrl && !result.sandboxSimulated) {
        const n8nRes = await dispatchIntegrationN8nWebhook({
          webhookUrl: conn.n8nWebhookUrl,
          serviceName: service,
          workflowName: conn.n8nWorkflowName,
          event: 'connection_test',
          payload: { diagnostic: result.diagnostic },
        });
        await appendConnectorLog({
          integrationId: conn.id,
          action: `n8n workflow "${conn.n8nWorkflowName}" test (${n8nRes.statusText})`,
          status: n8nRes.ok ? 'success' : 'error',
          isSandbox: false,
          errorMessage: n8nRes.ok ? null : n8nRes.statusText,
        });
      }

      const dashboard = await getConnectorDashboard(req.user!.id, req.user!.email);
      res.json({ ...result, dashboard });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Connection test failed.',
      });
    }
  });

  app.post('/api/connectors/:service/execute', requireAuth, requireNonDemoUser, async (req, res) => {
    const service = req.params.service as ConnectorServiceKey;
    if (!VALID_SERVICES.has(service)) {
      res.status(400).json({ error: 'Unknown connector service.' });
      return;
    }
    const { employeeId, action, requiredPermission, payload } = req.body as {
      employeeId?: BotId;
      action?: string;
      requiredPermission?: ConnectorPermissionLevel;
      payload?: Record<string, unknown>;
    };
    const botId: BotId = employeeId || 'alex';
    const employees = getEmployeesForUser(req.user!.id);
    const bot = employees.find((e) => e.id === botId);
    const googleToken =
      (req.headers['x-google-access-token'] as string | undefined) || undefined;

    try {
      const result = await executeConnectorAction({
        userId: req.user!.id,
        email: req.user!.email,
        serviceName: service,
        employeeId: botId,
        employeeName: bot?.name || botId,
        action: action?.trim() || 'Sync connector preview',
        requiredPermission: requiredPermission || 'read',
        googleAccessToken: googleToken,
        payload,
      });
      const dashboard = await getConnectorDashboard(req.user!.id, req.user!.email);
      res.json({ ...result, dashboard });
    } catch (err) {
      res.status(403).json({
        error: err instanceof Error ? err.message : 'Connector execution blocked.',
      });
    }
  });

  app.post('/api/connectors/oauth-apps', requireAuth, requireNonDemoUser, async (req, res) => {
    const { outlook, slack, encryptionKey } = req.body as {
      outlook?: { clientId?: string; clientSecret?: string; tenantId?: string };
      slack?: { clientId?: string; clientSecret?: string };
      encryptionKey?: string;
    };

    try {
      const result = await saveOAuthAppCredentialsBundle({
        userId: req.user!.id,
        email: req.user!.email,
        outlook,
        slack,
        encryptionKey,
      });
      if (result.updated.length === 0) {
        res.status(400).json({
          error: 'Enter at least one OAuth Client ID / Secret or Encryption Key to save.',
        });
        return;
      }
      const dashboard = await getConnectorDashboard(req.user!.id, req.user!.email);
      res.json({ ok: true, updated: result.updated, dashboard });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed saving OAuth application credentials.';
      const status = message.includes('managed by') ? 409 : 400;
      res.status(status).json({ error: message });
    }
  });

  app.delete('/api/connectors/oauth-apps/:provider', requireAuth, requireNonDemoUser, async (req, res) => {
    const provider = req.params.provider;
    if (provider !== 'outlook' && provider !== 'slack') {
      res.status(400).json({ error: 'Unsupported OAuth app provider.' });
      return;
    }
    try {
      await clearOAuthAppCredentials({
        userId: req.user!.id,
        email: req.user!.email,
        provider,
      });
      const dashboard = await getConnectorDashboard(req.user!.id, req.user!.email);
      res.json({ ok: true, dashboard });
    } catch (err) {
      res.status(500).json({
        error:
          err instanceof Error ? err.message : 'Failed clearing OAuth application credentials.',
      });
    }
  });

  app.post('/api/connectors/:service/refresh', requireAuth, requireNonDemoUser, async (req, res) => {
    const service = req.params.service as ConnectorServiceKey;
    if (!VALID_SERVICES.has(service)) {
      res.status(400).json({ error: 'Unknown connector service.' });
      return;
    }
    try {
      const result = await refreshConnectorToken({
        userId: req.user!.id,
        email: req.user!.email,
        serviceName: service,
      });
      const dashboard = await getConnectorDashboard(req.user!.id, req.user!.email);
      res.json({ ...result, dashboard });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Token refresh failed.',
      });
    }
  });

  app.post('/api/connectors/:service/disconnect', requireAuth, requireNonDemoUser, async (req, res) => {
    const service = req.params.service as ConnectorServiceKey;
    if (!VALID_SERVICES.has(service)) {
      res.status(400).json({ error: 'Unknown connector service.' });
      return;
    }
    try {
      await disconnectConnectorService({
        userId: req.user!.id,
        email: req.user!.email,
        serviceName: service,
      });
      const dashboard = await getConnectorDashboard(req.user!.id, req.user!.email);
      res.json({ dashboard });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Disconnect failed.',
      });
    }
  });

  app.post('/api/connectors/disconnect-all', requireAuth, requireNonDemoUser, async (req, res) => {
    try {
      await disconnectAllConnectorsWithAudit(req.user!.id, req.user!.email);
      const dashboard = await getConnectorDashboard(req.user!.id, req.user!.email);
      res.json({ dashboard });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to disconnect all services.',
      });
    }
  });

  app.patch(
    '/api/connectors/:service/employees/:employeeId',
    requireAuth,
    requireNonDemoUser,
    async (req, res) => {
      const service = req.params.service as ConnectorServiceKey;
      const employeeId = req.params.employeeId as BotId;
      if (!VALID_SERVICES.has(service)) {
        res.status(400).json({ error: 'Unknown connector service.' });
        return;
      }
      const { permissionLevel, enabled } = req.body as {
        permissionLevel?: ConnectorPermissionLevel;
        enabled?: boolean;
      };
      if (permissionLevel && !VALID_PERMISSIONS.has(permissionLevel)) {
        res.status(400).json({ error: 'Invalid permission level.' });
        return;
      }
      try {
        const conn = await getConnectorRecord(req.user!.id, service);
        if (!conn) {
          res.status(404).json({ error: 'Connector not found.' });
          return;
        }
        await setEmployeeConnectorPermission({
          integrationId: conn.id,
          employeeId,
          permissionLevel: permissionLevel ?? 'read',
          enabled: Boolean(enabled),
        });
        await appendConnectorLog({
          integrationId: conn.id,
          employeeId,
          action: `CEO set ${employeeId} access on ${conn.displayName} to ${enabled ? (permissionLevel ?? 'read').toUpperCase() : 'DISABLED'}`,
          status: 'success',
          isSandbox: conn.sandboxMode,
        });
        const dashboard = await getConnectorDashboard(req.user!.id, req.user!.email);
        res.json({ dashboard });
      } catch (err) {
        res.status(500).json({
          error:
            err instanceof Error
              ? err.message
              : 'Failed updating employee integration permissions.',
        });
      }
    }
  );

  if (options.serveFrontend !== false) {
    // --- Vite Dev Middleware / Static Production Assets ---
    if (!isProduction) {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.resolve(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        const indexFile = path.join(distPath, 'index.html');
        if (fs.existsSync(indexFile)) {
          res.sendFile(indexFile);
        } else {
          res.status(404).send('Build output not found.');
        }
      });
    }
  }

  return app;
}
