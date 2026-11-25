import assert from 'node:assert/strict';
import test from 'node:test';
import type { LookupAddress } from 'node:dns';
import {
  createPinnedLookup,
  isPublicIpAddress,
  resolveWebhookTarget,
} from './webhookRequest.ts';

const publicAddress: LookupAddress = { address: '8.8.8.8', family: 4 };

test('only accepts webhook DNS results that are globally routable', async () => {
  const target = await resolveWebhookTarget(
    'https://hooks.example.com/workflow',
    async () => [publicAddress]
  );

  assert.equal(target.url.hostname, 'hooks.example.com');
  assert.deepEqual(target.address, publicAddress);
});

test('rejects webhook hosts with any private or special-use DNS result', async () => {
  for (const address of [
    '10.0.0.1',
    '100.64.0.1',
    '169.254.169.254',
    '127.0.0.1',
    '::1',
    'fc00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
    '2001:db8::1',
  ]) {
    assert.equal(isPublicIpAddress(address), false, `${address} should not be public`);
    await assert.rejects(
      resolveWebhookTarget('https://hooks.example.com/workflow', async () => [
        publicAddress,
        { address, family: address.includes(':') ? 6 : 4 },
      ]),
      /resolve exclusively to public IP addresses/
    );
  }
});

test('pins the outgoing lookup to the address that passed validation', async () => {
  const lookup = createPinnedLookup(publicAddress);
  const result = await new Promise<LookupAddress>((resolve, reject) => {
    lookup('hooks.example.com', {}, (error, address, family) => {
      if (error) {
        reject(error);
        return;
      }
      if (typeof address !== 'string') {
        reject(new Error('Expected one pinned address.'));
        return;
      }
      resolve({ address, family: family ?? 0 });
    });
  });

  assert.deepEqual(result, publicAddress);
});
