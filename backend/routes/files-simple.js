const express = require('express');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * Simple test endpoint to verify files route is working
 * GET /api/files/test
 */
router.get('/test', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: 'Files route is working',
    timestamp: new Date().toISOString()
  });
});

/**
 * Check Pinecone connection and index status
 * GET /api/files/pinecone-status
 */
router.get('/pinecone-status', authenticateToken, async (req, res) => {
  try {
    const { Pinecone } = require('@pinecone-database/pinecone');
    
    if (!process.env.PINECONE_API_KEY) {
      return res.status(400).json({
        success: false,
        error: 'Pinecone API key not configured',
        configured: false
      });
    }

    // Initialize Pinecone
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });

    const indexName = process.env.PINECONE_INDEX_NAME || 'research-assistant';
    
    // Try to get index stats
    const index = pinecone.index(indexName);
    const stats = await index.describeIndexStats();
    
    res.json({
      success: true,
      configured: true,
      indexName: indexName,
      indexStats: stats,
      totalVectors: stats.totalVectorCount || 0,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Pinecone status check error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      configured: !!process.env.PINECONE_API_KEY,
      indexName: process.env.PINECONE_INDEX_NAME || 'research-assistant'
    });
  }
});

/**
 * Search for vectors by user or session
 * GET /api/files/check-documents?userId=xxx&sessionId=xxx
 */
