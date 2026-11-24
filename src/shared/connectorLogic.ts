import type {
  BotId,
  ConnectorAuthType,
  ConnectorConnectionView,
  ConnectorPermissionLevel,
  ConnectorServiceKey,
  EmployeeConnectorPermissionView,
  TokenExpirationStatus,
} from './types';

export interface ServiceCatalogEntry {
  serviceName: ConnectorServiceKey;
  displayName: string;
  shortLabel: string;
  description: string;
  authenticationType: ConnectorAuthType;
  n8nWorkflowName: string;
  availablePermissions: string[];
  requiredGoogleScopes: string[];
  defaultEmployees: Record<BotId, { level: ConnectorPermissionLevel; enabled: boolean }>;
}

export const SERVICE_CATALOG: ServiceCatalogEntry[] = [
  {
    serviceName: 'gmail',
    displayName: 'Gmail',
    shortLabel: 'GM',
    description:
      'Read incoming emails, categorize P1–P5 priorities, summarize threads, detect phishing, organize labels, and create reply drafts.',
    authenticationType: 'Google OAuth 2.0',
    n8nWorkflowName: 'Gmail Email Processing',
    availablePermissions: [
      'Read incoming emails',
      'Categorize & label messages',
      'Summarize threads',
      'Create reply drafts (no auto-send)',
      'Detect spam & phishing',
    ],
    requiredGoogleScopes: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.compose',
      'https://www.googleapis.com/auth/gmail.labels',
    ],
    defaultEmployees: {
      alex: { level: 'read', enabled: false },
      emma: { level: 'write', enabled: true },
      max: { level: 'none', enabled: false },
      sophie: { level: 'read', enabled: false },
      charlie: { level: 'none', enabled: false },
    },
  },
  {
    serviceName: 'outlook',
    displayName: 'Microsoft Outlook',
    shortLabel: 'OL',
    description:
      'Connect Microsoft 365 mailboxes via Graph API to read incoming emails, categorize messages, draft replies, and flag urgent threads.',
    authenticationType: 'Microsoft OAuth 2.0',
    n8nWorkflowName: 'Outlook Email Processing',
    availablePermissions: [
      'Read incoming emails',
      'Categorize & organize inbox',
      'Create draft responses',
      'Identify important messages',
    ],
    requiredGoogleScopes: [],
    defaultEmployees: {
      alex: { level: 'read', enabled: false },
      emma: { level: 'write', enabled: true },
      max: { level: 'none', enabled: false },
      sophie: { level: 'read', enabled: false },
      charlie: { level: 'none', enabled: false },
    },
  },
  {
    serviceName: 'google_calendar',
    displayName: 'Google Calendar',
    shortLabel: 'GC',
    description:
      'Read calendar events, check executive availability, organize daily schedules, detect conflicts, and create reminders.',
    authenticationType: 'Google OAuth 2.0',
    n8nWorkflowName: 'Google Calendar Management',
    availablePermissions: [
      'Read calendar events',
      'Check availability',
      'Create appointments & reminders',
      'Organize daily schedules',
    ],
    requiredGoogleScopes: [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events',
    ],
    defaultEmployees: {
      alex: { level: 'read', enabled: true },
      emma: { level: 'none', enabled: false },
      max: { level: 'none', enabled: false },
      sophie: { level: 'write', enabled: true },
      charlie: { level: 'read', enabled: false },
    },
  },
  {
    serviceName: 'google_drive',
    displayName: 'Google Drive',
    shortLabel: 'GD',
    description:
      'Search workspace files, read authorized documents, organize folders, create reports, and save completed AI employee deliverables.',
    authenticationType: 'Google OAuth 2.0',
    n8nWorkflowName: 'Google Drive File Management',
    availablePermissions: [
      'Search workspace files',
      'Read authorized documents',
      'Organize files into folders',
      'Create & upload reports',
    ],
    requiredGoogleScopes: [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/drive.file',
    ],
    defaultEmployees: {
      alex: { level: 'read', enabled: true },
      emma: { level: 'none', enabled: false },
      max: { level: 'read', enabled: true },
      sophie: { level: 'none', enabled: false },
      charlie: { level: 'write', enabled: true },
    },
  },
  {
    serviceName: 'slack',
    displayName: 'Slack',
    shortLabel: 'SL',
    description:
      'Send task notifications, deliver daily AI reports, route CEO approval requests, and receive authorized commands from Slack channels.',
    authenticationType: 'Slack OAuth 2.0',
    n8nWorkflowName: 'Slack Notifications',
    availablePermissions: [
      'Send task & completion alerts',
      'Receive authorized CEO commands',
      'Deliver daily reports',
      'Send approval requests',
    ],
    requiredGoogleScopes: [],
    defaultEmployees: {
      alex: { level: 'admin', enabled: true },
      emma: { level: 'read', enabled: false },
      max: { level: 'read', enabled: false },
      sophie: { level: 'write', enabled: false },
      charlie: { level: 'write', enabled: true },
    },
  },
  {
    serviceName: 'telegram',
    displayName: 'Telegram',
    shortLabel: 'TG',
    description:
      'Instant executive notifications, urgent email alerts, pending approval prompts, daily AI reports, and direct CEO command routing.',
    authenticationType: 'Telegram Bot API',
    n8nWorkflowName: 'Telegram Notifications',
    availablePermissions: [
      'Send instant CEO alerts',
      'Receive CEO commands',
      'Deliver daily employee reports',
      'Send pending approval alerts',
    ],
    requiredGoogleScopes: [],
    defaultEmployees: {
      alex: { level: 'admin', enabled: true },
      emma: { level: 'read', enabled: false },
      max: { level: 'none', enabled: false },
      sophie: { level: 'write', enabled: false },
      charlie: { level: 'none', enabled: false },
    },
  },
];

