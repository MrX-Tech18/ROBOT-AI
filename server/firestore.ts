import { createHash } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { adminFirestore } from '../src/lib/firebase-admin.ts';
import type {
  ChatMessage,
  UserProfile,
} from '../src/shared/types.ts';

const CHAT_CHANNELS = ['command', 'alex', 'emma', 'max', 'sophie', 'charlie'] as const;
const CHAT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const CHAT_SENDERS = ['ceo', 'alex', 'emma', 'max', 'sophie', 'charlie', 'system'];

export class InvalidChatMessageError extends Error {
  constructor() {
    super('Invalid chat message.');
    this.name = 'InvalidChatMessageError';
  }
}

export interface UserProfileUpdates {
  name?: string;
  companyName?: string;
  theme?: 'light' | 'dark';
}

function hashValue(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function userRef(uid: string) {
  if (!uid || uid.includes('/')) {
    throw new Error('Invalid authenticated user ID.');
  }
  return adminFirestore.collection('users').doc(uid);
}

export async function ensureFirestoreUser(params: {
  uid: string;
  email: string;
  name?: string;
  companyName?: string;
}): Promise<UserProfile> {
  const profileRef = userRef(params.uid);
  const preferencesRef = profileRef.collection('settings').doc('preferences');
  const now = new Date().toISOString();
  const name = params.name?.trim().slice(0, 100);
  const companyName = params.companyName?.trim().slice(0, 100);

  await adminFirestore.runTransaction(async (transaction) => {
    const [profileSnapshot, preferencesSnapshot] = await Promise.all([
      transaction.get(profileRef),
      transaction.get(preferencesRef),
    ]);
    const existing = profileSnapshot.data();
    if (!profileSnapshot.exists) {
      transaction.create(profileRef, {
        uid: params.uid,
        email: params.email.toLowerCase(),
        name: name || params.email.split('@')[0] || 'Workspace CEO',
        companyName: companyName || 'Robot Office HQ',
        createdAt: now,
        updatedAt: now,
      });
    } else {
      const updates: Record<string, string> = { updatedAt: now };
      if (existing?.email !== params.email.toLowerCase()) {
        updates.email = params.email.toLowerCase();
      }
      if (name) updates.name = name;
      if (companyName) updates.companyName = companyName;
      transaction.set(profileRef, updates, { merge: true });
    }

    if (!preferencesSnapshot.exists) {
      transaction.create(preferencesRef, { theme: 'dark', updatedAt: now });
    }
  });

  const [savedProfile, savedPreferences] = await Promise.all([
    profileRef.get(),
    preferencesRef.get(),
  ]);
  const profile = savedProfile.data();
  const preferences = savedPreferences.data();
  return {
    id: params.uid,
    name: typeof profile?.name === 'string' ? profile.name : 'Workspace CEO',
    email: params.email.toLowerCase(),
    companyName:
      typeof profile?.companyName === 'string' ? profile.companyName : 'Robot Office HQ',
    theme: preferences?.theme === 'light' ? 'light' : 'dark',
    isDemo: false,
  };
}

export async function updateFirestoreUser(
  uid: string,
  updates: UserProfileUpdates
): Promise<UserProfile> {
  const profileRef = userRef(uid);
  const preferencesRef = profileRef.collection('settings').doc('preferences');
  const now = new Date().toISOString();
  const profileUpdates: Record<string, string> = { updatedAt: now };
  const preferencesUpdates: Record<string, string> = { updatedAt: now };
  if (updates.name !== undefined) profileUpdates.name = updates.name;
  if (updates.companyName !== undefined) {
    profileUpdates.companyName = updates.companyName;
  }
  if (updates.theme !== undefined) preferencesUpdates.theme = updates.theme;
  await adminFirestore.runTransaction(async (transaction) => {
    const [profileSnapshot, preferencesSnapshot] = await Promise.all([
      transaction.get(profileRef),
      transaction.get(preferencesRef),
    ]);
    if (!profileSnapshot.exists) {
      throw new Error('Authenticated user profile was not found.');
    }
    transaction.set(profileRef, profileUpdates, { merge: true });
    transaction.set(
      preferencesRef,
      preferencesSnapshot.exists
        ? preferencesUpdates
        : { theme: updates.theme ?? 'dark', updatedAt: now },
      { merge: true }
    );
  });

  const [profileSnapshot, preferencesSnapshot] = await Promise.all([
    profileRef.get(),
    preferencesRef.get(),
  ]);
  const profile = profileSnapshot.data();
  const preferences = preferencesSnapshot.data();
  if (!profile) throw new Error('Authenticated user profile was not found.');
  return {
    id: uid,
    name: typeof profile.name === 'string' ? profile.name : 'Workspace CEO',
    email: typeof profile.email === 'string' ? profile.email : '',
    companyName:
      typeof profile.companyName === 'string' ? profile.companyName : 'Robot Office HQ',
    theme: preferences?.theme === 'light' ? 'light' : 'dark',
    isDemo: false,
  };
}

export async function saveUserChats(
  uid: string,
  messages: unknown[]
): Promise<void> {
  if (messages.length > 200) {
    throw new Error('A maximum of 200 chat messages can be saved at once.');
  }
  const validMessages = messages.filter(isValidChatMessage);
  if (validMessages.length !== messages.length) {
    throw new InvalidChatMessageError();
  }
  const profile = userRef(uid);
  const batch = adminFirestore.batch();
  const now = new Date().toISOString();
  const channelRefs = new Map(
    validMessages.map((message) => [
      message.channel,
      profile.collection('chats').doc(message.channel),
    ])
  );

  for (const message of validMessages) {
    const chatRef = channelRefs.get(message.channel)!;
    batch.set(
      chatRef.collection('messages').doc(message.id),
      {
        id: message.id,
        channel: message.channel,
        sender: message.sender,
        text: message.text,
        metadata: message.metadata ?? null,
        createdAt: message.createdAt,
      },
      { merge: true }
    );
  }
  for (const [channel, chatRef] of channelRefs) {
    batch.set(chatRef, { channel, updatedAt: now }, { merge: true });
  }
  if (validMessages.length > 0) await batch.commit();
}

function isValidChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== 'object') return false;
  const message = value as Partial<ChatMessage>;
  if (
    typeof message.id !== 'string' ||
    !CHAT_ID_PATTERN.test(message.id) ||
    typeof message.channel !== 'string' ||
    !CHAT_CHANNELS.includes(message.channel as (typeof CHAT_CHANNELS)[number]) ||
    typeof message.sender !== 'string' ||
    !CHAT_SENDERS.includes(message.sender) ||
    typeof message.text !== 'string' ||
    message.text.length === 0 ||
    message.text.length > 30000 ||
    typeof message.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(message.createdAt))
  ) {
    return false;
  }
  try {
    return JSON.stringify(message.metadata ?? null).length <= 20000;
  } catch {
    return false;
  }
}

