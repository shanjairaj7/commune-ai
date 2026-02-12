# commune-ai

Email infrastructure for agents — set up an inbox and send your first email in 30 seconds. Programmatic inboxes (~1 line), consistent threads, setup and verify custom domains, send and receive attachments, structured data extraction.

```bash
npm install commune-ai
```

## Table of Contents

- [Quickstart](#quickstart-endtoend-in-one-file)
- [Unified Inbox](#unified-inbox-what-your-webhook-receives)
- [API Key](#api-key-required)
- [Attachments](#attachments)
- [Semantic Search](#semantic-search)
- [Context](#context-conversation-state)
- [Email Handling](#email-handling)
- [Setup Instructions](#setup-instructions-dashboard-first)
- [Structured Extraction](#structured-extraction-per-inbox)
- [Webhook Verification](#webhook-verification-commune--your-app)
- [Full Example](#full-example-single-file)
- [Security](#security)

---

## Quickstart (end‑to‑end in one file)
This is the simplest full flow: receive webhook → run agent → reply in thread.

```ts
import express from "express";
import { CommuneClient, createWebhookHandler, verifyCommuneWebhook } from "commune-ai";

const client = new CommuneClient({ apiKey: process.env.COMMUNE_API_KEY! });

const handler = createWebhookHandler({
  verify: ({ rawBody, headers }) => {
    const signature = headers["x-commune-signature"];
    const timestamp = headers["x-commune-timestamp"];
    if (!signature || !timestamp) return false;

    return verifyCommuneWebhook({
      rawBody,
      timestamp,
      signature,
      secret: process.env.COMMUNE_WEBHOOK_SECRET!,
    });
  },
  onEvent: async (message, context) => {
    // Example inbound payload:
    // message = {
    //   channel: "email",
    //   thread_id: "thread_abc123",
    //   participants: [{ role: "sender", identity: "user@example.com" }],
    //   content: "Can you help with pricing?"
    // }

    // --- Run your agent here (1–2 line LLM call) ---
    const prompt = `Reply to: ${message.content}`;
    const agentReply = await llm.complete(prompt); // replace with your LLM client

    // Email reply (same thread)
    const sender = message.participants.find(p => p.role === "sender")?.identity;
    if (!sender) return;

    await client.messages.send({
      channel: "email",
      to: sender,
      text: agentReply,
      thread_id: message.thread_id,
      inboxId: context.payload.inboxId,
    });
  },
});

const app = express();
app.post("/commune/webhook", express.raw({ type: "*/*" }), handler);
app.listen(3000, () => console.log("listening on 3000"));
```

## 0) Install
```bash
npm install commune-ai
```

---

## Unified inbox (what your webhook receives)
Every inbound email arrives in this shape:

```ts
export interface UnifiedMessage {
  channel: "email";
  message_id: string;
  thread_id: string; // email thread
  participants: { role: string; identity: string }[];
  content: string;
  metadata: { ... };
}
```

---

## API key (required)
All `/v1/*` requests require an API key. Create one in the dashboard and reuse it in your client.

```bash
export COMMUNE_API_KEY="your_key_from_dashboard"
export COMMUNE_WEBHOOK_SECRET="your_webhook_secret"
```

```ts
const client = new CommuneClient({ apiKey: process.env.COMMUNE_API_KEY! });
```

---

<!--  -->
## Attachments
Send and receive email attachments with secure storage and temporary download URLs.

### Sending attachments
Upload attachments first, then use the attachment ID when sending emails.

```ts
import fs from 'fs';

// 1. Upload attachment (base64 encoded)
const fileBuffer = fs.readFileSync('invoice.pdf');
const base64Content = fileBuffer.toString('base64');

const { attachment_id } = await client.attachments.upload(
  base64Content,
  'invoice.pdf',
  'application/pdf'
);

// 2. Send email with attachment
await client.messages.send({
  to: 'customer@example.com',
  subject: 'Your invoice',
  text: 'Please find your invoice attached.',
  attachments: [attachment_id],
  domainId: 'your-domain-id',
});
```

### Receiving attachments
Attachments are available through:
- Email events in the incoming webhook
- Metadata of semantic search results

Use the `attachment_id` to access the attachment.

```ts
// Get attachment metadata
const attachment = await client.attachments.get("att_123");
console.log(attachment.filename, attachment.size);

// Get download URL (expires in 1 hour)
const { url } = await client.attachments.get("att_123", { url: true });
// Use the URL to download or display the file

// Custom expiration (2 hours)
const { url } = await client.attachments.get("att_123", { url: true, expiresIn: 7200 });
```

### Handling attachments in webhook
```ts
const handler = createWebhookHandler({
  onEvent: async (message, context) => {
    const { attachments } = context.payload;
    
    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        console.log(`Attachment: ${att.filename} (${att.size} bytes)`);
        
        // Get download URL
        const { url } = await client.attachments.get(att.attachment_id, { url: true });
        
        // Download the file
        const response = await fetch(url);
        const buffer = await response.arrayBuffer();
        // Process the file...
      }
    }
  },
});
```

---

## Semantic Search
Commune provides powerful semantic search capabilities to help your agent find relevant conversations and context. The search is powered by embeddings and vector similarity, allowing natural language queries.

### Basic Search
```ts
import { CommuneClient } from "commune-ai";
const client = new CommuneClient({ apiKey: process.env.COMMUNE_API_KEY! });

// Search across all conversations in an organization
const results = await client.searchConversations(
  "customer asking about refund policy",
  { organizationId: "org_123" }
);

// Search with inbox filter
const inboxResults = await client.searchConversations(
  "shipping delays",
  { 
    organizationId: "org_123",
    inboxIds: ["inbox_1", "inbox_2"]
  }
);

// Search by participant
const userResults = await client.searchConversations(
  "account upgrade request",
  {
    organizationId: "org_123",
    participants: ["user@example.com"]
  }
);

// Search with date range
const dateResults = await client.searchConversations(
  "feature request",
  {
    organizationId: "org_123",
    startDate: "2026-01-01",
    endDate: "2026-02-01"
  }
);
```

### Manual Indexing
By default, all conversations are automatically indexed. You can also manually index conversations:

```ts
// Index a single conversation
await client.indexConversation("org_123", {
  id: "conv_123",
  subject: "Product Inquiry",
  content: "Customer asking about product features",
  metadata: {
    subject: "Product Inquiry",
    organizationId: "org_123",
    inboxId: "inbox_1",
    domainId: "domain_1",
    participants: ["customer@example.com"],
    threadId: "thread_1",
    timestamp: new Date()
  }
});

// Batch index multiple conversations
await client.indexConversationBatch("org_123", [
  {
    id: "conv_1",
    subject: "Support Request",
    content: "Customer needs help with login",
    metadata: {
      subject: "Support Request",
      organizationId: "org_123",
      inboxId: "support_inbox",
      domainId: "domain_1",
      participants: ["customer@example.com"],
      threadId: "thread_1",
      timestamp: new Date()
    }
  },
  // ... more conversations
]);
```

### Search Results
Search results include relevance scores and metadata:

```ts
interface SearchResult {
  id: string;          // Conversation ID
  score: number;       // Similarity score (0-1)
  metadata: {
    subject: string;       // Email subject
    organizationId: string;
    inboxId: string;
    domainId: string;
    participants: string[];
    threadId: string;
    timestamp: Date;
    direction?: 'inbound' | 'outbound';  // Email direction (sent or received)
    attachmentIds?: string[];      // Attachment IDs in this conversation
    hasAttachments?: boolean;      // Whether conversation has attachments
    attachmentCount?: number;      // Number of attachments
  };
}
```

### Search with attachments
```ts
// Search for conversations with attachments
const results = await client.searchConversations(
  "invoice with receipt",
  { organizationId: "org_123" }
);

// Filter results that have attachments
const withAttachments = results.filter(r => r.metadata.hasAttachments);

// Access attachments from search results
for (const result of withAttachments) {
  for (const attachmentId of result.metadata.attachmentIds || []) {
    const { url, filename } = await client.attachments.get(attachmentId, { url: true });
    console.log(`Download: ${filename} - ${url}`);
  }
}
```

## Context (conversation state)
Commune stores conversation state so your agent can respond with context.

```ts
import { CommuneClient } from "commune-ai";
const client = new CommuneClient({ apiKey: process.env.COMMUNE_API_KEY! });

// Thread history (email thread)
const thread = await client.messages.listByThread(message.thread_id, {
  order: "asc",
  limit: 50,
});

// All messages from a user
const userHistory = await client.messages.list({
  sender: "user@example.com",
  limit: 25,
});

// All messages in a specific inbox
const inboxMessages = await client.messages.list({
  inbox_id: "i_xxx",
  channel: "email",
  limit: 50,
});
```

---

## Email handling
The `UnifiedMessage` shape works for email messages.

```ts
import express from "express";
import { CommuneClient, createWebhookHandler } from "commune-ai";

// Hosted API is default. If self-hosted, pass { baseUrl: "https://your-api" }
const client = new CommuneClient({ apiKey: process.env.COMMUNE_API_KEY! });

const handler = createWebhookHandler({
  onEvent: async (message, context) => {
    const sender = message.participants.find(p => p.role === "sender")?.identity;
    if (!sender) return;

    await client.messages.send({
      channel: "email",
      to: sender,
      text: "Got it — thanks for the message.",
      thread_id: message.thread_id,
      inboxId: context.payload.inboxId,
    });
  },
});

const app = express();
app.post("/commune/webhook", express.raw({ type: "*/*" }), handler);
app.listen(3000);
```

---

---

## Setup instructions (dashboard-first)
Domain setup and inbox creation are done in the **Commune dashboard**. You then copy the
IDs into your code.

### 1) Create a subdomain for the agent
Use a subdomain like `agents.yourcompany.com` for deliverability and isolation.

### 2) Create and verify the domain in the dashboard
The dashboard guides you through DNS (SPF/DKIM/MX) and verification.

### 3) Create inboxes for your agents in the dashboard
Each inbox represents an agent address (e.g. `support@agents.yourcompany.com`).

### 4) Use IDs from the webhook payload
The webhook payload already includes:
- `domainId` (e.g. `d_xxx`)
- `inboxId` (e.g. `i_xxx`)

Use them when replying:

```ts
await client.messages.send({
  channel: "email",
  to: "user@example.com",
  text: "Thanks — replying in thread.",
  thread_id: message.thread_id,
  inboxId: context.payload.inboxId,
});
```

> The SDK also supports programmatic domain/inbox creation, but the dashboard
> flow is the primary path for most teams.

### 5) Set your webhook secret
When you configure the inbox webhook in the dashboard, Commune shows a **webhook secret**.
Store it as:

```bash
export COMMUNE_WEBHOOK_SECRET="your_webhook_secret"
```

Use it in the `verify` function shown above.

### 6) Create an API key in the dashboard
Use the dashboard to create an API key, then set it as:

```bash
export COMMUNE_API_KEY="your_key_from_dashboard"
```

---

## Structured extraction (per inbox)
You can attach a **JSON schema** to a specific inbox so Commune extracts structured data from inbound emails.

### 1) Add a schema to an inbox (dashboard)
In **Dashboard → Inboxes**, open an inbox and add a Structured Extraction schema. Save it and enable extraction.

### 2) Set the schema via SDK (optional)
```ts
await client.inboxes.setExtractionSchema({
  domainId: "domain-123",
  inboxId: "inbox-456",
  schema: {
    name: "invoice_extraction",
    description: "Extract invoice details",
    enabled: true,
    schema: {
      type: "object",
      properties: {
        invoiceNumber: { type: "string" },
        amount: { type: "number" },
        dueDate: { type: "string" }
      },
      required: ["invoiceNumber", "amount"],
      additionalProperties: false
    }
  }
});
```

### 3) Read extracted data in your webhook
The webhook payload includes the structured output when extraction is enabled.

```ts
const handler = createWebhookHandler({
  onEvent: async (message, context) => {
    const extracted = context.payload.extractedData
      || message.metadata?.extracted_data
      || null;

    if (extracted) {
      // use structured fields in your agent workflow
      console.log("Extracted:", extracted);
    }
  },
});
```

> Tip: Keep your schema minimal (only the fields you need). You can evolve it over time.

### Example: Invoice extraction (end-to-end)
```ts
import { CommuneClient, createWebhookHandler } from "commune-ai";

const client = new CommuneClient({ apiKey: process.env.COMMUNE_API_KEY! });

await client.inboxes.setExtractionSchema({
  domainId: "domain-123",
  inboxId: "inbox-456",
  schema: {
    name: "invoice_extraction",
    enabled: true,
    schema: {
      type: "object",
      properties: {
        invoiceNumber: { type: "string" },
        amount: { type: "number" },
        vendor: { type: "string" }
      },
      required: ["invoiceNumber", "amount"],
      additionalProperties: false
    }
  }
});

const handler = createWebhookHandler({
  onEvent: async (message, context) => {
    const extracted = context.payload.extractedData;
    if (!extracted) return;

    console.log("Invoice:", extracted.invoiceNumber);
    console.log("Amount:", extracted.amount);

    await processInvoice(extracted);
  },
});
```

---

## Webhook verification (Commune → your app)
Commune signs outbound webhooks using your **inbox webhook secret**. Verify the
signature before processing the request.

```ts
import { createWebhookHandler, verifyCommuneWebhook } from "commune-ai";

const handler = createWebhookHandler({
  verify: ({ rawBody, headers }) => {
    const signature = headers["x-commune-signature"];
    const timestamp = headers["x-commune-timestamp"];
    if (!signature || !timestamp) return false;

    return verifyCommuneWebhook({
      rawBody,
      timestamp,
      signature,
      secret: process.env.COMMUNE_WEBHOOK_SECRET!,
    });
  },
  onEvent: async (message) => {
    // handle verified message
  },
});
```

---

## Full example (single file)
A complete copy‑paste example that:
- receives webhook
- handles incoming attachments
- sends email with attachments
- replies by email

```ts
import express from "express";
import { CommuneClient, createWebhookHandler } from "commune-ai";
import fs from "fs";

const client = new CommuneClient({ apiKey: process.env.COMMUNE_API_KEY! });

const handler = createWebhookHandler({
  onEvent: async (message, context) => {
    // 1) Handle incoming attachments
    const { attachments } = context.payload;
    if (attachments && attachments.length > 0) {
      console.log(`Received ${attachments.length} attachments`);
      
      for (const att of attachments) {
        // Get download URL
        const { url, filename } = await client.attachments.get(att.attachment_id, { url: true });
        console.log(`Attachment: ${filename} - ${url}`);
        
        // Download if needed
        // const response = await fetch(url);
        // const buffer = await response.arrayBuffer();
      }
    }

    // 2) Email reply with attachment (same thread)
    const sender = message.participants.find(p => p.role === "sender")?.identity;
    if (!sender) return;

    // Upload attachment for sending
    const fileBuffer = fs.readFileSync('receipt.pdf');
    const base64Content = fileBuffer.toString('base64');
    const { attachment_id } = await client.attachments.upload(
      base64Content,
      'receipt.pdf',
      'application/pdf'
    );

    await client.messages.send({
      channel: "email",
      to: sender,
      subject: "Your receipt",
      text: "Thanks! Here's your receipt.",
      attachments: [attachment_id],
      thread_id: message.thread_id,
      inboxId: context.payload.inboxId,
    });
  },
});

const app = express();
app.post("/commune/webhook", express.raw({ type: "*/*" }), handler);
app.listen(3000, () => console.log("listening on 3000"));
```

---

## Security

Commune is built as production email infrastructure — deliverability, authentication, and abuse prevention are handled at the platform level so you don't have to build them yourself.

### Email Authentication (DKIM, SPF, DMARC)

Every custom domain you verify through Commune is configured with proper email authentication records:

- **DKIM** — All outbound emails are cryptographically signed. The signing keys are managed by Commune; you add the CNAME record to your DNS during domain setup.
- **SPF** — Sender Policy Framework records authorize Commune's mail servers to send on behalf of your domain, preventing spoofing.
- **DMARC** — Domain-based Message Authentication is configured to instruct receiving mail servers how to handle unauthenticated messages from your domain.

When you verify a domain, the DNS records returned include all three. Once added and verified, your domain passes authentication checks at Gmail, Outlook, and other major providers.

### Inbound Spam Protection

All inbound email is analyzed before it reaches your inbox or webhook:

- **Content analysis** — Subject and body are scored for spam patterns, phishing keywords, and suspicious formatting.
- **URL validation** — Links are checked for phishing indicators, typosquatting, and low-authority domains.
- **Sender reputation** — Each sender builds a reputation score over time. Repeat offenders are automatically blocked.
- **Domain authority** — Sender domains are checked for MX records, SPF, DMARC, valid SSL, and structural red flags.
- **DNSBL checking** — Sender IPs are checked against DNS-based blackhole lists.
- **Mass attack detection** — Burst patterns (high volume + low quality) are detected per-organization and throttled automatically.

Emails scoring above the reject threshold are silently dropped. Borderline emails are flagged with spam metadata in the message object so your agent can decide how to handle them.

### Outbound Protection

Outbound emails are validated before sending to protect your domain reputation:

- **Content scanning** — Outgoing messages are checked for spam-like patterns before delivery.
- **Recipient limits** — Maximum 50 recipients per message to prevent mass mailing.
- **Redis-backed rate limiting** — Distributed sliding-window rate limiting powered by Redis (with in-memory fallback). Accurate across multiple server instances.
- **Burst detection** — Real-time burst detection using Redis sorted sets with dual sliding windows (10-second and 60-second). Sudden spikes in send volume are automatically throttled with a `429` response.

### Attachment Scanning

All inbound attachments are scanned before storage:

- **ClamAV integration** — When a ClamAV daemon is available (via `CLAMAV_HOST`), attachments are scanned using the INSTREAM protocol over TCP.
- **Heuristic fallback** — When ClamAV is unavailable, a multi-layer heuristic scanner checks file extensions, MIME types, magic bytes, double extensions, VBA macros in Office documents, and suspicious archive files.
- **Known threat database** — File hashes (SHA-256) are stored for all detected threats. Subsequent uploads of the same file are instantly blocked.
- **Quarantine** — Dangerous attachments are quarantined (not stored) and flagged in the message metadata.

### Encryption at Rest

When `EMAIL_ENCRYPTION_KEY` is set (64 hex characters = 256 bits):

- Email body (`content`, `content_html`) and subject are encrypted with **AES-256-GCM** before storage in MongoDB.
- Attachment content stored in the database is also encrypted.
- Each encrypted value uses a unique random IV and includes a GCM authentication tag for tamper detection.
- Decryption is transparent — the API returns plaintext to authorized callers.
- Existing unencrypted data continues to work (the system detects the `enc:` prefix).

### DMARC Reporting

Commune provides end-to-end DMARC aggregate report processing:

- **Report ingestion** — Submit DMARC XML reports via `POST /v1/dmarc/reports` (supports XML, gzip, and zip formats).
- **Automatic parsing** — Reports are parsed following RFC 7489 Appendix C, extracting per-record authentication results.
- **Failure alerting** — Authentication failures above 10% trigger warnings in server logs.
- **Summary API** — `GET /v1/dmarc/summary?domain=example.com&days=30` returns pass/fail rates, DKIM/SPF breakdowns, and top sending IPs.
- **Auto-cleanup** — Reports older than 1 year are automatically removed via TTL index.

### Delivery Metrics & Bounce Handling

Bounces, complaints, and delivery events are tracked automatically:

- **Automatic suppression** — Hard bounces and spam complaints automatically add recipients to the suppression list.
- **Delivery metrics API** — `GET /v1/delivery/metrics?inbox_id=...&days=7` returns sent, delivered, bounced, complained, and failed counts with calculated rates.
- **Event stream** — `GET /v1/delivery/events?inbox_id=...` lists recent delivery events for debugging.
- **Suppression list** — `GET /v1/delivery/suppressions?inbox_id=...` shows all suppressed addresses.

### Rate Limits

| Tier | Emails/hour | Emails/day | Domains/day | Inboxes/day |
|------|-------------|------------|-------------|-------------|
| Free | 100 | 1,000 | 5 | 50 |
| Pro | 10,000 | 100,000 | 50 | 500 |
| Enterprise | Unlimited | Unlimited | Unlimited | Unlimited |

Rate limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`) are included in API responses.

### API Key Security

- API keys use the `comm_` prefix followed by 64 cryptographically random hex characters.
- Keys are **bcrypt-hashed** before storage — the raw key is only shown once at creation.
- Each key has **granular permission scopes**: `domains:read`, `domains:write`, `inboxes:read`, `inboxes:write`, `threads:read`, `messages:read`, `messages:write`, `attachments:read`, `attachments:write`.
- Keys are scoped to a single organization and can be revoked or rotated at any time from the dashboard.
- Maximum 10 active keys per organization.

### Webhook Verification

Inbound webhook payloads from Commune are signed with your inbox webhook secret. Always verify the signature before processing — see the [Webhook Verification](#webhook-verification-commune--your-app) section above for the full implementation.

### Attachment Security

- Uploaded attachments are stored in secure cloud storage with per-object access control.
- Download URLs are **temporary** (default 1 hour, configurable up to 24 hours) and expire automatically.
- Attachments are scoped to the organization that uploaded them.

---

## License

MIT
