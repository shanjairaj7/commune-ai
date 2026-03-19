import type {
  ApiError,
  ApiResponse,
  AttachmentRecord,
  AttachmentUrl,
  AttachmentUploadResponse,
  Channel,
  CreateDomainPayload,
  DomainEntry,
  InboxEntry,
  MessageListParams,
  SendMessagePayload,
  UnifiedMessage,
  SearchFilter,
  SearchOptions,
  SearchResult,
  IndexConversationPayload,
  Thread,
  ThreadListParams,
  ThreadListResponse,
  SearchThreadsParams,
  SearchThreadResult,
  ThreadMetadataEntry,
  DeliveryMetricsParams,
  DeliveryEventEntry,
  DeliveryEventsParams,
  DeliverySuppressionsParams,
  SuppressionEntry,
  CreditBalance,
  CreditBundle,
  CreditCheckoutResult,
  FeedbackSubmitPayload,
  FeedbackResult,
} from './types.js';

const DEFAULT_BASE_URL = 'https://api.commune.email';

/**
 * x402Client interface — matches the x402 SDK's client shape.
 * Developers can pass their own pre-configured x402Client for full control
 * over signers, networks, and policies.
 */
export interface X402ClientLike {
  [key: string]: unknown;
}

/**
 * Client options — two auth modes:
 *
 * 1. API key (existing Stripe subscription):
 *    `new CommuneClient({ apiKey: 'comm_xxx' })`
 *
 * 2. Wallet (x402 pay-per-call):
 *    `new CommuneClient({ wallet: '0xPRIVATE_KEY' })`
 *    `new CommuneClient({ wallet: x402Client })`
 *
 * 3. Auto-detect from environment:
 *    `new CommuneClient()`
 *    Reads COMMUNE_API_KEY or COMMUNE_WALLET_KEY.
 */
export type ClientOptions =
  | { apiKey: string;  baseUrl?: string; headers?: Record<string, string>; fetcher?: typeof fetch }
  | { wallet: string | X402ClientLike; baseUrl?: string; headers?: Record<string, string> }
  | { baseUrl?: string; headers?: Record<string, string> }
  ;

const buildQuery = (params: Record<string, string | number | undefined>) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    query.set(key, String(value));
  });
  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
};

export class CommuneClient {
  private baseUrl: string;
  private apiKey: string;
  private headers?: Record<string, string>;
  private fetcher: typeof fetch;
  private authMode: 'apikey' | 'wallet';
  private deprecationWarnings = new Set<string>();