export const GOOGLE_WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.labels',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.file',
];

export function getServiceCatalogEntry(
  serviceName: ConnectorServiceKey
): ServiceCatalogEntry {
  const entry = SERVICE_CATALOG.find((item) => item.serviceName === serviceName);
  if (!entry) {
    throw new Error(`Unknown connector service: ${serviceName}`);
  }
  return entry;
}

const PERMISSION_RANK: Record<ConnectorPermissionLevel, number> = {
  none: 0,
  read: 1,
  write: 2,
  admin: 3,
};

export function canEmployeeUseConnector(
  permissions: Pick<
    EmployeeConnectorPermissionView,
    'employeeId' | 'serviceName' | 'permissionLevel' | 'enabled'
  >[],
  employeeId: BotId,
  serviceName: ConnectorServiceKey,
  minimumLevel: ConnectorPermissionLevel = 'read'
): { allowed: boolean; reason?: string } {
  const record = permissions.find(
    (p) => p.employeeId === employeeId && p.serviceName === serviceName
  );
  if (!record || !record.enabled) {
    return {
      allowed: false,
      reason: `${employeeId} does not have active access enabled for ${serviceName}.`,
    };
  }
  if (PERMISSION_RANK[record.permissionLevel] < PERMISSION_RANK[minimumLevel]) {
    return {
      allowed: false,
      reason: `${employeeId} has "${record.permissionLevel}" access, but "${minimumLevel}" permission is required.`,
    };
  }
  return { allowed: true };
}

export function evaluateTokenExpirationStatus(
  tokenExpiresAtIso: string | null,
  sandboxMode: boolean,
  connected: boolean,
  nowMs: number = Date.now()
): TokenExpirationStatus {
  if (sandboxMode || !connected) {
    return 'Sandbox / No Live Token';
  }
  if (!tokenExpiresAtIso) {
    return 'Valid';
  }
  const expiresMs = Date.parse(tokenExpiresAtIso);
  if (Number.isNaN(expiresMs)) {
    return 'Valid';
  }
  if (expiresMs <= nowMs) {
    return 'Expired';
  }
  if (expiresMs - nowMs <= 15 * 60 * 1000) {
    return 'Expiring Soon';
  }
  return 'Valid';
}

export function hasActiveWorkflowDependency(
  connector: Pick<ConnectorConnectionView, 'serviceName' | 'n8nEnabled'>,
  employeePermissions: Pick<
    EmployeeConnectorPermissionView,
    'serviceName' | 'enabled' | 'permissionLevel'
  >[]
): { hasDependency: boolean; activeWorkflowCount: number } {
  const activeEmployeeCount = employeePermissions.filter(
    (p) =>
      p.serviceName === connector.serviceName &&
      p.enabled &&
      p.permissionLevel !== 'none'
  ).length;
  const n8nCount = connector.n8nEnabled ? 1 : 0;
  const total = activeEmployeeCount + n8nCount;
  return {
    hasDependency: total > 0,
    activeWorkflowCount: total,
  };
}

