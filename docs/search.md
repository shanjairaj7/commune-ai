# Vector Search

Commune provides powerful vector search capabilities for your organization's conversations. You can search across all conversations or filter by specific inboxes, participants, or domains.

## Getting Started

```typescript
import { CommuneClient } from 'commune-ai';

const client = new CommuneClient({ apiKey: process.env.COMMUNE_API_KEY! });

// Search across all conversations in an organization
const results = await client.conversations.search(
  'Looking for emails about project planning',
  {
    organizationId: 'org_123',
  }
);

// Search within specific inboxes
const inboxResults = await client.conversations.search(
  'budget discussion',
  {
    organizationId: 'org_123',
    inboxIds: ['inbox_456'],
  }
);

// Search with participant filter
const participantResults = await client.conversations.search(
  'meeting schedule',
  {
    organizationId: 'org_123',
    participants: ['john@example.com'],
  }
);

// Search with date range
const dateResults = await client.conversations.search(
  'quarterly review',
  {
    organizationId: 'org_123',
    startDate: '2024-01-01',
    endDate: '2024-03-31',
  }
);

// Search with options
const customResults = await client.conversations.search(
  'project proposal',
  {
    organizationId: 'org_123',
  },
  {
    limit: 20,
    offset: 0,
    minScore: 0.8,
  }
);
```

## Indexing Conversations

To make conversations searchable, you need to index them first:

```typescript
// Index a single conversation
await client.conversations.index(
  'org_123',
  {
    id: 'conv_789',
    subject: 'Project Planning Meeting',
    content: 'Let\'s discuss the project timeline and milestones...',
    metadata: {
      subject: 'Project Planning Meeting',
      organizationId: 'org_123',
      inboxId: 'inbox_456',
      domainId: 'domain_789',
      participants: ['alice@example.com', 'bob@example.com'],
      threadId: 'thread_123',
      timestamp: new Date(),
    },
  }
);

// Index multiple conversations in batch
await client.conversations.indexBatch(
  'org_123',
  [
    {
      id: 'conv_790',
      subject: 'Budget Review',
      content: 'Here are the Q1 budget numbers...',
      metadata: {
        subject: 'Budget Review',
        organizationId: 'org_123',
        inboxId: 'inbox_456',
        domainId: 'domain_789',
        participants: ['finance@example.com'],
        threadId: 'thread_124',
        timestamp: new Date(),
      },
    },
    // ... more conversations
  ]
);
```

## Search Results

Search results include:
- Conversation ID
- Relevance score (0-1)
- Metadata (subject, organization, inbox, domain, participants, etc.)

```typescript
interface SearchResult {
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
```

## Best Practices

1. **Index Early**: Index conversations as soon as they are created or updated to ensure search results are current.

2. **Use Filters**: Combine text search with metadata filters to get more relevant results.

3. **Batch Operations**: Use batch indexing when processing multiple conversations to improve performance.

4. **Score Threshold**: Adjust `minScore` in search options to control result quality. Higher values (e.g., 0.8) give more relevant results.

5. **Pagination**: Use `limit` and `offset` options for large result sets.
