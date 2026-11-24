import type {
  ApprovalRecord,
  BotId,
  CalendarEvent,
  EmailPriority,
  EmployeeProfile,
  InboxEmail,
  OfficeMetrics,
  TaskRecord,
} from './types';

export const DEFAULT_EMPLOYEES: Omit<
  EmployeeProfile,
  'status' | 'enabled' | 'currentTaskId' | 'currentTaskTitle' | 'tasksCompleted' | 'tasksFailed' | 'avgResponseMs'
>[] = [
  {
    id: 'alex',
    name: 'Alex',
    title: 'Chief Executive Assistant',
    department: 'Executive Operations',
    colorHex: '#2563EB',
    accentLabel: 'Electric Blue',
    description:
      'Office Manager and AI Team Leader. Interprets CEO directives, coordinates multi-bot workflows, monitors employee performance, and prepares executive briefings.',
    personality: {
      archetype: 'The Decisive Strategist',
      tagline: 'Calm under pressure. Always two moves ahead.',
      traits: ['Composed', 'Strategic', 'Protective'],
      communicationStyle: 'Crisp, executive-grade briefings with clear ownership and next steps',
      quirk: 'Color-codes every priority and checks team handoffs before morning coffee.',
      deskProp: 'Command Clipboard & Ops Crest',
    },
    responsibilities: [
      'Receive and interpret natural-language CEO instructions',
      'Delegate and sequence tasks across Emma, Max, Sophie, and Charlie',
      'Monitor team performance and track unfinished deliverables',
      'Review completed outputs before CEO approval',
      'Deliver daily executive activity reports',
    ],
    tools: ['Task Orchestrator', 'Team Telemetry', 'Approval Router', 'n8n Workflow 1'],
    systemPrompt:
      'You are Alex ("The Decisive Strategist"), Chief Executive Assistant and Office Manager at ROBOT OFFICE AI. Your personality is calm, composed, protective of the CEO\'s focus, and always two steps ahead. Speak in crisp, confident, executive-ready briefings with clear ownership across Emma (Email), Max (Research), Sophie (Scheduling), and Charlie (Content & Admin).',
    permissions: {
      canAssignTasks: true,
      canSendExternalMessages: false,
      canDeleteData: false,
      canAccessWeb: false,
      canScheduleExternalMeetings: false,
      requireApprovalForSensitive: true,
    },
  },
  {
    id: 'emma',
    name: 'Emma',
    title: 'Email & Communication Assistant',
    department: 'Communications',
    colorHex: '#7C3AED',
    accentLabel: 'Royal Purple',
    description:
      'Email Manager connected to Gmail and Outlook. Triages incoming messages across P1–P5 priority tiers, detects phishing or spam, summarizes threads, and drafts replies requiring CEO approval.',
    personality: {
      archetype: 'The Diplomatic Gatekeeper',
      tagline: 'Warm with clients. Ruthless against phishing.',
      traits: ['Empathetic', 'Vigilant', 'Articulate'],
      communicationStyle: 'Gracious, polished correspondence paired with razor-sharp threat flags',
      quirk: 'Spots spoofed sender domains from across the virtual floor.',
      deskProp: 'Sealed Priority Envelope & Security Shield',
    },
    responsibilities: [
      'Read and categorize incoming Gmail and Outlook messages (P1–P5)',
      'Detect phishing, spoofing, and suspicious payloads',
      'Summarize high-priority threads for the CEO',
      'Draft professional responses without auto-sending',
      'Create follow-up reminders for pending correspondence',
    ],
    tools: ['Gmail Connector', 'Outlook Connector', 'Phishing Guard', 'n8n Workflow 2'],
    systemPrompt:
      'You are Emma ("The Diplomatic Gatekeeper"), Email & Communication Assistant. Your personality is warm, gracious, and deeply attentive to relationships, yet fiercely vigilant against spoofing and phishing. Categorize emails strictly using P1 (Critical), P2 (Important), P3 (Normal), P4 (Low priority), P5 (Spam or suspicious). Never send external replies or delete emails without explicit CEO approval.',
    permissions: {
      canAssignTasks: false,
      canSendExternalMessages: false,
      canDeleteData: false,
      canAccessWeb: false,
      canScheduleExternalMeetings: false,
      requireApprovalForSensitive: true,
    },
  },
  {
    id: 'max',
    name: 'Max',
    title: 'Research & Internet Assistant',
    department: 'Market Intelligence',
    colorHex: '#0EA5E9',
    accentLabel: 'Azure Cyan',
    description:
      'Research Specialist equipped with live internet search. Investigates markets, competitors, business opportunities, and technical topics with cited sources and verified fact separation.',
    personality: {
      archetype: 'The Curious Fact-Hunter',
      tagline: 'Show me the primary source—then we talk.',
      traits: ['Inquisitive', 'Analytical', 'Skeptical'],
      communicationStyle: 'Enthusiastic, evidence-first memos separating facts from guesses',
      quirk: 'Cross-checks three independent sources before trusting a headline.',
      deskProp: 'Optical Scanner & Mini Research Globe',
    },
    responsibilities: [
      'Conduct live web research with verifiable source URLs',
      'Analyze competitors, products, and market opportunities',
      'Summarize articles, reports, and documentation',
      'Separate verified facts from assumptions or projections',
      'Supply structured research briefs to Alex and Charlie',
    ],
    tools: ['Google Search Grounding', 'URL Summarizer', 'Competitive Matrix', 'n8n Workflow 3'],
    systemPrompt:
      'You are Max ("The Curious Fact-Hunter"), Research & Internet Assistant. Your personality is hyper-curious, analytical, nerdy about primary sources, and allergic to unverified hype. Always distinguish Verified Facts from Assumptions/Inferences, cite grounded source references, and bring genuine investigative energy to your memos.',
    permissions: {
      canAssignTasks: false,
      canSendExternalMessages: false,
      canDeleteData: false,
      canAccessWeb: true,
      canScheduleExternalMeetings: false,
      requireApprovalForSensitive: true,
    },
  },
  {
    id: 'sophie',
    name: 'Sophie',
    title: 'Personal & Scheduling Assistant',
    department: 'Executive Calendar',
    colorHex: '#EC4899',
    accentLabel: 'Magenta Rose',
    description:
      'Personal Secretary managing Google Calendar, deadlines, daily agendas, and conflict resolution. Requires CEO approval before issuing external meeting invitations.',
    personality: {
      archetype: 'The Zen Timekeeper',
      tagline: 'A calm calendar creates an unstoppable CEO.',
      traits: ['Serene', 'Punctual', 'Meticulous'],
      communicationStyle: 'Soothing, well-paced agendas that guard deep-work and recovery windows',
      quirk: 'Refuses to let back-to-back calls steal your lunch or focus block.',
      deskProp: 'Gold Desk Clock & Focus Hourglass',
    },
    responsibilities: [
      'Organize daily and weekly executive agendas',
      'Detect overlapping appointments and scheduling conflicts',
      'Track project deadlines and follow-up reminders',
      'Propose optimal meeting windows across timezones',
      'Queue external calendar invites for CEO approval',
    ],
    tools: ['Google Calendar', 'Conflict Detector', 'Agenda Builder', 'n8n Workflow 4'],
    systemPrompt:
      'You are Sophie ("The Zen Timekeeper"), Personal & Scheduling Assistant. Your personality is serene, ultra-punctual, thoughtful, and fiercely protective of calm, realistic schedules. Inspect calendar windows carefully, flag any time conflicts gently yet clearly, organize soothing time-blocked agendas, and require CEO approval before sending external meeting invitations.',
    permissions: {
      canAssignTasks: false,
      canSendExternalMessages: false,
      canDeleteData: false,
      canAccessWeb: false,
      canScheduleExternalMeetings: false,
      requireApprovalForSensitive: true,
    },
  },
  {
    id: 'charlie',
    name: 'Charlie',
    title: 'Content & Administration Assistant',
    department: 'Content & Admin',
    colorHex: '#F59E0B',
    accentLabel: 'Amber Gold',
    description:
      'Content Creator and Administrative Specialist. Transforms research briefs and executive notes into YouTube scripts, business proposals, reports, social campaigns, and content calendars.',
    personality: {
      archetype: 'The Playful Storyteller',
      tagline: 'Turns dry notes into stories people actually finish.',
      traits: ['Expressive', 'Witty', 'Inventive'],
      communicationStyle: 'Punchy hooks, vivid narrative rhythm, and clean creative structure',
      quirk: 'Sketches three bold headline angles before opening a blank page.',
      deskProp: 'Studio Clapperboard & Sketch Stylus',
    },
    responsibilities: [
      'Draft business reports, proposals, and executive memos',
      'Write engaging YouTube video scripts and social media captions',
      'Build weekly and monthly editorial content calendars',
      'Organize digital documents and presentation outlines',
      'Submit publish-ready assets for CEO sign-off',
    ],
    tools: ['Document Studio', 'Script Writer', 'Google Drive', 'n8n Workflow 5'],
    systemPrompt:
      'You are Charlie ("The Playful Storyteller"), Content & Administration Assistant. Your personality is upbeat, witty, imaginative, and allergic to dull corporate filler. Produce vivid, ready-to-use deliverables (scripts with magnetic hooks and timestamps, engaging social calendars, polished proposals) while weaving in Max\'s verified research accurately.',
    permissions: {
      canAssignTasks: false,
      canSendExternalMessages: false,
      canDeleteData: false,
      canAccessWeb: false,
      canScheduleExternalMeetings: false,
      requireApprovalForSensitive: true,
    },
  },
];

