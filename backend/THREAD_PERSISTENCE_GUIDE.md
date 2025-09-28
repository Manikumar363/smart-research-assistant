# Thread Management & User Login Implementation

## How Thread IDs are Retrieved When Users Log In

### Overview
We've implemented a comprehensive thread persistence system that maintains conversation context across user sessions and server restarts. Here's how it works:

### Database Schema (ConversationThread Model)
```javascript
{
  sessionId: ObjectId,     // Links to ResearchSession
  userId: ObjectId,        // Links to User
  threadId: String,        // Azure AI Foundry thread ID
  status: String,          // 'active', 'completed', 'archived'
  createdAt: Date,
  lastUsed: Date,
  metadata: Object         // Additional thread information
}
```

### User Login Flow

#### 1. Authentication (routes/auth.js)
When a user logs in successfully:
```javascript
// Update last login
await user.updateLastLogin();

// Load user's conversation threads into cache
try {
  const QueryRefiner = require('../services/QueryRefiner');
  const queryRefiner = new QueryRefiner();
  const userThreads = await queryRefiner.loadUserThreadsOnLogin(user._id.toString());
  console.log(`🧵 Loaded ${userThreads.length} existing threads for user ${user._id}`);
} catch (threadError) {
  // Don't fail login if thread loading fails
  console.warn('⚠️ Failed to load user threads during login:', threadError.message);
}
```

#### 2. Thread Loading Process
The `loadUserThreadsOnLogin()` method:

1. **Database Query**: Retrieves all active threads for the user
```javascript
async loadUserThreadsToCache(userId) {
  const threads = await ConversationThread.find({
    userId: userId,
    status: 'active'
  }).sort({ lastUsed: -1 });
  
  // Load into memory cache for fast access
  threads.forEach(thread => {
    this.threadCache.set(thread.sessionId, {
      threadId: thread.threadId,
      sessionId: thread.sessionId,
      userId: thread.userId,
      lastUsed: thread.lastUsed,
      hasThread: true
    });
  });
  
  return threads.map(/* ... */);
}
```

2. **Cache Population**: Loads threads into memory for fast access
3. **Return Summary**: Provides overview of loaded threads

#### 3. Session-to-Thread Mapping
When a user starts a chat session:

1. **First Check Cache**: Look for existing thread in memory
2. **Database Fallback**: Query database if not in cache
3. **Create New**: Create new thread if none exists
4. **Persist**: Save new threads to database immediately

```javascript
async getOrCreateThread(sessionId, userId) {
  // Check cache first
  if (this.threadCache.has(sessionId)) {
    return this.threadCache.get(sessionId);
  }
  
  // Check database
  const existingThread = await ConversationThread.findOne({
    sessionId: sessionId,
    status: 'active'
  });
  
  if (existingThread) {
    // Load into cache and return
    this.threadCache.set(sessionId, threadInfo);
    return threadInfo;
  }
  
  // Create new thread
  return await this.createNewThread(sessionId, userId);
}
```

### Chat Flow Integration

#### Query Refinement with Thread Context
```javascript
// In routes/files.js - Chat endpoint
const refinementResult = await queryRefiner.refineQuery(
  message, 
  sessionDocs, 
  sessionId, 
  userId  // Now includes userId for database operations
);
```

#### Thread-Aware Conversation
```javascript
// QueryRefiner uses LLMManager with thread persistence
const response = await this.llmManager.sendMessage(
  sessionId, 
  userMessage, 
  systemPrompt, 
  userId
);
```

### Key Benefits

1. **Persistent Context**: Conversations continue across server restarts
2. **Fast Access**: Memory cache provides instant thread lookup
3. **Database Backup**: All threads stored permanently in MongoDB
4. **User Isolation**: Each user's threads are completely separate
5. **Session Mapping**: Clear relationship between sessions and threads
6. **Automatic Loading**: Threads loaded seamlessly during login

### Testing
Run the test script to verify functionality:
```bash
cd backend
node test-thread-persistence.js
```

This tests:
- Thread creation and persistence
- User thread retrieval
- Cache management
- Login simulation
- Cross-session thread access

### Production Considerations

1. **Thread Cleanup**: Implement automated cleanup of old/inactive threads
2. **Cache Limits**: Add memory limits for thread cache
3. **Error Handling**: Graceful degradation when Azure AI is unavailable
4. **Monitoring**: Log thread creation/retrieval metrics
5. **Security**: Ensure thread access is properly authenticated

The system now provides complete thread persistence, ensuring users can resume conversations exactly where they left off, even after server restarts or re-login.