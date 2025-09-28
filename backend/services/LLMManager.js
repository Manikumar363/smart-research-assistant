const axios = require('axios');
const ConversationThread = require('../models/ConversationThread');

/**
 * LLM Manager class for Azure AI Foundry with thread-based conversation management
 * Each session gets its own thread ID for maintaining conversation context
 * Thread mappings are stored in the database for persistence across server restarts
 */
class LLMManager {
  constructor() {
    this.azureEndpoint = process.env.AZURE_OPENAI_BASE_URL;
    this.azureApiKey = process.env.AZURE_OPENAI_API_KEY;
    this.deploymentName = process.env.AZURE_OPENAI_COMPLETIONS_DEPLOYMENT || 'gpt-4.1';
    this.apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-12-01-preview';
    
    // In-memory cache for faster access (synced with database)
    this.sessionThreadsCache = new Map();
    
    // Fallback message storage for when Azure threads are not available
    this.fallbackMessages = new Map(); // threadId → array of messages
    
    if (!this.azureEndpoint || !this.azureApiKey) {
      throw new Error('Azure OpenAI credentials not configured for LLMManager');
    }
    
    console.log('🤖 LLMManager initialized with Azure AI Foundry');
    console.log(`🔗 Endpoint: ${this.azureEndpoint}`);
    console.log(`🏷️ Deployment: ${this.deploymentName}`);
    console.log(`📅 API Version: ${this.apiVersion}`);
    console.log('🧵 Thread-based conversation management with database persistence enabled');
    console.log('💾 Fallback message storage initialized for offline thread support');
  }

  /**
   * Get or create a thread for a session with database persistence
   * @param {string} sessionId - The session ID
   * @param {string} userId - The user ID (for database storage)
   * @returns {Promise<string>} - Thread ID
   */
  async getOrCreateThread(sessionId, userId = null) {
    try {
      console.log(`🔍 Getting or creating thread for session ${sessionId}, user ${userId}`);
      
      // First check cache
      if (this.sessionThreadsCache.has(sessionId)) {
        const threadId = this.sessionThreadsCache.get(sessionId);
        console.log(`🧵 Using cached thread ${threadId} for session ${sessionId}`);
        
        // Update last used time in database
        if (userId) {
          await this.updateThreadLastUsed(sessionId, threadId);
        }
        
        return threadId;
      }

      console.log(`🔍 Thread not in cache, checking database for session ${sessionId}`);

      // Check database for existing thread
      const ConversationThread = require('../models/ConversationThread');
      const existingThread = await ConversationThread.findBySession(sessionId);
      
      if (existingThread) {
        const threadId = existingThread.threadId;
        console.log(`🧵 Retrieved thread ${threadId} from database for session ${sessionId}`);
        
        // Cache it for faster access
        this.sessionThreadsCache.set(sessionId, threadId);
        
        // Update last used time
        await existingThread.updateLastUsed();
        
        return threadId;
      }

      console.log(`🆕 No existing thread found, creating new thread for session ${sessionId}`);

      // Create a new thread
      const threadId = await this.createNewThread(sessionId, userId);
      
      // Cache it
      this.sessionThreadsCache.set(sessionId, threadId);
      
      console.log(`✨ Created and cached new thread ${threadId} for session ${sessionId}`);
      return threadId;

    } catch (error) {
      console.error('❌ Failed to get/create thread:', error.message);
      
      // Fallback to in-memory only
      const fallbackThreadId = `fallback_${sessionId}_${Date.now()}`;
      this.sessionThreadsCache.set(sessionId, fallbackThreadId);
      console.warn(`⚠️ Using fallback thread ID: ${fallbackThreadId}`);
      return fallbackThreadId;
    }
  }

