import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_EMPLOYEES,
  classifyEmailPriority,
  detectCalendarConflicts,
  deriveOfficeMetrics,
  parseCommandRouting,
  validateWebhookUrl,
} from './officeLogic';
import {
  SERVICE_CATALOG,
  buildSandboxExecutionPreview,
  canEmployeeUseConnector,
  evaluateTokenExpirationStatus,
  hasActiveWorkflowDependency,
  isAllowedPostMessageOrigin,
  maskCredentialValue,
  normalizeMicrosoftTenantId,
} from './connectorLogic';
import type {
  ApprovalRecord,
  CalendarEvent,
  EmployeeConnectorPermissionView,
  InboxEmail,
  TaskRecord,
} from './types';

test('classifyEmailPriority assigns P5 and phishingFlag on suspicious lures', () => {
  const res = classifyEmailPriority(
    'Urgent: verify your bank password immediately',
    'Click here to avoid suspension: http://bit.ly/reset',
    'support@verify-login.xyz'
  );
  assert.equal(res.priority, 'P5');
  assert.equal(res.phishingFlag, true);
});

test('classifyEmailPriority assigns P1 for critical operations and P2 for client proposals', () => {
  const p1 = classifyEmailPriority(
    'Production outage on EU cluster',
    'Need urgent escalation ASAP.',
    'ops@company.com'
  );
  assert.equal(p1.priority, 'P1');
  assert.equal(p1.phishingFlag, false);

  const p2 = classifyEmailPriority(
    'Q4 Partnership Proposal Review',
    'Please review the attached client contract timeline.',
    'partner@acme.io'
  );
  assert.equal(p2.priority, 'P2');
});

test('detectCalendarConflicts detects overlapping intervals and ignores non-overlapping or cancelled events', () => {
  const existing: Pick<CalendarEvent, 'id' | 'title' | 'startIso' | 'endIso' | 'status'>[] = [
    {
      id: 'ev1',
      title: 'Board Sync',
      startIso: '2026-11-24T10:00:00Z',
      endIso: '2026-11-24T11:00:00Z',
      status: 'confirmed',
    },
    {
      id: 'ev2',
      title: 'Cancelled Sync',
      startIso: '2026-11-24T10:15:00Z',
      endIso: '2026-11-24T10:45:00Z',
      status: 'cancelled',
    },
  ];

  const overlap = detectCalendarConflicts(
    existing,
    '2026-11-24T10:30:00Z',
    '2026-11-24T11:30:00Z'
  );
  assert.deepEqual(overlap, ['ev1']);

  const clear = detectCalendarConflicts(
    existing,
    '2026-11-24T11:00:00Z',
    '2026-11-24T12:00:00Z'
  );
  assert.deepEqual(clear, []);
});

test('parseCommandRouting identifies multi-bot ocean YouTube workflow (Max -> Charlie)', () => {
  const plan = parseCommandRouting(
    'Create a YouTube video about interesting facts about the ocean.'
  );
  assert.equal(plan.isMultiBot, true);
  assert.deepEqual(plan.pipeline, ['max', 'charlie']);
  assert.equal(plan.requiresApproval, true);
});

test('parseCommandRouting routes single-bot instructions accurately', () => {
  const emmaPlan = parseCommandRouting('Emma, read my unread emails and prepare replies.');
  assert.equal(emmaPlan.isMultiBot, false);
  assert.deepEqual(emmaPlan.pipeline, ['emma']);

  const sophiePlan = parseCommandRouting('Sophie, organize my schedule for tomorrow.');
  assert.equal(sophiePlan.isMultiBot, false);
  assert.deepEqual(sophiePlan.pipeline, ['sophie']);
});

