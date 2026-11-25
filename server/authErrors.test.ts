import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getSafeErrorCode,
  isInvalidFirebaseTokenError,
  logAuthBackendFailure,
} from './authErrors.ts';

test('Firebase token errors are distinguished from authentication service failures', () => {
  assert.equal(isInvalidFirebaseTokenError({ code: 'auth/id-token-expired' }), true);
  assert.equal(isInvalidFirebaseTokenError({ code: 'auth/invalid-credential' }), false);
  assert.equal(isInvalidFirebaseTokenError(new Error('invalid token')), false);
});

test('auth backend diagnostics keep error messages and secrets out of logs', () => {
  const originalError = console.error;
  const logged: unknown[][] = [];
  console.error = (...args: unknown[]) => logged.push(args);
  try {
    const error = Object.assign(new Error('private-key-or-user-data'), {
      code: 'permission-denied',
    });
    logAuthBackendFailure('rate-limit:auth-login', error);
  } finally {
    console.error = originalError;
  }

  assert.deepEqual(logged, [
    [
      'Authentication backend operation failed',
      {
        operation: 'rate-limit:auth-login',
        errorName: 'Error',
        errorCode: 'permission-denied',
      },
    ],
  ]);
  assert.equal(getSafeErrorCode({ code: 'secret value' }), undefined);
});
