const { Pinecone } = require('@pinecone-database/pinecone');
const OpenAI = require('openai');

class PineconeService {
  constructor() {
    this.pinecone = null;
    this.index = null;
    this.openai = null;
    this.indexName = process.env.PINECONE_INDEX_NAME || 'research-assistant';
    this.embeddingModel = 'text-embedding-ada-002';
    this.maxChunkSize = 1000; // characters per chunk
    this.maxOverlap = 100; // overlap between chunks
  }

  /**
   * Initialize Pinecone and OpenAI connections
   */
  async initialize() {
    try {
      // Initialize Pinecone
      if (!process.env.PINECONE_API_KEY) {
        throw new Error('PINECONE_API_KEY not found in environment variables');
      }

      console.log('🔧 Initializing Pinecone...');
      console.log('📋 Index name:', this.indexName);
      console.log('🌍 Environment:', process.env.PINECONE_ENVIRONMENT || 'auto-detect');

      this.pinecone = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY,
      });

      // Get the specific index
      this.index = this.pinecone.index(this.indexName);
      
      console.log('✅ Pinecone client initialized successfully');

      // Initialize OpenAI for embeddings
      if (!process.env.OPENAI_API_KEY && !process.env.AZURE_OPENAI_API_KEY) {
        throw new Error('❌ No OpenAI API key found. Please set either OPENAI_API_KEY or AZURE_OPENAI_API_KEY in your .env file.');
      }

