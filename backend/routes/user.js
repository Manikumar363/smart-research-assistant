const express = require('express');
const User = require('../models/User');
const ResearchSession = require('../models/ResearchSession');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get user statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get additional statistics from research sessions
    const sessionStats = await ResearchSession.aggregate([
      { $match: { userId: user._id } },
      {
        $group: {
          _id: null,
          totalSessions: { $sum: 1 },
          completedSessions: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          totalReports: {
            $sum: { $cond: ['$reportGenerated', 1, 0] }
          },
          totalCreditsUsed: { $sum: '$metadata.creditsUsed' },
          averageProcessingTime: { $avg: '$metadata.processingTime' }
        }
      }
    ]);

    const stats = sessionStats[0] || {
      totalSessions: 0,
      completedSessions: 0,
      totalReports: 0,
      totalCreditsUsed: 0,
      averageProcessingTime: 0
    };

    res.json({
      success: true,
      data: {
        userStats: user.statistics,
        sessionStats: stats,
        accountInfo: {
          plan: user.plan,
          credits: user.credits,
          joinDate: user.createdAt,
          lastActivity: user.statistics.lastActivityDate
        }
      }
    });

  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Create new research session
router.post('/sessions', authenticateToken, async (req, res) => {
  try {
    const { question, title, category = 'research', status = 'pending', result } = req.body;

    console.log('CREATE SESSION REQUEST:', {
      question: question?.substring(0, 50) + '...',
      title,
      category,
      status,
      hasResult: !!result,
      userId: req.user.userId
    });

    if (!question) {
      return res.status(400).json({
        success: false,
        message: 'Question is required'
      });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user has enough credits
    if (user.credits < 1) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient credits'
      });
    }

    const sessionData = {
      userId: user._id,
      question,
      title: title || question.substring(0, 50) + '...',
      status,
      metadata: {
        category,
        creditsUsed: 1,
        messageCount: 0,
        fileCount: 0
      }
    };

    // Handle enhanced result object with chat history and files if provided
    if (result && typeof result === 'object') {
      sessionData.result = result;
      
      // Extract and store chat history
      if (result.chatHistory && Array.isArray(result.chatHistory)) {
        sessionData.chatHistory = result.chatHistory.map(msg => ({
          id: msg.id,
          type: msg.type,
          content: msg.content,
          timestamp: new Date(msg.timestamp),
          hasReportOption: msg.hasReportOption || false
        }));
        sessionData.metadata.messageCount = result.chatHistory.length;
      }
      
      // Extract and store uploaded files
      if (result.uploadedFiles && Array.isArray(result.uploadedFiles)) {
        sessionData.uploadedFiles = result.uploadedFiles.map(file => ({
          id: file.id || `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified ? new Date(file.lastModified) : new Date(),
          uploadDate: new Date(),
          originalName: file.name,
          mimeType: file.type,
          fileSize: file.size
        }));
        sessionData.metadata.fileCount = result.uploadedFiles.length;
      }
      
      // Store last message
      if (result.lastMessage) {
        sessionData.lastMessage = result.lastMessage;
      }
    }

    const session = new ResearchSession(sessionData);
    await session.save();
    console.log('New session created:', session._id, 'for user:', user._id);

    // Update user statistics
    await user.incrementQuestions();
    await user.incrementSessions();

    res.status(201).json({
      success: true,
      message: 'Session created successfully', 
      data: session
    });

  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get user's research sessions
router.get('/sessions', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const userId = req.user.userId;

    const query = { userId };
    if (status) {
      query.status = status;
    }

    const sessions = await ResearchSession.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await ResearchSession.countDocuments(query);

    res.json({
      success: true,
      data: {
        sessions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get specific session details
router.get('/sessions/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.userId;

    console.log(`📋 Getting session details: ${sessionId} for user ${userId}`);

    const session = await ResearchSession.findOne({
      _id: sessionId,
      userId
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Get associated documents from the Document collection
    const Document = require('../models/Document');
    const sessionDocuments = await Document.find({
      userId: userId,
      sessionId: sessionId
    }).select({
      docId: 1,
      fileName: 1,
      originalName: 1,
      fileSize: 1,
      mimeType: 1,
      uploadDate: 1,
      processingStatus: 1,
      wordCount: 1,
      pageCount: 1
    }).sort({ uploadDate: -1 });

    console.log(`✅ Found session with ${sessionDocuments.length} documents`);

    // Combine session data with document details
    const sessionWithFiles = {
      ...session.toObject(),
      documents: sessionDocuments,
      documentCount: sessionDocuments.length,
      documentsReady: sessionDocuments.filter(doc => doc.processingStatus === 'completed').length
    };

    res.json({
      success: true,
      data: sessionWithFiles
    });

  } catch (error) {
    console.error('Get session details error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Update research session (complete, add result, generate report)
router.put('/sessions/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { status, result, generateReport = false } = req.body;
    const userId = req.user.userId;

    console.log('UPDATE SESSION REQUEST:', {
      sessionId,
      userId,
      status,
      hasResult: !!result,
      resultType: typeof result,
      generateReport
    });

    // Debug: Log chat history types if present
    if (result && result.chatHistory) {
      console.log('Chat history message types:', result.chatHistory.map(msg => ({
        id: msg.id,
        type: msg.type,
        contentLength: msg.content ? msg.content.length : 0
      })));
    }

    const session = await ResearchSession.findOne({
      _id: sessionId,
      userId
    });

    if (!session) {
      console.log('Session not found:', sessionId, 'for user:', userId);
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    console.log('Found session:', session._id, 'title:', session.title);

    // Update session status and result
    if (status) session.status = status;
    
    // Handle enhanced result object with chat history and files
    if (result) {
      if (typeof result === 'object') {
        // Store the complete result object
        session.result = result;
        
        // Extract and store chat history with validation
        if (result.chatHistory && Array.isArray(result.chatHistory)) {
          try {
            session.chatHistory = result.chatHistory.map(msg => {
              // Validate and sanitize message type
              let messageType = msg.type;
              if (!['user', 'bot', 'system'].includes(messageType)) {
                console.warn(`Invalid message type '${messageType}', defaulting to 'user'`);
                messageType = 'user';
              }

              return {
                id: msg.id || Date.now(),
                type: messageType,
                content: msg.content ? msg.content.substring(0, 10000) : '', // Limit content length
                timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
                hasReportOption: msg.hasReportOption || false
              };
            });
            
            // Update message count
            session.metadata = session.metadata || {};
            session.metadata.messageCount = result.chatHistory.length;
            console.log(`✅ Processed ${result.chatHistory.length} chat messages`);
          } catch (chatError) {
            console.error('Error processing chat history:', chatError);
            // Continue without chat history if there's an error
            session.chatHistory = [];
          }
        }
        
        // Extract and store uploaded files with detailed metadata and validation
        if (result.uploadedFiles && Array.isArray(result.uploadedFiles)) {
          try {
            session.uploadedFiles = result.uploadedFiles.map(file => ({
              id: file.id || `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              name: file.name ? file.name.substring(0, 255) : 'Unknown', // Limit name length
              size: file.size || 0,
              type: file.type || 'unknown',
              lastModified: file.lastModified ? new Date(file.lastModified) : new Date(),
              uploadDate: new Date(),
              originalName: file.name ? file.name.substring(0, 255) : 'Unknown',
              mimeType: file.type || 'unknown',
              fileSize: file.size || 0
            }));
            
            // Update file count
            session.metadata = session.metadata || {};
            session.metadata.fileCount = result.uploadedFiles.length;
          } catch (fileError) {
            console.error('Error processing uploaded files:', fileError);
            // Continue without file metadata if there's an error
          }
        }
        
        // Store last message for quick display with length limit
        if (result.lastMessage) {
          session.lastMessage = result.lastMessage.substring(0, 500);
        }
      } else {
        // Legacy string result
        session.result = result;
      }
    }
    
    if (generateReport && !session.reportGenerated) {
      session.reportGenerated = true;
      
      // Update user report count
      try {
        const user = await User.findById(userId);
        if (user) {
          await user.incrementReports();
        }
      } catch (userError) {
        console.error('Error updating user report count:', userError);
        // Continue - this is non-critical
      }
    }

    // Validate session before saving
    try {
      await session.validate();
      console.log('✅ Session validation passed');
    } catch (validationError) {
      console.error('❌ Session validation failed:', validationError.message);
      console.error('Validation details:', validationError.errors);
      throw validationError;
    }

    await session.save();
    console.log('Session saved successfully:', session._id);

    res.json({
      success: true,
      message: 'Session updated successfully',
      data: { session }
    });

  } catch (error) {
    console.error('Update session error:', error);
    console.error('Error details:', error.message);
    console.error('Stack trace:', error.stack);
    
    // Log specific validation errors
    if (error.name === 'ValidationError') {
      console.error('Validation errors:', error.errors);
    }
    
    // Log data size information for debugging
    console.error('Request body size:', JSON.stringify(req.body).length);
    if (req.body.result) {
      console.error('Result object size:', JSON.stringify(req.body.result).length);
      if (req.body.result.chatHistory) {
        console.error('Chat history length:', req.body.result.chatHistory.length);
      }
      if (req.body.result.uploadedFiles) {
        console.error('Uploaded files length:', req.body.result.uploadedFiles.length);
      }
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
      details: error.name === 'ValidationError' ? error.errors : undefined
    });
  }
});

