export interface SearchFilter {
  organizationId: string;
  inboxIds?: string[];
  participants?: string[];
  domainId?: string;
  startDate?: string;
  endDate?: string;
}

export interface SearchOptions {
  limit?: number;
  offset?: number;
  minScore?: number;
}

export interface SearchResult {
  id: string;
  score: number;
  metadata: {
    subject: string;
    organizationId: string;
    inboxId: string;
    domainId: string;
    participants: string[];
    threadId: string;
    timestamp: Date;
  };
}

export interface ConversationMetadata {
  subject: string;
  organizationId: string;
  inboxId: string;
  domainId: string;
  participants: string[];
  threadId: string;
  timestamp: Date;
}
