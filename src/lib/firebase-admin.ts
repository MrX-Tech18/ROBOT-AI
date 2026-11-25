import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const firebaseConfig: unknown = JSON.parse(
  readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'),
);

if (
  typeof firebaseConfig !== 'object' ||
  firebaseConfig === null ||
  !('projectId' in firebaseConfig) ||
  typeof firebaseConfig.projectId !== 'string'
) {
  throw new Error('Firebase applet config must define a projectId.');
}

const projectId = firebaseConfig.projectId;

function getCredentialOptions() {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson) {
    let serviceAccount: unknown;
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
    } catch {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON must contain valid JSON.');
    }

    if (
      typeof serviceAccount !== 'object' ||
      serviceAccount === null ||
      !('client_email' in serviceAccount) ||
      typeof serviceAccount.client_email !== 'string' ||
      !('private_key' in serviceAccount) ||
      typeof serviceAccount.private_key !== 'string'
    ) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is missing client_email or private_key.');
    }

    return {
      credential: cert({
        projectId,
        clientEmail: serviceAccount.client_email,
        privateKey: serviceAccount.private_key.replace(/\\n/g, '\n'),
      }),
    };
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return { credential: applicationDefault() };
  }
  return {};
}

const app =
  getApps()[0] ??
  initializeApp({
    projectId,
    ...getCredentialOptions(),
  });

export const adminAuth = getAuth(app);
export const adminFirestore = getFirestore(app);
