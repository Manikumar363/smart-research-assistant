const PineconeService = require('./PineconeService');
const Document = require('../models/Document');

class Retriever {
  constructor() {
    this.pineconeService = PineconeService;
    this.defaultTopK = 10;
    this.relevanceThreshold = 0.7; // Minimum relevance score
    this.maxContextLength = 4000; // Maximum context length for LLM
  }

  /**
   * Perform semantic search and return enriched results
   */
  async search(query, options = {}) {
    try {
      const {
        userId,
        sessionId,
        docId,
        fileName,
        topK = this.defaultTopK,
        includeContext = true,
        minRelevance = this.relevanceThreshold
      } = options;

      console.log(`🔍 Retriever: Searching for "${query.substring(0, 50)}..."`);

      // Prepare search filters
      const filters = {};
      if (userId) filters.userId = userId;
      if (sessionId) filters.sessionId = sessionId;
      if (docId) filters.docId = docId;
      if (fileName) filters.fileName = fileName;

      // First, perform search in session-specific namespace
      console.log(`🔍 Retriever: Calling PineconeService.search with filters:`, filters);
      const sessionSearchResults = await this.pineconeService.search(query, filters, topK);
      
      console.log(`📊 Session namespace results:`, {
        totalResults: sessionSearchResults?.totalResults || 0,
        resultsCount: sessionSearchResults?.results?.length || 0,
        namespace: sessionSearchResults?.namespace || 'unknown'
      });

      // Also search in the default namespace for BBC news and other live sources
      let defaultSearchResults = { results: [] };
      if (sessionId !== 'default') {
        console.log(`🔍 Also searching in default namespace for live sources...`);
        const defaultFilters = { ...filters };
        delete defaultFilters.sessionId; // Remove sessionId to search in default namespace
        
        try {
          defaultSearchResults = await this.pineconeService.search(query, { ...defaultFilters, sessionId: 'default' }, Math.floor(topK / 2));
          console.log(`📊 Default namespace results:`, {
            totalResults: defaultSearchResults?.totalResults || 0,
            resultsCount: defaultSearchResults?.results?.length || 0,
            namespace: 'default'
          });
        } catch (defaultError) {
          console.warn(`⚠️ Error searching default namespace: ${defaultError.message}`);
          defaultSearchResults = { results: [] };
        }
      }

      // Combine results from both namespaces
      const combinedResults = {
        query: query,
        results: [
          ...(sessionSearchResults?.results || []),
          ...(defaultSearchResults?.results || [])
        ],
        totalResults: (sessionSearchResults?.totalResults || 0) + (defaultSearchResults?.totalResults || 0),
        searchPerformed: true,
        namespacesSearched: sessionId !== 'default' ? [sessionSearchResults?.namespace, 'default'] : [sessionSearchResults?.namespace]
      };

      console.log(`📊 Combined results from ${combinedResults.namespacesSearched.length} namespaces:`, {
        totalResults: combinedResults.totalResults,
        resultsCount: combinedResults.results.length
      });

      // Check if search results are valid
      if (!combinedResults.results || !Array.isArray(combinedResults.results)) {
        console.log('⚠️ Invalid search results from Pinecone');
        return {
          query,
          totalResults: 0,
          relevantResults: 0,
          documentsFound: 0,
          results: [],
          groupedByDocument: {},
          context: null,
          searchMetadata: {
            filters: filters,
            topK: topK,
            minRelevance: minRelevance,
            searchTimestamp: new Date().toISOString(),
            namespacesSearched: combinedResults.namespacesSearched
          }
        };
      }

      console.log(`🎯 Before relevance filtering: ${combinedResults.results.length} results`);
      
      // Filter by relevance threshold and sort by score
      const relevantResults = combinedResults.results
        .filter(result => result.score >= minRelevance)
        .sort((a, b) => b.score - a.score) // Sort by relevance score descending
        .slice(0, topK); // Limit to topK results
      
      console.log(`🎯 After relevance filtering (>= ${minRelevance}): ${relevantResults.length} results`);

      // Enrich results with MongoDB document data
      const enrichedResults = await this.enrichWithDocumentData(relevantResults);

      // Group results by document for better organization
      const groupedResults = this.groupResultsByDocument(enrichedResults);

      // Generate context for LLM if requested
      const context = includeContext ? this.generateContext(enrichedResults) : null;

      // Update usage statistics
      await this.updateUsageStats(enrichedResults, query);

      const response = {
        query,
        totalResults: enrichedResults.length,
        relevantResults: enrichedResults.length,
        documentsFound: Object.keys(groupedResults).length,
        results: enrichedResults,
        groupedByDocument: groupedResults,
        context: context,
        searchMetadata: {
          filters: filters,
          topK: topK,
          minRelevance: minRelevance,
          searchTimestamp: new Date().toISOString(),
          namespacesSearched: combinedResults.namespacesSearched || [sessionSearchResults?.namespace || 'unknown']
        }
      };

      console.log(`✅ Retriever: Found ${enrichedResults.length} relevant results across ${Object.keys(groupedResults).length} documents`);
      return response;

    } catch (error) {
      console.error('❌ Retriever search error:', error.message);
      throw error;
    }
  }