  /**
   * Create a new thread for conversation management with database persistence
   * @param {string} sessionId - The session ID for context
   * @param {string} userId - The user ID for database storage
   * @returns {Promise<string>} - Thread ID
   */
  async createNewThread(sessionId, userId = null) {
    try {
      console.log(`🆕 Creating new thread for session ${sessionId}, user ${userId}`);
      
      const url = `${this.azureEndpoint.replace(/\/$/, '')}/threads?api-version=${this.apiVersion}`;
      
      const requestBody = {
        metadata: {
          sessionId: sessionId,
          userId: userId,
          createdAt: new Date().toISOString(),
          purpose: 'query_refinement'
        }
      };

      console.log(`🔗 Making request to Azure AI: ${url}`);
      console.log(`📦 Request body:`, requestBody);

      let azureThreadId = null;
      let threadId = null;
      let isFallback = false;

      try {
        const response = await axios.post(url, requestBody, {
          headers: {
            'Content-Type': 'application/json',
            'api-key': this.azureApiKey
          },
          timeout: 30000
        });

        if (response.data && response.data.id) {
          azureThreadId = response.data.id;
          threadId = azureThreadId;
          console.log(`✅ Azure thread created: ${azureThreadId}`);
        } else {
          throw new Error('Invalid response format from Azure OpenAI thread creation');
        }
      } catch (azureError) {
        console.warn('⚠️ Azure thread creation failed, using fallback:', azureError.message);
        threadId = `fallback_${sessionId}_${Date.now()}`;
        isFallback = true;
      }

      // Save to database if userId is provided
      if (userId && sessionId) {
        try {
          const conversationThread = new ConversationThread({
            sessionId: sessionId,
            threadId: threadId,
            userId: userId,
            status: 'active',
            metadata: {
              purpose: 'query_refinement',
              azureThreadId: azureThreadId,
              fallbackMode: isFallback
            }
          });

          await conversationThread.save();
          console.log(`💾 Thread ${threadId} saved to database`);
        } catch (dbError) {
          console.warn('⚠️ Failed to save thread to database:', dbError.message);
          // Continue with thread creation even if database save fails
        }
      }

      return threadId;

    } catch (error) {
      console.error('❌ Thread creation failed:', error.message);
      
      // Generate fallback thread ID
      const fallbackThreadId = `fallback_${sessionId}_${Date.now()}`;
      console.warn(`⚠️ Using complete fallback thread ID: ${fallbackThreadId}`);
      return fallbackThreadId;
    }
  }

  /**
   * Reset thread for a session (create new thread) with database update
   * @param {string} sessionId - The session ID
   * @param {string} userId - The user ID
   * @returns {Promise<string>} - New thread ID
   */
  async resetThread(sessionId, userId = null) {
    try {
      console.log(`🔄 Resetting thread for session ${sessionId}`);
      
      // Mark old thread as reset in database
      if (userId) {
        const oldThread = await ConversationThread.findBySession(sessionId);
        if (oldThread) {
          await oldThread.markAsReset();
          console.log(`🗑️ Marked old thread ${oldThread.threadId} as reset`);
        }
      }
      
      // Remove from cache
      if (this.sessionThreadsCache.has(sessionId)) {
        const oldThreadId = this.sessionThreadsCache.get(sessionId);
        this.sessionThreadsCache.delete(sessionId);
        console.log(`🗑️ Removed old thread ${oldThreadId} from cache`);
      }

      // Create new thread
      const newThreadId = await this.createNewThread(sessionId, userId);
      this.sessionThreadsCache.set(sessionId, newThreadId);
      
      console.log(`✅ Thread reset complete. New thread: ${newThreadId}`);
      return newThreadId;

    } catch (error) {
      console.error('❌ Thread reset failed:', error.message);
      throw error;
    }
  }

