const axios = require('axios');
const { parseStringPromise } = require('xml2js');
const cheerio = require('cheerio');
const crypto = require('crypto');

/**
 * Live Source Ingestion Module
 * Handles incremental ingestion of live sources like news feeds, blogs, and articles
 */
class LiveSourceIngester {
  constructor() {
    this.sources = new Map(); // Store configured sources
    this.ingestionHistory = new Map(); // Track ingestion status
    this.batchSize = 10; // Maximum items to process in one batch
    this.intervalMs = 15 * 60 * 1000; // 15 minutes default
    
    console.log('📡 LiveSourceIngester initialized');
  }

  /**
   * Add a new live source for monitoring
   * @param {Object} sourceConfig - Source configuration
   * @param {string} sourceConfig.id - Unique identifier for the source
   * @param {string} sourceConfig.name - Human-readable name
   * @param {string} sourceConfig.url - RSS/feed URL or website URL
   * @param {string} sourceConfig.type - 'rss' | 'atom' | 'html' | 'api'
   * @param {string} sourceConfig.category - Content category (tech, news, finance, etc.)
   * @param {number} sourceConfig.intervalMs - How often to check (optional)
   * @param {Object} sourceConfig.selectors - CSS selectors for HTML parsing (optional)
   * @returns {boolean} - Success status
   */
  addSource(sourceConfig) {
    try {
      const {
        id,
        name,
        url,
        type = 'rss',
        category = 'general',
        intervalMs = this.intervalMs,
        selectors = {},
        enabled = true
      } = sourceConfig;

      if (!id || !name || !url) {
        throw new Error('Source requires id, name, and url');
      }

      const source = {
        id,
        name,
        url,
        type,
        category,
        intervalMs,
        selectors,
        enabled,
        addedAt: new Date(),
        lastChecked: null,
        lastIngested: null,
        itemCount: 0,
        errorCount: 0,
        status: 'active'
      };

      this.sources.set(id, source);
      this.ingestionHistory.set(id, []);

      console.log(`✅ Added live source: ${name} (${type}) - ${url}`);
      return true;

    } catch (error) {
      console.error(`❌ Failed to add source:`, error.message);
      return false;
    }
  }