test('deriveOfficeMetrics computes accurate counts across tasks, approvals, emails, and events', () => {
  const tasks: TaskRecord[] = [
    {
      id: 't1',
      title: 'A',
      description: '',
      assignedTo: 'max',
      createdBy: 'ceo',
      status: 'completed',
      priority: 'normal',
      output: '',
      sources: [],
      collaborationTrace: [],
      parentTaskId: null,
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 't2',
      title: 'B',
      description: '',
      assignedTo: 'charlie',
      createdBy: 'alex',
      status: 'in_progress',
      priority: 'high',
      output: '',
      sources: [],
      collaborationTrace: [],
      parentTaskId: null,
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 't3',
      title: 'C',
      description: '',
      assignedTo: 'emma',
      createdBy: 'ceo',
      status: 'failed',
      priority: 'normal',
      output: '',
      sources: [],
      collaborationTrace: [],
      parentTaskId: null,
      createdAt: '',
      updatedAt: '',
    },
  ];
  const approvals: ApprovalRecord[] = [
    {
      id: 'a1',
      taskId: 't2',
      botId: 'emma',
      actionType: 'send_email',
      title: 'Send reply',
      summary: '',
      payload: {},
      status: 'pending',
      decisionNote: null,
      createdAt: '',
      decidedAt: null,
    },
  ];
  const emails: InboxEmail[] = [
    {
      id: 'e1',
      provider: 'gmail',
      senderName: 'Test',
      senderEmail: 't@example.com',
      subject: 'Hi',
      body: 'Body',
      priority: 'P2',
      category: 'Business',
      phishingFlag: false,
      phishingReason: null,
      aiSummary: 'Summary',
      draftReply: null,
      status: 'triaged',
      receivedAt: '',
    },
  ];
  const events: CalendarEvent[] = [
    {
      id: 'c1',
      title: 'Future Call',
      startIso: '2026-11-25T10:00:00Z',
      endIso: '2026-11-25T11:00:00Z',
      attendees: [],
      location: 'Meet',
      notes: '',
      status: 'confirmed',
      conflictWithId: null,
      createdByBot: false,
    },
  ];

  const metrics = deriveOfficeMetrics(
    tasks,
    approvals,
    emails,
    events,
    Date.parse('2026-11-24T00:00:00Z')
  );
  assert.equal(metrics.totalTasks, 3);
  assert.equal(metrics.activeTasks, 1);
  assert.equal(metrics.completedTasks, 1);
  assert.equal(metrics.failedTasks, 1);
  assert.equal(metrics.pendingApprovals, 1);
  assert.equal(metrics.totalEmailsProcessed, 1);
  assert.equal(metrics.upcomingAppointments, 1);
});

test('validateWebhookUrl allows public HTTPS webhooks and rejects SSRF targets', () => {
  assert.equal(validateWebhookUrl('https://n8n.example.com/webhook/alex-orchestrator').valid, true);
  assert.equal(validateWebhookUrl('http://localhost:5678/webhook/test').valid, false);
  assert.equal(validateWebhookUrl('http://127.0.0.1:5678/webhook').valid, false);
  assert.equal(validateWebhookUrl('http://169.254.169.254/latest/meta-data').valid, false);
  assert.equal(validateWebhookUrl('https://10.0.0.5/hook').valid, false);
  assert.equal(validateWebhookUrl('ftp://example.com/hook').valid, false);
});

test('each of the 5 AI robot employees has a unique personality profile', () => {
  assert.equal(DEFAULT_EMPLOYEES.length, 5);
  const archetypes = new Set(DEFAULT_EMPLOYEES.map((e) => e.personality.archetype));
  const taglines = new Set(DEFAULT_EMPLOYEES.map((e) => e.personality.tagline));
  const deskProps = new Set(DEFAULT_EMPLOYEES.map((e) => e.personality.deskProp));
  assert.equal(archetypes.size, 5);
  assert.equal(taglines.size, 5);
  assert.equal(deskProps.size, 5);
  for (const emp of DEFAULT_EMPLOYEES) {
    assert.equal(emp.personality.traits.length, 3);
    assert.ok(emp.personality.communicationStyle.length > 10);
    assert.ok(emp.personality.quirk.length > 10);
    assert.ok(emp.systemPrompt.includes(emp.personality.archetype));
  }
});

test('connector catalog defines all 6 required external services with n8n workflows', () => {
  assert.equal(SERVICE_CATALOG.length, 6);
  const keys = SERVICE_CATALOG.map((s) => s.serviceName);
  assert.deepEqual(keys, [
    'gmail',
    'outlook',
    'google_calendar',
    'google_drive',
    'slack',
    'telegram',
  ]);
});