  /**
   * Enrich Pinecone results with MongoDB document metadata
   */
  async enrichWithDocumentData(results) {
    try {
      // Check if results exist and is an array
      if (!results || !Array.isArray(results) || results.length === 0) {
        console.log('⚠️ No results to enrich or invalid results format');
        return [];
      }

      // Get unique document IDs
      const docIds = [...new Set(results.map(result => result.metadata?.docId || result.docId).filter(Boolean))];

      if (docIds.length === 0) {
        console.log('⚠️ No valid document IDs found in results');
        return results;
      }

      // Fetch document data from MongoDB
      const documents = await Document.find({ docId: { $in: docIds } });
      const docMap = documents.reduce((map, doc) => {
        map[doc.docId] = doc;
        return map;
      }, {});

      // Enrich each result
      const enrichedResults = results.map(result => {
        const docId = result.metadata?.docId || result.docId;
        const fileName = result.metadata?.fileName || result.fileName;
        const document = docMap[docId];
        
        return {
          // Pinecone data
          id: result.id,
          score: result.score,
          content: result.text || result.content || result.metadata?.text || result.metadata?.content || '',
          chunkIndex: result.chunkIndex || result.metadata?.chunkIndex || 0,
          totalChunks: result.totalChunks || result.metadata?.totalChunks || 1,
          
          // Document metadata
          docId: docId,
          fileName: fileName,
          
          // Enhanced document data from MongoDB
          documentInfo: document ? {
            originalName: document.originalName,
            fileSize: document.fileSize,
            fileSizeFormatted: document.fileSizeFormatted,
            mimeType: document.mimeType,
            uploadDate: document.uploadDate,
            summary: document.summary,
            keywords: document.keywords,
            topics: document.topics,
            queryCount: document.queryCount,
            averageRelevanceScore: document.averageRelevanceScore,
            pageCount: document.pageCount,
            wordCount: document.wordCount,
            language: document.language,
            processingStatus: document.processingStatus
          } : null,
          
          // Citation information
          citation: this.generateCitation(result, document),
          
          // Content preview
          preview: this.generatePreview(result.text || result.content || result.metadata?.text || result.metadata?.content || ''),
          
          // Relevance category
          relevanceCategory: this.categorizerelevance(result.score),
          
          // Original metadata from Pinecone
          metadata: result.metadata
        };
      });

      return enrichedResults;

    } catch (error) {
      console.error('❌ Error enriching results:', error.message);
      // Return original results if enrichment fails, ensure it's an array
      return Array.isArray(results) ? results : [];
    }
  }

  /**
   * Group search results by document
   */
  groupResultsByDocument(results) {
    const grouped = {};

    results.forEach(result => {
      const docId = result.docId;
      
      if (!grouped[docId]) {
        grouped[docId] = {
          docId: docId,
          fileName: result.fileName,
          documentInfo: result.documentInfo,
          chunks: [],
          topScore: 0,
          averageScore: 0,
          totalChunks: 0
        };
      }

      grouped[docId].chunks.push(result);
      grouped[docId].topScore = Math.max(grouped[docId].topScore, result.score);
      grouped[docId].totalChunks += 1;
    });

    // Calculate average scores and sort chunks
    Object.keys(grouped).forEach(docId => {
      const group = grouped[docId];
      group.averageScore = group.chunks.reduce((sum, chunk) => sum + chunk.score, 0) / group.chunks.length;
      group.chunks.sort((a, b) => b.score - a.score); // Sort by relevance
    });

    return grouped;
  }

  /**
   * Generate context for LLM from search results
   */
  generateContext(results) {
    let context = '';
    let currentLength = 0;
    const maxLength = this.maxContextLength;

    // Sort results by relevance
    const sortedResults = results.sort((a, b) => b.score - a.score);

    for (const result of sortedResults) {
      const addition = `\n\n[Source: ${result.fileName}, Chunk ${result.chunkIndex + 1}, Relevance: ${(result.score * 100).toFixed(1)}%]\n${result.content}`;
      
      if (currentLength + addition.length > maxLength) {
        break;
      }
      
      context += addition;
      currentLength += addition.length;
    }

    return {
      content: context.trim(),
      length: currentLength,
      sourcesUsed: context.split('[Source:').length - 1,
      truncated: currentLength >= maxLength
    };
  }

