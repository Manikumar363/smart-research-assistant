const LLMManager = require('./LLMManager');

class QueryRefiner {
  constructor() {
    this.llmManager = new LLMManager();
    
    // QueryRefiner-specific thread management
    this.queryRefinerThreadMapping = new Map(); // sessionKey → queryRefinerThreadId
    this.queryRefinerThreadReverseMapping = new Map(); // queryRefinerThreadId → sessionKey
    
    console.log('🔧 QueryRefiner initialized with thread-based LLM management and QueryRefiner thread tracking');
  }

  /**
   * Create or get QueryRefiner thread ID for a session
   */
  getQueryRefinerThreadIdForSession(userId, sessionId) {
    const sessionKey = `queryrefiner_${userId}_${sessionId}`;
    
    if (!this.queryRefinerThreadMapping.has(sessionKey)) {
      // Generate a new QueryRefiner thread ID for this session
      const threadId = `queryrefiner_thread_${userId}_${sessionId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create bidirectional mapping
      this.queryRefinerThreadMapping.set(sessionKey, threadId);
      this.queryRefinerThreadReverseMapping.set(threadId, sessionKey);
      
      console.log(`🔍 Created new QueryRefiner thread mapping: Session ${sessionId} → Thread ${threadId}`);
      return threadId;
    }
    
    return this.queryRefinerThreadMapping.get(sessionKey);
  }

  /**
   * Get session info from QueryRefiner thread ID
   */
  getSessionFromQueryRefinerThreadId(threadId) {
    const sessionKey = this.queryRefinerThreadReverseMapping.get(threadId);
    if (sessionKey) {
      const [service, userId, sessionId] = sessionKey.split('_');
      return { userId, sessionId };
    }
    return null;
  }

  /**
   * Get thread information for a session
   */
  getThreadInfo(sessionId) {
    return this.llmManager.getThreadInfo(sessionId);
  }

  /**
   * Clean up thread when session is deleted
   * @param {string} sessionId - Session ID to clean up
   * @param {string} userId - User ID for verification
   * @returns {Promise<boolean>} - Success status
   */
  async cleanupSessionThread(sessionId, userId = null) {
    try {
      return await this.llmManager.cleanupSessionThread(sessionId, userId);
    } catch (error) {
      console.error('❌ Failed to cleanup session thread:', error.message);
      return false;
    }
  }

  /**
   * Clean up all threads for a user (when user account is deleted)
   * @param {string} userId - User ID
   * @returns {Promise<number>} - Number of threads cleaned up
   */
  async cleanupUserThreads(userId) {
    try {
      return await this.llmManager.cleanupUserThreads(userId);
    } catch (error) {
      console.error('❌ Failed to cleanup user threads:', error.message);
      return 0;
    }
  }

  /**
   * Clean up old threads
   * @param {number} maxAge - Maximum age in milliseconds
   * @returns {Promise<number>} - Number of threads cleaned up
   */
  async cleanupOldThreads(maxAge = 24 * 60 * 60 * 1000) {
    return await this.llmManager.cleanupOldThreads(maxAge);
  }
  /**
   * Refine a user query using thread-based conversation context
   * @param {string} originalQuery - The original user query
   * @param {Array} sessionDocuments - List of documents in the current session for context
   * @param {string} sessionId - Session ID for thread management
   * @param {string} userId - User ID for database operations
   * @param {boolean} isReportMode - Whether this is for report generation
   * @param {Array} conversationHistory - Full conversation history for report mode
   * @returns {Promise<Object>} - Refined query and analysis
   */
  async refineQuery(originalQuery, sessionDocuments = [], sessionId = null, userId = null, isReportMode = false, conversationHistory = [], answerAssistantThreadId = null) {
    try {
      console.log(`🔍 Refining query: "${originalQuery}" for session: ${sessionId}, user: ${userId}, answerAssistantThread: ${answerAssistantThreadId}, reportMode: ${isReportMode}`);
      
      if (!sessionId) {
        console.warn('⚠️ No session ID provided, using basic refinement');
        return this.basicQueryRefinement(originalQuery, sessionId, userId);
      }

      // Get or create QueryRefiner thread ID for this session
      const queryRefinerThreadId = this.getQueryRefinerThreadIdForSession(userId, sessionId);
      console.log(`🔍 Using QueryRefiner thread ID: ${queryRefinerThreadId}`);

      const documentContext = sessionDocuments.length > 0 
        ? sessionDocuments.map(doc => `- ${doc.fileName} (${doc.contentType || 'document'})`).join('\n')
        : 'No documents uploaded yet';

      // Build the system prompt based on mode
      const systemPrompt = isReportMode 
        ? this.buildReportSystemPrompt(documentContext, conversationHistory)
        : this.buildSystemPrompt(documentContext);
      
      // Build the user message based on mode
      const userMessage = isReportMode
        ? this.buildReportUserMessage(originalQuery, conversationHistory)
        : this.buildUserMessage(originalQuery);

      // Create comprehensive thread info including both thread IDs
      const threadInfo = {
        sessionId: sessionId,
        queryRefinerThreadId: queryRefinerThreadId,
        answerAssistantThreadId: answerAssistantThreadId,
        hasQueryRefinerThread: true,
        hasAnswerAssistantThread: !!answerAssistantThreadId,
        source: 'DualThreadSystem'
      };
      
      console.log(`🧵 Dual Thread Info: ${JSON.stringify(threadInfo)}`);

      // Ensure LLMManager knows about this session by creating/updating mapping
      try {
        await this.llmManager.getOrCreateThread(sessionId, userId);
      } catch (error) {
        console.warn(`⚠️ Could not sync session with LLMManager: ${error.message}`);
      }

      // Send message using QueryRefiner's LLMManager (which uses sessionId internally)
      const response = await this.llmManager.sendMessage(sessionId, userMessage, systemPrompt, userId, 'queryrefiner');
      
      let refinedData;
      try {
        refinedData = JSON.parse(response);
      } catch (parseError) {
        console.warn('⚠️ Failed to parse JSON response, using fallback');
        refinedData = isReportMode ? {
          refinedQuery: this.extractKeywordsFromHistory(conversationHistory),
          searchTerms: this.extractSearchTermsFromHistory(conversationHistory),
          intent: 'comprehensive_report',
          confidence: 0.7,
          reasoning: 'Fallback report query generation from conversation history',
          reportMode: true
        } : {
          refinedQuery: originalQuery,
          searchTerms: [originalQuery],
          intent: 'general_search',
          confidence: 0.5,
          reasoning: 'Fallback due to parsing error'
        };
      }

      console.log(`✅ Query refined: "${refinedData.refinedQuery}"`);
      console.log(`🎯 Search intent: ${refinedData.intent}`);
      console.log(`🔑 Key terms: ${refinedData.searchTerms?.join(', ')}`);
      console.log(`📊 Confidence: ${refinedData.confidence}`);

      return {
        original: originalQuery,
        refined: refinedData.refinedQuery || originalQuery,
        searchTerms: refinedData.searchTerms || [originalQuery],
        intent: refinedData.intent || 'general_search',
        confidence: refinedData.confidence || 0.7,
        reasoning: refinedData.reasoning || 'Query processed successfully',
        sessionId: sessionId,
        userId: userId,
        threadId: threadInfo.threadId,
        conversationTurn: threadInfo.hasThread ? 'ongoing' : 'new'
      };

    } catch (error) {
      console.error('❌ Query refinement failed:', error.message);
      
      // Fallback to basic refinement
      return this.basicQueryRefinement(originalQuery, sessionId, userId);
    }
  }

  /**
   * Basic query refinement when thread management fails
   */
  basicQueryRefinement(originalQuery, sessionId = null, userId = null) {
    console.log('🔄 Using basic query refinement');
    
    // Apply simple query enhancements
    let refined = originalQuery;
    
    // Package/dependency patterns
    if (/^([a-zA-Z-_]+)(>=|<=|==|>|<)([0-9.]+)$/.test(originalQuery)) {
      refined = `${originalQuery} package library dependency version requirements`;
    }
    // Single word technical terms
    else if (originalQuery.split(' ').length === 1 && originalQuery.length > 3) {
      refined = `${originalQuery} definition explanation concept meaning`;
    }
    // Question patterns
    else if (originalQuery.toLowerCase().startsWith('what')) {
      refined = originalQuery.replace(/^what\s+/i, 'definition explanation ');
    }
    // How-to patterns  
    else if (originalQuery.toLowerCase().startsWith('how')) {
      refined = originalQuery.replace(/^how\s+/i, 'procedure steps process ');
    }

    return {
      original: originalQuery,
      refined: refined,
      searchTerms: refined.split(' ').filter(term => term.length > 2),
      intent: 'general_search',
      confidence: 0.6,
      reasoning: 'Basic query enhancement applied',
      sessionId: sessionId,
      threadId: null,
      conversationTurn: 'basic'
    };
  }

  /**
   * Build system prompt for report mode query refinement
   */
  buildReportSystemPrompt(documentContext, conversationHistory) {
    const userQuestions = conversationHistory
      .filter(msg => msg.role === 'user')
      .map((msg, idx) => `${idx + 1}. ${msg.content}`)
      .join('\n');

    return `You are a comprehensive report query optimizer. Your task is to create a single optimized search query that captures ALL topics and concepts from an entire conversation history.

CONTEXT:
User's uploaded documents:
${documentContext}

CONVERSATION HISTORY - ALL USER QUESTIONS:
${userQuestions || 'No previous questions'}

INSTRUCTIONS FOR REPORT MODE:
1. Analyze ALL user questions from the conversation history
2. Extract key concepts, topics, and entities from EVERY question
3. Create a comprehensive search query that covers ALL discussed topics
4. Include synonyms and related terms for each major concept
5. Optimize for retrieving information relevant to ALL questions asked
6. This query will be used to generate a comprehensive report covering all topics

RESPONSE FORMAT (JSON only):
{
  "refinedQuery": "comprehensive search query covering all conversation topics and concepts",
  "searchTerms": ["all", "key", "concepts", "from", "entire", "conversation"],
  "intent": "comprehensive_report",
  "confidence": 0.90,
  "reasoning": "explanation of how all conversation topics were consolidated",
  "topicsCovered": ["topic1", "topic2", "topic3"],
  "reportMode": true
}

Always respond with valid JSON only, no additional text.`;
  }

  /**
   * Build user message for report mode query refinement
   */
  buildReportUserMessage(originalQuery, conversationHistory) {
    const questionCount = conversationHistory.filter(msg => msg.role === 'user').length;
    
    return `Generate a comprehensive search query for a final report that covers ALL topics discussed in this conversation.

Current request: "${originalQuery}"

The conversation contains ${questionCount} user questions covering various topics. Create ONE optimized search query that will retrieve information relevant to ALL questions asked throughout the conversation.

Focus on creating a query that captures the breadth and depth of all topics discussed.

Provide ONLY the JSON response as specified in the system prompt.`;
  }

  /**
   * Extract keywords from conversation history (fallback method)
   */
  extractKeywordsFromHistory(conversationHistory) {
    const userMessages = conversationHistory
      .filter(msg => msg.role === 'user')
      .map(msg => msg.content)
      .join(' ');

    // Simple keyword extraction - remove common words and get key terms
    const keywords = userMessages
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => 
        word.length > 3 && 
        !['what', 'how', 'why', 'when', 'where', 'can', 'could', 'would', 'should', 'tell', 'about', 'more'].includes(word)
      )
      .slice(0, 20); // Limit to 20 most relevant terms

    return keywords.join(' ');
  }

  /**
   * Extract search terms from conversation history (fallback method)
   */
  extractSearchTermsFromHistory(conversationHistory) {
    const userMessages = conversationHistory
      .filter(msg => msg.role === 'user')
      .map(msg => msg.content)
      .join(' ');

    return userMessages
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => 
        word.length > 3 && 
        !['what', 'how', 'why', 'when', 'where', 'can', 'could', 'would', 'should', 'tell', 'about', 'more'].includes(word)
      )
      .slice(0, 15);
  }

  /**
   * Build system prompt for query refinement
   */
  buildSystemPrompt(documentContext) {
    return `You are a query optimization expert for semantic search systems. Your task is to refine user queries to improve retrieval accuracy from document collections using vector similarity.

CONTEXT:
User's uploaded documents:
${documentContext}

SEMANTIC SEARCH OPTIMIZATION RULES:
1. For greetings like "hi", "hello", "hey" → Convert to meaningful search intent or ask for clarification
2. Keep queries concise and focused (3-8 words typically work best)
3. Use specific nouns, verbs, and technical terms rather than complete sentences
4. Extract core concepts and keywords
5. Remove filler words (the, a, an, is, are, etc.)
6. Use synonyms and related terms for better matching
7. Focus on the user's actual information need

EXAMPLES:
- "hi" → "general information overview"
- "What is machine learning?" → "machine learning definition concepts"
- "How do I implement authentication?" → "authentication implementation methods"
- "Tell me about project management best practices" → "project management best practices"

RESPONSE FORMAT (JSON only):
{
  "refinedQuery": "concise keywords and concepts for semantic search",
  "searchTerms": ["key", "terms", "extracted", "from", "query"],
  "intent": "specific_fact|conceptual_explanation|comparison|list_items|procedure|general_search|follow_up|greeting_clarification",
  "confidence": 0.85,
  "reasoning": "brief explanation of refinements made"
}

Always respond with valid JSON only, no additional text.`;
  }

  /**
   * Build user message for query refinement
   */
  buildUserMessage(originalQuery) {
    return `Please refine this query for semantic search: "${originalQuery}"

Provide ONLY the JSON response as specified in the system prompt.`;
  }

  /**
   * Reset conversation thread for a session
   */
  async resetThread(sessionId, userId = null) {
    try {
      if (!sessionId) {
        console.warn('⚠️ No session ID provided for thread reset');
        return false;
      }

      const newThreadId = await this.llmManager.resetThread(sessionId, userId);
      console.log(`✅ Thread reset for session ${sessionId}: ${newThreadId}`);
      return true;

    } catch (error) {
      console.error('❌ Thread reset failed:', error.message);
      return false;
    }
  }

  /**
   * Load user threads into cache on login
   * @param {string} userId - User ID
   * @returns {Promise<Array>} - Array of user thread info
   */
  async loadUserThreadsOnLogin(userId) {
    try {
      console.log(`🔄 Loading threads for user ${userId} on login`);
      return await this.llmManager.loadUserThreadsToCache(userId);
    } catch (error) {
      console.error('❌ Failed to load user threads on login:', error.message);
      return [];
    }
  }

  /**
   * Get user thread information
   * @param {string} userId - User ID
   * @returns {Promise<Array>} - Array of user thread info
   */
  async getUserThreads(userId) {
    try {
      return await this.llmManager.getUserThreads(userId);
    } catch (error) {
      console.error('❌ Failed to get user threads:', error.message);
      return [];
    }
  }

  /**
   * Get thread information for a session
   */
  getThreadInfo(sessionId) {
    return this.llmManager.getThreadInfo(sessionId);
  }

  /**
   * Clean up QueryRefiner threads for a session
   * @param {string} userId - User ID
   * @param {string} sessionId - Session ID to clean up
   * @returns {boolean} - Success status
   */
  cleanupQueryRefinerSessionThreads(userId, sessionId) {
    try {
      console.log(`🧹 Cleaning up QueryRefiner threads for session ${sessionId}, user ${userId}`);
      
      // Clean up QueryRefiner thread mapping
      const queryRefinerSessionKey = `queryrefiner_${userId}_${sessionId}`;
      const queryRefinerThreadId = this.queryRefinerThreadMapping.get(queryRefinerSessionKey);
      
      if (queryRefinerThreadId) {
        // Remove bidirectional mappings
        this.queryRefinerThreadMapping.delete(queryRefinerSessionKey);
        this.queryRefinerThreadReverseMapping.delete(queryRefinerThreadId);
        
        console.log(`✅ Cleaned up QueryRefiner thread mapping: ${queryRefinerThreadId}`);
      }
      
      return true;
    } catch (error) {
      console.error(`❌ Failed to cleanup QueryRefiner threads for session ${sessionId}:`, error.message);
      return false;
    }
  }

  /**
   * Clean up old threads
   */
  cleanupOldThreads(maxAge) {
    return this.llmManager.cleanupOldThreads(maxAge);
  }
}

module.exports = QueryRefiner;