  /**
   * Create a Commune client.
   *
   * @example
   * // API key auth (existing Stripe subscription)
   * const client = new CommuneClient({ apiKey: 'comm_xxx' });
   *
   * // Wallet auth (x402 pay-per-call, defaults to Base)
   * const client = new CommuneClient({ wallet: '0xPRIVATE_KEY' });
   *
   * // Wallet auth with pre-configured x402Client (full control)
   * const client = new CommuneClient({ wallet: x402Client });
   *
   * // Auto-detect from COMMUNE_API_KEY or COMMUNE_WALLET_KEY env vars
   * const client = new CommuneClient();
   */
  constructor(options?: ClientOptions) {
    const opts = options || {};
    this.baseUrl = (opts.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');
    this.headers = 'headers' in opts ? opts.headers : undefined;

    // Resolve auth mode
    if ('apiKey' in opts && opts.apiKey) {
      this.apiKey = opts.apiKey;
      this.authMode = 'apikey';
      this.fetcher = ('fetcher' in opts ? opts.fetcher : undefined) || fetch;
    } else if ('wallet' in opts && opts.wallet) {
      this.apiKey = '';
      this.authMode = 'wallet';
      this.fetcher = CommuneClient.createX402Fetcher(opts.wallet);
    } else {
      // Auto-detect from environment
      const envApiKey = typeof process !== 'undefined' ? process.env?.COMMUNE_API_KEY : undefined;
      const envWallet = typeof process !== 'undefined' ? process.env?.COMMUNE_WALLET_KEY : undefined;

      if (envApiKey) {
        this.apiKey = envApiKey;
        this.authMode = 'apikey';
        this.fetcher = fetch;
      } else if (envWallet) {
        this.apiKey = '';
        this.authMode = 'wallet';
        this.fetcher = CommuneClient.createX402Fetcher(envWallet);
      } else {
        throw new Error(
          'No auth configured. Pass { apiKey } or { wallet }, or set COMMUNE_API_KEY / COMMUNE_WALLET_KEY.'
        );
      }
    }
  }

  /**
   * Create an x402-wrapped fetch that handles 402 Payment Required responses.
   *
   * Accepts either:
   * - A private key string: creates a viem wallet and wraps fetch with @x402/fetch
   * - An x402Client instance: wraps fetch with the pre-configured client
   */
  private static createX402Fetcher(wallet: string | X402ClientLike): typeof fetch {
    // Lazy-load x402 dependencies — they're optional peer deps.
    // Use createRequire for ESM compatibility (the SDK is "type": "module").
    let loadModule: (id: string) => any;
    try {
      const { createRequire } = require('module');
      loadModule = createRequire(typeof __filename !== 'undefined' ? __filename : import.meta.url);
    } catch {
      // Fallback for environments where module.createRequire is unavailable
      loadModule = require;
    }

    try {
      if (typeof wallet === 'string') {
        // Private key → create x402Client with EVM signer on Base
        const { x402Client, wrapFetchWithPayment } = loadModule('@x402/fetch');
        const { registerExactEvmScheme } = loadModule('@x402/evm/exact/client');
        const { privateKeyToAccount } = loadModule('viem/accounts');

        const client = new x402Client();
        const signer = privateKeyToAccount(wallet.startsWith('0x') ? wallet : `0x${wallet}`);
        registerExactEvmScheme(client, { signer });

        return wrapFetchWithPayment(fetch, client);
      } else {
        // Pre-configured x402Client — use it directly
        const { wrapFetchWithPayment } = loadModule('@x402/fetch');
        return wrapFetchWithPayment(fetch, wallet);
      }
    } catch (err: any) {
      if (err?.code === 'MODULE_NOT_FOUND' || err?.code === 'ERR_MODULE_NOT_FOUND' || err instanceof ReferenceError) {
        throw new Error(
          'x402 wallet mode requires @x402/fetch and @x402/evm. Install them:\n' +
          '  npm install @x402/fetch @x402/evm viem'
        );
      }
      throw err;
    }
  }

  private warnDeprecated(key: string, message: string) {
    if (this.deprecationWarnings.has(key)) return;
    this.deprecationWarnings.add(key);
    console.warn(message);
  }

  private async request<T>(
    path: string,
    options: RequestInit & { json?: Record<string, unknown> } = {}
  ): Promise<T> {
    const { json, headers, ...rest } = options;
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        ...(this.headers || {}),
        ...(headers || {}),
      },
      body: json ? JSON.stringify(json) : rest.body,
    });

    const data = (await response.json().catch(() => ({}))) as ApiResponse<T> | { error?: ApiError };
    if (!response.ok) {
      const errorValue = (data as ApiResponse<T>)?.error;
      const message =
        errorValue?.message ||
        (typeof (data as any)?.error === 'string' ? (data as any).error : undefined) ||
        response.statusText;
      throw new Error(message);
    }

    if ((data as ApiResponse<T>).data !== undefined) {
      return (data as ApiResponse<T>).data as T;
    }

    return data as T;
  }

  domains = {
    list: async () => {
      const response = await this.request<{ data?: DomainEntry[] } | DomainEntry[]>(`/v1/domains`);
      if (Array.isArray(response)) {
        return response;
      }
      return Array.isArray(response.data) ? response.data : [];
    },
    create: async (payload: CreateDomainPayload) => {
      return this.request<Record<string, unknown>>(`/v1/domains`, {
        method: 'POST',
        json: payload as unknown as Record<string, unknown>,
      });
    },
    get: async (domainId: string) => {
      return this.request<Record<string, unknown>>(`/v1/domains/${encodeURIComponent(domainId)}`);
    },
    verify: async (domainId: string) => {
      return this.request<Record<string, unknown>>(
        `/v1/domains/${encodeURIComponent(domainId)}/verify`,
        { method: 'POST' }
      );
    },
    records: async (domainId: string) => {
      return this.request<unknown[]>(
        `/v1/domains/${encodeURIComponent(domainId)}/records`
      );
    },
    status: async (domainId: string) => {
      return this.request<Record<string, unknown>>(
        `/v1/domains/${encodeURIComponent(domainId)}/status`
      );
    },
  };

  inboxes = {
    /**
     * List inboxes.
     *
     * @param domainId - Optional domain ID to filter by. If omitted, lists all inboxes across all domains.
     * @example
     * // List all inboxes
     * const allInboxes = await commune.inboxes.list();
     *
     * // List inboxes for a specific domain
     * const domainInboxes = await commune.inboxes.list('domain-id');
     */
    list: async (domainId?: string) => {
      if (domainId) {
        return this.request<InboxEntry[]>(
          `/v1/domains/${encodeURIComponent(domainId)}/inboxes`
        );
      }
      return this.request<InboxEntry[]>(`/v1/inboxes`);
    },
    /**
     * Create a new inbox.
     *
     * @param payload - Inbox configuration
     * @example
     * // Simple creation with auto-resolved domain (recommended)
     * const inbox = await commune.inboxes.create({
     *   localPart: 'support',
     * });
     *
     * // With explicit domain (for custom domains)
     * const inbox = await commune.inboxes.create({
     *   localPart: 'support',
     *   domainId: 'my-domain-id',
     * });
     */
    create: async (
      payload: {
        localPart: string;
        domainId?: string;
        agent?: InboxEntry['agent'];
        webhook?: InboxEntry['webhook'];
        status?: string;
      }
    ) => {
      const { domainId, ...rest } = payload;

      // If domainId provided, use domain-scoped endpoint for explicit control
      if (domainId) {
        return this.request<InboxEntry>(
          `/v1/domains/${encodeURIComponent(domainId)}/inboxes`,
          {
            method: 'POST',
            json: rest as Record<string, unknown>,
          }
        );
      }

      // Otherwise use simple auto-resolved endpoint
      return this.request<InboxEntry>(`/v1/inboxes`, {
        method: 'POST',
        json: payload as Record<string, unknown>,
      });
    },
    update: async (
      domainId: string,
      inboxId: string,
      payload: {
        localPart?: string;
        agent?: InboxEntry['agent'];
        webhook?: InboxEntry['webhook'];
        status?: string;
      }
    ) => {
      return this.request<InboxEntry>(
        `/v1/domains/${encodeURIComponent(domainId)}/inboxes/${encodeURIComponent(inboxId)}`,
        {
          method: 'PUT',
          json: payload as Record<string, unknown>,
        }
      );
    },
    remove: async (domainId: string, inboxId: string) => {
      return this.request<{ ok: boolean }>(
        `/v1/domains/${encodeURIComponent(domainId)}/inboxes/${encodeURIComponent(inboxId)}`,
        { method: 'DELETE' }
      );
    },
    setWebhook: async (
      domainId: string,
      inboxId: string,
      payload: { endpoint: string; events?: string[] }
    ) => {
      return this.request<InboxEntry>(
        `/v1/domains/${encodeURIComponent(domainId)}/inboxes/${encodeURIComponent(inboxId)}/webhook`,
        { method: 'POST', json: payload as Record<string, unknown> }
      );
    },
    setExtractionSchema: async (payload: {
      domainId: string;
      inboxId: string;
      schema: {
        name: string;
        description?: string;
        enabled?: boolean;
        schema: Record<string, any>;
      };
    }) => {
      const { domainId, inboxId, schema } = payload;
      return this.request<InboxEntry>(
        `/v1/domains/${encodeURIComponent(domainId)}/inboxes/${encodeURIComponent(inboxId)}/extraction-schema`,
        { method: 'PUT', json: schema as Record<string, unknown> }
      );
    },
    removeExtractionSchema: async (payload: { domainId: string; inboxId: string }) => {
      const { domainId, inboxId } = payload;
      return this.request<InboxEntry>(
        `/v1/domains/${encodeURIComponent(domainId)}/inboxes/${encodeURIComponent(inboxId)}/extraction-schema`,
        { method: 'DELETE' }
      );
    },
  };

  messages = {
    send: async (payload: SendMessagePayload) => {
      return this.request<Record<string, unknown>>('/v1/messages/send', {
        method: 'POST',
        json: payload as unknown as Record<string, unknown>,
      });
    },
    list: async (params: MessageListParams) => {
      return this.request<UnifiedMessage[]>(
        `/v1/messages${buildQuery({
          sender: params.sender,
          channel: params.channel,
          before: params.before,
          after: params.after,
          limit: params.limit,
          order: params.order,
          domain_id: params.domain_id,
          inbox_id: params.inbox_id,
        })}`
      );
    },
    listByThread: async (threadId: string, params?: { limit?: number; order?: 'asc' | 'desc' }) => {
      return this.request<UnifiedMessage[]>(
        `/v1/threads/${encodeURIComponent(threadId)}/messages${buildQuery({
          limit: params?.limit,
          order: params?.order,
        })}`
      );
    },
  };

  search = {
    threads: async (params: SearchThreadsParams) => {
      return this.request<SearchThreadResult[]>(
        `/v1/search/threads${buildQuery({
          q: params.query,
          inbox_id: params.inboxId,
          domain_id: params.domainId,
          limit: params.limit,
        })}`
      );
    },
  };

  conversations = {
    search: async (query: string, filter: SearchFilter, options?: SearchOptions) => {
      this.warnDeprecated(
        'conversations.search',
        '[commune-ai] `conversations.search` is deprecated. Use `search.threads({ query, inboxId, domainId, limit })`.'
      );
      const inboxId = filter.inboxIds && filter.inboxIds.length > 0 ? filter.inboxIds[0] : undefined;
      return this.search.threads({
        query,
        inboxId,
        domainId: filter.domainId,
        limit: options?.limit,
      }) as unknown as SearchResult[];
    },

    index: async (organizationId: string, conversation: IndexConversationPayload) => {
      this.warnDeprecated(
        'conversations.index',
        '[commune-ai] `conversations.index` is deprecated and will be removed. Indexing is handled automatically.'
      );
      return this.request<{ success: boolean }>('/v1/search/index', {
        method: 'POST',
        json: {
          organizationId,
          conversation,
        },
      });
    },

    indexBatch: async (organizationId: string, conversations: IndexConversationPayload[]) => {
      this.warnDeprecated(
        'conversations.indexBatch',
        '[commune-ai] `conversations.indexBatch` is deprecated and will be removed. Indexing is handled automatically.'
      );
      return this.request<{ success: boolean }>('/v1/search/index/batch', {
        method: 'POST',
        json: {
          organizationId,
          conversations,
        },
      });
    },
  };

  threads = {
    list: async (params: ThreadListParams) => {
      const response = await this.fetcher(
        `${this.baseUrl}/v1/threads${buildQuery({
          inbox_id: params.inbox_id,
          domain_id: params.domain_id,
          limit: params.limit,
          cursor: params.cursor,
          order: params.order,
        })}`,
        {
          headers: {
            'Content-Type': 'application/json',
            ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
            ...(this.headers || {}),
          },
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || response.statusText);
      }
      return data as ThreadListResponse;
    },
    messages: async (threadId: string, params?: { limit?: number; order?: 'asc' | 'desc' }) => {
      return this.request<UnifiedMessage[]>(
        `/v1/threads/${encodeURIComponent(threadId)}/messages${buildQuery({
          limit: params?.limit,
          order: params?.order,
        })}`
      );
    },
    metadata: async (threadId: string) => {
      return this.request<ThreadMetadataEntry>(
        `/v1/threads/${encodeURIComponent(threadId)}/metadata`
      );
    },
    setStatus: async (
      threadId: string,
      status: 'open' | 'needs_reply' | 'waiting' | 'closed'
    ) => {
      return this.request<ThreadMetadataEntry>(
        `/v1/threads/${encodeURIComponent(threadId)}/status`,
        {
          method: 'PUT',
          json: { status },
        }
      );
    },
    addTags: async (threadId: string, tags: string[]) => {
      return this.request<ThreadMetadataEntry>(
        `/v1/threads/${encodeURIComponent(threadId)}/tags`,
        {
          method: 'POST',
          json: { tags },
        }
      );
    },
    removeTags: async (threadId: string, tags: string[]) => {
      return this.request<ThreadMetadataEntry>(
        `/v1/threads/${encodeURIComponent(threadId)}/tags`,
        {
          method: 'DELETE',
          json: { tags },
        }
      );
    },
    assign: async (threadId: string, assignedTo?: string | null) => {
      return this.request<ThreadMetadataEntry>(
        `/v1/threads/${encodeURIComponent(threadId)}/assign`,
        {
          method: 'PUT',
          json: { assigned_to: assignedTo ?? null },
        }
      );
    },
  };

  delivery = {
    metrics: async (params: DeliveryMetricsParams = {}) => {
      return this.request<Record<string, unknown>>(
        `/v1/delivery/metrics${buildQuery({
          inbox_id: params.inboxId,
          domain_id: params.domainId,
          period: params.period,
        })}`
      );
    },
    events: async (params: DeliveryEventsParams = {}) => {
      return this.request<DeliveryEventEntry[]>(
        `/v1/delivery/events${buildQuery({
          message_id: params.messageId,
          inbox_id: params.inboxId,
          domain_id: params.domainId,
          event_type: params.eventType,
          limit: params.limit,
        })}`
      );
    },
    suppressions: async (params: DeliverySuppressionsParams = {}) => {
      return this.request<SuppressionEntry[]>(
        `/v1/delivery/suppressions${buildQuery({
          inbox_id: params.inboxId,
          domain_id: params.domainId,
          limit: params.limit,
        })}`
      );
    },
  };

  attachments = {
    upload: async (content: string, filename: string, mimeType: string) => {
      return this.request<AttachmentUploadResponse>('/v1/attachments/upload', {
        method: 'POST',
        body: JSON.stringify({ content, filename, mimeType }),
      });
    },
    get: async (attachmentId: string, options?: { url?: boolean; expiresIn?: number }) => {
      if (options?.url) {
        const expiresIn = options.expiresIn || 3600;
        return this.request<AttachmentUrl>(
          `/v1/attachments/${encodeURIComponent(attachmentId)}/url?expires_in=${expiresIn}`
        );
      }
      return this.request<AttachmentRecord>(
        `/v1/attachments/${encodeURIComponent(attachmentId)}`
      );
    },
  };

  credits = {
    balance: async () => {
      return this.request<CreditBalance>('/v1/credits');
    },
    bundles: async () => {
      return this.request<CreditBundle[]>('/v1/credits/bundles');
    },
    checkout: async (bundle: 'starter' | 'growth' | 'scale', returnUrl?: string) => {
      return this.request<CreditCheckoutResult>('/v1/credits/checkout', {
        method: 'POST',
        json: {
          bundle,
          ...(returnUrl ? { success_url: returnUrl, cancel_url: returnUrl } : {}),
        },
      });
    },
  };

  feedback = {
    /**
     * Submit feedback to the Commune product team.
     *
     * Three types:
     * - `"error"` — something broke or behaved unexpectedly
     * - `"feature"` — request for new functionality
     * - `"signal"` — observation, impression, or positive note
     *
     * The optional `context` object lets you attach structured metadata
     * that makes feedback actionable (e.g. which endpoint failed, what IDs
     * were involved, what you were trying to do).
     *
     * @example
     * await commune.feedback.submit({
     *   type: 'error',
     *   message: 'Thread list returns 500 when inbox has never received a message',
     *   context: { inbox_id: 'inb_123', status_code: 500 },
     * });
     *
     * await commune.feedback.submit({
     *   type: 'signal',
     *   message: 'Semantic search quality on long threads is excellent',
     * });
     */
    submit: async (payload: FeedbackSubmitPayload) => {
      return this.request<FeedbackResult>('/v1/feedback', {
        method: 'POST',
        json: payload as unknown as Record<string, unknown>,
      });
    },
  };
}
