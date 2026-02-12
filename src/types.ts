export type Channel = 'email';
export type Direction = 'inbound' | 'outbound';
export type ParticipantRole =
  | 'sender'
  | 'to'
  | 'cc'
  | 'bcc'
  | 'mentioned'
  | 'participant';

export interface Participant {
  role: ParticipantRole;
  identity: string;
}

export interface MessageMetadata {
  created_at: string;
  subject?: string;
  in_reply_to?: string | null;
  references?: string[];
  is_private?: boolean;
  domain_id?: string | null;
  inbox_id?: string | null;
  inbox_address?: string | null;
  message_id?: string | null;
  provider?: 'resend' | 'email' | string;
  raw?: unknown;
  extracted_data?: Record<string, any>;
  spam_score?: number | null;
  spam_action?: 'accept' | 'flag' | 'reject' | string | null;
  spam_flagged?: boolean | null;
  delivery_status?: 'sent' | 'delivered' | 'bounced' | 'failed' | 'complained' | null;
  prompt_injection_checked?: boolean;
  prompt_injection_detected?: boolean;
  prompt_injection_risk?: 'none' | 'low' | 'medium' | 'high' | 'critical';
  prompt_injection_score?: number;
  prompt_injection_signals?: string;
}

export interface UnifiedMessage {
  _id?: string;
  channel: Channel;
  message_id: string;
  thread_id: string;
  direction: Direction;
  participants: Participant[];
  content: string;
  content_html?: string | null;
  attachments: string[];
  created_at: string;
  metadata: MessageMetadata;
}

export interface AttachmentRecord {
  attachment_id: string;
  message_id: string;
  filename: string;
  mime_type: string;
  size: number;
  content_base64: string | null;
  source: Channel;
  source_url?: string | null;
  download_error?: boolean;
  storage_type?: 'cloudinary' | 'database';
  cloudinary_url?: string | null;
  cloudinary_public_id?: string | null;
}

export interface AttachmentMetadata {
  attachment_id: string;
  filename: string;
  mime_type: string;
  size: number;
}

export interface AttachmentUrl {
  url: string;
  expiresIn: number;
  filename: string;
  mimeType: string;
  size: number;
}

export interface AttachmentUploadResponse {
  attachment_id: string;
  filename: string;
  mime_type: string;
  size: number;
  storage_type: 'cloudinary' | 'database';
}

export interface DomainWebhook {
  id?: string;
  endpoint?: string;
  events?: string[];
  secret?: string | null;
}

export interface InboxWebhook {
  endpoint?: string;
  events?: string[];
  secret?: string;
}

export interface InboxEntry {
  id: string;
  localPart: string;
  address?: string;
  displayName?: string;
  agent?: {
    id?: string;
    name?: string;
    metadata?: Record<string, unknown>;
  };
  webhook?: InboxWebhook;
  extractionSchema?: {
    name: string;
    description?: string;
    schema: Record<string, any>;
    enabled: boolean;
  };
  createdAt?: string;
  status?: string;
}

export interface DomainEntry {
  id: string;
  name?: string;
  status?: string;
  region?: string;
  records?: unknown[];
  createdAt?: string;
  webhook?: DomainWebhook;
  inboxes?: InboxEntry[];
}

export interface SendMessagePayload {
  thread_id?: string;
  to: string | string[];
  text?: string;
  html?: string;
  attachments?: string[]; // Array of attachment IDs from upload
  subject?: string;
  cc?: string[];
  bcc?: string[];
  headers?: Record<string, string>;
  replyTo?: string | string[];
  reply_to?: string | string[];
  domainId?: string;
  inboxId?: string;
  domain?: string;
  from?: string;
  localPart?: string;
}

export interface CreateDomainPayload {
  name: string;
  region?: string;
  capabilities?: { sending?: string; receiving?: string };
  createWebhook?: boolean;
}

export interface MessageListParams {
  sender?: string;
  channel?: Channel;
  before?: string;
  after?: string;
  limit?: number;
  order?: 'asc' | 'desc';
  domain_id?: string;
  inbox_id?: string;
}

/** @deprecated Use ThreadListParams instead */
export interface ConversationListParams {
  limit?: number;
  order?: 'asc' | 'desc';
  before?: string;
  after?: string;
}

export interface SvixHeaders {
  id: string;
  timestamp: string;
  signature: string;
}

export interface WebhookSecurityContext {
  spam: {
    checked: boolean;
    score: number;
    action: string;
    flagged: boolean;
  };
  prompt_injection: {
    checked: boolean;
    detected: boolean;
    risk_level: 'none' | 'low' | 'medium' | 'high' | 'critical';
    confidence: number;
    summary?: string;
  };
}

export interface InboundEmailWebhookPayload {
  domainId: string;
  inboxId?: string;
  inboxAddress?: string;
  event: unknown;
  email: unknown;
  message: UnifiedMessage;
  extractedData?: Record<string, any>;
  attachments?: AttachmentMetadata[];
  security?: WebhookSecurityContext;
}

export interface ApiError {
  message?: string;
  [key: string]: unknown;
}

export interface ApiResponse<T> {
  data: T;
  error?: ApiError;
}

// Vector Search
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
    direction?: 'inbound' | 'outbound';
    attachmentIds?: string[];
    hasAttachments?: boolean;
    attachmentCount?: number;
  };
}

export interface ThreadMetadata {
  subject: string;
  organizationId: string;
  inboxId: string;
  domainId: string;
  participants: string[];
  threadId: string;
  timestamp: Date;
  direction?: 'inbound' | 'outbound';
  attachmentIds?: string[];
  hasAttachments?: boolean;
  attachmentCount?: number;
}

export interface IndexConversationPayload {
  id: string;
  subject: string;
  content: string;
  metadata: ThreadMetadata;
}

export type SearchType = 'vector' | 'agent';

// ── Threads (paginated conversation summaries) ──────────────────────────────

export interface Thread {
  thread_id: string;
  subject?: string | null;
  last_message_at: string;
  first_message_at?: string | null;
  message_count: number;
  snippet?: string | null;
  last_direction?: Direction | null;
  inbox_id?: string | null;
  domain_id?: string | null;
  has_attachments?: boolean;
}

export interface ThreadListResponse {
  data: Thread[];
  next_cursor: string | null;
  has_more: boolean;
}

export interface ThreadListParams {
  inbox_id?: string;
  domain_id?: string;
  limit?: number;
  cursor?: string;
  order?: 'asc' | 'desc';
}