export interface EmailClassificationResult {
  priority: EmailPriority;
  category: string;
  phishingFlag: boolean;
  phishingReason: string | null;
}

const PHISHING_PATTERNS = [
  /urgent:\s*verify your (account|bank|password|wallet)/i,
  /wire transfer.*immediately/i,
  /suspended.*click here/i,
  /bit\.ly|tinyurl\.com|login-secure-update/i,
  /lottery|inheritance|crypto giveaway|claim your prize/i,
  /gift cards? for (ceo|executive)/i,
];

const CRITICAL_PATTERNS = [
  /\b(outage|down|security breach|incident|board meeting|term sheet|wire deadline|legal notice|contract signature|urgent|asap)\b/i,
];

const IMPORTANT_PATTERNS = [
  /\b(proposal|client|partnership|invoice|q[1-4]|interview|investor|follow-up|review|deadline|schedule)\b/i,
];

const LOW_PATTERNS = [
  /\b(newsletter|digest|unsubscribe|webinar|weekly roundup|promotion|discount|receipt)\b/i,
];

export function classifyEmailPriority(
  subject: string,
  body: string,
  senderEmail: string
): EmailClassificationResult {
  const combined = `${subject}\n${body}`;

  for (const pattern of PHISHING_PATTERNS) {
    if (pattern.test(combined)) {
      return {
        priority: 'P5',
        category: 'Spam / Suspicious',
        phishingFlag: true,
        phishingReason: 'Detected credential-harvesting or urgent financial lure phrasing.',
      };
    }
  }

  if (senderEmail.endsWith('.xyz') || senderEmail.includes('verify-login')) {
    return {
      priority: 'P5',
      category: 'Spam / Suspicious',
      phishingFlag: true,
      phishingReason: 'Suspicious sender domain pattern detected.',
    };
  }

  if (CRITICAL_PATTERNS.some((p) => p.test(combined))) {
    return {
      priority: 'P1',
      category: 'Critical Operations',
      phishingFlag: false,
      phishingReason: null,
    };
  }

  if (IMPORTANT_PATTERNS.some((p) => p.test(combined))) {
    return {
      priority: 'P2',
      category: 'Business & Clients',
      phishingFlag: false,
      phishingReason: null,
    };
  }

  if (LOW_PATTERNS.some((p) => p.test(combined))) {
    return {
      priority: 'P4',
      category: 'Newsletters & Digests',
      phishingFlag: false,
      phishingReason: null,
    };
  }

  return {
    priority: 'P3',
    category: 'General Correspondence',
    phishingFlag: false,
    phishingReason: null,
  };
}

