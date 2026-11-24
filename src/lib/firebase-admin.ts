import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
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

if (!getApps().length) {
  initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

export const adminAuth = getAuth();