  /**
   * Get all active threads for a user (useful for user login scenarios)
   * @param {string} userId - The user ID
   * @returns {Promise<Array>} - Array of thread information
   */
  async getUserThreads(userId) {
    try {
      const threads = await ConversationThread.findByUser(userId);
      
      const threadInfo = threads.map(thread => ({
        sessionId: thread.sessionId,
        threadId: thread.threadId,
        lastUsedAt: thread.lastUsedAt,
        messageCount: thread.messageCount,
        isFallback: thread.metadata?.fallbackMode || false,
        createdAt: thread.createdAt
      }));

      console.log(`👤 Found ${threadInfo.length} active threads for user ${userId}`);
      return threadInfo;

    } catch (error) {
      console.error('❌ Failed to get user threads:', error.message);
      return [];
    }
  }

  /**
   * Load user threads into cache (call this on user login)
   * @param {string} userId - The user ID
   * @returns {Promise<number>} - Number of threads loaded
   */
  async loadUserThreadsToCache(userId) {
    try {
      const threads = await this.getUserThreads(userId);
      
      let loadedCount = 0;
      for (const thread of threads) {
        this.sessionThreadsCache.set(thread.sessionId.toString(), thread.threadId);
        loadedCount++;
      }

      console.log(`📥 Loaded ${loadedCount} threads to cache for user ${userId}`);
      return loadedCount;

    } catch (error) {
      console.error('❌ Failed to load user threads to cache:', error.message);
      return 0;
    }
  }

  /**
   * Get thread information for a session with database lookup
   * @param {string} sessionId - The session ID
   * @returns {Promise<Object>} - Thread information
   */
  async getThreadInfo(sessionId) {
    try {
      // Check cache first
      const cachedThreadId = this.sessionThreadsCache.get(sessionId);
      
      // Check database
      const dbThread = await ConversationThread.findBySession(sessionId);
      
      return {
        sessionId: sessionId,
        threadId: cachedThreadId || dbThread?.threadId || null,
        hasThread: !!(cachedThreadId || dbThread),
        isFallback: cachedThreadId?.startsWith('fallback_') || dbThread?.metadata?.fallbackMode || false,
        inCache: !!cachedThreadId,
        inDatabase: !!dbThread,
        lastUsedAt: dbThread?.lastUsedAt || null,
        messageCount: dbThread?.messageCount || 0
      };
    } catch (error) {
      console.error('❌ Failed to get thread info:', error.message);
      return {
        sessionId: sessionId,
        threadId: null,
        hasThread: false,
        isFallback: false,
        inCache: false,
        inDatabase: false,
        error: error.message
      };
    }
  }

  /**
   * Send a message using thread-based conversation
   * @param {string} sessionId - The session ID
   * @param {string} message - The message to send
   * @param {string} systemPrompt - System prompt for context
   * @param {string} userId - The user ID (for database operations)
   * @param {string} service - The service calling this method ('queryrefiner' or 'answerassistant')
   * @returns {Promise<string>} - LLM response
   */
  async sendMessage(sessionId, message, systemPrompt = null, userId = null, service = 'queryrefiner') {
    try {
      const threadId = await this.getOrCreateThread(sessionId, userId);
      
      // Add message to thread
      await this.addMessageToThread(threadId, message, 'user');
      
      // If system prompt provided, add it as well
      if (systemPrompt) {
        await this.addMessageToThread(threadId, systemPrompt, 'system');
      }

      // Run the thread and get response
      const response = await this.runThread(threadId, service, message, systemPrompt);
      
      // Update thread usage in database
      if (userId) {
        await this.updateThreadLastUsed(sessionId, threadId);
      }
      
      console.log(`💬 LLM response for session ${sessionId}: ${response.substring(0, 100)}...`);
      return response;

    } catch (error) {
      console.error('❌ Send message failed:', error.message);
      throw error;
    }
  }

  /**
   * Update thread last used time in database
   */
  async updateThreadLastUsed(sessionId, threadId) {
    try {
      const thread = await ConversationThread.findBySession(sessionId);
      if (thread) {
        await thread.updateLastUsed();
      }
    } catch (error) {
      console.warn('⚠️ Failed to update thread last used time:', error.message);
    }
  }

