export type BotId = 'alex' | 'emma' | 'max' | 'sophie' | 'charlie';

export type BotStatus =
  | 'idle'
  | 'thinking'
  | 'working'
  | 'completed'
  | 'error'
  | 'waiting'
  | 'paused';

export type EmailPriority = 'P1' | 'P2' | 'P3' | 'P4' | 'P5';

export type TaskStatus =
  | 'queued'
  | 'in_progress'
  | 'waiting_approval'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export type ApprovalActionType =
  | 'send_email'
  | 'delete_email'
  | 'publish_social'
  | 'send_invite'
  | 'share_document'
  | 'make_purchase'
  | 'financial_transaction';

export type AppPage =
  | 'office'
  | 'dashboard'
  | 'command'
  | 'directory'
  | 'employee'
  | 'tasks'
  | 'approvals'
  | 'history'
  | 'integrations';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  companyName: string;
  theme: 'light' | 'dark';
  isDemo?: boolean;
}

export interface EmployeePermissions {
  canAssignTasks: boolean;
  canSendExternalMessages: boolean;
  canDeleteData: boolean;
  canAccessWeb: boolean;
  canScheduleExternalMeetings: boolean;
  requireApprovalForSensitive: boolean;
}

export interface EmployeePersonality {
  archetype: string;
  tagline: string;
  traits: [string, string, string];
  communicationStyle: string;
  quirk: string;
  deskProp: string;
}

export interface EmployeeProfile {
  id: BotId;
  name: string;
  title: string;
  department: string;
  colorHex: string;
  accentLabel: string;
  description: string;
  personality: EmployeePersonality;
  responsibilities: string[];
  tools: string[];
  status: BotStatus;
  enabled: boolean;
  currentTaskId: string | null;
  currentTaskTitle: string | null;
  systemPrompt: string;
  permissions: EmployeePermissions;
  tasksCompleted: number;
  tasksFailed: number;
  avgResponseMs: number;
}

export interface SourceCitation {
  title: string;
  uri: string;
}

export interface CollaborationStep {
  stepNumber: number;
  botId: BotId;
  botName: string;
  action: string;
  status: 'pending' | 'running' | 'completed' | 'waiting_approval' | 'failed';
  summary: string;
  timestamp: string;
}

