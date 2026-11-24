import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_EMPLOYEES,
  deriveOfficeMetrics,
  detectCalendarConflicts,
} from '../src/shared/officeLogic.ts';
import type {
  ApprovalActionType,
  ApprovalRecord,
  ApprovalStatus,
  AutomationLog,
  BotId,
  BotStatus,
  CalendarEvent,
  ChatMessage,
  CollaborationStep,
  EmployeePermissions,
  EmployeeProfile,
  InboxEmail,
  IntegrationConfig,
  NotificationItem,
  SourceCitation,
  TaskRecord,
  TaskStatus,
  UserProfile,
  WorkspacePayload,
} from '../src/shared/types.ts';

const DATA_DIR = path.resolve(process.cwd(), '.data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'robot_office.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    company_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    theme TEXT NOT NULL DEFAULT 'dark',
    is_demo INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS employees (
    user_id TEXT NOT NULL,
    bot_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'idle',
    enabled INTEGER NOT NULL DEFAULT 1,
    current_task_id TEXT,
    current_task_title TEXT,
    system_prompt TEXT NOT NULL,
    permissions_json TEXT NOT NULL,
    tasks_completed INTEGER NOT NULL DEFAULT 0,
    tasks_failed INTEGER NOT NULL DEFAULT 0,
    avg_response_ms INTEGER NOT NULL DEFAULT 1400,
    PRIMARY KEY (user_id, bot_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    assigned_to TEXT NOT NULL,
    created_by TEXT NOT NULL,
    status TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'normal',
    output TEXT NOT NULL DEFAULT '',
    sources_json TEXT NOT NULL DEFAULT '[]',
    collaboration_trace_json TEXT NOT NULL DEFAULT '[]',
    parent_task_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS approvals (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    task_id TEXT,
    bot_id TEXT NOT NULL,
    action_type TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    payload_json TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending',
    decision_note TEXT,
    created_at TEXT NOT NULL,
    decided_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS emails (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'gmail',
    sender_name TEXT NOT NULL,
    sender_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    priority TEXT NOT NULL,
    category TEXT NOT NULL,
    phishing_flag INTEGER NOT NULL DEFAULT 0,
    phishing_reason TEXT,
    ai_summary TEXT,
    draft_reply TEXT,
    status TEXT NOT NULL DEFAULT 'unread',
    received_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS calendar_events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    start_iso TEXT NOT NULL,
    end_iso TEXT NOT NULL,
    attendees_json TEXT NOT NULL DEFAULT '[]',
    location TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'confirmed',
    conflict_with_id TEXT,
    created_by_bot INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS automation_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    workflow_name TEXT NOT NULL,
    bot_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    message TEXT NOT NULL,
    details TEXT,
    status TEXT NOT NULL,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    bot_id TEXT,
    read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS integrations (
    user_id TEXT NOT NULL,
    id TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    connected INTEGER NOT NULL DEFAULT 0,
    endpoint_url TEXT NOT NULL DEFAULT '',
    account_label TEXT NOT NULL DEFAULT '',
    secret_value TEXT NOT NULL DEFAULT '',
    last_tested_at TEXT,
    last_status TEXT,
    PRIMARY KEY (user_id, id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    channel TEXT NOT NULL,
    sender TEXT NOT NULL,
    text TEXT NOT NULL,
    metadata_json TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

export function uid(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 10)}`;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, expectedHex] = stored.split(':');
  if (!salt || !expectedHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

export function createSession(userId: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  const now = new Date();
  const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  db.prepare(
    `INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)`
  ).run(token, userId, now.toISOString(), expires.toISOString());
  return token;
}

export function deleteSession(token: string): void {
  db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
}

export function getUserByToken(token: string): UserProfile | null {
  const row = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.company_name, u.theme, u.is_demo
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > ?`
    )
    .get(token, new Date().toISOString()) as
    | {
        id: string;
        name: string;
        email: string;
        company_name: string;
        theme: 'light' | 'dark';
        is_demo: number;
      }
    | undefined;

  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    companyName: row.company_name,
    theme: row.theme,
    isDemo: row.is_demo === 1,
  };
}

export function findUserByEmail(email: string) {
  return db
    .prepare(
      `SELECT id, name, email, company_name, password_hash, theme, is_demo FROM users WHERE lower(email) = lower(?)`
    )
    .get(email) as
    | {
        id: string;
        name: string;
        email: string;
        company_name: string;
        password_hash: string;
        theme: 'light' | 'dark';
        is_demo: number;
      }
    | undefined;
}

export function createUser(params: {
  name: string;
  email: string;
  companyName: string;
  password?: string;
  isDemo?: boolean;
}): UserProfile {
  const id = uid('ceo');
  const now = new Date().toISOString();
  const passwordHash = params.password
    ? hashPassword(params.password)
    : `demo-account-disabled-password:${crypto.randomBytes(16).toString('hex')}`;

  db.prepare(
    `INSERT INTO users (id, name, email, company_name, password_hash, theme, is_demo, created_at)
     VALUES (?, ?, ?, ?, ?, 'dark', ?, ?)`
  ).run(id, params.name, params.email, params.companyName, passwordHash, params.isDemo ? 1 : 0, now);

  seedWorkspaceForUser(id);

  return {
    id,
    name: params.name,
    email: params.email,
    companyName: params.companyName,
    theme: 'dark',
    isDemo: Boolean(params.isDemo),
  };
}

export function getOrCreateDemoUser(): UserProfile {
  const existing = findUserByEmail('ceo@robotoffice.ai');
  if (existing) {
    return {
      id: existing.id,
      name: existing.name,
      email: existing.email,
      companyName: existing.company_name,
      theme: existing.theme,
      isDemo: true,
    };
  }
  return createUser({
    name: 'Alex Morgan (CEO)',
    email: 'ceo@robotoffice.ai',
    companyName: 'Robot Office HQ',
    isDemo: true,
  });
}

export function getOrCreateFirebaseUser(params: {
  uid: string;
  email: string;
  name?: string;
}): UserProfile {
  const byId = db
    .prepare(
      `SELECT id, name, email, company_name, theme, is_demo FROM users WHERE id = ?`
    )
    .get(params.uid) as
    | {
        id: string;
        name: string;
        email: string;
        company_name: string;
        theme: 'light' | 'dark';
        is_demo: number;
      }
    | undefined;

  if (byId) {
    return {
      id: byId.id,
      name: byId.name,
      email: byId.email,
      companyName: byId.company_name,
      theme: byId.theme,
      isDemo: byId.is_demo === 1,
    };
  }

  const byEmail = findUserByEmail(params.email);
  if (byEmail) {
    return {
      id: byEmail.id,
      name: byEmail.name,
      email: byEmail.email,
      companyName: byEmail.company_name,
      theme: byEmail.theme,
      isDemo: byEmail.is_demo === 1,
    };
  }

  const displayName =
    params.name?.trim() || params.email.split('@')[0] || 'Workspace CEO';
  const now = new Date().toISOString();
  const placeholderHash = `firebase-oauth:${crypto.randomBytes(16).toString('hex')}`;

  db.prepare(
    `INSERT INTO users (id, name, email, company_name, password_hash, theme, is_demo, created_at)
     VALUES (?, ?, ?, ?, ?, 'dark', 0, ?)`
  ).run(
    params.uid,
    displayName,
    params.email.toLowerCase(),
    'Robot Office HQ',
    placeholderHash,
    now
  );

  seedWorkspaceForUser(params.uid);

  return {
    id: params.uid,
    name: displayName,
    email: params.email.toLowerCase(),
    companyName: 'Robot Office HQ',
    theme: 'dark',
    isDemo: false,
  };
}

export function updateUserSettings(
  userId: string,
  updates: { theme?: 'light' | 'dark'; name?: string; companyName?: string }
): UserProfile | null {
  const current = db
    .prepare(`SELECT id, name, email, company_name, theme, is_demo FROM users WHERE id = ?`)
    .get(userId) as
    | {
        id: string;
        name: string;
        email: string;
        company_name: string;
        theme: 'light' | 'dark';
        is_demo: number;
      }
    | undefined;
  if (!current) return null;

  const nextTheme = updates.theme ?? current.theme;
  const nextName = updates.name?.trim() || current.name;
  const nextCompany = updates.companyName?.trim() || current.company_name;

  db.prepare(`UPDATE users SET theme = ?, name = ?, company_name = ? WHERE id = ?`).run(
    nextTheme,
    nextName,
    nextCompany,
    userId
  );

  return {
    id: current.id,
    name: nextName,
    email: current.email,
    companyName: nextCompany,
    theme: nextTheme,
    isDemo: current.is_demo === 1,
  };
}

export function seedWorkspaceForUser(userId: string): void {
  const now = Date.now();
  const isoOffset = (minutesAgo: number) => new Date(now - minutesAgo * 60_000).toISOString();
  const isoFuture = (hoursAhead: number) => new Date(now + hoursAhead * 3600_000).toISOString();

  const insertEmployee = db.prepare(
    `INSERT INTO employees (
      user_id, bot_id, status, enabled, current_task_id, current_task_title,
      system_prompt, permissions_json, tasks_completed, tasks_failed, avg_response_ms
    ) VALUES (?, ?, ?, 1, NULL, NULL, ?, ?, ?, 0, ?)`
  );

  const starterCompletedCounts: Record<BotId, number> = {
    alex: 14,
    emma: 28,
    max: 19,
    sophie: 22,
    charlie: 17,
  };

  for (const emp of DEFAULT_EMPLOYEES) {
    insertEmployee.run(
      userId,
      emp.id,
      'idle',
      emp.systemPrompt,
      JSON.stringify(emp.permissions),
      starterCompletedCounts[emp.id],
      emp.id === 'max' ? 2100 : 1250
    );
  }

  // Starter tasks
  const t1 = uid('task');
  const t2 = uid('task');
  const insertTask = db.prepare(
    `INSERT INTO tasks (
      id, user_id, title, description, assigned_to, created_by, status, priority,
      output, sources_json, collaboration_trace_json, parent_task_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`
  );

  insertTask.run(
    t1,
    userId,
    'Morning Executive Office Briefing',
    'Compile overnight email alerts, upcoming calendar conflicts, and deliverable status across all departments.',
    'alex',
    'ceo',
    'completed',
    'high',
    'Executive Summary:\n1. Critical P1 email from Apex Cloud Ops regarding API latency threshold requires quick sign-off.\n2. Sophie flagged a 30-minute overlap between Product Architecture Sync and Partner Demo tomorrow.\n3. Emma quarantined 1 suspicious phishing lure (P5) and prepared 2 response drafts awaiting CEO approval.',
    '[]',
    JSON.stringify([
      {
        stepNumber: 1,
        botId: 'alex',
        botName: 'Alex',
        action: 'Compiled cross-department telemetry and overnight priorities',
        status: 'completed',
        summary: 'Consolidated email triage, calendar checks, and pending approvals.',
        timestamp: isoOffset(42),
      },
    ]),
    isoOffset(45),
    isoOffset(42)
  );

  insertTask.run(
    t2,
    userId,
    'Draft Reply: Series A Partner Follow-Up',
    'Summarize partner partnership inquiry and prepare a professional response draft for CEO approval.',
    'emma',
    'alex',
    'waiting_approval',
    'high',
    'Draft reply prepared for Elena Vance (Horizon Ventures) confirming Thursday availability and attaching the Q4 product roadmap summary.',
    '[]',
    JSON.stringify([
      {
        stepNumber: 1,
        botId: 'emma',
        botName: 'Emma',
        action: 'Classified message as P2 Important and generated executive reply draft',
        status: 'waiting_approval',
        summary: 'Held before sending per Email Safety Policy.',
        timestamp: isoOffset(18),
      },
    ]),
    isoOffset(20),
    isoOffset(18)
  );

  // Starter emails
  const insertEmail = db.prepare(
    `INSERT INTO emails (
      id, user_id, provider, sender_name, sender_email, subject, body,
      priority, category, phishing_flag, phishing_reason, ai_summary, draft_reply, status, received_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  insertEmail.run(
    uid('mail'),
    userId,
    'gmail',
    'Marcus Chen',
    'm.chen@apexcloud.io',
    'URGENT: Production webhook latency spike on EU-West gateway',
    'Hi CEO, our EU-West gateway crossed the 900ms SLA alert threshold 12 minutes ago. Engineering isolated the connection pool bottleneck and needs your sign-off to fail over traffic to EU-Central.',
    'P1',
    'Critical Operations',
    0,
    null,
    'EU-West gateway exceeded 900ms latency SLA; engineering requests authorization to fail over to EU-Central.',
    'Approved for immediate failover to EU-Central. Please share post-incident telemetry within 30 minutes.',
    'pending_approval',
    isoOffset(35)
  );

  insertEmail.run(
    uid('mail'),
    userId,
    'outlook',
    'Elena Vance',
    'elena@horizonvc.com',
    'Q4 Partnership Proposal & Board Follow-up',
    'Great speaking earlier this week. Could we confirm a 30-minute review of the Q4 partnership proposal and distribution terms this Thursday afternoon?',
    'P2',
    'Business & Clients',
    0,
    null,
    'Horizon Ventures requests a 30-minute Q4 partnership review meeting on Thursday afternoon.',
    'Hi Elena, Thursday afternoon works well for our team. I have asked Sophie to coordinate a 30-minute calendar invitation once confirmed.',
    'pending_approval',
    isoOffset(90)
  );

  insertEmail.run(
    uid('mail'),
    userId,
    'gmail',
    'Account Security Notice',
    'alerts@verify-login-portal.xyz',
    'Urgent: verify your corporate bank password immediately',
    'Your corporate account is suspended. Click here immediately to verify your bank password and avoid lockout: http://bit.ly/reset-corp-login',
    'P5',
    'Spam / Suspicious',
    1,
    'Suspicious external .xyz domain with shortened link and urgent credential lure.',
    'Quarantined phishing attempt impersonating corporate banking security.',
    null,
    'triaged',
    isoOffset(120)
  );

  insertEmail.run(
    uid('mail'),
    userId,
    'outlook',
    'SaaS Weekly Digest',
    'digest@saasbrief.io',
    'Weekly AI Operations Roundup & Benchmark Notes',
    'This week in enterprise automation: multi-agent orchestration benchmarks, workflow latency trends, and editorial highlights.',
    'P4',
    'Newsletters & Digests',
    0,
    null,
    null,
    null,
    'unread',
    isoOffset(180)
  );

  // Starter calendar events (including an intentional conflict for Sophie!)
  const ev1 = uid('cal');
  const ev2 = uid('cal');
  const ev3 = uid('cal');
  const insertCal = db.prepare(
    `INSERT INTO calendar_events (
      id, user_id, title, start_iso, end_iso, attendees_json, location, notes, status, conflict_with_id, created_by_bot
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const start1 = isoFuture(2);
  const end1 = isoFuture(3);
  const start2 = isoFuture(2.5);
  const end2 = isoFuture(3.5);
  const start3 = isoFuture(24);
  const end3 = isoFuture(25);

  insertCal.run(
    ev1,
    userId,
    'Executive Product Architecture Sync',
    start1,
    end1,
    JSON.stringify(['ceo@robotoffice.ai', 'cto@company.com']),
    'Virtual Meeting Room A',
    'Review Q4 robotics automation milestones.',
    'confirmed',
    null,
    0
  );

  insertCal.run(
    ev2,
    userId,
    'Enterprise Partner Discovery Call',
    start2,
    end2,
    JSON.stringify(['ceo@robotoffice.ai', 'partners@acme.io']),
    'Google Meet',
    'Sophie detected a 30-minute overlap with Product Architecture Sync.',
    'conflict',
    ev1,
    1
  );

  insertCal.run(
    ev3,
    userId,
    'Board Strategy & Metrics Review',
    start3,
    end3,
    JSON.stringify(['ceo@robotoffice.ai', 'board@company.com']),
    'Main CEO Office',
    'Quarterly KPI review prepared by Alex & Charlie.',
    'confirmed',
    null,
    0
  );

  // Starter approvals
  const insertApproval = db.prepare(
    `INSERT INTO approvals (
      id, user_id, task_id, bot_id, action_type, title, summary, payload_json, status, decision_note, created_at, decided_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL)`
  );

  insertApproval.run(
    uid('apr'),
    userId,
    t2,
    'emma',
    'send_email',
    'Send P2 Email Reply to Elena Vance (Horizon Ventures)',
    'Emma drafted a response confirming Thursday availability for the Q4 partnership proposal review.',
    JSON.stringify({
      to: 'elena@horizonvc.com',
      subject: 'Re: Q4 Partnership Proposal & Board Follow-up',
      body: 'Hi Elena, Thursday afternoon works well for our team. I have asked Sophie to coordinate a 30-minute calendar invitation once confirmed.',
    }),
    'pending',
    isoOffset(18)
  );

  insertApproval.run(
    uid('apr'),
    userId,
    null,
    'sophie',
    'send_invite',
    'Reschedule & Send Invite: Enterprise Partner Discovery Call',
    'Sophie detected a conflict at the original slot and proposes moving the partner invite 1 hour later.',
    JSON.stringify({
      attendees: ['partners@acme.io'],
      proposedStart: isoFuture(4),
      proposedEnd: isoFuture(5),
      location: 'Google Meet',
    }),
    'pending',
    isoOffset(12)
  );

  // Starter logs
  const insertLog = db.prepare(
    `INSERT INTO automation_logs (
      id, user_id, workflow_name, bot_id, event_type, message, details, status, duration_ms, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  insertLog.run(
    uid('log'),
    userId,
    'Workflow 1: Alex Orchestrator',
    'alex',
    'orchestration',
    'Generated morning executive operations briefing',
    'Reviewed 4 inbox threads, 3 upcoming meetings, and 2 pending CEO approvals.',
    'success',
    1180,
    isoOffset(42)
  );
  insertLog.run(
    uid('log'),
    userId,
    'Workflow 2: Emma Email Management',
    'emma',
    'execution',
    'Quarantined P5 phishing attempt from alerts@verify-login-portal.xyz',
    'Matched credential lure & URL shortener indicators; held without deleting.',
    'success',
    640,
    isoOffset(30)
  );
  insertLog.run(
    uid('log'),
    userId,
    'Workflow 4: Sophie Calendar Management',
    'sophie',
    'execution',
    'Flagged 30-minute scheduling overlap and queued reschedule invite for approval',
    'Overlap detected between Executive Product Architecture Sync and Enterprise Partner Discovery Call.',
    'pending',
    520,
    isoOffset(12)
  );

  // Starter notifications
  const insertNotif = db.prepare(
    `INSERT INTO notifications (id, user_id, type, title, message, bot_id, read, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?)`
  );
  insertNotif.run(
    uid('notif'),
    userId,
    'email',
    'P1 Critical Email Detected',
    'Marcus Chen (Apex Cloud) requested failover sign-off for EU-West gateway latency.',
    'emma',
    isoOffset(35)
  );
  insertNotif.run(
    uid('notif'),
    userId,
    'approval',
    '2 Actions Awaiting CEO Approval',
    'Emma (email reply) and Sophie (meeting reschedule invite) are waiting in the Approval Center.',
    'alex',
    isoOffset(12)
  );

  // Starter integrations
  const insertIntegration = db.prepare(
    `INSERT INTO integrations (user_id, id, name, category, connected, endpoint_url, account_label, secret_value, last_tested_at, last_status)
     VALUES (?, ?, ?, ?, ?, '', ?, '', NULL, ?)`
  );
  const starterIntegrations = [
    ['n8n_alex', 'n8n Workflow 1 — Alex Orchestrator', 'automation', 0, 'Webhook not configured', 'Setup Required'],
    ['n8n_emma', 'n8n Workflow 2 — Emma Email Management', 'automation', 0, 'Webhook not configured', 'Setup Required'],
    ['n8n_max', 'n8n Workflow 3 — Max Research Assistant', 'automation', 0, 'Webhook not configured', 'Setup Required'],
    ['n8n_sophie', 'n8n Workflow 4 — Sophie Calendar Management', 'automation', 0, 'Webhook not configured', 'Setup Required'],
    ['n8n_charlie', 'n8n Workflow 5 — Charlie Content & Admin', 'automation', 0, 'Webhook not configured', 'Setup Required'],
    ['gmail', 'Gmail Workspace Mailbox', 'email', 0, 'Sandbox Inbox Active (Connect live account)', 'Sandbox Mode'],
    ['outlook', 'Microsoft Outlook Mail', 'email', 0, 'Sandbox Inbox Active (Connect live account)', 'Sandbox Mode'],
    ['google_calendar', 'Google Calendar', 'calendar', 0, 'Sandbox Calendar Active (Connect live account)', 'Sandbox Mode'],
    ['google_drive', 'Google Drive Storage', 'storage', 0, 'Not connected', 'Setup Required'],
    ['telegram', 'Telegram CEO Alerts Bot', 'messaging', 0, 'Not configured', 'Setup Required'],
    ['slack', 'Slack Team Bridge', 'messaging', 0, 'Not configured', 'Setup Required'],
  ] as const;

  for (const [id, name, category, connected, accountLabel, lastStatus] of starterIntegrations) {
    insertIntegration.run(userId, id, name, category, connected, accountLabel, lastStatus);
  }

  // Starter welcome command chat message
  db.prepare(
    `INSERT INTO chat_messages (id, user_id, channel, sender, text, metadata_json, created_at)
     VALUES (?, ?, 'command', 'alex', ?, ?, ?)`
  ).run(
    uid('msg'),
    userId,
    'Good morning, CEO. All five AI employees are stationed and ready. Emma flagged 1 P1 critical email and 1 phishing attempt, Sophie detected a scheduling conflict, and 2 items await your approval. Give me any directive to orchestrate the team.',
    JSON.stringify({ delegatedBots: ['emma', 'sophie'] }),
    isoOffset(10)
  );
}

export function getEmployeesForUser(userId: string): EmployeeProfile[] {
  const rows = db
    .prepare(`SELECT * FROM employees WHERE user_id = ?`)
    .all(userId) as Array<{
    bot_id: BotId;
    status: BotStatus;
    enabled: number;
    current_task_id: string | null;
    current_task_title: string | null;
    system_prompt: string;
    permissions_json: string;
    tasks_completed: number;
    tasks_failed: number;
    avg_response_ms: number;
  }>;

  const byId = new Map(rows.map((r) => [r.bot_id, r]));
  return DEFAULT_EMPLOYEES.map((def) => {
    const row = byId.get(def.id);
    return {
      ...def,
      status: row?.status ?? 'idle',
      enabled: row ? row.enabled === 1 : true,
      currentTaskId: row?.current_task_id ?? null,
      currentTaskTitle: row?.current_task_title ?? null,
      systemPrompt: row?.system_prompt ?? def.systemPrompt,
      permissions: row ? (JSON.parse(row.permissions_json) as EmployeePermissions) : def.permissions,
      tasksCompleted: row?.tasks_completed ?? 0,
      tasksFailed: row?.tasks_failed ?? 0,
      avgResponseMs: row?.avg_response_ms ?? 1200,
    };
  });
}

export function updateEmployeeState(
  userId: string,
  botId: BotId,
  updates: {
    status?: BotStatus;
    enabled?: boolean;
    currentTaskId?: string | null;
    currentTaskTitle?: string | null;
    systemPrompt?: string;
    permissions?: EmployeePermissions;
    incrementCompleted?: boolean;
    incrementFailed?: boolean;
    lastResponseMs?: number;
  }
): void {
  const row = db
    .prepare(`SELECT * FROM employees WHERE user_id = ? AND bot_id = ?`)
    .get(userId, botId) as
    | {
        status: BotStatus;
        enabled: number;
        current_task_id: string | null;
        current_task_title: string | null;
        system_prompt: string;
        permissions_json: string;
        tasks_completed: number;
        tasks_failed: number;
        avg_response_ms: number;
      }
    | undefined;
  if (!row) return;

  const nextEnabled = updates.enabled !== undefined ? (updates.enabled ? 1 : 0) : row.enabled;
  const nextStatus =
    updates.status !== undefined
      ? updates.status
      : updates.enabled === false
        ? 'paused'
        : updates.enabled === true && row.status === 'paused'
          ? 'idle'
          : row.status;
  const nextTaskId = updates.currentTaskId !== undefined ? updates.currentTaskId : row.current_task_id;
  const nextTaskTitle =
    updates.currentTaskTitle !== undefined ? updates.currentTaskTitle : row.current_task_title;
  const nextPrompt = updates.systemPrompt !== undefined ? updates.systemPrompt : row.system_prompt;
  const nextPerms =
    updates.permissions !== undefined ? JSON.stringify(updates.permissions) : row.permissions_json;
  const nextCompleted = row.tasks_completed + (updates.incrementCompleted ? 1 : 0);
  const nextFailed = row.tasks_failed + (updates.incrementFailed ? 1 : 0);
  const nextAvg =
    updates.lastResponseMs !== undefined
      ? Math.round((row.avg_response_ms * 3 + updates.lastResponseMs) / 4)
      : row.avg_response_ms;

  db.prepare(
    `UPDATE employees
     SET status = ?, enabled = ?, current_task_id = ?, current_task_title = ?,
         system_prompt = ?, permissions_json = ?, tasks_completed = ?, tasks_failed = ?, avg_response_ms = ?
     WHERE user_id = ? AND bot_id = ?`
  ).run(
    nextStatus,
    nextEnabled,
    nextTaskId,
    nextTaskTitle,
    nextPrompt,
    nextPerms,
    nextCompleted,
    nextFailed,
    nextAvg,
    userId,
    botId
  );
}

export function createTask(params: {
  userId: string;
  title: string;
  description: string;
  assignedTo: BotId;
  createdBy: 'ceo' | BotId;
  status?: TaskStatus;
  priority?: 'critical' | 'high' | 'normal' | 'low';
  output?: string;
  sources?: SourceCitation[];
  collaborationTrace?: CollaborationStep[];
  parentTaskId?: string | null;
}): TaskRecord {
  const id = uid('task');
  const now = new Date().toISOString();
  const status = params.status ?? 'queued';
  const priority = params.priority ?? 'normal';
  const output = params.output ?? '';
  const sources = params.sources ?? [];
  const trace = params.collaborationTrace ?? [];

  db.prepare(
    `INSERT INTO tasks (
      id, user_id, title, description, assigned_to, created_by, status, priority,
      output, sources_json, collaboration_trace_json, parent_task_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    params.userId,
    params.title,
    params.description,
    params.assignedTo,
    params.createdBy,
    status,
    priority,
    output,
    JSON.stringify(sources),
    JSON.stringify(trace),
    params.parentTaskId ?? null,
    now,
    now
  );

  return {
    id,
    title: params.title,
    description: params.description,
    assignedTo: params.assignedTo,
    createdBy: params.createdBy,
    status,
    priority,
    output,
    sources,
    collaborationTrace: trace,
    parentTaskId: params.parentTaskId ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

export function updateTask(
  userId: string,
  taskId: string,
  updates: {
    status?: TaskStatus;
    output?: string;
    sources?: SourceCitation[];
    collaborationTrace?: CollaborationStep[];
  }
): TaskRecord | null {
  const row = db
    .prepare(`SELECT * FROM tasks WHERE id = ? AND user_id = ?`)
    .get(taskId, userId) as
    | {
        id: string;
        title: string;
        description: string;
        assigned_to: BotId;
        created_by: 'ceo' | BotId;
        status: TaskStatus;
        priority: 'critical' | 'high' | 'normal' | 'low';
        output: string;
        sources_json: string;
        collaboration_trace_json: string;
        parent_task_id: string | null;
        created_at: string;
        updated_at: string;
      }
    | undefined;
  if (!row) return null;

  const nextStatus = updates.status ?? row.status;
  const nextOutput = updates.output !== undefined ? updates.output : row.output;
  const nextSources =
    updates.sources !== undefined ? JSON.stringify(updates.sources) : row.sources_json;
  const nextTrace =
    updates.collaborationTrace !== undefined
      ? JSON.stringify(updates.collaborationTrace)
      : row.collaboration_trace_json;
  const now = new Date().toISOString();

  db.prepare(
    `UPDATE tasks SET status = ?, output = ?, sources_json = ?, collaboration_trace_json = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`
  ).run(nextStatus, nextOutput, nextSources, nextTrace, now, taskId, userId);

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    assignedTo: row.assigned_to,
    createdBy: row.created_by,
    status: nextStatus,
    priority: row.priority,
    output: nextOutput,
    sources: JSON.parse(nextSources) as SourceCitation[],
    collaborationTrace: JSON.parse(nextTrace) as CollaborationStep[],
    parentTaskId: row.parent_task_id,
    createdAt: row.created_at,
    updatedAt: now,
  };
}

export function createApproval(params: {
  userId: string;
  taskId: string | null;
  botId: BotId;
  actionType: ApprovalActionType;
  title: string;
  summary: string;
  payload: Record<string, unknown>;
}): ApprovalRecord {
  const id = uid('apr');
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO approvals (id, user_id, task_id, bot_id, action_type, title, summary, payload_json, status, decision_note, created_at, decided_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL, ?, NULL)`
  ).run(
    id,
    params.userId,
    params.taskId,
    params.botId,
    params.actionType,
    params.title,
    params.summary,
    JSON.stringify(params.payload),
    now
  );

  return {
    id,
    taskId: params.taskId,
    botId: params.botId,
    actionType: params.actionType,
    title: params.title,
    summary: params.summary,
    payload: params.payload,
    status: 'pending',
    decisionNote: null,
    createdAt: now,
    decidedAt: null,
  };
}

export function decideApproval(
  userId: string,
  approvalId: string,
  decision: 'approved' | 'rejected',
  note: string | null
): ApprovalRecord | null {
  const row = db
    .prepare(`SELECT * FROM approvals WHERE id = ? AND user_id = ?`)
    .get(approvalId, userId) as
    | {
        id: string;
        task_id: string | null;
        bot_id: BotId;
        action_type: ApprovalActionType;
        title: string;
        summary: string;
        payload_json: string;
        status: ApprovalStatus;
        decision_note: string | null;
        created_at: string;
        decided_at: string | null;
      }
    | undefined;
  if (!row) return null;

  const now = new Date().toISOString();
  db.prepare(
    `UPDATE approvals SET status = ?, decision_note = ?, decided_at = ? WHERE id = ? AND user_id = ?`
  ).run(decision, note, now, approvalId, userId);

  if (row.task_id) {
    updateTask(userId, row.task_id, {
      status: decision === 'approved' ? 'completed' : 'cancelled',
    });
    updateEmployeeState(userId, row.bot_id, {
      status: decision === 'approved' ? 'completed' : 'idle',
      currentTaskId: null,
      currentTaskTitle: null,
      incrementCompleted: decision === 'approved',
    });
  }

  return {
    id: row.id,
    taskId: row.task_id,
    botId: row.bot_id,
    actionType: row.action_type,
    title: row.title,
    summary: row.summary,
    payload: JSON.parse(row.payload_json) as Record<string, unknown>,
    status: decision,
    decisionNote: note,
    createdAt: row.created_at,
    decidedAt: now,
  };
}

export function addAutomationLog(params: {
  userId: string;
  workflowName: string;
  botId: BotId;
  eventType: AutomationLog['eventType'];
  message: string;
  details?: string | null;
  status: AutomationLog['status'];
  durationMs?: number;
}): AutomationLog {
  const id = uid('log');
  const now = new Date().toISOString();
  const durationMs = params.durationMs ?? 0;
  db.prepare(
    `INSERT INTO automation_logs (id, user_id, workflow_name, bot_id, event_type, message, details, status, duration_ms, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    params.userId,
    params.workflowName,
    params.botId,
    params.eventType,
    params.message,
    params.details ?? null,
    params.status,
    durationMs,
    now
  );

  return {
    id,
    workflowName: params.workflowName,
    botId: params.botId,
    eventType: params.eventType,
    message: params.message,
    details: params.details ?? null,
    status: params.status,
    durationMs,
    createdAt: now,
  };
}

export function addNotification(params: {
  userId: string;
  type: NotificationItem['type'];
  title: string;
  message: string;
  botId?: BotId | null;
}): NotificationItem {
  const id = uid('notif');
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO notifications (id, user_id, type, title, message, bot_id, read, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?)`
  ).run(id, params.userId, params.type, params.title, params.message, params.botId ?? null, now);

  return {
    id,
    type: params.type,
    title: params.title,
    message: params.message,
    botId: params.botId ?? null,
    read: false,
    createdAt: now,
  };
}

export function markAllNotificationsRead(userId: string): void {
  db.prepare(`UPDATE notifications SET read = 1 WHERE user_id = ?`).run(userId);
}

export function addChatMessage(params: {
  userId: string;
  channel: 'command' | BotId;
  sender: 'ceo' | BotId | 'system';
  text: string;
  metadata?: ChatMessage['metadata'];
}): ChatMessage {
  const id = uid('msg');
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO chat_messages (id, user_id, channel, sender, text, metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    params.userId,
    params.channel,
    params.sender,
    params.text,
    params.metadata ? JSON.stringify(params.metadata) : null,
    now
  );

  return {
    id,
    channel: params.channel,
    sender: params.sender,
    text: params.text,
    metadata: params.metadata,
    createdAt: now,
  };
}

export function addEmailItem(params: {
  userId: string;
  provider: 'gmail' | 'outlook';
  senderName: string;
  senderEmail: string;
  subject: string;
  body: string;
  priority: InboxEmail['priority'];
  category: string;
  phishingFlag: boolean;
  phishingReason: string | null;
  aiSummary?: string | null;
  draftReply?: string | null;
  status?: InboxEmail['status'];
}): InboxEmail {
  const id = uid('mail');
  const now = new Date().toISOString();
  const status = params.status ?? 'unread';
  db.prepare(
    `INSERT INTO emails (
      id, user_id, provider, sender_name, sender_email, subject, body,
      priority, category, phishing_flag, phishing_reason, ai_summary, draft_reply, status, received_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    params.userId,
    params.provider,
    params.senderName,
    params.senderEmail,
    params.subject,
    params.body,
    params.priority,
    params.category,
    params.phishingFlag ? 1 : 0,
    params.phishingReason,
    params.aiSummary ?? null,
    params.draftReply ?? null,
    status,
    now
  );

  return {
    id,
    provider: params.provider,
    senderName: params.senderName,
    senderEmail: params.senderEmail,
    subject: params.subject,
    body: params.body,
    priority: params.priority,
    category: params.category,
    phishingFlag: params.phishingFlag,
    phishingReason: params.phishingReason,
    aiSummary: params.aiSummary ?? null,
    draftReply: params.draftReply ?? null,
    status,
    receivedAt: now,
  };
}

export function updateEmailAnalysis(
  userId: string,
  emailId: string,
  updates: {
    priority?: InboxEmail['priority'];
    category?: string;
    phishingFlag?: boolean;
    phishingReason?: string | null;
    aiSummary?: string | null;
    draftReply?: string | null;
    status?: InboxEmail['status'];
  }
): void {
  const row = db
    .prepare(`SELECT * FROM emails WHERE id = ? AND user_id = ?`)
    .get(emailId, userId) as
    | {
        priority: InboxEmail['priority'];
        category: string;
        phishing_flag: number;
        phishing_reason: string | null;
        ai_summary: string | null;
        draft_reply: string | null;
        status: InboxEmail['status'];
      }
    | undefined;
  if (!row) return;

  db.prepare(
    `UPDATE emails
     SET priority = ?, category = ?, phishing_flag = ?, phishing_reason = ?, ai_summary = ?, draft_reply = ?, status = ?
     WHERE id = ? AND user_id = ?`
  ).run(
    updates.priority ?? row.priority,
    updates.category ?? row.category,
    updates.phishingFlag !== undefined ? (updates.phishingFlag ? 1 : 0) : row.phishing_flag,
    updates.phishingReason !== undefined ? updates.phishingReason : row.phishing_reason,
    updates.aiSummary !== undefined ? updates.aiSummary : row.ai_summary,
    updates.draftReply !== undefined ? updates.draftReply : row.draft_reply,
    updates.status ?? row.status,
    emailId,
    userId
  );
}

export function addCalendarEvent(params: {
  userId: string;
  title: string;
  startIso: string;
  endIso: string;
  attendees: string[];
  location: string;
  notes: string;
  createdByBot: boolean;
  requiresApproval?: boolean;
}): CalendarEvent {
  const existingRows = db
    .prepare(`SELECT id, title, start_iso, end_iso, status FROM calendar_events WHERE user_id = ?`)
    .all(params.userId) as Array<{
    id: string;
    title: string;
    start_iso: string;
    end_iso: string;
    status: CalendarEvent['status'];
  }>;

  const conflicts = detectCalendarConflicts(
    existingRows.map((r) => ({
      id: r.id,
      title: r.title,
      startIso: r.start_iso,
      endIso: r.end_iso,
      status: r.status,
    })),
    params.startIso,
    params.endIso
  );

  const id = uid('cal');
  const status: CalendarEvent['status'] =
    conflicts.length > 0
      ? 'conflict'
      : params.requiresApproval
        ? 'pending_approval'
        : 'confirmed';

  db.prepare(
    `INSERT INTO calendar_events (
      id, user_id, title, start_iso, end_iso, attendees_json, location, notes, status, conflict_with_id, created_by_bot
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    params.userId,
    params.title,
    params.startIso,
    params.endIso,
    JSON.stringify(params.attendees),
    params.location,
    params.notes,
    status,
    conflicts[0] ?? null,
    params.createdByBot ? 1 : 0
  );

  return {
    id,
    title: params.title,
    startIso: params.startIso,
    endIso: params.endIso,
    attendees: params.attendees,
    location: params.location,
    notes: params.notes,
    status,
    conflictWithId: conflicts[0] ?? null,
    createdByBot: params.createdByBot,
  };
}

export function updateIntegration(
  userId: string,
  integrationId: string,
  updates: {
    connected?: boolean;
    endpointUrl?: string;
    accountLabel?: string;
    secretValue?: string;
    lastTestedAt?: string | null;
    lastStatus?: string | null;
  }
): IntegrationConfig | null {
  const row = db
    .prepare(`SELECT * FROM integrations WHERE user_id = ? AND id = ?`)
    .get(userId, integrationId) as
    | {
        id: string;
        name: string;
        category: IntegrationConfig['category'];
        connected: number;
        endpoint_url: string;
        account_label: string;
        secret_value: string;
        last_tested_at: string | null;
        last_status: string | null;
      }
    | undefined;
  if (!row) return null;

  const connected = updates.connected !== undefined ? (updates.connected ? 1 : 0) : row.connected;
  const endpointUrl = updates.endpointUrl !== undefined ? updates.endpointUrl : row.endpoint_url;
  const accountLabel =
    updates.accountLabel !== undefined ? updates.accountLabel : row.account_label;
  const secretValue = updates.secretValue !== undefined ? updates.secretValue : row.secret_value;
  const lastTestedAt =
    updates.lastTestedAt !== undefined ? updates.lastTestedAt : row.last_tested_at;
  const lastStatus = updates.lastStatus !== undefined ? updates.lastStatus : row.last_status;

  db.prepare(
    `UPDATE integrations
     SET connected = ?, endpoint_url = ?, account_label = ?, secret_value = ?, last_tested_at = ?, last_status = ?
     WHERE user_id = ? AND id = ?`
  ).run(
    connected,
    endpointUrl,
    accountLabel,
    secretValue,
    lastTestedAt,
    lastStatus,
    userId,
    integrationId
  );

  return {
    id: row.id,
    name: row.name,
    category: row.category,
    connected: connected === 1,
    endpointUrl,
    accountLabel,
    lastTestedAt,
    lastStatus,
  };
}

export function getIntegrationSecret(userId: string, integrationId: string): string {
  const row = db
    .prepare(`SELECT secret_value FROM integrations WHERE user_id = ? AND id = ?`)
    .get(userId, integrationId) as { secret_value: string } | undefined;
  return row?.secret_value ?? '';
}

export function getIntegrationsForUser(userId: string): IntegrationConfig[] {
  const rows = db
    .prepare(`SELECT * FROM integrations WHERE user_id = ? ORDER BY category, id`)
    .all(userId) as Array<{
    id: string;
    name: string;
    category: IntegrationConfig['category'];
    connected: number;
    endpoint_url: string;
    account_label: string;
    last_tested_at: string | null;
    last_status: string | null;
  }>;

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    connected: r.connected === 1,
    endpointUrl: r.endpoint_url,
    accountLabel: r.account_label,
    lastTestedAt: r.last_tested_at,
    lastStatus: r.last_status,
  }));
}

export function getWorkspacePayload(user: UserProfile): WorkspacePayload {
  const employees = getEmployeesForUser(user.id);

  const taskRows = db
    .prepare(`SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`)
    .all(user.id) as Array<{
    id: string;
    title: string;
    description: string;
    assigned_to: BotId;
    created_by: 'ceo' | BotId;
    status: TaskStatus;
    priority: 'critical' | 'high' | 'normal' | 'low';
    output: string;
    sources_json: string;
    collaboration_trace_json: string;
    parent_task_id: string | null;
    created_at: string;
    updated_at: string;
  }>;

  const tasks: TaskRecord[] = taskRows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    assignedTo: r.assigned_to,
    createdBy: r.created_by,
    status: r.status,
    priority: r.priority,
    output: r.output,
    sources: JSON.parse(r.sources_json) as SourceCitation[],
    collaborationTrace: JSON.parse(r.collaboration_trace_json) as CollaborationStep[],
    parentTaskId: r.parent_task_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));

  const approvalRows = db
    .prepare(`SELECT * FROM approvals WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`)
    .all(user.id) as Array<{
    id: string;
    task_id: string | null;
    bot_id: BotId;
    action_type: ApprovalActionType;
    title: string;
    summary: string;
    payload_json: string;
    status: ApprovalStatus;
    decision_note: string | null;
    created_at: string;
    decided_at: string | null;
  }>;

  const approvals: ApprovalRecord[] = approvalRows.map((r) => ({
    id: r.id,
    taskId: r.task_id,
    botId: r.bot_id,
    actionType: r.action_type,
    title: r.title,
    summary: r.summary,
    payload: JSON.parse(r.payload_json) as Record<string, unknown>,
    status: r.status,
    decisionNote: r.decision_note,
    createdAt: r.created_at,
    decidedAt: r.decided_at,
  }));

  const emailRows = db
    .prepare(`SELECT * FROM emails WHERE user_id = ? ORDER BY received_at DESC LIMIT 100`)
    .all(user.id) as Array<{
    id: string;
    provider: 'gmail' | 'outlook';
    sender_name: string;
    sender_email: string;
    subject: string;
    body: string;
    priority: InboxEmail['priority'];
    category: string;
    phishing_flag: number;
    phishing_reason: string | null;
    ai_summary: string | null;
    draft_reply: string | null;
    status: InboxEmail['status'];
    received_at: string;
  }>;

  const emails: InboxEmail[] = emailRows.map((r) => ({
    id: r.id,
    provider: r.provider,
    senderName: r.sender_name,
    senderEmail: r.sender_email,
    subject: r.subject,
    body: r.body,
    priority: r.priority,
    category: r.category,
    phishingFlag: r.phishing_flag === 1,
    phishingReason: r.phishing_reason,
    aiSummary: r.ai_summary,
    draftReply: r.draft_reply,
    status: r.status,
    receivedAt: r.received_at,
  }));

  const calRows = db
    .prepare(`SELECT * FROM calendar_events WHERE user_id = ? ORDER BY start_iso ASC LIMIT 100`)
    .all(user.id) as Array<{
    id: string;
    title: string;
    start_iso: string;
    end_iso: string;
    attendees_json: string;
    location: string;
    notes: string;
    status: CalendarEvent['status'];
    conflict_with_id: string | null;
    created_by_bot: number;
  }>;

  const calendarEvents: CalendarEvent[] = calRows.map((r) => ({
    id: r.id,
    title: r.title,
    startIso: r.start_iso,
    endIso: r.end_iso,
    attendees: JSON.parse(r.attendees_json) as string[],
    location: r.location,
    notes: r.notes,
    status: r.status,
    conflictWithId: r.conflict_with_id,
    createdByBot: r.created_by_bot === 1,
  }));

  const logRows = db
    .prepare(`SELECT * FROM automation_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 150`)
    .all(user.id) as Array<{
    id: string;
    workflow_name: string;
    bot_id: BotId;
    event_type: AutomationLog['eventType'];
    message: string;
    details: string | null;
    status: AutomationLog['status'];
    duration_ms: number;
    created_at: string;
  }>;

  const logs: AutomationLog[] = logRows.map((r) => ({
    id: r.id,
    workflowName: r.workflow_name,
    botId: r.bot_id,
    eventType: r.event_type,
    message: r.message,
    details: r.details,
    status: r.status,
    durationMs: r.duration_ms,
    createdAt: r.created_at,
  }));

  const notifRows = db
    .prepare(`SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`)
    .all(user.id) as Array<{
    id: string;
    type: NotificationItem['type'];
    title: string;
    message: string;
    bot_id: BotId | null;
    read: number;
    created_at: string;
  }>;

  const notifications: NotificationItem[] = notifRows.map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    message: r.message,
    botId: r.bot_id,
    read: r.read === 1,
    createdAt: r.created_at,
  }));

  const integrations = getIntegrationsForUser(user.id);

  const chatRows = db
    .prepare(`SELECT * FROM chat_messages WHERE user_id = ? ORDER BY created_at ASC LIMIT 200`)
    .all(user.id) as Array<{
    id: string;
    channel: 'command' | BotId;
    sender: 'ceo' | BotId | 'system';
    text: string;
    metadata_json: string | null;
    created_at: string;
  }>;

  const chatMessages: ChatMessage[] = chatRows.map((r) => ({
    id: r.id,
    channel: r.channel,
    sender: r.sender,
    text: r.text,
    metadata: r.metadata_json ? (JSON.parse(r.metadata_json) as ChatMessage['metadata']) : undefined,
    createdAt: r.created_at,
  }));

  const metrics = deriveOfficeMetrics(tasks, approvals, emails, calendarEvents);

  return {
    user,
    employees,
    tasks,
    approvals,
    emails,
    calendarEvents,
    logs,
    notifications,
    integrations,
    chatMessages,
    metrics,
  };
}