test('canEmployeeUseConnector enforces enabled flag and permission hierarchy', () => {
  const perms: Pick<
    EmployeeConnectorPermissionView,
    'employeeId' | 'serviceName' | 'permissionLevel' | 'enabled'
  >[] = [
    { employeeId: 'emma', serviceName: 'gmail', permissionLevel: 'write', enabled: true },
    { employeeId: 'max', serviceName: 'google_drive', permissionLevel: 'read', enabled: true },
    { employeeId: 'charlie', serviceName: 'gmail', permissionLevel: 'read', enabled: false },
  ];

  assert.equal(canEmployeeUseConnector(perms, 'emma', 'gmail', 'write').allowed, true);
  assert.equal(canEmployeeUseConnector(perms, 'max', 'google_drive', 'read').allowed, true);
  assert.equal(canEmployeeUseConnector(perms, 'max', 'google_drive', 'write').allowed, false);
  assert.equal(canEmployeeUseConnector(perms, 'charlie', 'gmail', 'read').allowed, false);
});

test('evaluateTokenExpirationStatus distinguishes Sandbox, Valid, Expiring Soon, and Expired', () => {
  const now = Date.parse('2026-11-24T12:00:00Z');
  assert.equal(
    evaluateTokenExpirationStatus('2026-11-24T13:00:00Z', true, false, now),
    'Sandbox / No Live Token'
  );
  assert.equal(
    evaluateTokenExpirationStatus('2026-11-24T13:00:00Z', false, true, now),
    'Valid'
  );
  assert.equal(
    evaluateTokenExpirationStatus('2026-11-24T12:05:00Z', false, true, now),
    'Expiring Soon'
  );
  assert.equal(
    evaluateTokenExpirationStatus('2026-11-24T11:55:00Z', false, true, now),
    'Expired'
  );
});

test('hasActiveWorkflowDependency detects n8n and employee dependencies before disconnect', () => {
  const res = hasActiveWorkflowDependency(
    { serviceName: 'gmail', n8nEnabled: true },
    [
      { serviceName: 'gmail', enabled: true, permissionLevel: 'write' },
      { serviceName: 'gmail', enabled: false, permissionLevel: 'read' },
    ]
  );
  assert.equal(res.hasDependency, true);
  assert.equal(res.activeWorkflowCount, 2);
});

test('buildSandboxExecutionPreview marks every simulated run with SANDBOX badge and safe flags', () => {
  const preview = buildSandboxExecutionPreview('gmail', 'Triage Inbox', 'Emma');
  assert.equal(preview.badge, 'SANDBOX');
  assert.ok(preview.summary.includes('[SANDBOX]'));
  assert.equal(preview.sampleData.externalEmailSent, false);
});

test('isAllowedPostMessageOrigin accepts run.app, localhost, and rejects untrusted origins', () => {
  assert.equal(
    isAllowedPostMessageOrigin(
      'https://ais-dev-c5lhwz3c6le3ai2hc4zlxd-1014530368246.asia-east1.run.app',
      'https://ais-dev-c5lhwz3c6le3ai2hc4zlxd-1014530368246.asia-east1.run.app'
    ),
    true
  );
  assert.equal(
    isAllowedPostMessageOrigin('http://localhost:3000', 'http://localhost:3000'),
    true
  );
  assert.equal(
    isAllowedPostMessageOrigin('https://evil.example.com', 'http://localhost:3000'),
    false
  );
});

test('maskCredentialValue hides middle characters without exposing full client IDs', () => {
  assert.equal(maskCredentialValue(''), '');
  assert.equal(maskCredentialValue('abc123'), '••••23');
  assert.equal(maskCredentialValue('ms-client-9876543210-prod'), 'ms-c••••prod');
});

test('normalizeMicrosoftTenantId defaults blank input to common and rejects unsafe values', () => {
  assert.equal(normalizeMicrosoftTenantId(''), 'common');
  assert.equal(normalizeMicrosoftTenantId('  '), 'common');
  assert.equal(
    normalizeMicrosoftTenantId('72f988bf-86f1-41af-91ab-2d7cd011db47'),
    '72f988bf-86f1-41af-91ab-2d7cd011db47'
  );
  assert.throws(() => normalizeMicrosoftTenantId('bad/tenant?x=1'));
});