export interface TaskRecord {
  id: string;
  title: string;
  description: string;
  assignedTo: BotId;
  createdBy: 'ceo' | BotId;
  status: TaskStatus;
  priority: 'critical' | 'high' | 'normal' | 'low';
  output: string;
  sources: SourceCitation[];
  collaborationTrace: CollaborationStep[];
  parentTaskId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalRecord {
  id: string;
  taskId: string | null;
  botId: BotId;
  actionType: ApprovalActionType;
  title: string;
  summary: string;
  payload: Record<string, unknown>;
  status: ApprovalStatus;
  decisionNote: string | null;
  createdAt: string;
  decidedAt: string | null;
}

export interface InboxEmail {
  id: string;
  provider: 'gmail' | 'outlook';
  senderName: string;
  senderEmail: string;
  subject: string;
  body: string;
  priority: EmailPriority;
  category: string;
  phishingFlag: boolean;
  phishingReason: string | null;
  aiSummary: string | null;
  draftReply: string | null;
  status: 'unread' | 'triaged' | 'draft_ready' | 'pending_approval' | 'sent' | 'archived';
  receivedAt: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  startIso: string;
  endIso: string;
  attendees: string[];
  location: string;
  notes: string;
  status: 'confirmed' | 'pending_approval' | 'conflict' | 'cancelled';
  conflictWithId: string | null;
  createdByBot: boolean;
}

export interface AutomationLog {
  id: string;
  workflowName: string;
  botId: BotId;
  eventType: 'orchestration' | 'execution' | 'collaboration' | 'n8n_webhook' | 'approval' | 'error';
  message: string;
  details: string | null;
  status: 'success' | 'pending' | 'error';
  durationMs: number;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  type: 'email' | 'task' | 'error' | 'meeting' | 'approval' | 'report';
  title: string;
  message: string;
  botId: BotId | null;
  read: boolean;
  createdAt: string;
}

export interface IntegrationConfig {
  id: string;
  name: string;
  category: 'automation' | 'email' | 'calendar' | 'storage' | 'messaging';
  connected: boolean;
  endpointUrl: string;
  accountLabel: string;
  lastTestedAt: string | null;
  lastStatus: string | null;
}

export interface ChatMessage {
  id: string;
  channel: 'command' | BotId;
  sender: 'ceo' | BotId | 'system';
  text: string;
  metadata?: {
    delegatedBots?: BotId[];
    taskIds?: string[];
    sources?: SourceCitation[];
    approvalId?: string;
  };
  createdAt: string;
}

export interface OfficeMetrics {
  totalTasks: number;
  activeTasks: number;
  completedTasks: number;
  pendingApprovals: number;
  failedTasks: number;
  totalEmailsProcessed: number;
  upcomingAppointments: number;
}

export interface WorkspacePayload {
  user: UserProfile;
  employees: EmployeeProfile[];
  tasks: TaskRecord[];
  approvals: ApprovalRecord[];
  emails: InboxEmail[];
  calendarEvents: CalendarEvent[];
  logs: AutomationLog[];
  notifications: NotificationItem[];
  integrations: IntegrationConfig[];
  chatMessages: ChatMessage[];
  metrics: OfficeMetrics;
}

export type ConnectorServiceKey =
  | 'gmail'
  | 'outlook'
  | 'google_calendar'
  | 'google_drive'
  | 'slack'
  | 'telegram';

export type ConnectorConnectionStatus =
  | 'CONNECTED'
  | 'NOT CONNECTED'
  | 'CONNECTING'
  | 'ERROR'
  | 'SANDBOX MODE';

export type ConnectorAuthType =
  | 'Google OAuth 2.0'
  | 'Microsoft OAuth 2.0'
  | 'Slack OAuth 2.0'
  | 'Telegram Bot API';

export type ConnectorPermissionLevel = 'none' | 'read' | 'write' | 'admin';

export type ConnectorDiagnosticMessage =
  | 'Connection successful'
  | 'Authentication expired'
  | 'Missing permissions'
  | 'Invalid configuration'
  | 'API unavailable';

export type TokenExpirationStatus =
  | 'Valid'
  | 'Expiring Soon'
  | 'Expired'
  | 'Sandbox / No Live Token';

export type CredentialSource = 'env' | 'vault' | 'none';

export interface OAuthAppCredentialStatus {
  provider: 'outlook' | 'slack';
  configured: boolean;
  source: CredentialSource;
  clientIdHint: string | null;
  tenantId?: string | null;
}

export interface ConnectorConnectionView {
  id: number;
  serviceName: ConnectorServiceKey;
  displayName: string;
  description: string;
  connectionStatus: ConnectorConnectionStatus;
  authenticationType: ConnectorAuthType;
  permissions: string[];
  availablePermissions: string[];
  accountLabel: string;
  sandboxMode: boolean;
  n8nWorkflowName: string;
  n8nWebhookUrl: string;
  n8nEnabled: boolean;
  tokenExpiresAt: string | null;
  tokenExpirationStatus: TokenExpirationStatus;
  lastSync: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  hasStoredSecret: boolean;
  oauthConfigured: boolean;
  credentialSource?: CredentialSource;
  clientIdHint?: string | null;
}

export interface EmployeeConnectorPermissionView {
  id: number;
  employeeId: BotId;
  integrationId: number;
  serviceName: ConnectorServiceKey;
  permissionLevel: ConnectorPermissionLevel;
  enabled: boolean;
  updatedAt: string;
}

export interface ConnectorActivityLogView {
  id: number;
  integrationId: number;
  serviceName: ConnectorServiceKey;
  displayName: string;
  employeeId: BotId | null;
  action: string;
  status: 'success' | 'error' | 'sandbox' | 'warning';
  isSandbox: boolean;
  timestamp: string;
  errorMessage: string | null;
}

export interface ConnectorDashboardPayload {
  connections: ConnectorConnectionView[];
  employeePermissions: EmployeeConnectorPermissionView[];
  activityLogs: ConnectorActivityLogView[];
  oauthAppStatuses: {
    outlook: OAuthAppCredentialStatus;
    slack: OAuthAppCredentialStatus;
  };
  encryptionKeySource: 'env' | 'custom_vault' | 'auto_vault';
  callbackUrls: {
    outlookDev: string;
    outlookShared: string;
    slackDev: string;
    slackShared: string;
  };
}

export interface OAuthSetupInstructionPayload {
  needsEnvSetup: true;
  provider: 'outlook' | 'slack';
  missingVars: string[];
  callbackUrls: {
    dev: string;
    shared: string;
  };
  steps: string[];
}


