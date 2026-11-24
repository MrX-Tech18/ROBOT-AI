import { GoogleGenAI, Type } from '@google/genai';
import type {
  ApprovalActionType,
  BotId,
  CalendarEvent,
  EmployeeProfile,
  InboxEmail,
  SourceCitation,
  TaskRecord,
} from '../src/shared/types.ts';

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please configure GEMINI_API_KEY in Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function withGeminiRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const status = (err as { status?: number })?.status;
      const isTransient =
        status === 429 ||
        status === 503 ||
        /503|429|UNAVAILABLE|RESOURCE_EXHAUSTED|high demand|overloaded|try again/i.test(msg);
      if (!isTransient || attempt === maxRetries) {
        throw err;
      }
      const delayMs = 900 * Math.pow(2, attempt) + Math.floor(Math.random() * 250);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

export interface OrchestrationPlan {
  alexSummary: string;
  taskTitle: string;
  priority: 'critical' | 'high' | 'normal' | 'low';
  steps: Array<{
    botId: BotId;
    instruction: string;
    dependsOnPrevious: boolean;
  }>;
  requiresApproval: boolean;
  approvalActionType: ApprovalActionType | null;
  approvalTitle: string | null;
}

export async function planCommandWithAlex(params: {
  command: string;
  employees: EmployeeProfile[];
  pendingApprovalsCount: number;
  unreadEmailsCount: number;
  upcomingMeetingsCount: number;
}): Promise<OrchestrationPlan> {
  const ai = getAiClient();
  const teamSummary = params.employees
    .map(
      (e) =>
        `- ${e.id} (${e.name}, ${e.title} — ${e.personality.archetype}): ${e.enabled ? 'ENABLED' : 'PAUSED/DISABLED'}. Style: ${e.personality.communicationStyle}. Responsibilities: ${e.responsibilities.slice(0, 3).join('; ')}`
    )
    .join('\n');

  const response = await withGeminiRetry(() =>
    ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `CEO Command: "${params.command}"

Office Context:
- Pending Approvals: ${params.pendingApprovalsCount}
- Unread/Pending Emails: ${params.unreadEmailsCount}
- Upcoming Calendar Appointments: ${params.upcomingMeetingsCount}

Available AI Employees:
${teamSummary}

Plan how Alex should orchestrate this command.
Rules:
1. Only assign steps to ENABLED bots (unless the command is purely an Alex briefing).
2. If the task asks to create content/video/report/proposal on a topic (e.g., "YouTube video about interesting facts about the ocean"), collaborate by assigning step 1 to 'max' (research with verified sources) and step 2 to 'charlie' (draft script/report/content using Max's research).
3. If the task involves reading/replying to emails, assign to 'emma'.
4. If the task involves calendar/schedule/meetings/agenda, assign to 'sophie'.
5. If the task is an executive briefing ("what needs my attention today"), assign to 'alex'.
6. Sensitive external actions (sending emails, deleting emails, publishing social/YouTube content, sending external meeting invites, sharing docs, purchases/financials) MUST set requiresApproval=true and pick the right approvalActionType.`,
    config: {
      systemInstruction:
        'You are Alex, Chief Executive Assistant at ROBOT OFFICE AI. Return a clean JSON orchestration plan.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          alexSummary: {
            type: Type.STRING,
            description: 'Short executive acknowledgment from Alex explaining the delegation plan.',
          },
          taskTitle: {
            type: Type.STRING,
            description: 'Concise 4-8 word title for the overall task.',
          },
          priority: {
            type: Type.STRING,
            description: 'One of: critical, high, normal, low',
          },
          steps: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                botId: {
                  type: Type.STRING,
                  description: 'One of: alex, emma, max, sophie, charlie',
                },
                instruction: {
                  type: Type.STRING,
                  description: 'Specific task instruction for this employee.',
                },
                dependsOnPrevious: {
                  type: Type.BOOLEAN,
                  description: 'Whether this step uses output from the previous step.',
                },
              },
              required: ['botId', 'instruction', 'dependsOnPrevious'],
            },
          },
          requiresApproval: {
            type: Type.BOOLEAN,
            description: 'True if the final deliverable involves a sensitive external action.',
          },
          approvalActionType: {
            type: Type.STRING,
            description:
              'One of: send_email, delete_email, publish_social, send_invite, share_document, make_purchase, financial_transaction, or empty string if none.',
          },
          approvalTitle: {
            type: Type.STRING,
            description: 'Concise title for the CEO approval request if requiresApproval is true.',
          },
        },
        required: ['alexSummary', 'taskTitle', 'priority', 'steps', 'requiresApproval'],
      },
    },
  })
  );

  const parsed = JSON.parse((response.text ?? '{}').trim()) as Partial<OrchestrationPlan>;
  const validBots = new Set<BotId>(['alex', 'emma', 'max', 'sophie', 'charlie']);

  const steps = Array.isArray(parsed.steps)
    ? parsed.steps
        .filter((s) => validBots.has(s.botId))
        .map((s, idx) => ({
          botId: s.botId,
          instruction: s.instruction || params.command,
          dependsOnPrevious: idx > 0 ? Boolean(s.dependsOnPrevious) : false,
        }))
    : [];

  return {
    alexSummary:
      parsed.alexSummary || 'Understood, CEO. Coordinating the appropriate specialists now.',
    taskTitle: parsed.taskTitle || params.command.slice(0, 60),
    priority:
      parsed.priority === 'critical' ||
      parsed.priority === 'high' ||
      parsed.priority === 'low'
        ? parsed.priority
        : 'normal',
    steps:
      steps.length > 0
        ? steps
        : [{ botId: 'alex', instruction: params.command, dependsOnPrevious: false }],
    requiresApproval: Boolean(parsed.requiresApproval),
    approvalActionType:
      parsed.requiresApproval && parsed.approvalActionType
        ? (parsed.approvalActionType as ApprovalActionType)
        : parsed.requiresApproval
          ? 'share_document'
          : null,
    approvalTitle: parsed.approvalTitle || null,
  };
}

