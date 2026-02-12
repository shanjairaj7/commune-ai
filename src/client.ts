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
} from './types.js';
import { SearchClient } from './client/search.js';

const DEFAULT_BASE_URL = 'https://web-production-3f46f.up.railway.app';

export type ClientOptions = {
  baseUrl?: string;
  apiKey: string;
  headers?: Record<string, string>;
  fetcher?: typeof fetch;
};

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
  private searchClient: SearchClient;
  private baseUrl: string;
  private apiKey: string;
  private headers?: Record<string, string>;
  private fetcher: typeof fetch;

  constructor(options: ClientOptions) {
    this.baseUrl = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');
    this.apiKey = options.apiKey;
    this.headers = options.headers;
    this.fetcher = options.fetcher || fetch;
    this.searchClient = new SearchClient(this.baseUrl, { Authorization: `Bearer ${this.apiKey}` });
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
    list: async (domainId: string) => {
      return this.request<InboxEntry[]>(
        `/v1/domains/${encodeURIComponent(domainId)}/inboxes`
      );
    },
    create: async (
      domainId: string,
      payload: {
        localPart: string;
        agent?: InboxEntry['agent'];
        webhook?: InboxEntry['webhook'];
        status?: string;
      }
    ) => {
      return this.request<InboxEntry>(
        `/v1/domains/${encodeURIComponent(domainId)}/inboxes`,
        {
          method: 'POST',
          json: payload as Record<string, unknown>,
        }
      );
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

  conversations = {
    search: async (query: string, filter: SearchFilter, options?: SearchOptions) => {
      return this.request<SearchResult[]>('/v1/search', {
        method: 'POST',
        json: {
          query,
          filter,
          options,
        },
      });
    },

    index: async (organizationId: string, conversation: IndexConversationPayload) => {
      return this.request<{ success: boolean }>('/v1/search/index', {
        method: 'POST',
        json: {
          organizationId,
          conversation,
        },
      });
    },

    indexBatch: async (organizationId: string, conversations: IndexConversationPayload[]) => {
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
}