export async function getUserChats(uid: string): Promise<ChatMessage[]> {
  const profile = userRef(uid);
  const results = await Promise.all(
    CHAT_CHANNELS.map(async (channel) => {
      const snapshot = await profile
        .collection('chats')
        .doc(channel)
        .collection('messages')
        .orderBy('createdAt', 'desc')
        .limit(200)
        .get();
      return snapshot.docs.map((document) => document.data() as ChatMessage);
    })
  );
  return results.flat().sort((left, right) => left.createdAt.localeCompare(right.createdAt)).slice(-200);
}

export async function enforceRateLimit(params: {
  key: string;
  limit: number;
  windowMs: number;
}): Promise<boolean> {
  const reference = adminFirestore
    .collection('apiRateLimits')
    .doc(hashValue(params.key));
  const now = Date.now();
  return adminFirestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const data = snapshot.data();
    const windowStartedAt =
      typeof data?.windowStartedAt === 'number' ? data.windowStartedAt : now;
    const count =
      now - windowStartedAt >= params.windowMs ||
      typeof data?.count !== 'number'
        ? 0
        : data.count;
    if (count >= params.limit) return false;
    const nextWindowStart = count === 0 ? now : windowStartedAt;
    transaction.set(reference, {
      count: count + 1,
      windowStartedAt: nextWindowStart,
      expiresAt: Timestamp.fromMillis(nextWindowStart + params.windowMs * 2),
    });
    return true;
  });
}
