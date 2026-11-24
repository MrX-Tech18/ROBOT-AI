import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  type User,
} from 'firebase/auth';
import { auth } from './firebase';

let isSigningIn = false;
let cachedGoogleAccessToken: string | null = null;

function buildGoogleWorkspaceProvider(scopes: readonly string[]): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  for (const scope of scopes) {
    provider.addScope(scope);
  }
  provider.setCustomParameters({
    prompt: 'consent',
    include_granted_scopes: 'true',
  });
  return provider;
}

export function initGoogleWorkspaceAuth(
  onAuthenticated?: (user: User, accessToken: string | null) => void,
  onSignedOut?: () => void
): () => void {
  return onAuthStateChanged(auth, (user) => {
    if (user) {
      if (!isSigningIn && onAuthenticated) {
        onAuthenticated(user, cachedGoogleAccessToken);
      }
    } else {
      cachedGoogleAccessToken = null;
      if (onSignedOut) onSignedOut();
    }
  });
}

export async function signInWithGoogle(): Promise<{
  user: User;
  idToken: string;
}> {
  isSigningIn = true;
  try {
    const result = await signInWithPopup(auth, new GoogleAuthProvider());
    const idToken = await result.user.getIdToken();
    return { user: result.user, idToken };
  } finally {
    isSigningIn = false;
  }
}

export async function signInWithGoogleWorkspace(scopes: readonly string[]): Promise<{
  user: User;
  idToken: string;
  accessToken: string;
}> {
  isSigningIn = true;
  try {
    const provider = buildGoogleWorkspaceProvider(scopes);
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Google OAuth did not return a Workspace access token.');
    }
    cachedGoogleAccessToken = credential.accessToken;
    const idToken = await result.user.getIdToken();
    return {
      user: result.user,
      idToken,
      accessToken: cachedGoogleAccessToken,
    };
  } finally {
    isSigningIn = false;
  }
}

export function getCachedGoogleAccessToken(): string | null {
  return cachedGoogleAccessToken;
}

export async function clearGoogleWorkspaceTokens(): Promise<void> {
  cachedGoogleAccessToken = null;
  if (auth.currentUser) {
    await auth.signOut().catch(() => undefined);
  }
}