  /**
   * Add a message to a thread
   * @param {string} threadId - The thread ID
   * @param {string} content - Message content
   * @param {string} role - Message role (user, assistant, system)
   */
  async addMessageToThread(threadId, content, role = 'user') {
    try {
      // If using fallback thread, store message locally
      if (threadId.startsWith('fallback_')) {
        if (!this.fallbackMessages.has(threadId)) {
          this.fallbackMessages.set(threadId, []);
        }
        
        const message = {
          id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          role: role,
          content: content,
          timestamp: new Date().toISOString()
        };
        
        this.fallbackMessages.get(threadId).push(message);
        console.log(`📝 Fallback mode: Message added to ${threadId} (${this.fallbackMessages.get(threadId).length} total messages)`);
        console.log(`🔍 Added message: ${role}: ${content.substring(0, 50)}...`);
        return;
      }

      const url = `${this.azureEndpoint.replace(/\/$/, '')}/threads/${threadId}/messages?api-version=${this.apiVersion}`;
      
      const requestBody = {
        role: role,
        content: content
      };

      await axios.post(url, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.azureApiKey
        },
        timeout: 15000
      });

      console.log(`📝 Added ${role} message to thread ${threadId}`);

    } catch (error) {
      console.warn(`⚠️ Failed to add message to thread: ${error.message}`);
      // Don't throw here to allow fallback to direct chat completions
    }
  }

  /**
   * Run a thread and get the assistant's response
   * @param {string} threadId - The thread ID
   * @param {string} service - The service calling this method
   * @param {string} userMessage - The user message (for fallback)
   * @param {string} systemPrompt - The system prompt (for fallback)
   * @returns {Promise<string>} - Assistant response
   */
  async runThread(threadId, service = 'queryrefiner', userMessage = null, systemPrompt = null) {
    try {
      // If using fallback thread, use direct chat completions
      if (threadId.startsWith('fallback_')) {
        console.log(`🔄 Using fallback chat completions for ${threadId}`);
        const response = await this.fallbackChatCompletion(service, userMessage, systemPrompt);
        
        // Store the assistant's response in fallback messages
        if (response) {
          await this.addMessageToThread(threadId, response, 'assistant');
        }
        
        return response;
      }

      const url = `${this.azureEndpoint.replace(/\/$/, '')}/threads/${threadId}/runs?api-version=${this.apiVersion}`;
      
      const requestBody = {
        assistant_id: this.deploymentName,
        model: this.deploymentName
      };

      const response = await axios.post(url, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.azureApiKey
        },
        timeout: 30000
      });

      if (response.data && response.data.id) {
        // Wait for completion and get response
        return await this.waitForRunCompletion(threadId, response.data.id);
      } else {
        throw new Error('Invalid run response format');
      }

    } catch (error) {
      console.warn(`⚠️ Thread run failed, using fallback: ${error.message}`);
      const response = await this.fallbackChatCompletion(service, userMessage, systemPrompt);
      
      // Store the assistant's response in fallback messages if this becomes a fallback thread
      if (response && threadId.startsWith('fallback_')) {
        await this.addMessageToThread(threadId, response, 'assistant');
      }
      
      return response;
    }
  }

  /**
   * Wait for thread run completion and get the response
   * @param {string} threadId - The thread ID
   * @param {string} runId - The run ID
   * @returns {Promise<string>} - Assistant response
   */
  async waitForRunCompletion(threadId, runId) {
    const maxAttempts = 10;
    const delay = 1000; // 1 second

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const url = `${this.azureEndpoint.replace(/\/$/, '')}/threads/${threadId}/runs/${runId}?api-version=${this.apiVersion}`;
        
        const response = await axios.get(url, {
          headers: {
            'api-key': this.azureApiKey
          },
          timeout: 10000
        });

        if (response.data.status === 'completed') {
          // Get the latest message from the thread
          return await this.getLatestMessage(threadId);
        } else if (response.data.status === 'failed') {
          throw new Error('Thread run failed');
        }

        // Wait before checking again
        await new Promise(resolve => setTimeout(resolve, delay));

      } catch (error) {
        console.warn(`⚠️ Run status check failed (attempt ${attempt + 1}): ${error.message}`);
      }
    }

    throw new Error('Thread run timed out');
  }

  /**
   * Get the latest message from a thread
   * @param {string} threadId - The thread ID
   * @returns {Promise<string>} - Latest message content
   */
  async getLatestMessage(threadId) {
    try {
      const url = `${this.azureEndpoint.replace(/\/$/, '')}/threads/${threadId}/messages?api-version=${this.apiVersion}&limit=1`;
      
      const response = await axios.get(url, {
        headers: {
          'api-key': this.azureApiKey
        },
        timeout: 10000
      });

      if (response.data && response.data.data && response.data.data[0]) {
        const message = response.data.data[0];
        if (message.content && message.content[0] && message.content[0].text) {
          return message.content[0].text.value;
        }
      }

      throw new Error('No message content found');

    } catch (error) {
      console.warn(`⚠️ Failed to get latest message: ${error.message}`);
      return 'Response received but content unavailable';
    }
  }

  /**
   * Get all messages from a thread
   * @param {string} threadId - The thread ID
   * @param {number} limit - Maximum number of messages to retrieve (default: 50)
   * @returns {Promise<Array>} - Array of messages with role and content
   */
  async getThreadMessages(threadId, limit = 50) {
    try {
      // If fallback thread, return stored messages
      if (threadId.startsWith('fallback_')) {
        const messages = this.fallbackMessages.get(threadId) || [];
        console.log(`📝 Fallback thread ${threadId} has ${messages.length} stored messages`);
        console.log(`🔍 Fallback messages debug:`, messages.length > 0 ? messages.map(m => `${m.role}: ${m.content.substring(0, 50)}...`) : 'No messages');
        
        // Return the most recent messages up to the limit
        const recentMessages = messages.slice(-limit);
        return recentMessages;
      }

      const url = `${this.azureEndpoint.replace(/\/$/, '')}/threads/${threadId}/messages?api-version=${this.apiVersion}&limit=${limit}&order=asc`;
      
      const response = await axios.get(url, {
        headers: {
          'api-key': this.azureApiKey
        },
        timeout: 15000
      });

      if (response.data && response.data.data) {
        const messages = response.data.data.map(message => {
          let content = '';
          if (message.content && message.content[0] && message.content[0].text) {
            content = message.content[0].text.value;
          }
          
          return {
            id: message.id,
            role: message.role,
            content: content,
            timestamp: message.created_at ? new Date(message.created_at * 1000).toISOString() : new Date().toISOString()
          };
        });

        console.log(`📚 Retrieved ${messages.length} messages from thread ${threadId}`);
        return messages;
      }

      return [];

    } catch (error) {
      console.warn(`⚠️ Failed to get thread messages: ${error.message}`);
      return [];
    }
  }

  /**
   * Fallback to direct chat completions when thread API is unavailable
   * @param {string} service - The service calling this fallback ('queryrefiner' or 'answerassistant')
   * @param {string} userMessage - The actual user message
   * @param {string} systemPrompt - The system prompt
   * @returns {Promise<string>} - Fallback response
   */
  async fallbackChatCompletion(service = 'queryrefiner', userMessage = null, systemPrompt = null) {
    try {
      const url = `${this.azureEndpoint.replace(/\/$/, '')}/deployments/${this.deploymentName}/chat/completions?api-version=${this.apiVersion}`;
      
      let requestBody;
      
      if (service === 'answerassistant') {
        // Fallback for AnswerAssistant - natural language response
        const messages = [
          {
            role: "system",
            content: systemPrompt || "You are a helpful research assistant. Provide clear, natural language responses to user questions. If no specific information is available, provide a helpful general response."
          }
        ];
        
        if (userMessage) {
          messages.push({
            role: "user",
            content: userMessage
          });
        } else {
          messages.push({
            role: "user",
            content: "Please provide a helpful response to the user's question. Respond in natural language, not JSON."
          });
        }
        
        requestBody = {
          messages: messages,
          max_tokens: 500,
          temperature: 0.7
        };
      } else {
        // Fallback for QueryRefiner - JSON response
        const messages = [
          {
            role: "system",
            content: systemPrompt || "You are a query optimization expert for semantic search. Convert user queries into concise keywords for vector similarity matching. For greetings like 'hi', 'hello', 'hey' → use 'general information overview' or ask for clarification. Always respond with valid JSON only."
          }
        ];
        
        if (userMessage) {
          messages.push({
            role: "user",
            content: userMessage
          });
        } else {
          messages.push({
            role: "user",
            content: "Refine the query for semantic search. For greetings, use general terms like 'overview' or 'help'. Respond in JSON format with refinedQuery, searchTerms, intent, confidence, and reasoning fields."
          });
        }
        
        requestBody = {
          messages: messages,
          max_tokens: 500,
          temperature: 0.3
        };
      }

      const response = await axios.post(url, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.azureApiKey
        },
        timeout: 30000
      });

      if (response.data?.choices?.[0]?.message?.content) {
        return response.data.choices[0].message.content.trim();
      } else {
        throw new Error('Invalid fallback response format');
      }

    } catch (error) {
      console.error('❌ Fallback chat completion failed:', error.message);
      
      if (service === 'answerassistant') {
        return "I apologize, but I'm experiencing technical difficulties. Could you please rephrase your question or try again later?";
      } else {
        return JSON.stringify({
          refinedQuery: userMessage || "fallback query refinement",
          searchTerms: userMessage ? userMessage.split(' ').slice(0, 3) : ["fallback"],
          intent: "general_search",
          confidence: 0.3,
          reasoning: "Fallback response due to API issues"
        });
      }
    }
  }

  /**
   * Get thread information for a session
   * @param {string} sessionId - The session ID
   * @returns {Object} - Thread information
   */
  getThreadInfo(sessionId) {
    const threadId = this.sessionThreadsCache.get(sessionId);
    return {
      sessionId: sessionId,
      threadId: threadId || null,
      hasThread: !!threadId,
      isFallback: threadId ? threadId.startsWith('fallback_') : false
    };
  }

  /**
   * Clean up thread when session is deleted
   * @param {string} sessionId - Session ID to clean up
   * @param {string} userId - User ID for verification
   * @returns {Promise<boolean>} - Success status
   */
  async cleanupSessionThread(sessionId, userId = null) {
    try {
      console.log(`🧹 Cleaning up thread for session ${sessionId}`);
      
      // Get thread info before cleanup
      const threadInfo = this.getThreadInfo(sessionId);
      
      // Remove from cache
      this.sessionThreadsCache.delete(sessionId);
      console.log(`✅ Removed session ${sessionId} from thread cache`);
      
      // Clean up fallback messages if this was a fallback thread
      if (threadInfo && threadInfo.threadId && threadInfo.threadId.startsWith('fallback_')) {
        this.fallbackMessages.delete(threadInfo.threadId);
        console.log(`✅ Cleaned up fallback messages for thread ${threadInfo.threadId}`);
      }
      
      // Remove from database
      const ConversationThread = require('../models/ConversationThread');
      const deleteQuery = { sessionId: sessionId };
      if (userId) {
        deleteQuery.userId = userId; // Add user verification if provided
      }
      
      const deletedThread = await ConversationThread.findOneAndDelete(deleteQuery);
      
      if (deletedThread) {
        console.log(`✅ Deleted thread mapping for session ${sessionId} from database`);
        
        // Optionally delete the thread from Azure AI as well
        if (threadInfo.hasThread && threadInfo.threadId) {
          try {
            // Note: Azure OpenAI threads are automatically cleaned up by Azure
            // But we could explicitly delete them if needed in the future
            console.log(`ℹ️ Azure thread ${threadInfo.threadId} will be auto-cleaned by Azure`);
          } catch (azureError) {
            console.warn(`⚠️ Could not clean up Azure thread ${threadInfo.threadId}:`, azureError.message);
          }
        }
        
        return true;
      } else {
        console.log(`ℹ️ No thread mapping found for session ${sessionId}`);
        return true; // Still consider success if nothing to delete
      }
      
    } catch (error) {
      console.error(`❌ Failed to cleanup thread for session ${sessionId}:`, error.message);
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
      console.log(`🧹 Cleaning up all threads for user ${userId}`);
      
      const ConversationThread = require('../models/ConversationThread');
      
      // Get all user threads first
      const userThreads = await ConversationThread.find({ userId: userId });
      console.log(`Found ${userThreads.length} threads to clean up for user ${userId}`);
      
      // Remove from cache
      let cacheCleanupCount = 0;
      userThreads.forEach(thread => {
        if (this.sessionThreadsCache.has(thread.sessionId)) {
          this.sessionThreadsCache.delete(thread.sessionId);
          cacheCleanupCount++;
        }
        
        // Clean up fallback messages for this thread
        if (thread.threadId && thread.threadId.startsWith('fallback_')) {
          this.fallbackMessages.delete(thread.threadId);
          console.log(`✅ Cleaned up fallback messages for thread ${thread.threadId}`);
        }
      });
      console.log(`✅ Removed ${cacheCleanupCount} threads from cache`);
      
      // Remove from database
      const deleteResult = await ConversationThread.deleteMany({ userId: userId });
      console.log(`✅ Deleted ${deleteResult.deletedCount} thread mappings from database`);
      
      return deleteResult.deletedCount;
      
    } catch (error) {
      console.error(`❌ Failed to cleanup threads for user ${userId}:`, error.message);
      return 0;
    }
  }

  /**
   * Clean up old threads (call periodically to prevent memory leaks)
   * @param {number} maxAge - Maximum age in milliseconds
   * @returns {Promise<number>} - Number of threads cleaned up
   */
  async cleanupOldThreads(maxAge = 24 * 60 * 60 * 1000) {
    try {
      console.log(`🧹 Cleaning up threads older than ${maxAge}ms`);
      
      const ConversationThread = require('../models/ConversationThread');
      const cutoffDate = new Date(Date.now() - maxAge);
      
      // Find old threads
      const oldThreads = await ConversationThread.find({
        lastUsed: { $lt: cutoffDate },
        status: { $ne: 'archived' }
      });
      
      console.log(`Found ${oldThreads.length} old threads to clean up`);
      
      // Remove from cache
      let cacheCleanupCount = 0;
      oldThreads.forEach(thread => {
        if (this.sessionThreadsCache.has(thread.sessionId)) {
          this.sessionThreadsCache.delete(thread.sessionId);
          cacheCleanupCount++;
        }
        
        // Clean up fallback messages for old threads
        if (thread.threadId && thread.threadId.startsWith('fallback_')) {
          this.fallbackMessages.delete(thread.threadId);
          console.log(`✅ Cleaned up fallback messages for old thread ${thread.threadId}`);
        }
      });
      
      // Archive old threads instead of deleting (for audit trail)
      const updateResult = await ConversationThread.updateMany(
        {
          lastUsed: { $lt: cutoffDate },
          status: { $ne: 'archived' }
        },
        {
          $set: { status: 'archived' }
        }
      );
      
      console.log(`✅ Archived ${updateResult.modifiedCount} old threads`);
      console.log(`✅ Removed ${cacheCleanupCount} old threads from cache`);
      
      return updateResult.modifiedCount;
      
    } catch (error) {
      console.error('❌ Thread cleanup failed:', error.message);
      return 0;
    }
  }
}

module.exports = LLMManager;