export function buildSandboxExecutionPreview(
  serviceName: ConnectorServiceKey,
  action: string,
  employeeName: string
): {
  badge: 'SANDBOX';
  summary: string;
  sampleData: Record<string, unknown>;
} {
  switch (serviceName) {
    case 'gmail':
      return {
        badge: 'SANDBOX',
        summary: `[SANDBOX] ${employeeName} simulated Gmail action "${action}" using sample inbox threads. No real mailbox was accessed.`,
        sampleData: {
          mode: 'SANDBOX',
          sampleThreads: [
            {
              priority: 'P1',
              from: 'board-chair@sample-corp.example',
              subject: 'Q4 Executive Review Agenda',
              label: 'Executive/Urgent',
            },
            {
              priority: 'P5',
              from: 'alert@verify-login.xyz',
              subject: 'Urgent: Verify Your Account Now',
              label: 'Quarantined/Phishing',
            },
          ],
          draftCreated: false,
          externalEmailSent: false,
        },
      };
    case 'outlook':
      return {
        badge: 'SANDBOX',
        summary: `[SANDBOX] ${employeeName} simulated Microsoft Outlook action "${action}" with sample Microsoft 365 messages.`,
        sampleData: {
          mode: 'SANDBOX',
          sampleMessages: [
            {
              importance: 'high',
              from: 'procurement@northwind.example',
              subject: 'Vendor Agreement Redlines',
            },
          ],
          externalEmailSent: false,
        },
      };
    case 'google_calendar':
      return {
        badge: 'SANDBOX',
        summary: `[SANDBOX] ${employeeName} simulated Google Calendar action "${action}" on sample schedule blocks. No real calendar invites were dispatched.`,
        sampleData: {
          mode: 'SANDBOX',
          sampleEvents: [
            {
              title: 'Weekly Product Sync (Sample)',
              slot: '10:00 AM - 10:45 AM',
              conflicts: 0,
            },
            {
              title: 'Deep Work Block (Sample)',
              slot: '02:00 PM - 04:00 PM',
              conflicts: 0,
            },
          ],
          externalInviteSent: false,
        },
      };
    case 'google_drive':
      return {
        badge: 'SANDBOX',
        summary: `[SANDBOX] ${employeeName} simulated Google Drive action "${action}" against sample workspace folders. No files were uploaded or altered.`,
        sampleData: {
          mode: 'SANDBOX',
          sampleFiles: [
            { name: 'Q4 Market Research Brief (Sample).docx', folder: 'AI Deliverables' },
            { name: 'Executive Weekly Report (Sample).pdf', folder: 'Board Reports' },
          ],
          realUploadExecuted: false,
        },
      };
    case 'slack':
      return {
        badge: 'SANDBOX',
        summary: `[SANDBOX] ${employeeName} simulated Slack action "${action}" for #ceo-briefings. No real Slack message was posted.`,
        sampleData: {
          mode: 'SANDBOX',
          channel: '#ceo-briefings (sample)',
          messagePreview: `${employeeName}: Daily status summary ready for review.`,
          realSlackMessageSent: false,
        },
      };
    case 'telegram':
      return {
        badge: 'SANDBOX',
        summary: `[SANDBOX] ${employeeName} simulated Telegram alert "${action}". No real Telegram Bot API message was transmitted.`,
        sampleData: {
          mode: 'SANDBOX',
          chatId: 'sandbox-demo-chat',
          messagePreview: 'Sample executive notification preview.',
          realTelegramSent: false,
        },
      };
  }
}

export function isAllowedPostMessageOrigin(
  eventOrigin: string,
  currentOrigin: string
): boolean {
  if (!eventOrigin) return false;
  if (eventOrigin === currentOrigin) return true;
  try {
    const parsed = new URL(eventOrigin);
    return (
      parsed.hostname.endsWith('.run.app') ||
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1'
    );
  } catch {
    return false;
  }
}

export function maskCredentialValue(value: string | null | undefined): string {
  const trimmed = (value || '').trim();
  if (!trimmed) return '';
  if (trimmed.length <= 6) {
    return `••••${trimmed.slice(-2)}`;
  }
  return `${trimmed.slice(0, 4)}••••${trimmed.slice(-4)}`;
}

export function normalizeMicrosoftTenantId(tenantId?: string | null): string {
  const trimmed = (tenantId || '').trim();
  if (!trimmed) return 'common';
  if (!/^[a-zA-Z0-9.-]+$/.test(trimmed)) {
    throw new Error(
      'Microsoft Tenant ID must be "common", "organizations", "consumers", or a valid tenant domain/GUID.'
    );
  }
  return trimmed;
}

