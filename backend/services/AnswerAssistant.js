const LLMManager = require('./LLMManager');

class AnswerAssistant {
  constructor() {
    this.llmManager = new LLMManager();
    
    // AnswerAssistant-specific thread management
    this.answerAssistantThreadMapping = new Map(); // sessionKey → answerAssistantThreadId
    this.answerAssistantThreadReverseMapping = new Map(); // answerAssistantThreadId → sessionKey
    
    console.log('🤖 AnswerAssistant initialized with thread-based LLM management and AnswerAssistant thread tracking');
  }

  /**
   * Create or get AnswerAssistant thread ID for a session
   */
  getAnswerAssistantThreadIdForSession(userId, sessionId) {
    const sessionKey = `answerassistant_${userId}_${sessionId}`;
    
    if (!this.answerAssistantThreadMapping.has(sessionKey)) {
      // Generate a new AnswerAssistant thread ID for this session
      const threadId = `answerassistant_thread_${userId}_${sessionId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create bidirectional mapping
      this.answerAssistantThreadMapping.set(sessionKey, threadId);
      this.answerAssistantThreadReverseMapping.set(threadId, sessionKey);
      
      console.log(`� Created new AnswerAssistant thread mapping: Session ${sessionId} → Thread ${threadId}`);
      return threadId;
    }
    
    return this.answerAssistantThreadMapping.get(sessionKey);
  }

  /**
   * Get session info from AnswerAssistant thread ID
   */
  getSessionFromAnswerAssistantThreadId(threadId) {
    const sessionKey = this.answerAssistantThreadReverseMapping.get(threadId);
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
   * Generate comprehensive answer using retrieved data and original user query with thread context
   * @param {string} originalQuery - The user's original question
   * @param {Array} retrievedData - Array of retrieved documents/chunks
   * @param {string} userId - User identifier
   * @param {string} sessionId - Session identifier  
   * @param {boolean} isReportMode - Whether this is for comprehensive report generation
   * @param {Array} conversationHistory - Full conversation history for report mode
   * @param {string} queryRefinerThreadId - QueryRefiner thread ID for cross-referencing
   * @returns {Object} Generated answer with sources and metadata
   */
  async generateAnswer(originalQuery, retrievedData, userId, sessionId, isReportMode = false, conversationHistory = [], queryRefinerThreadId = null) {
    try {
      console.log(`🤖 Generating answer: "${originalQuery}" for session: ${sessionId}, user: ${userId}, queryRefinerThread: ${queryRefinerThreadId}, reportMode: ${isReportMode}`);
      
      if (!sessionId) {
        console.warn('⚠️ No session ID provided, using basic answer generation');
        return this.basicAnswerGeneration(originalQuery, retrievedData);
      }

      // Get or create AnswerAssistant thread ID for this session
      const answerAssistantThreadId = this.getAnswerAssistantThreadIdForSession(userId, sessionId);
      console.log(`🤖 Using AnswerAssistant thread ID: ${answerAssistantThreadId}`);

      // Prepare context from retrieved data
      const context = this.prepareContext(retrievedData);
      
      // Build the system prompt based on mode
      const systemPrompt = isReportMode 
        ? this.buildReportSystemPrompt(context, conversationHistory)
        : this.buildSystemPrompt(context);
      
      // Build the user message based on mode
      const userMessage = isReportMode
        ? this.buildReportUserMessage(originalQuery, conversationHistory)
        : this.buildUserMessage(originalQuery, context);

      // Create comprehensive thread info including both thread IDs
      const threadInfo = {
        sessionId: sessionId,
        answerAssistantThreadId: answerAssistantThreadId,
        queryRefinerThreadId: queryRefinerThreadId,
        hasAnswerAssistantThread: true,
        hasQueryRefinerThread: !!queryRefinerThreadId,
        source: 'DualThreadSystem'
      };
      
      console.log(`🧵 Dual Thread Info: ${JSON.stringify(threadInfo)}`);

      // Ensure LLMManager knows about this session by creating/updating mapping
      try {
        await this.llmManager.getOrCreateThread(sessionId, userId);
      } catch (error) {
        console.warn(`⚠️ Could not sync session with LLMManager: ${error.message}`);
      }

      // Send message using AnswerAssistant's LLMManager (which uses sessionId internally)
      const response = await this.llmManager.sendMessage(sessionId, userMessage, systemPrompt, userId, 'answerassistant');
      
      let answerData;
      try {
        // For reports, try to parse as JSON first, then fallback to direct text
        if (isReportMode) {
          try {
            answerData = JSON.parse(response);
          } catch (parseError) {
            // If JSON parsing fails for reports, treat as direct markdown response
            answerData = {
              response: response,
              sources: this.extractSourcesFromResponse(response, retrievedData),
              confidence: this.calculateConfidence(retrievedData, response, conversationHistory)
            };
          }
        } else {
          // For regular chat, expect direct text response
          answerData = {
            response: response,
            sources: this.extractSourcesFromResponse(response, retrievedData),
            confidence: this.calculateConfidence(retrievedData, response, conversationHistory)
          };
        }
      } catch (parseError) {
        console.warn('⚠️ Failed to process response, using fallback');
        answerData = {
          response: "I apologize, but I encountered an issue processing your request. Please try again.",
          sources: [],
          confidence: 0.3
        };
      }

      console.log(`✅ Answer generated: "${answerData.response.substring(0, 100)}..."`);
      console.log(`📊 Confidence: ${answerData.confidence}`);
      console.log(`🔗 Sources: ${answerData.sources.length}`);

      return {
        answer: answerData.response,
        sources: answerData.sources,
        confidence: answerData.confidence,
        hasRelevantSources: answerData.sources.length > 0,
        threadId: answerAssistantThreadId,
        sessionId: sessionId,
        isReport: isReportMode,
        metadata: {
          originalQuery,
          documentsUsed: retrievedData.length,
          timestamp: new Date().toISOString(),
          conversationLength: (Array.isArray(conversationHistory) ? conversationHistory.length : 0) + (isReportMode ? 0 : 2),
          sessionThreadMapping: `${sessionId} → ${answerAssistantThreadId}`,
          mode: isReportMode ? 'report_generation' : 'conversation',
          ...(isReportMode && {
            questionsAnswered: Array.isArray(conversationHistory) ? conversationHistory.filter(msg => msg && msg.role === 'user').length : 0,
            reportScope: 'comprehensive_session_summary'
          })
        }
      };

    } catch (error) {
      console.error('❌ Answer generation failed:', error.message);
      
      // Fallback to basic answer generation
      return this.basicAnswerGeneration(originalQuery, retrievedData);
    }
  }

  /**
   * Basic answer generation when thread management fails
   */
  basicAnswerGeneration(originalQuery, retrievedData) {
    console.log('🔄 Using basic answer generation');
    
    const context = this.prepareContext(retrievedData);
    const sources = this.extractSourcesFromResponse("", retrievedData);
    
    return {
      answer: `Based on the available information, I can provide the following response to your query: "${originalQuery}". ${context}`,
      sources: sources,
      confidence: 0.5,
      hasRelevantSources: sources.length > 0,
      threadId: null,
      sessionId: null,
      isReport: false,
      metadata: {
        originalQuery,
        documentsUsed: retrievedData.length,
        timestamp: new Date().toISOString(),
        mode: 'basic_fallback'
      }
    };
  }

  /**
   * Build system prompt for report mode answer generation
   */
  buildReportSystemPrompt(context, conversationHistory) {
    // Ensure conversationHistory is an array
    const historyArray = Array.isArray(conversationHistory) ? conversationHistory : [];
    
    const userQuestions = historyArray
      .filter(msg => msg && msg.role === 'user')
      .map((msg, idx) => `${idx + 1}. ${msg.content || msg.message || 'Unknown question'}`)
      .join('\n');

    return `You are a comprehensive research report generator. Your task is to create a detailed, well-structured report that answers ALL user questions from a research session using the provided retrieved information.

REPORT REQUIREMENTS:
1. Create a comprehensive report covering ALL topics discussed in the conversation
2. Answer each user question thoroughly using the provided context
3. Organize the report with clear sections and subsections
4. Include natural source attribution (e.g., "According to BBC News..." or "The latest data shows...")
5. Provide crisp, clear, and well-structured answers in professional language
6. Include an executive summary at the beginning
7. Add a conclusion summarizing key findings
8. End with a comprehensive References section listing all sources used

REPORT STRUCTURE:
# Research Report

## Executive Summary
[Brief overview of all topics covered and key findings]

## Detailed Analysis
[For each major topic/question, provide comprehensive answers with natural source attribution]

### Topic 1: [First major topic]
[Detailed answer with natural references like "According to the BBC report..." or "Data from the study indicates..."]

### Topic 2: [Second major topic]
[Detailed answer with natural source attribution]

[Continue for all topics...]

## Key Findings and Conclusions
[Summary of most important discoveries and insights]

## References
[Complete list of all sources referenced in the report with actual names and URLs]

Guidelines:
- Be thorough and comprehensive - this is a final report
- Maintain academic/professional tone
- Reference sources naturally within the text
- Organize information logically by topic
- Provide clear, actionable insights where possible
- If information is incomplete, acknowledge limitations
- Include actual source names, URLs, and dates in the References section

CONVERSATION QUESTIONS TO ADDRESS:
${userQuestions || 'No previous questions'}

CONTEXT INFORMATION:
${context}

Always respond with well-formatted markdown text only, no JSON wrapper.`;
  }

  /**
   * Build user message for report mode answer generation
   */
  buildReportUserMessage(originalQuery, conversationHistory) {
    // Ensure conversationHistory is an array
    const historyArray = Array.isArray(conversationHistory) ? conversationHistory : [];
    const questionCount = historyArray.filter(msg => msg && msg.role === 'user').length;
    
    return `Generate a comprehensive research report based on the conversation history and retrieved information.

Current request: "${originalQuery}"

The conversation contains ${questionCount} user questions covering various topics. Create a detailed report that addresses ALL questions asked throughout the conversation using the provided information.

Focus on creating a thorough, well-organized report with natural source attribution and a comprehensive References section.

Provide the report as well-formatted markdown text.`;
  }

  /**
   * Build system prompt for regular answer generation
   */
  buildSystemPrompt(context) {
    return `You are a helpful research assistant that provides comprehensive, accurate answers based on retrieved information and conversation context. Your task is to:

1. Answer the user's question using ONLY the provided context information
2. Include natural references to sources without using numbered citations
3. If no relevant information is found, clearly state this
4. Be thorough but concise
5. Maintain objectivity and accuracy
6. Provide natural, flowing responses with proper attribution

Guidelines:
- Reference sources naturally: "According to BBC News..." or "Based on the latest report from..."
- Include a "References" section at the end with actual source URLs/names
- If information is incomplete, acknowledge this limitation
- Distinguish between different sources when they provide different perspectives
- If no relevant sources are found, say "Based on the available information, there is no data about..."
- Write in a conversational, helpful tone

CONTEXT INFORMATION:
${context}

Always respond with clear, well-structured text that includes natural source attribution and end with a References section listing the actual sources used.`;
  }

  /**
   * Build user message for regular answer generation
   */
  buildUserMessage(originalQuery, context) {
    return `Please provide a comprehensive answer to this question: "${originalQuery}"

Use natural language to reference sources (e.g., "According to BBC News..." or "The latest report indicates...") and include a References section at the end with actual source names and URLs when available.

Provide a clear, well-structured response with natural source attribution and proper references.`;
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
  prepareContext(retrievedData) {
    if (!retrievedData || retrievedData.length === 0) {
      return "No relevant information found in the knowledge base.";
    }

    let context = "Based on the following information from the knowledge base:\n\n";
    
    retrievedData.forEach((item, index) => {
      const text = item.text || item.content || '';
      const source = this.extractSourceInfo(item);
      
      context += `[Source ${index + 1}] ${source}\n`;
      context += `${text}\n\n`;
    });

    return context;
  }

  /**
   * Extract source information from retrieved item
   */
  extractSourceInfo(item) {
    const metadata = item.metadata || {};
    
    // For live sources (BBC News, etc.)
    if (metadata.isLiveData && metadata.sourceName) {
      const sourceUrl = metadata.sourceUrl || '';
      const timestamp = metadata.timestamp ? new Date(metadata.timestamp).toLocaleDateString() : '';
      return `${metadata.sourceName}${sourceUrl ? ` (${sourceUrl})` : ''}${timestamp ? ` - ${timestamp}` : ''}`;
    }
    
    // For uploaded documents
    if (metadata.fileName) {
      const uploadDate = metadata.uploadDate ? new Date(metadata.uploadDate).toLocaleDateString() : '';
      return `Document: ${metadata.fileName}${uploadDate ? ` - ${uploadDate}` : ''}`;
    }
    
    // For general content
    if (metadata.sourceType) {
      return `${metadata.sourceType}${metadata.title ? `: ${metadata.title}` : ''}`;
    }
    
    return 'Knowledge Base';
  }

  /**
   * Extract and format source references from the response
   */
  extractSourcesFromResponse(response, retrievedData) {
    const sources = [];
    const sourcePattern = /\[Source (\d+)\]/g;
    let match;

    while ((match = sourcePattern.exec(response)) !== null) {
      const sourceIndex = parseInt(match[1]) - 1;
      if (sourceIndex >= 0 && sourceIndex < retrievedData.length) {
        const item = retrievedData[sourceIndex];
        const metadata = item.metadata || {};
        
        const source = {
          index: sourceIndex + 1,
          title: metadata.sourceName || metadata.fileName || metadata.title || `Source ${sourceIndex + 1}`,
          url: metadata.sourceUrl || metadata.url || null,
          type: metadata.isLiveData ? 'live-source' : (metadata.fileName ? 'document' : 'content'),
          timestamp: metadata.timestamp || metadata.uploadDate || null,
          snippet: (item.text || item.content || '').substring(0, 200) + '...'
        };

        // Avoid duplicates
        if (!sources.find(s => s.index === source.index)) {
          sources.push(source);
        }
      }
    }

    return sources;
  }

  /**
   * Calculate confidence score based on retrieved data relevance and conversation context
   */
  calculateConfidence(retrievedData, response, conversationHistory = []) {
    if (!retrievedData || retrievedData.length === 0) {
      return 0.1; // Very low confidence with no sources
    }

    // Base confidence on number of sources and their scores
    const avgScore = retrievedData.reduce((sum, item) => {
      return sum + (item.score || 0.5);
    }, 0) / retrievedData.length;

    // Factor in number of sources (more sources = higher confidence)
    const sourcesFactor = Math.min(retrievedData.length / 5, 1);
    
    // Factor in response length (reasonable length indicates good coverage)
    const responseLengthFactor = Math.min(response.length / 500, 1);

    // Factor in conversation continuity (ongoing conversation = higher confidence)
    const conversationFactor = conversationHistory.length > 0 ? 0.1 : 0;

    const confidence = (avgScore * 0.4) + (sourcesFactor * 0.3) + (responseLengthFactor * 0.2) + conversationFactor;
    
    return Math.min(Math.max(confidence, 0.1), 0.95); // Clamp between 0.1 and 0.95
  }

  /**
   * Get thread history for context (for AnswerAssistant - retrieves from LLMManager)
   */
  async getThreadHistory(userId, sessionId, threadIdOrMaxMessages = 10, maxMessages = 10) {
    try {
      // Handle both old and new calling patterns
      let actualMaxMessages = maxMessages;
      
      // If threadIdOrMaxMessages is a number, it's the old pattern (userId, sessionId, maxMessages)
      // If it's a string, it's the new pattern (userId, sessionId, threadId, maxMessages)
      if (typeof threadIdOrMaxMessages === 'number') {
        actualMaxMessages = threadIdOrMaxMessages;
      } else if (typeof maxMessages === 'number') {
        actualMaxMessages = maxMessages;
      }
      
      // Get the LLMManager's thread for this session (where actual messages are stored)
      const threadInfo = await this.llmManager.getThreadInfo(sessionId);
      if (!threadInfo || !threadInfo.threadId) {
        console.log(`⚠️ No LLMManager thread found for session ${sessionId}`);
        return [];
      }

      // Use the LLMManager's thread to get actual conversation history
      const messages = await this.llmManager.getThreadMessages(threadInfo.threadId, actualMaxMessages);
      console.log(`📚 Retrieved ${messages.length} messages from LLMManager thread ${threadInfo.threadId} for session ${sessionId}`);
      
      return Array.isArray(messages) ? messages : [];
    } catch (error) {
      console.warn(`⚠️ Could not retrieve thread history: ${error.message}`);
      return [];
    }
  }

  /**
   * Clean up AnswerAssistant threads for a session
   * @param {string} userId - User ID
   * @param {string} sessionId - Session ID to clean up
   * @returns {boolean} - Success status
   */
  cleanupAnswerAssistantSessionThreads(userId, sessionId) {
    try {
      console.log(`🧹 Cleaning up AnswerAssistant threads for session ${sessionId}, user ${userId}`);
      
      // Clean up AnswerAssistant thread mapping
      const answerAssistantSessionKey = `answerassistant_${userId}_${sessionId}`;
      const answerAssistantThreadId = this.answerAssistantThreadMapping.get(answerAssistantSessionKey);
      
      if (answerAssistantThreadId) {
        // Remove bidirectional mappings
        this.answerAssistantThreadMapping.delete(answerAssistantSessionKey);
        this.answerAssistantThreadReverseMapping.delete(answerAssistantThreadId);
        
        console.log(`✅ Cleaned up AnswerAssistant thread mapping: ${answerAssistantThreadId}`);
      }
      
      return true;
    } catch (error) {
      console.error(`❌ Failed to cleanup AnswerAssistant threads for session ${sessionId}:`, error.message);
      return false;
    }
  }
}

module.exports = AnswerAssistant;