  /**
   * Generate citation for a result
   */
  generateCitation(result, document) {
    const fileName = document?.originalName || result.fileName;
    const uploadDate = document?.uploadDate ? new Date(document.uploadDate).toLocaleDateString() : 'Unknown date';
    const chunk = result.chunkIndex + 1;
    const relevance = (result.score * 100).toFixed(1);

    return {
      apa: `${fileName} (${uploadDate}). Section ${chunk}. Retrieved with ${relevance}% relevance.`,
      simple: `${fileName}, Section ${chunk} (${relevance}% match)`,
      filename: fileName,
      section: chunk,
      relevance: relevance,
      uploadDate: uploadDate
    };
  }

  /**
   * Generate content preview
   */
  generatePreview(content, maxLength = 200) {
    if (content.length <= maxLength) {
      return content;
    }
    
    return content.substring(0, maxLength).trim() + '...';
  }

  /**
   * Categorize relevance score
   */
  categorizerelevance(score) {
    if (score >= 0.9) return 'excellent';
    if (score >= 0.8) return 'high';
    if (score >= 0.7) return 'good';
    if (score >= 0.6) return 'moderate';
    return 'low';
  }

  /**
   * Update usage statistics for documents
   */
  async updateUsageStats(results, query) {
    try {
      const docUpdates = {};
      
      // Aggregate statistics by document
      results.forEach(result => {
        if (!docUpdates[result.docId]) {
          docUpdates[result.docId] = {
            queryCount: 0,
            totalRelevance: 0,
            resultCount: 0
          };
        }
        
        docUpdates[result.docId].queryCount = 1; // One query per document
        docUpdates[result.docId].totalRelevance += result.score;
        docUpdates[result.docId].resultCount += 1;
      });

      // Update documents in parallel
      const updatePromises = Object.entries(docUpdates).map(async ([docId, stats]) => {
        const avgRelevance = stats.totalRelevance / stats.resultCount;
        
        const document = await Document.findOne({ docId });
        if (document) {
          await document.updateUsage(avgRelevance);
        }
      });

      await Promise.all(updatePromises);
      
      console.log(`📊 Updated usage stats for ${Object.keys(docUpdates).length} documents`);

    } catch (error) {
      console.error('❌ Error updating usage stats:', error.message);
      // Don't throw - this is non-critical
    }
  }

  /**
   * Search for similar content to a specific document chunk
   */
  async findSimilarContent(docId, chunkIndex, options = {}) {
    try {
      const { topK = 5, excludeSameDoc = true, sessionId } = options;

      // Get the content of the specified chunk with session context
      const filters = { docId };
      if (sessionId) filters.sessionId = sessionId;
      
      const results = await this.pineconeService.search('', filters, 1000);
      
      const targetChunk = results.results.find(
        result => result.chunkIndex === chunkIndex
      );

      if (!targetChunk) {
        throw new Error(`Chunk ${chunkIndex} not found in document ${docId}`);
      }

      // Search for similar content within the same session
      const similarResults = await this.search(targetChunk.text || targetChunk.content, {
        topK: topK + (excludeSameDoc ? 10 : 0), // Get extra results to filter
        sessionId: sessionId, // Ensure session isolation
        ...options
      });

      // Filter out results from the same document if requested
      let filteredResults = similarResults.results;
      if (excludeSameDoc) {
        filteredResults = filteredResults.filter(result => result.docId !== docId);
        filteredResults = filteredResults.slice(0, topK);
      }

      return {
        ...similarResults,
        results: filteredResults,
        sourceChunk: targetChunk,
        excludedSameDoc: excludeSameDoc
      };

    } catch (error) {
      console.error('❌ Error finding similar content:', error.message);
      throw error;
    }
  }

  /**
   * Get comprehensive document analysis
   */
  async analyzeDocument(docId, sessionId = null) {
    try {
      // Get document from MongoDB
      const document = await Document.findOne({ docId });
      if (!document) {
        throw new Error(`Document ${docId} not found`);
      }

      // Get all chunks from Pinecone with session context
      const filters = { docId };
      if (sessionId) filters.sessionId = sessionId;
      
      const allChunks = await this.pineconeService.search('', filters, 1000);

      // Analyze content patterns
      const analysis = {
        document: document,
        totalChunks: allChunks.results.length,
        averageChunkLength: allChunks.results.reduce((sum, chunk) => sum + (chunk.text || chunk.content).length, 0) / allChunks.results.length,
        contentSample: allChunks.results.slice(0, 3).map(chunk => ({
          chunkIndex: chunk.chunkIndex,
          content: this.generatePreview(chunk.text || chunk.content, 150),
          wordCount: chunk.wordCount
        })),
        keywords: document.keywords,
        topics: document.topics,
        usageStats: {
          queryCount: document.queryCount,
          averageRelevanceScore: document.averageRelevanceScore,
          lastAccessed: document.lastAccessed
        }
      };

      return analysis;

    } catch (error) {
      console.error('❌ Error analyzing document:', error.message);
      throw error;
    }
  }
}

module.exports = new Retriever();