export async function executeSpecialistStep(params: {
  employee: EmployeeProfile;
  instruction: string;
  previousOutput?: string;
  emails: InboxEmail[];
  calendarEvents: CalendarEvent[];
  tasks: TaskRecord[];
}): Promise<{ output: string; sources: SourceCitation[] }> {
  const ai = getAiClient();
  const { employee } = params;

  let contextBlock = '';
  if (employee.id === 'emma') {
    contextBlock = `\nCurrent Inbox Emails:\n${params.emails
      .slice(0, 8)
      .map(
        (e) =>
          `- [${e.priority}] (${e.provider}) From: ${e.senderName} <${e.senderEmail}> | Subject: ${e.subject} | Status: ${e.status} | PhishingFlag: ${e.phishingFlag}\n  Body: ${e.body}`
      )
      .join('\n')}`;
  } else if (employee.id === 'sophie') {
    contextBlock = `\nCurrent Calendar Events:\n${params.calendarEvents
      .slice(0, 10)
      .map(
        (ev) =>
          `- ${ev.title} | ${ev.startIso} to ${ev.endIso} | Status: ${ev.status} | Location: ${ev.location} | Notes: ${ev.notes}`
      )
      .join('\n')}`;
  } else if (employee.id === 'alex') {
    contextBlock = `\nRecent Tasks:\n${params.tasks
      .slice(0, 8)
      .map((t) => `- [${t.status}] (${t.assignedTo}) ${t.title}`)
      .join('\n')}\nEmails Summary: ${params.emails.length} total (${params.emails.filter((e) => e.priority === 'P1').length} P1 critical, ${params.emails.filter((e) => e.phishingFlag).length} P5 phishing).\nCalendar Conflicts: ${params.calendarEvents.filter((c) => c.status === 'conflict').length}.`;
  }

  const handoffBlock = params.previousOutput
    ? `\n\nInput / Research Handed Off From Previous Specialist:\n${params.previousOutput}`
    : '';

  const useSearch = employee.id === 'max' && employee.permissions.canAccessWeb;

  const response = await withGeminiRetry(() =>
    ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Task Instruction: ${params.instruction}${handoffBlock}${contextBlock}`,
      config: {
        systemInstruction: `${employee.systemPrompt}\n\nPersonality Archetype: ${employee.personality.archetype} (${employee.personality.traits.join(', ')})\nCommunication Style: ${employee.personality.communicationStyle}\nSignature Quirk: ${employee.personality.quirk}\n\nStay authentically in character while providing a clear, thorough, well-structured deliverable. Do not invent fake external executions. ${
          employee.id === 'max'
            ? 'Explicitly separate "Verified Facts" from "Assumptions / Strategic Takeaways" and cite grounded sources.'
            : ''
        }`,
        ...(useSearch ? { tools: [{ googleSearch: {} }] } : {}),
      },
    })
  );

  const sources: SourceCitation[] = [];
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (Array.isArray(chunks)) {
    for (const chunk of chunks) {
      if (chunk.web?.uri) {
        sources.push({
          title: chunk.web.title || chunk.web.uri,
          uri: chunk.web.uri,
        });
      }
    }
  }

  // Deduplicate source links
  const uniqueSources = Array.from(new Map(sources.map((s) => [s.uri, s])).values());

  return {
    output: (response.text ?? '').trim() || `${employee.name} completed the step.`,
    sources: uniqueSources,
  };
}

export async function chatWithSpecialist(params: {
  employee: EmployeeProfile;
  message: string;
  history: Array<{ sender: string; text: string }>;
  emails: InboxEmail[];
  calendarEvents: CalendarEvent[];
  tasks: TaskRecord[];
}): Promise<{ reply: string; sources: SourceCitation[] }> {
  const ai = getAiClient();
  const { employee } = params;

  const recentHistory = params.history
    .slice(-8)
    .map((m) => `${m.sender.toUpperCase()}: ${m.text}`)
    .join('\n');

  let contextSnippet = '';
  if (employee.id === 'emma') {
    contextSnippet = `Inbox (${params.emails.length} messages): ${params.emails
      .slice(0, 6)
      .map((e) => `[${e.priority}] ${e.subject} (${e.senderEmail})`)
      .join('; ')}`;
  } else if (employee.id === 'sophie') {
    contextSnippet = `Calendar (${params.calendarEvents.length} events): ${params.calendarEvents
      .slice(0, 6)
      .map((c) => `${c.title} [${c.startIso}] (${c.status})`)
      .join('; ')}`;
  } else if (employee.id === 'alex') {
    contextSnippet = `Active/Recent Tasks: ${params.tasks
      .slice(0, 6)
      .map((t) => `${t.title} [${t.status}]`)
      .join('; ')}`;
  }

  const useSearch = employee.id === 'max' && employee.permissions.canAccessWeb;

  const response = await withGeminiRetry(() =>
    ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `${contextSnippet ? `Workspace Context: ${contextSnippet}\n\n` : ''}${
        recentHistory ? `Recent Conversation:\n${recentHistory}\n\n` : ''
      }CEO Message: ${params.message}`,
      config: {
        systemInstruction: `${employee.systemPrompt}\nPersonality Archetype: ${employee.personality.archetype} (${employee.personality.traits.join(', ')})\nCommunication Style: ${employee.personality.communicationStyle}\nSignature Quirk: ${employee.personality.quirk}\nStay genuinely in character in your tone and phrasing.\nRemember your permissions: ${JSON.stringify(employee.permissions)}.`,
        ...(useSearch ? { tools: [{ googleSearch: {} }] } : {}),
      },
    })
  );

  const sources: SourceCitation[] = [];
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (Array.isArray(chunks)) {
    for (const chunk of chunks) {
      if (chunk.web?.uri) {
        sources.push({
          title: chunk.web.title || chunk.web.uri,
          uri: chunk.web.uri,
        });
      }
    }
  }

  return {
    reply: (response.text ?? '').trim() || 'Acknowledged, CEO.',
    sources: Array.from(new Map(sources.map((s) => [s.uri, s])).values()),
  };
}

export async function analyzeEmailWithEmma(email: {
  senderName: string;
  senderEmail: string;
  subject: string;
  body: string;
}): Promise<{
  priority: 'P1' | 'P2' | 'P3' | 'P4' | 'P5';
  category: string;
  phishingFlag: boolean;
  phishingReason: string | null;
  summary: string;
  draftReply: string | null;
}> {
  const ai = getAiClient();
  const response = await withGeminiRetry(() =>
    ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Analyze this incoming email:
From: ${email.senderName} <${email.senderEmail}>
Subject: ${email.subject}
Body:
${email.body}`,
      config: {
        systemInstruction:
          'You are Emma, Email & Communication Assistant. Classify priority as P1 (Critical), P2 (Important), P3 (Normal), P4 (Low), or P5 (Spam or suspicious/phishing). Flag phishing indicators accurately. Provide a concise executive summary and a professional draft reply (or null/empty string if P5 spam/phishing).',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            priority: { type: Type.STRING, description: 'P1, P2, P3, P4, or P5' },
            category: { type: Type.STRING },
            phishingFlag: { type: Type.BOOLEAN },
            phishingReason: { type: Type.STRING },
            summary: { type: Type.STRING },
            draftReply: { type: Type.STRING },
          },
          required: ['priority', 'category', 'phishingFlag', 'summary'],
        },
      },
    })
  );

  const parsed = JSON.parse((response.text ?? '{}').trim()) as {
    priority?: string;
    category?: string;
    phishingFlag?: boolean;
    phishingReason?: string;
    summary?: string;
    draftReply?: string;
  };

  const validP = new Set(['P1', 'P2', 'P3', 'P4', 'P5']);
  const priority = validP.has(parsed.priority ?? '')
    ? (parsed.priority as 'P1' | 'P2' | 'P3' | 'P4' | 'P5')
    : 'P3';

  return {
    priority,
    category: parsed.category || 'General Correspondence',
    phishingFlag: Boolean(parsed.phishingFlag) || priority === 'P5',
    phishingReason: parsed.phishingReason || null,
    summary: parsed.summary || 'Email analyzed by Emma.',
    draftReply: priority === 'P5' ? null : parsed.draftReply || null,
  };
}
