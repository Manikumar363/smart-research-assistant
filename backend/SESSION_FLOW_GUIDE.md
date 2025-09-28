# Complete Session Flow with Thread Management

## 🎯 Overview

This implementation provides a complete session-based research flow where opening a session automatically triggers the entire research pipeline with proper conversation thread management. The system maintains conversation continuity across multiple queries within a session.

## 🔄 Session Flow Architecture

### 1. Session Initialization
When a user opens a session, the system:
- Creates or retrieves a conversation thread ID mapped to the session
- Optionally triggers an initial research query if provided
- Sets up bidirectional session ↔ thread mapping
- Prepares the context for continuous conversation

### 2. Research Query Processing
For each query in the session:
- Uses the session-mapped thread ID for conversation continuity
- Retrieves relevant data from both file uploads and live sources
- Generates contextual answers using original user queries
- Maintains conversation history for better context

### 3. Thread Management
- **Automatic Thread Creation**: Thread IDs are auto-generated from session IDs
- **Bidirectional Mapping**: Session → Thread and Thread → Session lookups
- **Conversation Continuity**: All exchanges are preserved in thread history
- **Memory Management**: Automatic cleanup when limits are reached

## 🚀 API Endpoints

### Session Management

#### 1. Initialize Session
```http
POST /api/files/initialize-session
Content-Type: application/json
Authorization: Bearer <token>

{
  "sessionId": "60f7b3b3b3b3b3b3b3b3b3b3",
  "initialQuery": "What are the latest AI developments?",
  "autoTriggerFlow": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Session initialized successfully",
  "sessionState": {
    "sessionId": "60f7b3b3b3b3b3b3b3b3b3b3",
    "threadId": "thread_user123_session456_20240920_abc123",
    "userId": "user123",
    "conversationHistory": [],
    "threadMapping": {
      "sessionToThread": "session-456 → thread_user123_session456_20240920_abc123",
      "threadToSession": "session-456"
    },
    "statistics": {
      "messageCount": 0,
      "sessionThreads": ["thread_user123_session456_20240920_abc123"],
      "hasExistingConversation": false
    }
  },
  "initialResearch": {
    "query": "What are the latest AI developments?",
    "answer": "Based on recent data...",
    "sources": [...],
    "confidence": 0.92
  }
}
```

#### 2. Resume Session
```http
GET /api/files/resume-session/60f7b3b3b3b3b3b3b3b3b3b3
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Session resumed successfully",
  "sessionId": "60f7b3b3b3b3b3b3b3b3b3b3",
  "threadId": "thread_user123_session456_20240920_abc123",
  "conversationState": {
    "history": [...],
    "recentContext": [...],
    "summary": {
      "totalMessages": 6,
      "userMessages": 3,
      "assistantMessages": 3,
      "lastActivity": "2024-09-20T10:30:00Z"
    },
    "isActiveConversation": true
  },
  "readyForQueries": true
}
```

### Research Flow

#### 3. Complete Research Query
```http
POST /api/files/research-answer
Content-Type: application/json
Authorization: Bearer <token>

{
  "query": "Tell me more about AI in healthcare",
  "sessionId": "60f7b3b3b3b3b3b3b3b3b3b3",
  "searchLimit": 10,
  "includeFileData": true,
  "includeLiveData": true,
  "ensureSessionInit": true
}
```

**Response:**
```json
{
  "success": true,
  "query": "Tell me more about AI in healthcare",
  "sessionId": "60f7b3b3b3b3b3b3b3b3b3b3",
  "threadId": "thread_user123_session456_20240920_abc123",
  "sessionInitialized": true,
  "retrievedData": {
    "count": 8,
    "documents": [...],
    "liveSources": [...]
  },
  "answer": {
    "response": "AI applications in healthcare have shown remarkable progress...",
    "sources": [...],
    "confidence": 0.89,
    "hasRelevantSources": true
  },
  "conversationContext": {
    "threadId": "thread_user123_session456_20240920_abc123",
    "sessionMapping": "session-456 → thread_user123_session456_20240920_abc123",
    "conversationLength": 4,
    "isNewConversation": false
  }
}
```

#### 4. Get Session State
```http
GET /api/files/session-state/60f7b3b3b3b3b3b3b3b3b3b3
Authorization: Bearer <token>
```

#### 5. Get Thread History
```http
GET /api/files/thread-history/60f7b3b3b3b3b3b3b3b3b3b3
Authorization: Bearer <token>
```

#### 6. Clear Session Thread
```http
DELETE /api/files/thread/60f7b3b3b3b3b3b3b3b3b3b3
Authorization: Bearer <token>
```

## 🔧 Implementation Details

### Thread ID Generation
Thread IDs follow the format: `thread_{userId}_{sessionId}_{timestamp}_{randomId}`

Example: `thread_user123_session456_20240920_abc123`

### Session-Thread Mapping
The system maintains two mapping structures:
- `sessionThreadMapping`: Map from session IDs to thread IDs
- `threadSessionMapping`: Map from thread IDs to session IDs

### Conversation Context
Each message in the thread contains:
- `role`: 'user' or 'assistant'
- `content`: The message content
- `timestamp`: When the message was created
- `metadata`: Additional context (query info, sources, etc.)

### Memory Management
- Automatic cleanup when conversation gets too long
- Configurable limits for conversation history
- Efficient storage using in-memory Maps with optional persistence

## 🌟 Usage Patterns

### 1. New Session (First Time)
```javascript
// 1. Initialize session
const initResponse = await fetch('/api/files/initialize-session', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: newSessionId,
    initialQuery: userQuestion,
    autoTriggerFlow: true
  })
});

// Session is ready with thread management
const { sessionState, initialResearch } = await initResponse.json();
```

### 2. Continuing Session
```javascript
// Research queries automatically use existing thread
const researchResponse = await fetch('/api/files/research-answer', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: followUpQuestion,
    sessionId: existingSessionId,
    ensureSessionInit: true  // Ensures thread continuity
  })
});

const { answer, conversationContext } = await researchResponse.json();
```

### 3. Resuming Session (Return to existing session)
```javascript
// Resume session with full context
const resumeResponse = await fetch(`/api/files/resume-session/${sessionId}`, {
  headers: { 'Authorization': `Bearer ${token}` }
});

const { conversationState, threadId } = await resumeResponse.json();

// Continue with research queries...
```

## ✅ Benefits

1. **Seamless Conversation Flow**: Maintains context across multiple queries
2. **Session Persistence**: Conversations survive session close/reopen
3. **Automatic Thread Management**: No manual thread ID management required
4. **Bidirectional Mapping**: Easy navigation between sessions and threads
5. **Memory Efficiency**: Automatic cleanup and optimization
6. **Source Attribution**: Proper citations with conversation context
7. **Original Query Usage**: Uses user's actual questions, not refined versions

## 🎯 Key Features Achieved

- ✅ **Session Initialization**: Automatic thread creation when session opens
- ✅ **Thread Continuity**: Conversation preserved across queries
- ✅ **Auto-Mapping**: Session IDs automatically mapped to thread IDs
- ✅ **Context Preservation**: Full conversation history maintained
- ✅ **Session Resumption**: Complete state restoration on session reopen
- ✅ **Source Integration**: Combines file data and live sources in answers
- ✅ **Memory Management**: Efficient cleanup and optimization

This implementation ensures that when a user opens any session, the entire research flow is properly initialized with correct conversation thread IDs, maintaining seamless conversation continuity throughout the session lifecycle.