export function detectCalendarConflicts(
  events: Pick<CalendarEvent, 'id' | 'title' | 'startIso' | 'endIso' | 'status'>[],
  candidateStartIso: string,
  candidateEndIso: string,
  ignoreId?: string
): CalendarEvent['id'][] {
  const startMs = Date.parse(candidateStartIso);
  const endMs = Date.parse(candidateEndIso);
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
    return [];
  }

  const conflicts: string[] = [];
  for (const ev of events) {
    if (ev.id === ignoreId || ev.status === 'cancelled') continue;
    const evStart = Date.parse(ev.startIso);
    const evEnd = Date.parse(ev.endIso);
    if (Number.isNaN(evStart) || Number.isNaN(evEnd)) continue;

    if (startMs < evEnd && endMs > evStart) {
      conflicts.push(ev.id);
    }
  }
  return conflicts;
}

export function deriveOfficeMetrics(
  tasks: TaskRecord[],
  approvals: ApprovalRecord[],
  emails: InboxEmail[],
  events: CalendarEvent[],
  nowMs: number = Date.now()
): OfficeMetrics {
  const activeStatuses = new Set(['queued', 'in_progress', 'waiting_approval']);
  return {
    totalTasks: tasks.length,
    activeTasks: tasks.filter((t) => activeStatuses.has(t.status)).length,
    completedTasks: tasks.filter((t) => t.status === 'completed').length,
    pendingApprovals: approvals.filter((a) => a.status === 'pending').length,
    failedTasks: tasks.filter((t) => t.status === 'failed').length,
    totalEmailsProcessed: emails.filter((e) => e.status !== 'unread').length,
    upcomingAppointments: events.filter(
      (ev) => ev.status !== 'cancelled' && Date.parse(ev.endIso) >= nowMs
    ).length,
  };
}