router.get('/check-documents', authenticateToken, async (req, res) => {
  try {
    const { userId, sessionId, docId } = req.query;
    const { Pinecone } = require('@pinecone-database/pinecone');
    
    if (!process.env.PINECONE_API_KEY) {
      return res.status(400).json({
        success: false,
        error: 'Pinecone not configured'
      });
    }

    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });

    const indexName = process.env.PINECONE_INDEX_NAME || 'research-assistant';
    const index = pinecone.index(indexName);

    // Build filter
    const filter = {};
    if (userId) filter.userId = userId;
    if (sessionId) filter.sessionId = sessionId;
    if (docId) filter.docId = docId;

    // Query with dummy vector to get metadata
    const dummyVector = new Array(1536).fill(0); // text-embedding-ada-002 dimension
    
    const queryResponse = await index.query({
      vector: dummyVector,
      filter: filter,
      topK: 100,
      includeMetadata: true,
      includeValues: false
    });

    // Group by document
    const documentGroups = {};
    queryResponse.matches.forEach(match => {
      const docId = match.metadata.docId;
      if (!documentGroups[docId]) {
        documentGroups[docId] = {
          docId: docId,
          fileName: match.metadata.fileName,
          chunks: [],
          totalChunks: match.metadata.totalChunks || 0,
          userId: match.metadata.userId,
          sessionId: match.metadata.sessionId,
          uploadDate: match.metadata.uploadDate
        };
      }
      documentGroups[docId].chunks.push({
        id: match.id,
        chunkIndex: match.metadata.chunkIndex,
        score: match.score
      });
    });

    // Sort chunks by index
    Object.values(documentGroups).forEach(doc => {
      doc.chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
      doc.chunksFound = doc.chunks.length;
    });

    res.json({
      success: true,
      filter: filter,
      totalMatches: queryResponse.matches.length,
      documentsFound: Object.keys(documentGroups).length,
      documents: Object.values(documentGroups),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Document check error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Test embedding generation
 * POST /api/files/test-embedding
 */
router.post('/test-embedding', authenticateToken, async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text is required'
      });
    }

    const OpenAI = require('openai');
    
    // Initialize OpenAI (try Azure first, then standard)
    let openai;
    if (process.env.AZURE_OPENAI_API_KEY) {
      openai = new OpenAI({
        apiKey: process.env.AZURE_OPENAI_API_KEY,
        baseURL: process.env.AZURE_OPENAI_BASE_URL,
        defaultQuery: { 'api-version': process.env.AZURE_OPENAI_EMBEDDING_API_VERSION || '2023-05-15' },
        defaultHeaders: {
          'api-key': process.env.AZURE_OPENAI_API_KEY,
        },
      });
    } else if (process.env.OPENAI_API_KEY) {
      openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    } else {
      return res.status(400).json({
        success: false,
        error: 'No OpenAI API key configured'
      });
    }

    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text.replace(/\n/g, ' ').trim(),
    });

    const embedding = response.data[0].embedding;

    res.json({
      success: true,
      inputText: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      inputLength: text.length,
      embeddingDimension: embedding.length,
      embeddingPreview: embedding.slice(0, 5), // First 5 values
      model: 'text-embedding-ada-002',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Embedding test error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get supported file types
 * GET /api/files/supported-types
 */
router.get('/supported-types', (req, res) => {
  try {
    res.json({
      success: true,
      supportedTypes: {
        'application/pdf': 'pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
        'text/plain': 'txt',
        'text/markdown': 'md',
        'application/json': 'json',
        'text/csv': 'csv'
      },
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
 * Debug: Check specific document in Pinecone
 * GET /api/files/debug-document/:docId
 */
router.get('/debug-document/:docId', authenticateToken, async (req, res) => {
  try {
    const { docId } = req.params;
    const PineconeService = require('../services/PineconeService');
    
    console.log(`🔍 DEBUG: Checking document ${docId} in Pinecone...`);
    
    const vectors = await PineconeService.debugListDocumentVectors(docId);
    const indexStats = await PineconeService.debugIndexStats();
    
    res.json({
      success: true,
      docId: docId,
      vectorsFound: vectors.length,
      vectors: vectors.map(v => ({
        id: v.id,
        chunkIndex: v.metadata?.chunkIndex,
        fileName: v.metadata?.fileName,
        uploadDate: v.metadata?.uploadDate
      })),
      indexStats: indexStats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Debug document error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Debug: Get all index statistics
 * GET /api/files/debug-index
 */
router.get('/debug-index', authenticateToken, async (req, res) => {
  try {
    const PineconeService = require('../services/PineconeService');
    
    console.log('📊 DEBUG: Getting Pinecone index statistics...');
    
    const stats = await PineconeService.debugIndexStats();
    
    res.json({
      success: true,
      indexStats: stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Debug index error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Debug: Check MongoDB documents
 * GET /api/files/debug-mongodb
 */
router.get('/debug-mongodb', authenticateToken, async (req, res) => {
  try {
    const Document = require('../models/Document');
    
    console.log('📊 DEBUG: Getting MongoDB document statistics...');
    
    const totalDocuments = await Document.countDocuments();
    const processingStatusCounts = await Document.aggregate([
      { $group: { _id: '$processingStatus', count: { $sum: 1 } } }
    ]);
    
    const recentDocuments = await Document.find()
      .sort({ uploadDate: -1 })
      .limit(10)
      .select('docId fileName processingStatus totalChunks uploadDate');
    
    console.log(`📄 Total documents in MongoDB: ${totalDocuments}`);
    processingStatusCounts.forEach(status => {
      console.log(`   ${status._id}: ${status.count} documents`);
    });
    
    res.json({
      success: true,
      totalDocuments: totalDocuments,
      statusBreakdown: processingStatusCounts,
      recentDocuments: recentDocuments,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Debug MongoDB error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Debug: Check specific document in MongoDB
 * GET /api/files/debug-mongodb/:docId
 */
router.get('/debug-mongodb/:docId', authenticateToken, async (req, res) => {
  try {
    const { docId } = req.params;
    const Document = require('../models/Document');
    
    console.log(`🔍 DEBUG: Checking document ${docId} in MongoDB...`);
    
    const document = await Document.findOne({ docId });
    
    if (!document) {
      return res.status(404).json({
        success: false,
        error: `Document ${docId} not found in MongoDB`
      });
    }
    
    console.log(`📄 Found document: ${document.fileName}`);
    console.log(`   Status: ${document.processingStatus}`);
    console.log(`   Chunks: ${document.totalChunks}`);
    console.log(`   Pinecone IDs: ${document.pineconeIds?.length || 0}`);
    
    res.json({
      success: true,
      document: {
        docId: document.docId,
        fileName: document.fileName,
        processingStatus: document.processingStatus,
        totalChunks: document.totalChunks,
        pineconeIds: document.pineconeIds,
        wordCount: document.wordCount,
        uploadDate: document.uploadDate,
        queryCount: document.queryCount
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Debug MongoDB document error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;