const express = require('express');
const multer = require('multer');
const { body, param, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const Document = require('../models/Document');
const PineconeService = require('../services/PineconeService');
const Retriever = require('../services/Retriever');
const QueryRefiner = require('../services/QueryRefiner');
const AnswerAssistant = require('../services/AnswerAssistant');
const FileProcessor = require('../utils/FileProcessor');

const router = express.Router();
const answerAssistant = new AnswerAssistant();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Maximum 5 files at once
  },
  fileFilter: (req, file, cb) => {
    // Check if file type is supported
    if (FileProcessor.isSupported(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
    }
  }
});

/**
 * Upload and process files with embedding generation
 * POST /api/files/upload-and-embed
 */
router.post('/upload-and-embed', 
  authenticateToken, 
  upload.array('files', 5),
  [
    body('sessionId').isMongoId().withMessage('Valid session ID is required')
  ],
  async (req, res) => {
    try {
      // Validate request
      const validationErrors = validationResult(req);
      if (!validationErrors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: validationErrors.array()
        });
      }

      const { sessionId } = req.body;
      const userId = req.user.userId; // JWT contains userId, not id
      const files = req.files;

      if (!files || files.length === 0) {
        return res.status(400).json({
          error: 'No files provided',
          message: 'At least one file must be uploaded'
        });
      }

      console.log(`📤 Processing ${files.length} files for user ${userId}, session ${sessionId}`);

      const results = [];
      const processingErrors = [];

      // Process each file
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        try {
          console.log(`📄 Processing file ${i + 1}/${files.length}: ${file.originalname}`);

          // Validate file
          const validationErrors = FileProcessor.validateFile(file);
          if (validationErrors.length > 0) {
            processingErrors.push({
              fileName: file.originalname,
              errors: validationErrors
            });
            continue;
          }

          // Generate unique document ID
          const timestamp = Date.now() + i; // Add index to ensure uniqueness
          const docId = Document.generateDocId(sessionId, file.originalname, timestamp);

          // Create document record in MongoDB
          const document = new Document({
            docId: docId,
            fileName: file.originalname,
            originalName: file.originalname,
            fileSize: file.size,
            mimeType: file.mimetype,
            userId: userId,
            sessionId: sessionId,
            processingStatus: 'processing'
          });

          await document.save();
          console.log(`📝 Created document record: ${docId}`);

          // Extract text from file
          const extractionResult = await FileProcessor.extractText(file);
          console.log(`📖 Extracted ${extractionResult.metadata.wordCount} words from ${file.originalname}`);

          // Store in Pinecone with embeddings
          const pineconeResult = await PineconeService.storeDocument(
            docId,
            extractionResult.text,
            {
              userId: userId,
              sessionId: sessionId,
              fileName: file.originalname,
              fileSize: file.size,
              mimeType: file.mimetype,
              uploadDate: new Date().toISOString()
            }
          );

          // Update document with processing results
          await document.markProcessingComplete({
            totalChunks: pineconeResult.totalChunks,
            pineconeIds: pineconeResult.pineconeIds,
            extractedText: extractionResult.text,
            wordCount: extractionResult.metadata.wordCount,
            pageCount: extractionResult.metadata.pageCount || 0
          });

          // Generate processing summary
          const summary = FileProcessor.generateProcessingSummary(file, extractionResult);

          results.push({
            success: true,
            docId: docId,
            fileName: file.originalname,
            pineconeFileId: docId,
            pineconeIds: pineconeResult.pineconeIds,
            chunksCount: pineconeResult.totalChunks,
            wordCount: extractionResult.metadata.wordCount,
            summary: summary,
            processingTime: Date.now() - timestamp
          });

          console.log(`✅ Successfully processed ${file.originalname}: ${pineconeResult.totalChunks} chunks created`);

        } catch (fileError) {
          console.error(`❌ Error processing file ${file.originalname}:`, fileError.message);
          
          // Mark document as failed if it was created
          try {
            const docId = Document.generateDocId(sessionId, file.originalname, Date.now());
            const document = await Document.findOne({ docId });
            if (document) {
              await document.markProcessingFailed(fileError);
            }
          } catch (updateError) {
            console.error('Error updating document status:', updateError.message);
          }

          processingErrors.push({
            fileName: file.originalname,
            error: fileError.message,
            success: false
          });
        }
      }

      // Return response
      const response = {
        success: results.length > 0,
        processed: results.length,
        failed: processingErrors.length,
        total: files.length,
        results: results,
        errors: processingErrors.length > 0 ? processingErrors : undefined,
        sessionId: sessionId,
        userId: userId,
        timestamp: new Date().toISOString()
      };

      console.log(`📊 File processing complete: ${results.length} success, ${processingErrors.length} failed`);

      if (results.length === 0) {
        return res.status(400).json({
          ...response,
          message: 'No files were successfully processed'
        });
      }

      res.status(201).json(response);

    } catch (error) {
      console.error('❌ File upload and embedding error:', error.message);
      res.status(500).json({
        error: 'File processing failed',
        message: error.message,
        success: false
      });
    }
  }
);

/**
 * Search documents using semantic search
 * POST /api/files/search
 */
