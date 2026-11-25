const INVALID_FIREBASE_TOKEN_CODES = new Set([
  'auth/argument-error',
  'auth/id-token-expired',
  'auth/id-token-revoked',
  'auth/invalid-id-token',
  'auth/user-disabled',
  'auth/user-not-found',
]);

export function getSafeErrorCode(error: unknown): string | number | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  const code = error.code;
  if (typeof code === 'number' && Number.isInteger(code)) return code;
  if (typeof code === 'string' && /^[A-Za-z0-9._/-]{1,64}$/.test(code)) return code;
  return undefined;
}

export function isInvalidFirebaseTokenError(error: unknown): boolean {
  const code = getSafeErrorCode(error);
  return typeof code === 'string' && INVALID_FIREBASE_TOKEN_CODES.has(code);
}

export function logAuthBackendFailure(operation: string, error: unknown): void {
  const errorName =
    error instanceof Error && /^[A-Za-z0-9._-]{1,64}$/.test(error.name)
      ? error.name
      : 'UnknownError';
  const errorCode = getSafeErrorCode(error);
  console.error('Authentication backend operation failed', {
    operation,
    errorName,
    ...(errorCode === undefined ? {} : { errorCode }),
  });
}
