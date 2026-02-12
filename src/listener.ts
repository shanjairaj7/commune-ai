import type { InboundEmailWebhookPayload, UnifiedMessage } from './types.js';

export type CommuneWebhookEvent = InboundEmailWebhookPayload;

export type CommuneWebhookHandlerContext = {
  payload: CommuneWebhookEvent;
  rawBody: string;
  headers: Record<string, string | undefined>;
};

export type CreateWebhookHandlerOptions = {
  onEvent: (message: UnifiedMessage, context: CommuneWebhookHandlerContext) => Promise<void> | void;
  verify?: (input: { rawBody: string; headers: Record<string, string | undefined> }) => boolean;
};

const collectNodeBody = async (req: any): Promise<string> => {
  if (req?.body) {
    if (Buffer.isBuffer(req.body)) {
      return req.body.toString('utf8');
    }
    if (typeof req.body === 'string') {
      return req.body;
    }
  }

  return await new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
};

const getHeadersFromNode = (req: any) => {
  const headers: Record<string, string | undefined> = {};
  if (!req?.headers) {
    return headers;
  }
  for (const [key, value] of Object.entries(req.headers)) {
    headers[key.toLowerCase()] = Array.isArray(value) ? value[0] : value;
  }
  return headers;
};

const parsePayload = (rawBody: string) => {
  try {
    return JSON.parse(rawBody) as InboundEmailWebhookPayload;
  } catch (error) {
    return null;
  }
};

export const createWebhookHandler = ({ onEvent, verify }: CreateWebhookHandlerOptions) => {
  return async (req: any, res?: any) => {
    if (req?.method && req.method !== 'POST') {
      if (res) {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
      }
      return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const isWebRequest = typeof req?.text === 'function';
    const rawBody = isWebRequest ? await req.text() : await collectNodeBody(req);
    const headers = isWebRequest
      ? {
          'x-commune-signature': req.headers.get('x-commune-signature') || undefined,
          'x-commune-timestamp': req.headers.get('x-commune-timestamp') || undefined,
        }
      : getHeadersFromNode(req);

    if (verify && !verify({ rawBody, headers })) {
      if (res) {
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const payload = parsePayload(rawBody);
    if (!payload) {
      if (res) {
        res.status(400).json({ error: 'Invalid JSON payload' });
        return;
      }
      return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await onEvent(payload.message, { payload, rawBody, headers });

    if (res) {
      res.json({ ok: true });
      return;
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
};