router.post('/search',
  authenticateToken,
  [
    body('query').isLength({ min: 1 }).withMessage('Search query is required'),
    body('sessionId').optional().isMongoId().withMessage('Session ID must be valid'),
    body('docId').optional().isString().withMessage('Document ID must be a string'),
    body('topK').optional().isInt({ min: 1, max: 50 }).withMessage('topK must be between 1 and 50')
  ],
  async (req, res) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { query, sessionId, docId, topK = 10, minRelevance = 0.7 } = req.body;
      const userId = req.user.userId; // JWT contains userId, not id

      console.log(`🔍 Search request: "${query.substring(0, 50)}..." by user ${userId}`);

      // Add QueryRefiner to search endpoint as well
      let finalQuery = query;
      console.log(`🔄 Starting query refinement process...`);
      
      try {
        console.log(`📦 Requiring QueryRefiner module...`);
        const QueryRefiner = require('../services/QueryRefiner');
        console.log(`✅ QueryRefiner module loaded successfully`);
        
        const queryRefiner = new QueryRefiner();
        console.log(`✅ QueryRefiner instance created`);
        
        // Get session documents for context
        console.log(`📄 Fetching session documents...`);
        const Document = require('../models/Document');
        const sessionDocs = await Document.find({ userId, sessionId });
        console.log(`📄 Found ${sessionDocs.length} session documents`);
        
        console.log(`🔄 Original search query: "${query}"`);
        console.log(`🔄 Calling queryRefiner.refineQuery with params:`, {
          query: query,
          sessionDocsCount: sessionDocs.length,
          sessionId: sessionId,
          userId: userId
        });
        
        const refinementResult = await queryRefiner.refineQuery(query, sessionDocs, sessionId, userId, false, [], null);
        console.log(`✅ Query refinement completed:`, refinementResult);
        
        finalQuery = refinementResult.refined;
        
        console.log(`✨ Refined search query: "${finalQuery}"`);
        console.log(`🎯 Search intent: ${refinementResult.intent}`);
        console.log(`🔑 Key terms: ${refinementResult.searchTerms?.join(', ')}`);
        console.log(`📊 Confidence: ${refinementResult.confidence}`);
      } catch (refinementError) {
        console.warn(`⚠️ Query refinement failed, using original query:`, refinementError.message);
        finalQuery = query;
      }

      // Perform search with refined query
      const searchResults = await Retriever.search(finalQuery, {
        userId: userId,
        sessionId: sessionId,
        docId: docId,
        topK: topK,
        minRelevance: minRelevance,
        includeContext: true
      });

      console.log(`✅ Search completed: ${searchResults.totalResults} results found`);

      res.json({
        success: true,
        ...searchResults,
        searchPerformed: true,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Search error:', error.message);
      res.status(500).json({
        error: 'Search failed',
        message: error.message,
        success: false
      });
    }
  }
);

/**
 * Chat endpoint with semantic search
 * POST /api/files/chat
 */
router.post('/chat',
  authenticateToken,
  [
    body('message').isLength({ min: 1 }).withMessage('Chat message is required'),
    body('sessionId').isMongoId().withMessage('Session ID is required'),
    body('topK').optional().isInt({ min: 1, max: 20 }).withMessage('topK must be between 1 and 20')
  ],
  async (req, res) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { message, sessionId, topK = 5 } = req.body;
      const userId = req.user.userId;

      console.log(`💬 Chat request: "${message.substring(0, 50)}..." from user ${userId} in session ${sessionId}`);

      // Get or create thread ID for this session
      const threadId = answerAssistant.getAnswerAssistantThreadIdForSession(userId, sessionId);
      console.log(`🧵 Using thread ID: ${threadId} for chat`);

      // Debug: Check if documents exist in this session
      const Document = require('../models/Document');
      const sessionDocs = await Document.find({ userId, sessionId });
      console.log(`📄 Found ${sessionDocs.length} documents in session ${sessionId}:`);
      sessionDocs.forEach(doc => {
        console.log(`  - ${doc.fileName} (${doc.processingStatus}) - docId: ${doc.docId}`);
      });

      // Initialize QueryRefiner and refine the user's query for better search results
      const queryRefiner = new QueryRefiner();
      console.log(`🔄 Original query: "${message}"`);
      
      // Use thread-based conversation context with session ID and user ID
      const refinementResult = await queryRefiner.refineQuery(message, sessionDocs, sessionId, userId, false, [], threadId);
      const refinedQuery = refinementResult.refined;
      
      console.log(`✨ Refined query: "${refinedQuery}"`);
      console.log(`🎯 Search intent: ${refinementResult.intent}`);
      console.log(`🔑 Key terms: ${refinementResult.searchTerms?.join(', ')}`);
      console.log(`📊 Confidence: ${refinementResult.confidence}`);
      
      if (refinementResult.error) {
        console.warn(`⚠️ Query refinement had issues: ${refinementResult.reasoning}`);
      }

      // Perform semantic search using the refined query
      const searchResults = await Retriever.search(refinedQuery, {
        userId: userId,
        sessionId: sessionId,
        topK: topK,
        minRelevance: 0.3, // Temporarily lower threshold for debugging
        includeContext: true
      });

      console.log(`🔍 Raw search results:`, {
        totalResults: searchResults.totalResults,
        resultsLength: searchResults.results?.length || 0,
        originalQuery: message,
        refinedQuery: refinedQuery,
        searchIntent: refinementResult.intent,
        filters: { userId, sessionId, topK, minRelevance: 0.3 }
      });

      console.log(`✅ Chat search completed: ${searchResults.totalResults} results found using refined query`);

      // Format response for chat interface
      let chatResponse = "";
      let sources = [];

      if (searchResults.totalResults > 0) {
        chatResponse = "Based on your uploaded documents, here's what I found:\n\n";
        
        // Ensure each result has proper content field for frontend
        const formattedResults = searchResults.results.map((result, index) => {
          // Safely get content with fallback
          const content = result.content || result.text || result.metadata?.content || result.metadata?.text || '';
          const displayContent = content.length > 200 ? content.substring(0, 200) + '...' : content;
          
          if (displayContent.trim()) {
            chatResponse += `${index + 1}. ${displayContent}\n\n`;
          }
          
          // Add source information
          if (result.metadata || result.fileName) {
            const fileName = result.metadata?.fileName || result.fileName || 'Unknown document';
            const docId = result.metadata?.docId || result.docId || '';
            const snippet = content.length > 150 ? content.substring(0, 150) + '...' : content;
            
            sources.push({
              fileName: fileName,
              docId: docId,
              relevance: result.score || 0,
              snippet: snippet
            });
          }

          // Return formatted result for frontend with guaranteed content field
          return {
            id: result.id || `result_${index}`,
            score: result.score || 0,
            content: content || '', // Ensure content is never undefined
            docId: result.metadata?.docId || result.docId || '',
            fileName: result.metadata?.fileName || result.fileName || 'Unknown',
            metadata: result.metadata || {},
            // Add any other fields the frontend might expect
            text: content, // Alternative content field
            chunkIndex: result.chunkIndex || 0,
            totalChunks: result.totalChunks || 1
          };
        });

        if (sources.length > 0) {
          chatResponse += `\nSources: ${sources.map(s => s.fileName).join(', ')}`;
        }

        console.log(`📤 Sending ${formattedResults.length} formatted results to frontend`);

        res.json({
          success: true,
          message: chatResponse,
          searchResults: formattedResults, // Use formatted results
          sources: sources || [],
          totalResults: searchResults.totalResults || 0,
          userMessage: message,
          sessionId: sessionId,
          timestamp: new Date().toISOString(),
          queryRefinement: {
            original: refinementResult.original,
            refined: refinementResult.refined,
            intent: refinementResult.intent,
            confidence: refinementResult.confidence,
            searchTerms: refinementResult.searchTerms,
            reasoning: refinementResult.reasoning
          },
          debug: {
            documentsInSession: sessionDocs.length,
            rawResultsCount: searchResults.results?.length || 0,
            filtersUsed: { userId, sessionId, topK, minRelevance: 0.3 }
          }
        });

      } else {
        chatResponse = "I couldn't find relevant information in your uploaded documents for this query. You might want to upload more documents or try rephrasing your question.";
        
        res.json({
          success: true,
          message: chatResponse,
          searchResults: [], // Empty array instead of undefined
          sources: [],
          totalResults: 0,
          userMessage: message,
          sessionId: sessionId,
          timestamp: new Date().toISOString(),
          queryRefinement: {
            original: refinementResult.original,
            refined: refinementResult.refined,
            intent: refinementResult.intent,
            confidence: refinementResult.confidence,
            searchTerms: refinementResult.searchTerms,
            reasoning: refinementResult.reasoning
          },
          debug: {
            documentsInSession: sessionDocs.length,
            rawResultsCount: 0,
            filtersUsed: { userId, sessionId, topK, minRelevance: 0.3 }
          }
        });
      }

    } catch (error) {
      console.error('❌ Chat error:', error.message);
      res.status(500).json({
        error: 'Chat failed',
        message: error.message,
        success: false
      });
    }
  }
);

