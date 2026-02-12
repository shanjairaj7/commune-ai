import { SearchFilter, SearchOptions, SearchResult, IndexConversationPayload, ApiResponse } from '../types.js';

export class SearchClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(baseUrl: string, headers: Record<string, string>) {
    this.baseUrl = baseUrl;
    this.headers = headers;
  }

  /**
   * Search conversations using semantic search
   * @param query - The search query in natural language
   * @param filter - Filter criteria for the search
   * @param options - Additional search options
   * @returns Promise<SearchResult[]>
   * @example
   * ```typescript
   * // Search across organization
   * const results = await client.conversations.search(
   *   "customer asking about refund policy",
   *   { organizationId: "org_123" }
   * );
   * 
   * // Search in specific inboxes
   * const results = await client.conversations.search(
   *   "shipping delays",
   *   { 
   *     organizationId: "org_123",
   *     inboxIds: ["inbox_1", "inbox_2"]
   *   }
   * );
   * 
   * // Search with participant filter
   * const results = await client.conversations.search(
   *   "account upgrade request",
   *   {
   *     organizationId: "org_123",
   *     participants: ["user@example.com"]
   *   }
   * );
   * ```
   */
  async search(
    query: string,
    filter: SearchFilter,
    options?: SearchOptions
  ): Promise<SearchResult[]> {
    const response = await fetch(`${this.baseUrl}/search`, {
      method: 'POST',
      headers: {
        ...this.headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, filter, options }),
    });

    const data: ApiResponse<{ results: SearchResult[] }> = await response.json();
    if (data.error) {
      throw new Error(data.error.message || 'Search failed');
    }

    return data.data.results;
  }

  /**
   * Index a conversation for semantic search
   * @param organizationId - The organization ID
   * @param conversation - The conversation to index
   * @returns Promise<void>
   * @example
   * ```typescript
   * await client.conversations.index("org_123", {
   *   id: "conv_123",
   *   subject: "Product Inquiry",
   *   content: "Customer asking about product features",
   *   metadata: {
   *     subject: "Product Inquiry",
   *     organizationId: "org_123",
   *     inboxId: "inbox_1",
   *     domainId: "domain_1",
   *     participants: ["customer@example.com"],
   *     threadId: "thread_1",
   *     timestamp: new Date()
   *   }
   * });
   * ```
   */
  async index(
    organizationId: string,
    conversation: IndexConversationPayload
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/search/index`, {
      method: 'POST',
      headers: {
        ...this.headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ organizationId, conversation }),
    });

    const data: ApiResponse<{ success: boolean }> = await response.json();
    if (data.error || !data.data.success) {
      throw new Error(data.error?.message || 'Failed to index conversation');
    }
  }

  /**
   * Index multiple conversations in batch
   * @param organizationId - The organization ID
   * @param conversations - Array of conversations to index
   * @returns Promise<void>
   * @example
   * ```typescript
   * await client.conversations.indexBatch("org_123", [
   *   {
   *     id: "conv_1",
   *     subject: "Support Request",
   *     content: "Customer needs help with login",
   *     metadata: {
   *       subject: "Support Request",
   *       organizationId: "org_123",
   *       inboxId: "support_inbox",
   *       domainId: "domain_1",
   *       participants: ["customer@example.com"],
   *       threadId: "thread_1",
   *       timestamp: new Date()
   *     }
   *   },
   *   // ... more conversations
   * ]);
   * ```
   */
  async indexBatch(
    organizationId: string,
    conversations: IndexConversationPayload[]
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/search/index/batch`, {
      method: 'POST',
      headers: {
        ...this.headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ organizationId, conversations }),
    });

    const data: ApiResponse<{ success: boolean }> = await response.json();
    if (data.error || !data.data.success) {
      throw new Error(data.error?.message || 'Failed to index conversations');
    }
  }
}
