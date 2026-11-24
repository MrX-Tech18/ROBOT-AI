import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const integrationConnections = pgTable(
  'integration_connections',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    serviceName: text('service_name').notNull(),
    displayName: text('display_name').notNull(),
    connectionStatus: text('connection_status').notNull().default('SANDBOX MODE'),
    authenticationType: text('authentication_type').notNull(),
    permissions: jsonb('permissions').$type<string[]>().notNull().default([]),
    accountLabel: text('account_label').notNull().default(''),
    sandboxMode: boolean('sandbox_mode').notNull().default(true),
    n8nWorkflowName: text('n8n_workflow_name').notNull(),
    n8nWebhookUrl: text('n8n_webhook_url').notNull().default(''),
    n8nEnabled: boolean('n8n_enabled').notNull().default(false),
    tokenExpiresAt: timestamp('token_expires_at'),
    lastSync: timestamp('last_sync'),
    lastError: text('last_error'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('integration_connections_user_service_idx').on(
      table.userId,
      table.serviceName
    ),
  ]
);

export const integrationSecrets = pgTable('integration_secrets', {
  id: serial('id').primaryKey(),
  integrationId: integer('integration_id')
    .notNull()
    .unique()
    .references(() => integrationConnections.id, { onDelete: 'cascade' }),
  encryptedPayload: text('encrypted_payload').notNull(),
  tokenExpiresAt: timestamp('token_expires_at'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const employeeIntegrations = pgTable(
  'employee_integrations',
  {
    id: serial('id').primaryKey(),
    employeeId: text('employee_id').notNull(),
    integrationId: integer('integration_id')
      .notNull()
      .references(() => integrationConnections.id, { onDelete: 'cascade' }),
    permissionLevel: text('permission_level').notNull().default('read'),
    enabled: boolean('enabled').notNull().default(false),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('employee_integrations_emp_int_idx').on(
      table.employeeId,
      table.integrationId
    ),
  ]
);

export const integrationActivityLogs = pgTable('integration_activity_logs', {
  id: serial('id').primaryKey(),
  integrationId: integer('integration_id')
    .notNull()
    .references(() => integrationConnections.id, { onDelete: 'cascade' }),
  employeeId: text('employee_id'),
  action: text('action').notNull(),
  status: text('status').notNull(),
  isSandbox: boolean('is_sandbox').notNull().default(true),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  errorMessage: text('error_message'),
});

export const oauthAppConfigs = pgTable(
  'oauth_app_configs',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    clientIdHint: text('client_id_hint').notNull(),
    tenantId: text('tenant_id'),
    encryptedCredentials: text('encrypted_credentials').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('oauth_app_configs_user_provider_idx').on(table.userId, table.provider),
  ]
);

export const usersRelations = relations(users, ({ many }) => ({
  integrationConnections: many(integrationConnections),
  oauthAppConfigs: many(oauthAppConfigs),
}));

export const integrationConnectionsRelations = relations(
  integrationConnections,
  ({ one, many }) => ({
    user: one(users, {
      fields: [integrationConnections.userId],
      references: [users.uid],
    }),
    secret: one(integrationSecrets, {
      fields: [integrationConnections.id],
      references: [integrationSecrets.integrationId],
    }),
    employeePermissions: many(employeeIntegrations),
    activityLogs: many(integrationActivityLogs),
  })
);

export const employeeIntegrationsRelations = relations(
  employeeIntegrations,
  ({ one }) => ({
    integration: one(integrationConnections, {
      fields: [employeeIntegrations.integrationId],
      references: [integrationConnections.id],
    }),
  })
);

export const integrationActivityLogsRelations = relations(
  integrationActivityLogs,
  ({ one }) => ({
    integration: one(integrationConnections, {
      fields: [integrationActivityLogs.integrationId],
      references: [integrationConnections.id],
    }),
  })
);

export const oauthAppConfigsRelations = relations(oauthAppConfigs, ({ one }) => ({
  user: one(users, {
    fields: [oauthAppConfigs.userId],
    references: [users.uid],
  }),
}));