/**
 * Get document information and analysis
 * GET /api/files/document/:docId
 */
router.get('/document/:docId',
  authenticateToken,
  [
    param('docId').isString().withMessage('Document ID is required')
  ],
  async (req, res) => {
    try {
      const { docId } = req.params;
      const userId = req.user.userId; // JWT contains userId, not id

      // Get document from MongoDB
      const document = await Document.findOne({ docId, userId });
      if (!document) {
        return res.status(404).json({
          error: 'Document not found',
          message: `Document ${docId} not found or access denied`
        });
      }

      // Get detailed analysis
      const analysis = await Retriever.analyzeDocument(docId);

      res.json({
        success: true,
        document: analysis,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Document analysis error:', error.message);
      res.status(500).json({
        error: 'Document analysis failed',
        message: error.message,
        success: false
      });
    }
  }
);

/**
 * Delete document and its embeddings
 * DELETE /api/files/document/:docId
 */
router.delete('/document/:docId',
  authenticateToken,
  [
    param('docId').isString().withMessage('Document ID is required')
  ],
  async (req, res) => {
    try {
      const { docId } = req.params;
      const userId = req.user.userId; // JWT contains userId, not id

      // Find document
      const document = await Document.findOne({ docId, userId });
      if (!document) {
        return res.status(404).json({
          error: 'Document not found',
          message: `Document ${docId} not found or access denied`
        });
      }

      console.log(`🗑️ Deleting document ${docId} for user ${userId}`);

      // Delete from Pinecone with session context
      await PineconeService.deleteDocument(docId, document.sessionId);

      // Delete from MongoDB
      await Document.deleteOne({ docId, userId });

      console.log(`✅ Successfully deleted document ${docId}`);

      res.json({
        success: true,
        message: `Document ${docId} deleted successfully`,
        deletedDocument: {
          docId: docId,
          fileName: document.fileName,
          deletedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('❌ Document deletion error:', error.message);
      res.status(500).json({
        error: 'Document deletion failed',
        message: error.message,
        success: false
      });
    }
  }
);

/**
 * Get documents for a specific session
 * GET /api/files/session/:sessionId/documents
 */
router.get('/session/:sessionId/documents',
  authenticateToken,
  [
    param('sessionId').isMongoId().withMessage('Session ID must be valid')
  ],
  async (req, res) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { sessionId } = req.params;
      const userId = req.user.userId;

      console.log(`📄 Getting documents for session ${sessionId} by user ${userId}`);

      // Get all documents for this session and user
      const documents = await Document.find({
        userId: userId,
        sessionId: sessionId
      })
      .sort({ uploadDate: -1 })
      .select({
        docId: 1,
        fileName: 1,
        originalName: 1,
        fileSize: 1,
        mimeType: 1,
        uploadDate: 1,
        processingStatus: 1,
        wordCount: 1,
        pageCount: 1,
        pineconeNamespace: 1
      });

      console.log(`✅ Found ${documents.length} documents in session ${sessionId}`);

      // Calculate session statistics
      const stats = {
        totalDocuments: documents.length,
        totalSize: documents.reduce((sum, doc) => sum + (doc.fileSize || 0), 0),
        totalWords: documents.reduce((sum, doc) => sum + (doc.wordCount || 0), 0),
        totalPages: documents.reduce((sum, doc) => sum + (doc.pageCount || 0), 0),
        completedProcessing: documents.filter(doc => doc.processingStatus === 'completed').length,
        processingErrors: documents.filter(doc => doc.processingStatus === 'error').length
      };

      res.json({
        success: true,
        sessionId: sessionId,
        documents: documents,
        stats: stats,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Get session documents error:', error.message);
      res.status(500).json({
        error: 'Failed to get session documents',
        message: error.message,
        success: false
      });
    }
  }
);

/**
 * Delete session and all its documents
 * DELETE /api/files/session/:sessionId
 */
router.delete('/session/:sessionId',
  authenticateToken,
  [
    param('sessionId').isMongoId().withMessage('Session ID must be valid')
  ],
  async (req, res) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { sessionId } = req.params;
      const userId = req.user.userId;

      console.log(`🗑️ Deleting session ${sessionId} and all documents by user ${userId}`);

      // First, get all documents in this session
      const documents = await Document.find({
        userId: userId,
        sessionId: sessionId
      });

      if (documents.length === 0) {
        return res.json({
          success: true,
          message: 'No documents found in session',
          deletedDocuments: 0,
          sessionId: sessionId
        });
      }

      console.log(`📄 Found ${documents.length} documents to delete in session ${sessionId}`);

      let deletedFromPinecone = 0;
      let pineconeErrors = [];

      // Delete each document from Pinecone
      for (const doc of documents) {
        try {
          await PineconeService.deleteDocument(doc.docId, {
            sessionId: sessionId,
            userId: userId
          });
          deletedFromPinecone++;
          console.log(`✅ Deleted document ${doc.docId} from Pinecone`);
        } catch (error) {
          console.error(`❌ Failed to delete ${doc.docId} from Pinecone:`, error.message);
          pineconeErrors.push({
            docId: doc.docId,
            fileName: doc.fileName,
            error: error.message
          });
        }
      }

      // Delete all documents from MongoDB
      const mongoResult = await Document.deleteMany({
        userId: userId,
        sessionId: sessionId
      });

      console.log(`✅ Deleted ${mongoResult.deletedCount} documents from MongoDB`);

      // Delete the entire namespace from Pinecone (cleanup)
      try {
        await PineconeService.deleteNamespace(sessionId);
        console.log(`✅ Deleted namespace ${sessionId} from Pinecone`);
      } catch (error) {
        console.error(`⚠️ Failed to delete namespace ${sessionId}:`, error.message);
        // Non-critical error, continue
      }

      // Clean up dual thread system (AnswerAssistant + QueryRefiner)
      try {
        // Clean up AnswerAssistant threads
        const answerAssistantCleanup = answerAssistant.cleanupAnswerAssistantSessionThreads(userId, sessionId);
        if (answerAssistantCleanup) {
          console.log(`✅ Cleaned up AnswerAssistant threads for session ${sessionId}`);
        }
        
        // Clean up QueryRefiner threads
        const QueryRefiner = require('../services/QueryRefiner');
        const queryRefiner = new QueryRefiner();
        const queryRefinerCleanup = queryRefiner.cleanupQueryRefinerSessionThreads(userId, sessionId);
        if (queryRefinerCleanup) {
          console.log(`✅ Cleaned up QueryRefiner threads for session ${sessionId}`);
        }
        
        // Clean up legacy LLMManager thread (for backward compatibility)
        const legacyCleanupSuccess = await queryRefiner.cleanupSessionThread(sessionId, userId);
        if (legacyCleanupSuccess) {
          console.log(`✅ Cleaned up legacy LLMManager thread for session ${sessionId}`);
        }
      } catch (error) {
        console.error(`⚠️ Failed to cleanup threads for session ${sessionId}:`, error.message);
        // Non-critical error, continue
      }

      res.json({
        success: true,
        message: 'Session and all documents deleted successfully',
        sessionId: sessionId,
        deletedDocuments: mongoResult.deletedCount,
        pineconeResults: {
          successful: deletedFromPinecone,
          errors: pineconeErrors
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Delete session error:', error.message);
      res.status(500).json({
        error: 'Failed to delete session',
        message: error.message,
        success: false
      });
    }
  }
);

/**
 * Get user's documents
 * GET /api/files/my-documents
 */
router.get('/my-documents',
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user.userId; // JWT contains userId, not id
      const { sessionId, status, limit = 50, offset = 0 } = req.query;

      // Build query
      const query = { userId };
      if (sessionId) query.sessionId = sessionId;
      if (status) query.processingStatus = status;

      // Get documents
      const documents = await Document.find(query)
        .sort({ uploadDate: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(offset))
        .populate('sessionId', 'title question createdAt');

      const total = await Document.countDocuments(query);

      res.json({
        success: true,
        documents: documents,
        pagination: {
          total: total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: total > parseInt(offset) + parseInt(limit)
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Get documents error:', error.message);
      res.status(500).json({
        error: 'Failed to retrieve documents',
        message: error.message,
        success: false
      });
    }
  }
);

/**
 * Get supported file types
 * GET /api/files/supported-types
 */
router.get('/supported-types', (req, res) => {
  try {
    const supportedTypes = FileProcessor.getSupportedTypes();
    
    res.json({
      success: true,
      supportedTypes: supportedTypes,
      maxFileSize: '10MB',
      maxFilesPerUpload: 5
    });

  } catch (error) {
    console.error('❌ Get supported types error:', error.message);
    res.status(500).json({
      error: 'Failed to get supported types',
      message: error.message,
      success: false
    });
  }
});

/**
 * Initialize session with thread management and optional initial query
 * POST /api/files/initialize-session
 */
router.post('/initialize-session',
  authenticateToken,
  [
    body('sessionId').isMongoId().withMessage('Valid session ID is required'),
    body('initialQuery').optional().notEmpty().withMessage('Initial query cannot be empty if provided'),
    body('autoTriggerFlow').optional().isBoolean().withMessage('Auto trigger flow must be boolean')
  ],
  async (req, res) => {
    try {
      // Validate request
      const validationErrors = validationResult(req);
      if (!validationErrors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: validationErrors.array()
        });
      }

      const userId = req.user.userId;
      const { sessionId, initialQuery, autoTriggerFlow = false } = req.body;

      console.log(`🚀 Initializing session ${sessionId} for user ${userId}`);

      // Get or create thread ID for this session
      const threadId = answerAssistant.getAnswerAssistantThreadIdForSession(userId, sessionId);
      
      // Get existing conversation history
      const existingHistory = answerAssistant.getThreadHistory(userId, sessionId, threadId);
      
      console.log(`🆔 Thread ID: ${threadId}`);
      console.log(`📚 Existing conversation messages: ${existingHistory.length}`);

      let researchResult = null;

      // If initial query provided and auto-trigger enabled, run complete research flow
      if (initialQuery && autoTriggerFlow) {
        console.log(`🔍 Auto-triggering research flow with query: "${initialQuery}"`);
        
        try {
          // Retrieve relevant data
          const retrievedData = await Retriever.search(
            initialQuery,
            {
              userId,
              sessionId,
              limit: 10,
              includeFileData: true,
              includeLiveData: true
            }
          );

          console.log(`📊 Retrieved ${retrievedData.results?.length || 0} documents for initial query`);

          // Generate answer with thread context
          researchResult = await answerAssistant.generateAnswer(
            initialQuery,
            retrievedData.results || [],
            userId,
            sessionId,
            false, // isReportMode
            [], // conversationHistory
            threadId // queryRefinerThreadId
          );

          console.log(`✅ Initial research completed with ${researchResult.sources.length} sources`);

        } catch (researchError) {
          console.error(`⚠️ Research flow failed during session initialization:`, researchError.message);
          // Continue with session initialization even if research fails
        }
      }

      // Prepare session state
      const sessionState = {
        sessionId,
        threadId,
        userId,
        conversationHistory: answerAssistant.getThreadHistory(userId, sessionId, threadId),
        threadMapping: {
          sessionToThread: `${sessionId} → ${threadId}`,
          threadToSession: answerAssistant.getSessionFromThreadId(userId, threadId)
        },
        statistics: {
          messageCount: answerAssistant.getThreadHistory(userId, sessionId, threadId).length,
          sessionThreads: answerAssistant.getSessionThreads(userId, sessionId),
          hasExistingConversation: existingHistory.length > 0
        }
      };

      const response = {
        success: true,
        message: 'Session initialized successfully',
        sessionState,
        timestamp: new Date().toISOString()
      };

      // Include research result if auto-triggered
      if (researchResult) {
        response.initialResearch = {
          query: initialQuery,
          answer: researchResult.answer,
          sources: researchResult.sources,
          confidence: researchResult.confidence,
          metadata: researchResult.metadata
        };
      }

      res.json(response);

    } catch (error) {
      console.error('❌ Session initialization error:', error.message);
      res.status(500).json({
        error: 'Failed to initialize session',
        message: error.message,
        success: false
      });
    }
  }
);

/**
 * Generate comprehensive report from session conversation history
 * POST /api/files/generate-report
 */
router.post('/generate-report',
  authenticateToken,
  [
    body('sessionId').isMongoId().withMessage('Valid session ID is required'),
    body('reportTitle').optional().notEmpty().withMessage('Report title cannot be empty if provided'),
    body('includeFileData').optional().isBoolean().withMessage('Include file data must be boolean'),
    body('includeLiveData').optional().isBoolean().withMessage('Include live data must be boolean'),
    body('searchLimit').optional().isInt({ min: 5, max: 100 }).withMessage('Search limit must be between 5 and 100')
  ],
  async (req, res) => {
    try {
      // Validate request
      const validationErrors = validationResult(req);
      if (!validationErrors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: validationErrors.array()
        });
      }

      const userId = req.user.userId;
      const { 
        sessionId, 
        reportTitle = 'Research Session Report',
        includeFileData = true,
        includeLiveData = true,
        searchLimit = 20
      } = req.body;

      console.log(`📊 Generating comprehensive report for session ${sessionId}`);

      // Step 1: Get conversation history from AnswerAssistant
      const threadId = answerAssistant.getAnswerAssistantThreadIdForSession(userId, sessionId);
      const rawConversationHistory = await answerAssistant.getThreadHistory(userId, sessionId, threadId, 50); // Get more history for reports
      
      // Ensure conversationHistory is always an array
      const conversationHistory = Array.isArray(rawConversationHistory) ? rawConversationHistory : [];

      if (conversationHistory.length === 0) {
        return res.status(400).json({
          error: 'No conversation history found',
          message: 'Cannot generate report for session with no conversation history',
          success: false
        });
      }

      console.log(`📚 Found ${conversationHistory.length} messages in conversation history`);

      // Step 2: Use QueryRefiner in report mode to create comprehensive search query
      const queryRefiner = new QueryRefiner();
      const refinedQuery = await queryRefiner.refineQuery(
        `Generate comprehensive report covering all topics discussed`,
        [], // No specific session documents needed for query refinement
        sessionId,
        userId,
        true, // isReportMode = true
        conversationHistory,
        threadId // pass thread ID for proper context
      );

      console.log(`🔍 Report query refined: "${refinedQuery.refined}"`);
      console.log(`📝 Topics covered: ${refinedQuery.topicsCovered?.join(', ') || 'Multiple topics'}`);

      // Step 3: Retrieve comprehensive data using the refined query
      const retrievedData = await Retriever.search(
        refinedQuery.refined,
        {
          userId,
          sessionId,
          limit: searchLimit,
          includeFileData,
          includeLiveData
        }
      );

      console.log(`📊 Retrieved ${retrievedData.results?.length || 0} documents for comprehensive report`);

      // Step 4: Generate comprehensive report using AnswerAssistant in report mode
      const reportResult = await answerAssistant.generateAnswer(
        `Generate comprehensive report: ${reportTitle}`,
        retrievedData.results || [],
        userId,
        sessionId,
        true, // isReportMode = true
        [], // conversationHistory
        threadId // queryRefinerThreadId
      );

      console.log(`✅ Comprehensive report generated successfully`);

      // Step 5: Prepare report metadata
      const userQuestions = conversationHistory
        .filter(msg => msg.role === 'user')
        .map(msg => msg.content);

      const reportMetadata = {
        title: reportTitle,
        sessionId,
        threadId: reportResult.threadId,
        generatedAt: new Date().toISOString(),
        conversationSummary: {
          totalMessages: conversationHistory.length,
          userQuestions: userQuestions.length,
          topics: refinedQuery.topicsCovered || [],
          conversationSpan: conversationHistory.length > 0 ? {
            firstMessage: conversationHistory[0]?.timestamp,
            lastMessage: conversationHistory[conversationHistory.length - 1]?.timestamp
          } : null
        },
        dataSources: {
          documentsUsed: retrievedData.results?.length || 0,
          fileData: includeFileData ? (retrievedData.results || []).filter(d => d.documentId).length : 0,
          liveData: includeLiveData ? (retrievedData.results || []).filter(d => d.source).length : 0
        },
        queryRefinement: {
          originalScope: 'Session conversation history',
          refinedQuery: refinedQuery.refined,
          searchTerms: refinedQuery.searchTerms,
          confidence: refinedQuery.confidence
        }
      };

      res.json({
        success: true,
        report: {
          title: reportTitle,
          content: reportResult.answer,
          sources: reportResult.sources,
          confidence: reportResult.confidence,
          metadata: reportMetadata
        },
        conversationContext: {
          questionsAnswered: userQuestions.length,
          totalInteractions: conversationHistory.length,
          conversationHistory: conversationHistory.map(msg => ({
            role: msg.role,
            content: msg.content.substring(0, 100) + (msg.content.length > 100 ? '...' : ''),
            timestamp: msg.timestamp
          }))
        },
        processingDetails: {
          queryRefinement: refinedQuery,
          dataRetrieval: {
            documentsFound: retrievedData.results?.length || 0,
            searchQuery: refinedQuery.refined
          },
          reportGeneration: {
            mode: 'comprehensive_session_report',
            model: reportResult.metadata.model,
            processingTime: new Date().toISOString()
          }
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Report generation error:', error.message);
      res.status(500).json({
        error: 'Failed to generate comprehensive report',
        message: error.message,
        success: false
      });
    }
  }
);

/**
 * Get report generation status and preview
 * GET /api/files/report-preview/:sessionId
 */
router.get('/report-preview/:sessionId',
  authenticateToken,
  [
    param('sessionId').isMongoId().withMessage('Valid session ID is required')
  ],
  async (req, res) => {
    try {
      const validationErrors = validationResult(req);
      if (!validationErrors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: validationErrors.array()
        });
      }

      const userId = req.user.userId;
      const { sessionId } = req.params;

      // Get conversation history
      const threadId = answerAssistant.getAnswerAssistantThreadIdForSession(userId, sessionId);
      const rawConversationHistory = await answerAssistant.getThreadHistory(userId, sessionId, threadId, 50);
      
      // Ensure conversationHistory is always an array
      const conversationHistory = Array.isArray(rawConversationHistory) ? rawConversationHistory : [];

      if (conversationHistory.length === 0) {
        return res.status(400).json({
          error: 'No conversation history found',
          message: 'Cannot preview report for session with no conversation history',
          success: false
        });
      }

      // Extract questions and topics for preview
      const userQuestions = conversationHistory
        .filter(msg => msg.role === 'user')
        .map((msg, idx) => ({
          number: idx + 1,
          question: msg.content,
          timestamp: msg.timestamp
        }));

      // Simple topic extraction for preview
      const topicKeywords = conversationHistory
        .filter(msg => msg.role === 'user')
        .map(msg => msg.content.toLowerCase())
        .join(' ')
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => 
          word.length > 4 && 
          !['what', 'how', 'why', 'when', 'where', 'can', 'could', 'would', 'should', 'tell', 'about', 'more'].includes(word)
        )
        .slice(0, 10);

      res.json({
        success: true,
        sessionId,
        reportPreview: {
          questionsToAnswer: userQuestions,
          estimatedTopics: [...new Set(topicKeywords)],
          conversationSpan: {
            messageCount: conversationHistory.length,
            userQuestions: userQuestions.length,
            timeRange: conversationHistory.length > 0 ? {
              start: conversationHistory[0]?.timestamp,
              end: conversationHistory[conversationHistory.length - 1]?.timestamp
            } : null
          }
        },
        readyForReportGeneration: userQuestions.length > 0,
        recommendedSettings: {
          includeFileData: true,
          includeLiveData: true,
          searchLimit: Math.min(20 + userQuestions.length * 2, 50)
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Report preview error:', error.message);
      res.status(500).json({
        error: 'Failed to generate report preview',
        message: error.message,
        success: false
      });
    }
  }
);

/**
 * Resume session with full context and conversation history
 * GET /api/files/resume-session/:sessionId
 */
router.get('/resume-session/:sessionId',
  authenticateToken,
  [
    param('sessionId').isMongoId().withMessage('Valid session ID is required')
  ],
  async (req, res) => {
    try {
      const validationErrors = validationResult(req);
      if (!validationErrors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: validationErrors.array()
        });
      }

      const userId = req.user.userId;
      const { sessionId } = req.params;

      console.log(`🔄 Resuming session ${sessionId} for user ${userId}`);

      // Initialize session and get thread context
      const threadId = answerAssistant.getAnswerAssistantThreadIdForSession(userId, sessionId);
      const conversationHistory = answerAssistant.getThreadHistory(userId, sessionId, threadId);
      const sessionThreads = answerAssistant.getSessionThreads(userId, sessionId);

      // Get session metadata from database if available
      let sessionMetadata = null;
      try {
        const ResearchSession = require('../models/ResearchSession');
        sessionMetadata = await ResearchSession.findById(sessionId).populate('userId', 'username email');
      } catch (dbError) {
        console.warn(`⚠️ Could not load session metadata: ${dbError.message}`);
      }

      // Prepare conversation summary
      const conversationSummary = {
        totalMessages: conversationHistory.length,
        userMessages: conversationHistory.filter(msg => msg.role === 'user').length,
        assistantMessages: conversationHistory.filter(msg => msg.role === 'assistant').length,
        lastActivity: conversationHistory.length > 0 ? 
          conversationHistory[conversationHistory.length - 1].timestamp : null,
        topics: [] // Could extract topics from conversation if needed
      };

      // Extract recent context (last few exchanges)
      const recentContext = conversationHistory.slice(-6); // Last 3 exchanges (6 messages)

      res.json({
        success: true,
        message: 'Session resumed successfully',
        sessionId,
        threadId,
        sessionMetadata,
        conversationState: {
          history: conversationHistory,
          recentContext,
          summary: conversationSummary,
          isActiveConversation: conversationHistory.length > 0
        },
        threadMapping: {
          sessionToThread: `${sessionId} → ${threadId}`,
          threadToSession: answerAssistant.getSessionFromThreadId(userId, threadId),
          allSessionThreads: sessionThreads
        },
        readyForQueries: true,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Resume session error:', error.message);
      res.status(500).json({
        error: 'Failed to resume session',
        message: error.message,
        success: false
      });
    }
  }
);

/**
 * Get session state and thread information
 * GET /api/files/session-state/:sessionId
 */
router.get('/session-state/:sessionId',
  authenticateToken,
  [
    param('sessionId').isMongoId().withMessage('Valid session ID is required')
  ],
  async (req, res) => {
    try {
      const validationErrors = validationResult(req);
      if (!validationErrors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: validationErrors.array()
        });
      }

      const userId = req.user.userId;
      const { sessionId } = req.params;

      // Get thread ID for this session (creates if doesn't exist)
      const threadId = answerAssistant.getAnswerAssistantThreadIdForSession(userId, sessionId);
      
      // Get conversation history
      const history = answerAssistant.getThreadHistory(userId, sessionId, threadId);
      
      // Get all threads for this session
      const sessionThreads = answerAssistant.getSessionThreads(userId, sessionId);

      res.json({
        success: true,
        sessionId,
        threadId,
        conversationHistory: history,
        threadMapping: {
          sessionToThread: `${sessionId} → ${threadId}`,
          threadToSession: answerAssistant.getSessionFromThreadId(userId, threadId),
          allSessionThreads: sessionThreads
        },
        statistics: {
          messageCount: history.length,
          hasActiveConversation: history.length > 0,
          threadCount: sessionThreads.length
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Get session state error:', error.message);
      res.status(500).json({
        error: 'Failed to get session state',
        message: error.message,
        success: false
      });
    }
  }
);

/**
 * Complete research flow: search + retrieve + answer generation with thread management
 * POST /api/files/research-answer
 */
router.post('/research-answer',
  authenticateToken,
  [
    body('query').notEmpty().withMessage('Query is required'),
    body('sessionId').isMongoId().withMessage('Valid session ID is required'),
    body('searchLimit').optional().isInt({ min: 1, max: 50 }).withMessage('Search limit must be between 1 and 50'),
    body('includeFileData').optional().isBoolean().withMessage('Include file data must be boolean'),
    body('includeLiveData').optional().isBoolean().withMessage('Include live data must be boolean'),
    body('threadId').optional().isString().withMessage('Thread ID must be a string'),
    body('ensureSessionInit').optional().isBoolean().withMessage('Ensure session init must be boolean')
  ],
  async (req, res) => {
    try {
      // Validate request
      const validationErrors = validationResult(req);
      if (!validationErrors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: validationErrors.array()
        });
      }

      const userId = req.user.userId;
      const { 
        query, 
        sessionId, 
        searchLimit = 10,
        includeFileData = true,
        includeLiveData = true,
        threadId,
        ensureSessionInit = true,
        answerOptions = {}
      } = req.body;

      console.log(`🔍 Starting complete research flow for user ${userId}`);
      console.log(`📝 Query: "${query}"`);
      console.log(`🗂️ Session: ${sessionId}`);

      // Ensure session is properly initialized with dual thread management
      let effectiveAnswerAssistantThreadId = threadId;
      let existingHistory = [];
      
      if (ensureSessionInit) {
        // Get or create AnswerAssistant thread ID for this session
        effectiveAnswerAssistantThreadId = answerAssistant.getAnswerAssistantThreadIdForSession(userId, sessionId);
        console.log(`🆔 AnswerAssistant thread ID: ${effectiveAnswerAssistantThreadId}`);
        
        // Check for existing conversation context
        existingHistory = answerAssistant.getThreadHistory(userId, sessionId, effectiveAnswerAssistantThreadId);
        console.log(`📚 Existing conversation messages: ${existingHistory.length}`);
        
        if (existingHistory.length > 0) {
          console.log(`🔄 Continuing conversation in AnswerAssistant thread ${effectiveAnswerAssistantThreadId}`);
        } else {
          console.log(`🆕 Starting new conversation in AnswerAssistant thread ${effectiveAnswerAssistantThreadId}`);
        }
      }

      // Step 1: Initialize QueryRefiner and refine the user query with dual thread system
      console.log(`🔍 Refining query for better search results...`);
      const queryRefiner = new QueryRefiner();
      
      // Get QueryRefiner thread ID for this session
      const queryRefinerThreadId = queryRefiner.getQueryRefinerThreadIdForSession(userId, sessionId);
      console.log(`🔍 QueryRefiner thread ID: ${queryRefinerThreadId}`);
      
      // Get session documents for context (optional)
      const sessionDocs = await Document.find({ sessionId }).limit(5);
      
      const refinementResult = await queryRefiner.refineQuery(
        query, 
        sessionDocs, 
        sessionId, 
        userId, 
        false, // isReportMode = false for chat mode
        existingHistory || [], // conversation history for context
        effectiveAnswerAssistantThreadId // pass AnswerAssistant thread ID for context
      );
      
      console.log(`✨ Query refined: "${refinementResult.refined}"`);
      
      // Step 2: Retrieve relevant data using the refined query
      console.log(`📊 Retrieving data for refined query...`);
      
      const retrievedData = await Retriever.search(
        refinementResult.refined, // Use refined query instead of original
        {
          userId,
          sessionId,
          limit: searchLimit,
          includeFileData,
          includeLiveData
        }
      );

      console.log(`📚 Retrieved ${retrievedData.totalResults || 0} total results, ${retrievedData.results?.length || 0} relevant documents`);

      // Step 3: Generate answer with dual thread management and session context
      const answerResult = await answerAssistant.generateAnswer(
        query, // Keep original user query for conversation context
        retrievedData.results || [], // Extract the results array from the search result object
        userId,
        sessionId,
        false, // isReportMode
        [], // conversationHistory
        queryRefinerThreadId // queryRefinerThreadId
      );

      console.log(`✅ Complete research flow completed successfully`);
      console.log(`🔗 AnswerAssistant thread: ${effectiveAnswerAssistantThreadId}`);
      console.log(`🔗 QueryRefiner thread: ${queryRefinerThreadId}`);

      res.json({
        success: true,
        query: query,
        sessionId: sessionId,
        threadId: answerResult.threadId, // Legacy field for backward compatibility
        sessionInitialized: ensureSessionInit,
        threads: {
          answerAssistantThreadId: effectiveAnswerAssistantThreadId,
          queryRefinerThreadId: queryRefinerThreadId,
          dualThreadSystem: true
        },
        retrievedData: {
          count: retrievedData.results?.length || 0,
          documents: includeFileData ? (retrievedData.results || []).filter(d => d.documentId) : [],
          liveSources: includeLiveData ? (retrievedData.results || []).filter(d => d.source) : []
        },
        answer: {
          response: answerResult.answer,
          sources: answerResult.sources,
          confidence: answerResult.confidence,
          hasRelevantSources: answerResult.hasRelevantSources
        },
        conversationContext: {
          answerAssistantThreadId: effectiveAnswerAssistantThreadId,
          queryRefinerThreadId: queryRefinerThreadId,
          sessionMapping: answerResult.metadata.sessionThreadMapping,
          conversationLength: answerResult.metadata.conversationLength,
          isNewConversation: answerResult.metadata.conversationLength <= 2
        },
        metadata: {
          ...answerResult.metadata,
          searchParameters: {
            searchLimit,
            includeFileData,
            includeLiveData
          },
          processingSteps: [
            'Session initialization confirmed',
            'Thread context established',
            'Query received',
            'Data retrieval completed',
            'Answer generation with conversation context completed'
          ]
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Complete research flow error:', error.message);
      res.status(500).json({
        error: 'Failed to complete research flow',
        message: error.message,
        success: false
      });
    }
  }
);

/**
 * Generate answer using retrieved data and original user query with thread management
 * POST /api/files/generate-answer
 */
router.post('/generate-answer',
  authenticateToken,
  [
    body('originalQuery').notEmpty().withMessage('Original query is required'),
    body('retrievedData').isArray().withMessage('Retrieved data must be an array'),
    body('sessionId').isMongoId().withMessage('Valid session ID is required'),
    body('threadId').optional().isString().withMessage('Thread ID must be a string')
  ],
  async (req, res) => {
    try {
      // Validate request
      const validationErrors = validationResult(req);
      if (!validationErrors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: validationErrors.array()
        });
      }

      const userId = req.user.userId;
      const { originalQuery, retrievedData, sessionId, threadId, options = {} } = req.body;

      console.log(`🤖 Generating answer for user ${userId}, session ${sessionId}`);
      console.log(`📝 Original query: "${originalQuery}"`);
      console.log(`📊 Retrieved data count: ${retrievedData.length}`);

      // Generate answer with thread management and session mapping
      const result = await answerAssistant.generateAnswer(
        originalQuery,
        retrievedData,
        userId,
        sessionId,
        false, // isReportMode
        [], // conversationHistory
        threadId // queryRefinerThreadId
      );

      console.log(`✅ Answer generated successfully with ${result.sources.length} sources`);
      console.log(`🔗 Session-Thread mapping: ${result.metadata.sessionThreadMapping}`);

      res.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Answer generation error:', error.message);
      res.status(500).json({
        error: 'Failed to generate answer',
        message: error.message,
        success: false
      });
    }
  }
);

/**
 * Get thread history for a session
 * GET /api/files/thread-history/:sessionId
 */
router.get('/thread-history/:sessionId',
  authenticateToken,
  [
    param('sessionId').isMongoId().withMessage('Valid session ID is required')
  ],
  async (req, res) => {
    try {
      const validationErrors = validationResult(req);
      if (!validationErrors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: validationErrors.array()
        });
      }

      const userId = req.user.userId;
      const { sessionId } = req.params;

      // Get thread ID for this session
      const threadId = answerAssistant.getAnswerAssistantThreadIdForSession(userId, sessionId);
      
      // Get conversation history
      const history = answerAssistant.getThreadHistory(userId, sessionId, threadId);

      res.json({
        success: true,
        sessionId,
        threadId,
        history,
        messageCount: history.length,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Get thread history error:', error.message);
      res.status(500).json({
        error: 'Failed to get thread history',
        message: error.message,
        success: false
      });
    }
  }
);

/**
 * Clear thread for a session
 * DELETE /api/files/thread/:sessionId
 */
router.delete('/thread/:sessionId',
  authenticateToken,
  [
    param('sessionId').isMongoId().withMessage('Valid session ID is required')
  ],
  async (req, res) => {
    try {
      const validationErrors = validationResult(req);
      if (!validationErrors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: validationErrors.array()
        });
      }

      const userId = req.user.userId;
      const { sessionId } = req.params;

      // Clear both threads for this session (dual thread system)
      let answerAssistantCleared = false;
      let queryRefinerCleared = false;
      let legacyCleared = false;
      
      try {
        // Clear AnswerAssistant thread
        answerAssistantCleared = answerAssistant.cleanupAnswerAssistantSessionThreads(userId, sessionId);
        
        // Clear QueryRefiner thread
        const QueryRefiner = require('../services/QueryRefiner');
        const queryRefiner = new QueryRefiner();
        queryRefinerCleared = queryRefiner.cleanupQueryRefinerSessionThreads(userId, sessionId);
        
        // Clear legacy thread (for backward compatibility)
        legacyCleared = answerAssistant.clearSessionThread(userId, sessionId);
        
      } catch (error) {
        console.error(`❌ Error clearing threads for session ${sessionId}:`, error.message);
      }

      res.json({
        success: true,
        sessionId,
        threads: {
          answerAssistantCleared,
          queryRefinerCleared,
          legacyCleared,
          dualThreadSystem: true
        },
        message: (answerAssistantCleared || queryRefinerCleared || legacyCleared) 
          ? 'Threads cleared successfully' 
          : 'No threads found for this session',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Clear thread error:', error.message);
      res.status(500).json({
        error: 'Failed to clear thread',
        message: error.message,
        success: false
      });
    }
  }
);

module.exports = router;