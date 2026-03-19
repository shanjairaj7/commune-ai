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

/**
 * Payload for creating a new inbox.
 *
 * @example
 * // Simple creation with auto-resolved domain
 * const payload: CreateInboxPayload = {
 *   localPart: 'support',
 * };
 *
 * // With explicit domain
 * const payload: CreateInboxPayload = {
 *   localPart: 'support',
 *   domainId: 'domain-id',
 * };
 */
export interface CreateInboxPayload {
  /** The part before @ in the email address (e.g., "support" → support@domain.com) */
  localPart: string;
  /** Optional domain ID. If omitted, Commune auto-assigns to an available domain. */
  domainId?: string;
  /** Optional agent configuration */
  agent?: {
    name?: string;
    metadata?: Record<string, unknown>;
  };
  /** Optional webhook configuration */
  webhook?: InboxWebhook;
  /** Optional status */
  status?: string;
  /** Optional display name shown in email clients */
  displayName?: string;
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

export interface SearchThreadsParams {
  query: string;
  inboxId?: string;
  domainId?: string;
  limit?: number;
}

export interface SearchThreadResult {
  thread_id: string;
  subject?: string | null;
  score?: number;
  inbox_id?: string | null;
  domain_id?: string | null;
  participants?: string[];
  direction?: Direction | null;
}

export interface ThreadMetadataEntry {
  thread_id: string;
  orgId?: string;
  tags: string[];
  status: 'open' | 'needs_reply' | 'waiting' | 'closed';
  assigned_to?: string | null;
  updated_at?: string;
}

export interface DeliveryMetricsParams {
  inboxId?: string;
  domainId?: string;
  period?: string;
}

export interface DeliveryEventEntry {
  _id?: string;
  message_id: string;
  event_type: string;
  event_data: Record<string, unknown>;
  processed_at?: string;
  inbox_id?: string;
  domain_id?: string;
}

export interface DeliveryEventsParams {
  messageId?: string;
  inboxId?: string;
  domainId?: string;
  eventType?: string;
  limit?: number;
}

export interface SuppressionEntry {
  _id?: string;
  email: string;
  reason: string;
  type: string;
  source: 'inbox' | 'domain' | 'global';
  inbox_id?: string;
  domain_id?: string;
  created_at?: string;
  expires_at?: string;
  message_id?: string;
  metadata?: Record<string, unknown>;
}

export interface DeliverySuppressionsParams {
  inboxId?: string;
  domainId?: string;
  limit?: number;
}

// ─── Phone Numbers ────────────────────────────────────────────────

export interface AvailablePhoneNumber {
  phoneNumber: string;
  friendlyName: string;
  capabilities: { sms: boolean; mms: boolean; voice: boolean };
  region?: string;
  locality?: string;
  postalCode?: string;
}

export interface ProvisionPhoneNumberPayload {
  phone_number?: string;
  type?: 'tollfree' | 'local';
  country?: string;
  friendly_name?: string;
  area_code?: string;
}

export interface PhoneNumber {
  id: string;
  number: string;
  numberType: 'tollfree' | 'local' | 'shortcode';
  friendlyName: string | null;
  country: string;
  capabilities: { sms: boolean; mms: boolean; voice: boolean };
  status: 'active' | 'released' | 'suspended_non_payment';
  allowList: string[];
  blockList: string[];
  creditCostPerMonth: number;
  autoReply: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PhoneNumberWebhookPayload {
  endpoint?: string;
  secret?: string;
  events?: string[];
}

export interface UpdatePhoneNumberPayload {
  friendlyName?: string;
  autoReply?: string | null;
  allowList?: string[];
  blockList?: string[];
  webhook?: PhoneNumberWebhookPayload;
}

// ─── SMS ─────────────────────────────────────────────────────────

export interface SmsConversation {
  thread_id: string;
  remote_number: string;
  phone_number_id: string;
  last_message_at: string;
  last_message_preview: string | null;
  message_count: number;
  unread_count: number;
}

export interface SmsMessage {
  message_id: string;
  thread_id: string;
  direction: 'inbound' | 'outbound';
  content: string | null;
  created_at: string;
  metadata: {
    delivery_status: string | null;
    from_number: string | null;
    to_number: string | null;
    phone_number_id: string | null;
    message_sid: string | null;
    credits_charged: number | null;
    sms_segments: number | null;
    has_attachments: boolean;
    mms_media: unknown[] | null;
  };
}

export interface SendSmsPayload {
  to: string;
  body: string;
  phone_number_id?: string;
  media_url?: string[];
}

export interface SendSmsResult {
  message_id: string;
  thread_id: string;
  message_sid: string;
  status: string;
  credits_charged: number;
  segments: number;
}

export interface SmsConversationListParams {
  phone_number_id?: string;
  limit?: number;
  cursor?: string;
}

export interface SmsSearchParams {
  q: string;
  phone_number_id?: string;
  limit?: number;
}

export interface SmsListParams {
  phone_number_id?: string;
  limit?: number;
  before?: string;
  after?: string;
}

export interface SmsSuppression {
  phone_number: string;
  orgId: string;
  phone_number_id?: string;
  reason?: string;
  created_at?: string;
}

// ─── Credits ─────────────────────────────────────────────────────

export interface CreditBalance {
  included: number;
  purchased: number;
  total: number;
  usedThisCycle: number;
}

export interface CreditBundle {
  id: string;
  credits: number;
  price: number;
  price_per_credit: string;
  available?: boolean;
}

export interface CreditCheckoutResult {
  checkout_url: string;
  bundle: string;
  credits: number;
  price: number;
}

export type FeedbackType = 'error' | 'feature' | 'signal';

export interface FeedbackSubmitPayload {
  type: FeedbackType;
  message: string;
  context?: Record<string, unknown>;
}

export interface FeedbackResult {
  id: string;
  type: FeedbackType;
  status: 'received';
  created_at: string;
}