  /**
   * Remove a live source
   * @param {string} sourceId - Source ID to remove
   * @returns {boolean} - Success status
   */
  removeSource(sourceId) {
    try {
      if (this.sources.has(sourceId)) {
        const source = this.sources.get(sourceId);
        this.sources.delete(sourceId);
        this.ingestionHistory.delete(sourceId);
        console.log(`🗑️ Removed live source: ${source.name}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`❌ Failed to remove source:`, error.message);
      return false;
    }
  }

  /**
   * Get all configured sources
   * @returns {Array} - Array of source configurations
   */
  getSources() {
    return Array.from(this.sources.values());
  }

  /**
   * Get source by ID
   * @param {string} sourceId - Source ID
   * @returns {Object|null} - Source configuration or null
   */
  getSource(sourceId) {
    return this.sources.get(sourceId) || null;
  }

  /**
   * Fetch content from RSS/Atom feed
   * @param {Object} source - Source configuration
   * @returns {Promise<Array>} - Array of parsed items
   */
  async fetchRSSFeed(source) {
    try {
      console.log(`📡 Fetching RSS feed: ${source.url}`);
      
      const response = await axios.get(source.url, {
        timeout: 30000,
        headers: {
          'User-Agent': 'Research-Assistant-Bot/1.0'
        }
      });

      const feedData = await parseStringPromise(response.data);
      const items = [];

      // Handle RSS format
      if (feedData.rss && feedData.rss.channel && feedData.rss.channel[0].item) {
        const rssItems = feedData.rss.channel[0].item;
        
        for (const item of rssItems.slice(0, this.batchSize)) {
          const parsedItem = {
            id: this.generateItemId(item.link?.[0] || item.guid?.[0] || item.title?.[0]),
            title: item.title?.[0] || 'Untitled',
            content: item.description?.[0] || item['content:encoded']?.[0] || '',
            url: item.link?.[0] || '',
            publishedAt: item.pubDate?.[0] ? new Date(item.pubDate[0]) : new Date(),
            author: item.author?.[0] || item['dc:creator']?.[0] || 'Unknown',
            category: item.category?.[0] || source.category,
            source: source.name,
            sourceId: source.id,
            sourceType: 'rss'
          };

          // Clean HTML from content
          parsedItem.content = this.cleanHTML(parsedItem.content);
          items.push(parsedItem);
        }
      }

      // Handle Atom format
      if (feedData.feed && feedData.feed.entry) {
        const atomItems = feedData.feed.entry;
        
        for (const item of atomItems.slice(0, this.batchSize)) {
          const parsedItem = {
            id: this.generateItemId(item.link?.[0]?.$.href || item.id?.[0] || item.title?.[0]),
            title: item.title?.[0] || 'Untitled',
            content: item.content?.[0] || item.summary?.[0] || '',
            url: item.link?.[0]?.$.href || '',
            publishedAt: item.published?.[0] ? new Date(item.published[0]) : new Date(),
            author: item.author?.[0]?.name?.[0] || 'Unknown',
            category: source.category,
            source: source.name,
            sourceId: source.id,
            sourceType: 'atom'
          };

          // Clean HTML from content
          parsedItem.content = this.cleanHTML(parsedItem.content);
          items.push(parsedItem);
        }
      }

      console.log(`📰 Fetched ${items.length} items from ${source.name}`);
      return items;

    } catch (error) {
      console.error(`❌ Failed to fetch RSS feed ${source.url}:`, error.message);
      throw error;
    }
  }

  /**
   * Fetch content from HTML webpage
   * @param {Object} source - Source configuration with selectors
   * @returns {Promise<Array>} - Array of parsed items
   */
  async fetchHTMLContent(source) {
    try {
      console.log(`🌐 Fetching HTML content: ${source.url}`);
      
      const response = await axios.get(source.url, {
        timeout: 30000,
        headers: {
          'User-Agent': 'Research-Assistant-Bot/1.0'
        }
      });

      const $ = cheerio.load(response.data);
      const items = [];
      
      const {
        articleSelector = 'article',
        titleSelector = 'h1, h2, .title',
        contentSelector = '.content, .article-body, p',
        linkSelector = 'a',
        dateSelector = '.date, time',
        authorSelector = '.author, .byline'
      } = source.selectors;

      // Find article containers
      $(articleSelector).each((index, element) => {
        if (index >= this.batchSize) return false; // Limit batch size

        const $article = $(element);
        
        const title = $article.find(titleSelector).first().text().trim() || 'Untitled';
        const content = $article.find(contentSelector).text().trim() || '';
        const link = $article.find(linkSelector).first().attr('href') || source.url;
        const dateText = $article.find(dateSelector).first().text().trim();
        const author = $article.find(authorSelector).first().text().trim() || 'Unknown';

        // Convert relative URLs to absolute
        const absoluteUrl = new URL(link, source.url).href;

        const parsedItem = {
          id: this.generateItemId(absoluteUrl || title),
          title,
          content: this.cleanHTML(content),
          url: absoluteUrl,
          publishedAt: this.parseDate(dateText) || new Date(),
          author,
          category: source.category,
          source: source.name,
          sourceId: source.id,
          sourceType: 'html'
        };

        if (title && content) {
          items.push(parsedItem);
        }
      });

      console.log(`🌐 Fetched ${items.length} items from ${source.name}`);
      return items;

    } catch (error) {
      console.error(`❌ Failed to fetch HTML content ${source.url}:`, error.message);
      throw error;
    }
  }

  /**
   * Process a single source - fetch and ingest new content
   * @param {string} sourceId - Source ID to process
   * @param {string} userId - User ID for content attribution
   * @param {string} sessionId - Session ID for content attribution
   * @returns {Promise<Object>} - Processing results
   */
  async processSource(sourceId, userId, sessionId) {
    try {
      const source = this.sources.get(sourceId);
      if (!source || !source.enabled) {
        throw new Error(`Source ${sourceId} not found or disabled`);
      }

      console.log(`🔄 Processing live source: ${source.name}`);
      source.lastChecked = new Date();

      let items = [];

      // Fetch content based on source type
      switch (source.type) {
        case 'rss':
        case 'atom':
          items = await this.fetchRSSFeed(source);
          break;
        case 'html':
          items = await this.fetchHTMLContent(source);
          break;
        default:
          throw new Error(`Unsupported source type: ${source.type}`);
      }

      // Filter out already processed items
      const history = this.ingestionHistory.get(sourceId) || [];
      const processedIds = new Set(history.map(h => h.itemId));
      const newItems = items.filter(item => !processedIds.has(item.id));

      if (newItems.length === 0) {
        console.log(`ℹ️ No new items found for ${source.name}`);
        return {
          sourceId,
          sourceName: source.name,
          totalFetched: items.length,
          newItems: 0,
          ingested: 0,
          skipped: 0,
          errors: 0
        };
      }

      console.log(`📥 Found ${newItems.length} new items for ${source.name}`);

      // Ingest new items into the system
      const results = await this.ingestItems(newItems, userId, sessionId);

      // Update source statistics
      source.itemCount += results.ingested;
      source.lastIngested = new Date();

      // Record ingestion history
      for (const item of newItems) {
        history.push({
          itemId: item.id,
          title: item.title,
          ingestedAt: new Date(),
          status: 'success'
        });
      }

      // Keep only last 1000 history entries
      if (history.length > 1000) {
        history.splice(0, history.length - 1000);
      }

      this.ingestionHistory.set(sourceId, history);

      console.log(`✅ Processed ${source.name}: ${results.ingested} items ingested`);

      return {
        sourceId,
        sourceName: source.name,
        totalFetched: items.length,
        newItems: newItems.length,
        ...results
      };

    } catch (error) {
      console.error(`❌ Failed to process source ${sourceId}:`, error.message);
      
      // Update error count
      const source = this.sources.get(sourceId);
      if (source) {
        source.errorCount++;
        source.status = source.errorCount > 5 ? 'error' : 'active';
      }

      throw error;
    }
  }

  /**
   * Ingest items into the document system
   * @param {Array} items - Items to ingest
   * @param {string} userId - User ID
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} - Ingestion results
   */
  async ingestItems(items, userId, sessionId) {
    try {
      const Document = require('../models/Document');
      const FileProcessor = require('../utils/FileProcessor');
      const PineconeService = require('./PineconeService');

      let ingested = 0;
      let skipped = 0;
      let errors = 0;

      for (const item of items) {
        try {
          // Check if document already exists
          const existingDoc = await Document.findOne({
            userId,
            originalName: item.title,
            contentHash: this.generateContentHash(item.content)
          });

          if (existingDoc) {
            skipped++;
            continue;
          }

          // Create document record
          const document = new Document({
            userId,
            sessionId,
            fileName: `${item.source}_${item.title.substring(0, 50)}.txt`,
            originalName: item.title,
            fileSize: Buffer.byteLength(item.content, 'utf8'),
            contentType: 'text/plain',
            docId: this.generateItemId(item.url + item.title),
            processingStatus: 'processing',
            extractedText: item.content,
            contentHash: this.generateContentHash(item.content),
            metadata: {
              sourceType: 'live_ingestion',
              liveSource: {
                sourceId: item.sourceId,
                sourceName: item.source,
                sourceType: item.sourceType,
                originalUrl: item.url,
                author: item.author,
                publishedAt: item.publishedAt,
                category: item.category
              }
            }
          });

          await document.save();

          // Process and vectorize content
          const chunks = FileProcessor.chunkText(item.content, 1000, 200);
          console.log(`📄 Processing ${chunks.length} chunks for: ${item.title}`);

          // Store in Pinecone
          await PineconeService.storeDocument(
            document.docId,
            chunks,
            {
              userId,
              sessionId,
              fileName: document.fileName,
              sourceType: 'live_ingestion',
              sourceId: item.sourceId,
              sourceName: item.source,
              category: item.category,
              author: item.author,
              publishedAt: item.publishedAt.toISOString(),
              url: item.url
            }
          );

          // Update document status
          document.processingStatus = 'completed';
          document.chunkCount = chunks.length;
          await document.save();

          ingested++;
          console.log(`✅ Ingested: ${item.title}`);

        } catch (itemError) {
          console.error(`❌ Failed to ingest item "${item.title}":`, itemError.message);
          errors++;
        }
      }

      return { ingested, skipped, errors };

    } catch (error) {
      console.error('❌ Failed to ingest items:', error.message);
      throw error;
    }
  }

  /**
   * Process all enabled sources
   * @param {string} userId - User ID
   * @param {string} sessionId - Session ID
   * @returns {Promise<Array>} - Array of processing results
   */
  async processAllSources(userId, sessionId) {
    const results = [];
    const enabledSources = Array.from(this.sources.values()).filter(s => s.enabled);

    console.log(`🔄 Processing ${enabledSources.length} live sources`);

    for (const source of enabledSources) {
      try {
        const result = await this.processSource(source.id, userId, sessionId);
        results.push(result);
      } catch (error) {
        console.error(`❌ Failed to process source ${source.id}:`, error.message);
        results.push({
          sourceId: source.id,
          sourceName: source.name,
          error: error.message,
          totalFetched: 0,
          newItems: 0,
          ingested: 0,
          skipped: 0,
          errors: 1
        });
      }
    }

    return results;
  }

  /**
   * Start periodic ingestion for all sources
   * @param {string} userId - Default user ID
   * @param {string} sessionId - Default session ID
   */
  startPeriodicIngestion(userId, sessionId) {
    console.log(`🕒 Starting periodic live source ingestion (every ${this.intervalMs / 60000} minutes)`);
    
    this.ingestionInterval = setInterval(async () => {
      try {
        console.log('🔄 Running periodic live source ingestion...');
        const results = await this.processAllSources(userId, sessionId);
        
        const summary = results.reduce((acc, r) => ({
          totalIngested: acc.totalIngested + (r.ingested || 0),
          totalSkipped: acc.totalSkipped + (r.skipped || 0),
          totalErrors: acc.totalErrors + (r.errors || 0)
        }), { totalIngested: 0, totalSkipped: 0, totalErrors: 0 });
        
        console.log(`📊 Periodic ingestion complete: ${summary.totalIngested} ingested, ${summary.totalSkipped} skipped, ${summary.totalErrors} errors`);
        
      } catch (error) {
        console.error('❌ Periodic ingestion failed:', error.message);
      }
    }, this.intervalMs);
  }

  /**
   * Stop periodic ingestion
   */
  stopPeriodicIngestion() {
    if (this.ingestionInterval) {
      clearInterval(this.ingestionInterval);
      this.ingestionInterval = null;
      console.log('⏹️ Stopped periodic live source ingestion');
    }
  }

  /**
   * Utility: Generate unique ID for an item
   * @param {string} content - Content to hash
   * @returns {string} - Unique ID
   */
  generateItemId(content) {
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * Utility: Generate content hash
   * @param {string} content - Content to hash
   * @returns {string} - Content hash
   */
  generateContentHash(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Utility: Clean HTML tags from content
   * @param {string} html - HTML content
   * @returns {string} - Clean text
   */
  cleanHTML(html) {
    if (!html) return '';
    
    // Remove HTML tags
    const cleaned = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();

    return cleaned;
  }

  /**
   * Utility: Parse date from various formats
   * @param {string} dateString - Date string
   * @returns {Date|null} - Parsed date or null
   */
  parseDate(dateString) {
    if (!dateString) return null;
    
    try {
      // Try common date formats
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return date;
      }
      
      // Try regex patterns for common formats
      const patterns = [
        /(\d{4})-(\d{2})-(\d{2})/, // YYYY-MM-DD
        /(\d{2})\/(\d{2})\/(\d{4})/, // MM/DD/YYYY
        /(\d{2})-(\d{2})-(\d{4})/, // MM-DD-YYYY
      ];
      
      for (const pattern of patterns) {
        const match = dateString.match(pattern);
        if (match) {
          const date = new Date(match[0]);
          if (!isNaN(date.getTime())) {
            return date;
          }
        }
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }
}

module.exports = LiveSourceIngester;