      // Use Azure OpenAI if available, otherwise standard OpenAI
      if (process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_BASE_URL && !process.env.AZURE_OPENAI_BASE_URL.includes('YOUR_RESOURCE_NAME')) {
        console.log('🔑 Using Azure OpenAI for embeddings');
        console.log('🔗 Azure endpoint:', process.env.AZURE_OPENAI_BASE_URL);
        console.log('🏷️ Deployment name:', process.env.AZURE_OPENAI_DEPLOYMENT_NAME);
        
        // Check if it's Azure Cognitive Services format
        const isAzureCognitiveServices = process.env.AZURE_OPENAI_BASE_URL.includes('cognitiveservices.azure.com');
        
        if (isAzureCognitiveServices) {
          // For Azure Cognitive Services, we need to construct the full URL differently
          const baseUrl = `${process.env.AZURE_OPENAI_BASE_URL.replace(/\/$/, '')}/deployments/${process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME || 'text-embedding-ada-002'}`;
          console.log('🔧 Using Azure Cognitive Services format for embeddings:', baseUrl);
          
          this.openai = new OpenAI({
            apiKey: process.env.AZURE_OPENAI_API_KEY,
            baseURL: baseUrl,
            defaultQuery: { 'api-version': process.env.AZURE_OPENAI_EMBEDDING_API_VERSION || '2023-05-15' },
            defaultHeaders: {
              'api-key': process.env.AZURE_OPENAI_API_KEY,
            },
          });
        } else {
          // Standard Azure OpenAI format
          this.openai = new OpenAI({
            apiKey: process.env.AZURE_OPENAI_API_KEY,
            baseURL: process.env.AZURE_OPENAI_BASE_URL,
            defaultQuery: { 'api-version': process.env.AZURE_OPENAI_EMBEDDING_API_VERSION || '2023-05-15' },
            defaultHeaders: {
              'api-key': process.env.AZURE_OPENAI_API_KEY,
            },
          });
        }
        
        // Use Azure deployment name for embeddings (separate from chat deployment)
        this.embeddingModel = process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME || 'text-embedding-ada-002';
      } else if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your-openai-api-key-here') {
        console.log('🔑 Using standard OpenAI for embeddings');
        this.openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });
        // Use standard OpenAI model name
        this.embeddingModel = 'text-embedding-ada-002';
      } else {
        throw new Error('❌ No valid OpenAI API key found. Please set a valid OPENAI_API_KEY or configure Azure OpenAI properly in your .env file.');
      }

      console.log('✅ Pinecone and OpenAI services initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Pinecone service:', error.message);
      throw error;
    }
  }

  /**
   * Generate embeddings using OpenAI's text-embedding-ada-002 (Azure or OpenAI)
   */
  async generateEmbedding(text) {
    try {
      if (!this.openai) {
        await this.initialize();
      }

      // For Azure Cognitive Services, we need to make the call differently
      const isAzureCognitiveServices = process.env.AZURE_OPENAI_BASE_URL && process.env.AZURE_OPENAI_BASE_URL.includes('cognitiveservices.azure.com');
      
      if (isAzureCognitiveServices) {
        // Direct API call to Azure Cognitive Services for embeddings
        const embeddingDeployment = process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME || 'text-embedding-ada-002';
        const url = `${process.env.AZURE_OPENAI_BASE_URL.replace(/\/$/, '')}/deployments/${embeddingDeployment}/embeddings?api-version=${process.env.AZURE_OPENAI_EMBEDDING_API_VERSION || '2023-05-15'}`;
        
        console.log('🔗 Making direct API call to:', url);
        console.log('🎯 Using embedding deployment:', embeddingDeployment);
        
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': process.env.AZURE_OPENAI_API_KEY,
          },
          body: JSON.stringify({
            input: text.replace(/\n/g, ' ').trim(),
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Azure API error: ${response.status} ${response.statusText} - ${error}`);
        }

        const result = await response.json();
        return result.data[0].embedding;
      } else {
        // Use OpenAI SDK for standard OpenAI or Azure OpenAI
        const response = await this.openai.embeddings.create({
          model: this.embeddingModel,
          input: text.replace(/\n/g, ' ').trim(),
        });

        return response.data[0].embedding;
      }
    } catch (error) {
      console.error('❌ Error generating embedding:', error.message);
      console.error('❌ Full error details:', error);
      
      // Check if it's an API key issue
      if (error.message.includes('API key') || error.message.includes('authentication') || error.message.includes('unauthorized')) {
        throw new Error('Invalid OpenAI API key. Please check your OPENAI_API_KEY or AZURE_OPENAI_API_KEY in the .env file.');
      }
      
      // Check if it's a connection issue
      if (error.message.includes('Connection error') || error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
        throw new Error('Cannot connect to OpenAI API. Please check your internet connection and API configuration.');
      }
      
      throw error;
    }
  }

  /**
   * Split text into chunks with overlap
   */
  chunkText(text, chunkSize = this.maxChunkSize, overlap = this.maxOverlap) {
    const chunks = [];
    const words = text.split(/\s+/);
    let currentChunk = [];
    let currentLength = 0;

    for (const word of words) {
      const wordLength = word.length + 1; // +1 for space
      
      if (currentLength + wordLength > chunkSize && currentChunk.length > 0) {
        // Create chunk with current words
        chunks.push(currentChunk.join(' '));
        
        // Start new chunk with overlap
        const overlapWords = Math.min(
          Math.floor(overlap / 10), // Rough estimate of overlap in words
          Math.floor(currentChunk.length / 4)
        );
        
        currentChunk = currentChunk.slice(-overlapWords);
        currentLength = currentChunk.join(' ').length;
      }
      
      currentChunk.push(word);
      currentLength += wordLength;
    }

    // Add the last chunk if it has content
    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join(' '));
    }

    return chunks.filter(chunk => chunk.trim().length > 0);
  }

  /**
   * Process and store document in Pinecone with session isolation
   */
  async storeDocument(docId, text, metadata = {}) {
    try {
      if (!this.index) {
        await this.initialize();
      }

      // Use sessionId as namespace for isolation
      const namespace = metadata.sessionId || 'default';
      console.log(`📄 Processing document ${docId} in namespace: ${namespace}`);

      // Split text into chunks
      const chunks = this.chunkText(text);
      console.log(`📄 Processing document ${docId}: ${chunks.length} chunks created`);

      // Generate embeddings and prepare vectors for batch upsert
      const vectors = [];
      const pineconeIds = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunkId = `${docId}_chunk_${i}`;
        const embedding = await this.generateEmbedding(chunks[i]);
        
        pineconeIds.push(chunkId);
        vectors.push({
          id: chunkId,
          values: embedding,
          metadata: {
            // Document identification
            docId: docId,
            chunkIndex: i,
            totalChunks: chunks.length,
            
            // Content
            text: chunks[i], // Changed from 'content' to 'text' for consistency with search
            wordCount: chunks[i].split(/\s+/).length,
            
            // User context
            userId: metadata.userId,
            sessionId: metadata.sessionId,
            fileName: metadata.fileName,
            
            // Document metadata
            fileSize: metadata.fileSize,
            mimeType: metadata.mimeType,
            uploadDate: metadata.uploadDate || new Date().toISOString(),
            
            // Processing metadata
            embeddingModel: this.embeddingModel,
            chunkSize: this.maxChunkSize,
            processedAt: new Date().toISOString()
          }
        });

        // Log progress for large documents
        if (chunks.length > 10 && (i + 1) % 10 === 0) {
          console.log(`📊 Embedded ${i + 1}/${chunks.length} chunks for ${docId}`);
        }
      }

      // Batch upsert all vectors to session-specific namespace
      console.log(`🔄 Storing ${vectors.length} vectors in Pinecone namespace '${namespace}' for ${docId}`);
      await this.index.namespace(namespace).upsert(vectors);

      console.log(`✅ Successfully stored document ${docId} with ${chunks.length} chunks in namespace ${namespace}`);
      
      return {
        docId,
        pineconeIds,
        totalChunks: chunks.length,
        extractedText: text,
        wordCount: text.split(/\s+/).length,
        namespace: namespace,
        success: true
      };

    } catch (error) {
      console.error(`❌ Error storing document ${docId}:`, error.message);
      throw error;
    }
  }

  /**
   * Search for relevant content using semantic similarity with session isolation
   */
  async search(query, filters = {}, topK = 10) {
    try {
      if (!this.index) {
        await this.initialize();
      }

      // Use sessionId as namespace for search isolation
      const namespace = filters.sessionId || 'default';
      console.log(`🔍 Searching in namespace: ${namespace}`);

      // Generate embedding for the query
      const queryEmbedding = await this.generateEmbedding(query);

      // Prepare search filters (sessionId will be handled by namespace)
      const searchFilters = {};
      if (filters.userId) searchFilters.userId = filters.userId;
      if (filters.docId) searchFilters.docId = filters.docId;
      if (filters.fileName) searchFilters.fileName = filters.fileName;

      // Perform semantic search within the session namespace
      const searchResults = await this.index.namespace(namespace).query({
        vector: queryEmbedding,
        filter: Object.keys(searchFilters).length > 0 ? searchFilters : undefined,
        topK: topK,
        includeMetadata: true,
        includeValues: false
      });

      // Format results with relevance scores
      const formattedResults = searchResults.matches.map(match => ({
        id: match.id,
        score: match.score,
        text: match.metadata.text, // Changed from 'content' to 'text' for consistency
        docId: match.metadata.docId,
        fileName: match.metadata.fileName,
        chunkIndex: match.metadata.chunkIndex,
        totalChunks: match.metadata.totalChunks,
        wordCount: match.metadata.wordCount,
        uploadDate: match.metadata.uploadDate,
        sessionId: match.metadata.sessionId,
        userId: match.metadata.userId,
        metadata: match.metadata
      }));

      console.log(`🔍 Search completed in namespace '${namespace}': ${formattedResults.length} results for "${query.substring(0, 50)}..."`);
      
      return {
        query,
        results: formattedResults,
        totalResults: formattedResults.length,
        namespace: namespace,
        searchPerformed: true
      };

    } catch (error) {
      console.error('❌ Error performing search:', error.message);
      throw error;
    }
  }

  /**
   * Delete document and all its chunks from Pinecone with namespace support
   */
  async deleteDocument(docId, sessionId) {
    try {
      if (!this.index) {
        await this.initialize();
      }

      // Use sessionId as namespace for deletion
      const namespace = sessionId || 'default';
      console.log(`🗑️ Deleting document ${docId} from namespace '${namespace}'`);

      // Delete all chunks for this document from the specific namespace
      await this.index.namespace(namespace).deleteMany({
        filter: { docId: docId }
      });

      console.log(`🗑️ Successfully deleted document ${docId} from Pinecone namespace '${namespace}'`);
      return true;

    } catch (error) {
      console.error(`❌ Error deleting document ${docId}:`, error.message);
      throw error;
    }
  }

  /**
   * Get document statistics from Pinecone
   */
  async getDocumentStats(docId) {
    try {
      if (!this.index) {
        await this.initialize();
      }

      const stats = await this.index.query({
        vector: new Array(1536).fill(0), // Dummy vector for ada-002
        filter: { docId: docId },
        topK: 1,
        includeMetadata: true
      });

      return {
        docId,
        exists: stats.matches.length > 0,
        chunkCount: stats.matches.length,
        metadata: stats.matches[0]?.metadata || null
      };

    } catch (error) {
      console.error(`❌ Error getting document stats for ${docId}:`, error.message);
      return { docId, exists: false, error: error.message };
    }
  }

  /**
   * Debug: List all vectors for a document
   */
  async debugListDocumentVectors(docId) {
    try {
      if (!this.index) {
        await this.initialize();
      }

      const dummyVector = new Array(1536).fill(0);
      const results = await this.index.query({
        vector: dummyVector,
        filter: { docId: docId },
        topK: 1000,
        includeMetadata: true,
        includeValues: false
      });

      console.log(`🔍 DEBUG: Document ${docId} has ${results.matches.length} vectors in Pinecone`);
      results.matches.forEach((match, index) => {
        console.log(`   Chunk ${index}: ID=${match.id}, chunkIndex=${match.metadata.chunkIndex}`);
      });

      return results.matches;
    } catch (error) {
      console.error(`❌ Debug error for document ${docId}:`, error.message);
      return [];
    }
  }

  /**
   * Debug: Get index statistics
   */
  async debugIndexStats() {
    try {
      if (!this.index) {
        await this.initialize();
      }

      const stats = await this.index.describeIndexStats();
      console.log('📊 Pinecone Index Statistics:');
      console.log(`   Total vectors: ${stats.totalVectorCount || 0}`);
      console.log(`   Index fullness: ${stats.indexFullness || 0}%`);
      console.log(`   Dimension: ${stats.dimension || 'unknown'}`);
      
      if (stats.namespaces) {
        console.log('   Namespaces:');
        Object.entries(stats.namespaces).forEach(([ns, data]) => {
          console.log(`     ${ns}: ${data.vectorCount} vectors`);
        });
      }

      return stats;
    } catch (error) {
      console.error('❌ Debug index stats error:', error.message);
      return null;
    }
  }

  /**
   * Get index statistics
   */
  async getIndexStats() {
    try {
      if (!this.index) {
        await this.initialize();
      }

      const stats = await this.index.describeIndexStats();
      return stats;

    } catch (error) {
      console.error('❌ Error getting index stats:', error.message);
      throw error;
    }
  }

  /**
   * Delete an entire namespace and all its vectors
   */
  async deleteNamespace(namespace) {
    try {
      if (!this.index) {
        await this.initialize();
      }

      console.log(`🗑️ Deleting namespace: ${namespace}`);
      
      // Delete all vectors in the namespace
      await this.index.namespace(namespace).deleteAll();
      
      console.log(`✅ Successfully deleted namespace: ${namespace}`);
      return true;

    } catch (error) {
      console.error(`❌ Error deleting namespace ${namespace}:`, error.message);
      throw error;
    }
  }

  /**
   * Store live source data with rolling window management
   * Maintains a maximum number of entries per source, removing oldest when limit is exceeded
   */
  async storeLiveSourceData(sourceId, data, metadata = {}, maxEntries = 500) {
    try {
      if (!this.index) {
        await this.initialize();
      }

      const namespace = metadata.sessionId || 'live-sources';
      const timestamp = new Date().toISOString();
      const entryId = `${sourceId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      console.log(`📡 Storing live data for source ${sourceId} (max: ${maxEntries} entries)`);

      // Generate embedding for the content
      const contentText = typeof data === 'string' ? data : JSON.stringify(data);
      const embedding = await this.generateEmbedding(contentText);

      // Create vector with live source metadata
      const vector = {
        id: entryId,
        values: embedding,
        metadata: {
          // Source identification
          sourceId: sourceId,
          sourceType: metadata.sourceType || 'live-data',
          entryId: entryId,
          
          // Content
          text: contentText,
          originalData: JSON.stringify(data),
          wordCount: contentText.split(/\s+/).length,
          
          // Timing
          timestamp: timestamp,
          ingestionTime: timestamp,
          
          // User context
          userId: metadata.userId,
          sessionId: metadata.sessionId,
          
          // Live source metadata
          sourceUrl: metadata.sourceUrl,
          sourceName: metadata.sourceName,
          dataType: metadata.dataType || 'general',
          
          // Processing metadata
          embeddingModel: this.embeddingModel,
          processedAt: timestamp,
          isLiveData: true
        }
      };

      // Store the new vector
      await this.index.namespace(namespace).upsert([vector]);

      // Check if we need to clean up old entries
      await this.cleanupOldLiveSourceData(sourceId, namespace, maxEntries);

      console.log(`✅ Stored live data entry ${entryId} for source ${sourceId}`);
      
      return {
        entryId,
        sourceId,
        timestamp,
        namespace,
        success: true
      };

    } catch (error) {
      console.error(`❌ Error storing live source data for ${sourceId}:`, error.message);
      throw error;
    }
  }

  /**
   * Clean up old live source data when exceeding maximum entries
   */
  async cleanupOldLiveSourceData(sourceId, namespace, maxEntries) {
    try {
      // Get all entries for this source, sorted by timestamp
      const dummyVector = new Array(1536).fill(0);
      const searchResults = await this.index.namespace(namespace).query({
        vector: dummyVector,
        filter: { 
          sourceId: sourceId,
          isLiveData: true
        },
        topK: 10000, // Get all entries
        includeMetadata: true,
        includeValues: false
      });

      const entries = searchResults.matches;
      console.log(`📊 Source ${sourceId} has ${entries.length} entries (max: ${maxEntries})`);

      if (entries.length > maxEntries) {
        // Sort by timestamp (oldest first)
        entries.sort((a, b) => new Date(a.metadata.timestamp) - new Date(b.metadata.timestamp));
        
        // Calculate how many to remove
        const entriesToRemove = entries.length - maxEntries;
        const oldEntries = entries.slice(0, entriesToRemove);
        
        console.log(`🧹 Removing ${entriesToRemove} old entries for source ${sourceId}`);
        
        // Delete old entries in batches
        const batchSize = 100;
        for (let i = 0; i < oldEntries.length; i += batchSize) {
          const batch = oldEntries.slice(i, i + batchSize);
          const idsToDelete = batch.map(entry => entry.id);
          
          await this.index.namespace(namespace).deleteMany({
            ids: idsToDelete
          });
          
          console.log(`🗑️ Deleted batch of ${idsToDelete.length} old entries for source ${sourceId}`);
        }
        
        console.log(`✅ Cleanup completed for source ${sourceId}. Removed ${entriesToRemove} old entries`);
      }

    } catch (error) {
      console.error(`❌ Error cleaning up old data for source ${sourceId}:`, error.message);
      // Don't throw error - cleanup failure shouldn't stop new data ingestion
    }
  }

  /**
   * Get live source statistics
   */
  async getLiveSourceStats(sourceId, namespace = 'live-sources') {
    try {
      if (!this.index) {
        await this.initialize();
      }

      const dummyVector = new Array(1536).fill(0);
      const searchResults = await this.index.namespace(namespace).query({
        vector: dummyVector,
        filter: { 
          sourceId: sourceId,
          isLiveData: true
        },
        topK: 10000,
        includeMetadata: true,
        includeValues: false
      });

      const entries = searchResults.matches;
      
      if (entries.length === 0) {
        return {
          sourceId,
          entryCount: 0,
          exists: false
        };
      }

      // Sort by timestamp to get oldest and newest
      entries.sort((a, b) => new Date(a.metadata.timestamp) - new Date(b.metadata.timestamp));
      
      return {
        sourceId,
        entryCount: entries.length,
        exists: true,
        oldestEntry: entries[0].metadata.timestamp,
        newestEntry: entries[entries.length - 1].metadata.timestamp,
        sourceName: entries[0].metadata.sourceName,
        sourceType: entries[0].metadata.sourceType,
        dataType: entries[0].metadata.dataType,
        namespace
      };

    } catch (error) {
      console.error(`❌ Error getting live source stats for ${sourceId}:`, error.message);
      return {
        sourceId,
        entryCount: 0,
        exists: false,
        error: error.message
      };
    }
  }

  /**
   * Search live source data with time filtering
   */
  async searchLiveSourceData(query, filters = {}, topK = 10) {
    try {
      if (!this.index) {
        await this.initialize();
      }

      const namespace = filters.sessionId || 'live-sources';
      console.log(`🔍 Searching live source data in namespace: ${namespace}`);

      // Generate embedding for the query
      const queryEmbedding = await this.generateEmbedding(query);

      // Prepare search filters
      const searchFilters = { isLiveData: true };
      if (filters.sourceId) searchFilters.sourceId = filters.sourceId;
      if (filters.sourceType) searchFilters.sourceType = filters.sourceType;
      if (filters.dataType) searchFilters.dataType = filters.dataType;
      if (filters.userId) searchFilters.userId = filters.userId;

      // Perform semantic search
      const searchResults = await this.index.namespace(namespace).query({
        vector: queryEmbedding,
        filter: searchFilters,
        topK: topK,
        includeMetadata: true,
        includeValues: false
      });

      // Format results
      const formattedResults = searchResults.matches.map(match => ({
        id: match.id,
        score: match.score,
        text: match.metadata.text,
        sourceId: match.metadata.sourceId,
        sourceName: match.metadata.sourceName,
        sourceType: match.metadata.sourceType,
        dataType: match.metadata.dataType,
        timestamp: match.metadata.timestamp,
        originalData: match.metadata.originalData,
        metadata: match.metadata
      }));

      console.log(`🔍 Live source search completed: ${formattedResults.length} results for "${query.substring(0, 50)}..."`);
      
      return {
        query,
        results: formattedResults,
        totalResults: formattedResults.length,
        namespace,
        isLiveSourceSearch: true
      };

    } catch (error) {
      console.error('❌ Error searching live source data:', error.message);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new PineconeService();