import { lookup as dnsLookup } from 'node:dns/promises';
import type { LookupAddress } from 'node:dns';
import { request as httpRequest } from 'node:http';
import type { RequestOptions } from 'node:http';
import type { LookupFunction } from 'node:net';
import { request as httpsRequest } from 'node:https';
import ipaddr from 'ipaddr.js';
import { validateWebhookUrl } from '../src/shared/officeLogic.ts';

const DNS_TIMEOUT_MS = 3000;

type ResolveAddresses = (hostname: string) => Promise<LookupAddress[]>;

interface ResolvedWebhookTarget {
  url: URL;
  address: LookupAddress;
}

interface WebhookResponse {
  ok: boolean;
  status: number;
  statusText: string;
}

const resolveAddresses: ResolveAddresses = (hostname) =>
  dnsLookup(hostname, { all: true, verbatim: true });

export function isPublicIpAddress(address: string): boolean {
  try {
    return ipaddr.process(address).range() === 'unicast';
  } catch {
    return false;
  }
}

export async function resolveWebhookTarget(
  rawUrl: string,
  resolver: ResolveAddresses = resolveAddresses
): Promise<ResolvedWebhookTarget> {
  const validation = validateWebhookUrl(rawUrl);
  if (!validation.valid) {
    throw new Error(validation.reason ?? 'Invalid webhook URL.');
  }

  const url = new URL(rawUrl.trim());
  if (url.username || url.password) {
    throw new Error('Webhook URLs cannot contain credentials.');
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  let timer: ReturnType<typeof setTimeout> | undefined;
  let addresses: LookupAddress[];
  try {
    addresses = await Promise.race([
      resolver(hostname),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Webhook DNS resolution timed out.')),
          DNS_TIMEOUT_MS
        );
      }),
    ]);
  } catch (error) {
    throw new Error('Unable to safely resolve webhook hostname.', { cause: error });
  } finally {
    if (timer) clearTimeout(timer);
  }

  if (!addresses.length || addresses.some(({ address }) => !isPublicIpAddress(address))) {
    throw new Error('Webhook host must resolve exclusively to public IP addresses.');
  }

  return { url, address: addresses[0] };
}

export function createPinnedLookup(address: LookupAddress): LookupFunction {
  return (_hostname, options, callback) => {
    const pinnedAddress = { address: address.address, family: address.family };
    if (options.all) {
      callback(null, [pinnedAddress]);
      return;
    }
    callback(null, pinnedAddress.address, pinnedAddress.family);
  };
}

function sendToPinnedAddress(
  target: ResolvedWebhookTarget,
  payload: string,
  timeoutMs: number
): Promise<WebhookResponse> {
  const { url, address } = target;
  const request = url.protocol === 'https:' ? httpsRequest : httpRequest;
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const options: RequestOptions = {
    agent: false,
    headers: {
      'content-length': Buffer.byteLength(payload),
      'content-type': 'application/json',
    },
    hostname,
    lookup: createPinnedLookup(address),
    method: 'POST',
    path: `${url.pathname}${url.search}`,
    port: url.port || undefined,
    signal: AbortSignal.timeout(timeoutMs),
  };

  return new Promise((resolve, reject) => {
    const req = request(options, (res) => {
      res.resume();
      res.once('error', reject);
      res.once('end', () => {
        const status = res.statusCode ?? 0;
        resolve({
          ok: status >= 200 && status < 300,
          status,
          statusText: res.statusMessage ?? '',
        });
      });
    });
    req.once('error', reject);
    req.end(payload);
  });
}

export async function postWebhookJson(
  rawUrl: string,
  payload: Record<string, unknown>,
  timeoutMs: number
): Promise<WebhookResponse> {
  const target = await resolveWebhookTarget(rawUrl);
  return sendToPinnedAddress(target, JSON.stringify(payload), timeoutMs);
}