// Delete research session
router.delete('/sessions/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.userId;

    console.log(`🗑️ Deleting session ${sessionId} and all associated data for user ${userId}`);

    const session = await ResearchSession.findOne({
      _id: sessionId,
      userId
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Get and delete associated documents
    const Document = require('../models/Document');
    const PineconeService = require('../services/PineconeService');
    
    const documents = await Document.find({
      userId: userId,
      sessionId: sessionId
    });

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
      const AnswerAssistant = require('../services/AnswerAssistant');
      const answerAssistant = new AnswerAssistant();
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

    // Finally delete the session
    await ResearchSession.findOneAndDelete({
      _id: sessionId,
      userId
    });

    console.log(`✅ Session ${sessionId} and all associated data deleted successfully`);

    res.json({
      success: true,
      message: 'Session and all associated data deleted successfully',
      details: {
        sessionDeleted: true,
        documentsDeleted: mongoResult.deletedCount,
        pineconeResults: {
          successful: deletedFromPinecone,
          errors: pineconeErrors
        }
      }
    });

  } catch (error) {
    console.error('Delete session error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Update user preferences
router.put('/preferences', authenticateToken, async (req, res) => {
  try {
    const { language, theme, emailNotifications, reportFormat } = req.body;
    const userId = req.user.userId;

    const updateData = {};
    if (language !== undefined) updateData['preferences.language'] = language;
    if (theme !== undefined) updateData['preferences.theme'] = theme;
    if (emailNotifications !== undefined) updateData['preferences.emailNotifications'] = emailNotifications;
    if (reportFormat !== undefined) updateData['preferences.reportFormat'] = reportFormat;

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true }
    );

    res.json({
      success: true,
      message: 'Preferences updated',
      data: { preferences: user.preferences }
    });

  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;