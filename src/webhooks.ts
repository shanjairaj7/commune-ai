import crypto from 'crypto';
import { Webhook } from 'svix';
import type { SvixHeaders } from './types.js';

export const verifyResendWebhook = (
  payload: string,
  headers: SvixHeaders,
  secret: string
) => {
  const webhook = new Webhook(secret);
  const svixHeaders = {
    'svix-id': headers.id,
    'svix-timestamp': headers.timestamp,
    'svix-signature': headers.signature,
  };

  return webhook.verify(payload, svixHeaders);
};

// ─── Commune outbound webhook verification ──────────────────────────────────

export interface CommuneWebhookHeaders {
  /** The `x-commune-signature` header value, e.g. `"v1=5a3f2b..."` */
  signature: string;
  /** The `x-commune-timestamp` header value (Unix milliseconds) */
  timestamp: string;
}

/**
 * Compute the expected `v1=` HMAC-SHA256 signature for a Commune webhook.
 *
 * Matches the backend's `computeSignature(body, timestamp, secret)`.
 */
export const computeCommuneSignature = (
  body: string,
  timestamp: string,
  secret: string
): string => {
  const digest = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${body}`, 'utf8')
    .digest('hex');
  return `v1=${digest}`;
};

/**
 * Verify a Commune outbound webhook signature.
 *
 * Commune signs every webhook delivery with HMAC-SHA256:
 * ```
 * x-commune-signature: v1={HMAC-SHA256(secret, "{timestamp}.{body}")}
 * x-commune-timestamp: {unix_ms}
 * ```
 *
 * @param rawBody - The raw request body string
 * @param timestamp - The `x-commune-timestamp` header (Unix ms)
 * @param signature - The `x-commune-signature` header (`v1=...`)
 * @param secret - Your inbox webhook secret
 * @param toleranceMs - Max age in milliseconds (default 300000 = 5 min)
 * @returns `true` if valid
 * @throws Error if signature is invalid or timestamp is too old
 *
 * @example
 * ```ts
 * import { verifyCommuneWebhook } from "commune-ai";
 *
 * const isValid = verifyCommuneWebhook({
 *   rawBody: req.body,
 *   timestamp: req.headers["x-commune-timestamp"],
 *   signature: req.headers["x-commune-signature"],
 *   secret: process.env.COMMUNE_WEBHOOK_SECRET!,
 * });
 * ```
 */
export const verifyCommuneWebhook = (params: {
  rawBody: string;
  timestamp: string;
  signature: string;
  secret: string;
  toleranceMs?: number;
}): boolean => {
  const { rawBody, timestamp, signature, secret, toleranceMs = 5 * 60 * 1000 } = params;

  if (!signature) throw new Error('Missing x-commune-signature header');
  if (!timestamp) throw new Error('Missing x-commune-timestamp header');
  if (!secret) throw new Error('Missing webhook secret');

  const expected = computeCommuneSignature(rawBody, timestamp, secret);

  // Constant-time comparison
  if (expected.length !== signature.length) {
    throw new Error('Invalid webhook signature');
  }
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
    throw new Error('Invalid webhook signature');
  }

  // Replay protection
  const age = Date.now() - parseInt(timestamp, 10);
  if (Number.isNaN(age) || age > toleranceMs) {
    throw new Error(`Webhook timestamp too old (${Math.round(age / 1000)}s)`);
  }

  return true;
};