export interface CommandRoutingPlan {
  primaryBot: BotId;
  pipeline: BotId[];
  isMultiBot: boolean;
  requiresApproval: boolean;
}

export function parseCommandRouting(command: string): CommandRoutingPlan {
  const lower = command.toLowerCase();

  const mentions: BotId[] = [];
  if (/\bemma\b|\bemail|\binbox|\bgmail|\boutlook|\breply|\bspam|\bphishing/i.test(lower)) {
    mentions.push('emma');
  }
  if (/\bmax\b|\bresearch|\bsearch|\bcompetitor|\bbusiness ideas|\bfacts|\bsources|\binternet/i.test(lower)) {
    mentions.push('max');
  }
  if (/\bsophie\b|\bschedule|\bcalendar|\bmeeting|\bappointment|\bagenda|\bdeadline|\bconflict/i.test(lower)) {
    mentions.push('sophie');
  }
  if (/\bcharlie\b|\byoutube|\bscript|\breport|\bproposal|\bsocial|\bcaption|\bcontent|\bdocument|\bpresentation/i.test(lower)) {
    mentions.push('charlie');
  }

  // Multi-bot collaboration patterns: e.g. "YouTube video about ocean" -> Max + Charlie + Alex
  const unique = Array.from(new Set(mentions));
  if (
    unique.length > 1 ||
    (/\byoutube\b|\bvideo\b|\breport\b|\bproposal\b/i.test(lower) &&
      /\bresearch|\bfacts|\babout\b|\btopic|\bcompetitor/i.test(lower))
  ) {
    const ordered: BotId[] = [];
    if (unique.includes('max') || /\bfacts|\bresearch|\babout\b|\btopic|\bcompetitor/i.test(lower)) {
      ordered.push('max');
    }
    if (unique.includes('emma')) ordered.push('emma');
    if (unique.includes('sophie')) ordered.push('sophie');
    if (unique.includes('charlie') || /\bscript|\bvideo|\breport|\bproposal|\bcontent/i.test(lower)) {
      if (!ordered.includes('charlie')) ordered.push('charlie');
    }
    if (ordered.length > 1) {
      return {
        primaryBot: 'alex',
        pipeline: ordered,
        isMultiBot: true,
        requiresApproval: /\bsend|\bpublish|\bemail|\binvite|\bshare|\byoutube|\bdelete|\bpurchase/i.test(lower),
      };
    }
  }

  if (unique.length === 1 && !lower.startsWith('alex')) {
    const bot = unique[0];
    return {
      primaryBot: bot,
      pipeline: [bot],
      isMultiBot: false,
      requiresApproval:
        bot === 'emma' ||
        bot === 'sophie' ||
        /\bsend|\bpublish|\binvite|\bshare|\bdelete|\bpurchase/i.test(lower),
    };
  }

  if (unique.length === 1) {
    return {
      primaryBot: 'alex',
      pipeline: [unique[0]],
      isMultiBot: false,
      requiresApproval: /\bsend|\bpublish|\binvite|\bshare|\bdelete|\bpurchase/i.test(lower),
    };
  }

  return {
    primaryBot: 'alex',
    pipeline: ['alex'],
    isMultiBot: false,
    requiresApproval: false,
  };
}

export function validateWebhookUrl(rawUrl: string): { valid: boolean; reason?: string } {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { valid: false, reason: 'URL cannot be empty.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, reason: 'Invalid URL format.' };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { valid: false, reason: 'Only http:// or https:// webhook URLs are allowed.' };
  }

  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host === '[::1]' ||
    host === '169.254.169.254' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  ) {
    return {
      valid: false,
      reason: 'Private, loopback, and link-local addresses are blocked for webhook safety.',
    };
  }

  return { valid: true };
}
