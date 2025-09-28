const express = require('express');
const { authenticateToken: authMiddleware } = require('../middleware/auth');
const User = require('../models/User');
const ResearchSession = require('../models/ResearchSession');
const LiveSourceIngester = require('../services/LiveSourceIngester');

const router = express.Router();

// Initialize the global live source ingester
const liveIngester = new LiveSourceIngester();

// Predefined source templates for common feeds
const SOURCE_TEMPLATES = {
  'bbc-tech': {
    name: 'BBC Technology News',
    url: 'http://feeds.bbci.co.uk/news/technology/rss.xml',
    type: 'rss',
    category: 'technology',
    description: 'Latest technology news from BBC'
  },
  'techcrunch': {
    name: 'TechCrunch',
    url: 'https://techcrunch.com/feed/',
    type: 'rss',
    category: 'technology',
    description: 'Startup and technology news'
  },
  'reuters-tech': {
    name: 'Reuters Technology',
    url: 'https://www.reuters.com/technology',
    type: 'html',
    category: 'technology',
    description: 'Reuters technology news',
    selectors: {
      articleSelector: '[data-testid="Body"] article',
      titleSelector: '[data-testid="Heading"]',
      contentSelector: '[data-testid="paragraph"]',
      linkSelector: 'a[data-testid="Heading"]',
      dateSelector: 'time',
      authorSelector: '[data-testid="BylineBy"]'
    }
  },
  'hn-top': {
    name: 'Hacker News Top Stories',
    url: 'https://hnrss.org/frontpage',
    type: 'rss',
    category: 'technology',
    description: 'Top stories from Hacker News'
  },
  'mit-tech-review': {
    name: 'MIT Technology Review',
    url: 'https://www.technologyreview.com/feed/',
    type: 'rss',
    category: 'technology',
    description: 'MIT Technology Review articles'
  }
};

/**
 * GET /api/live-sources/templates
 * Get predefined source templates
 */
router.get('/templates', authMiddleware, async (req, res) => {
  try {
    console.log('📋 Fetching live source templates');
    
    const templates = Object.entries(SOURCE_TEMPLATES).map(([id, template]) => ({
      id,
      ...template
    }));

    res.json({
      success: true,
      templates,
      message: `${templates.length} source templates available`
    });

  } catch (error) {
    console.error('❌ Failed to get source templates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get source templates',
      error: error.message
    });
  }
});

/**
 * POST /api/live-sources/add
 * Add a new live source
 */
router.post('/add', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      templateId,
      customSource,
      enabled = true
    } = req.body;

    console.log(`📡 Adding live source for user ${userId}`);

    let sourceConfig;

    if (templateId && SOURCE_TEMPLATES[templateId]) {
      // Use predefined template
      const template = SOURCE_TEMPLATES[templateId];
      sourceConfig = {
        id: `${userId}_${templateId}_${Date.now()}`,
        ...template,
        enabled
      };
    } else if (customSource) {
      // Use custom source configuration
      const {
        name,
        url,
        type = 'rss',
        category = 'general',
        intervalMs,
        selectors
      } = customSource;

      if (!name || !url) {
        return res.status(400).json({
          success: false,
          message: 'Custom source requires name and url'
        });
      }

      sourceConfig = {
        id: `${userId}_custom_${Date.now()}`,
        name,
        url,
        type,
        category,
        intervalMs,
        selectors,
        enabled
      };
    } else {
      return res.status(400).json({
        success: false,
        message: 'Either templateId or customSource is required'
      });
    }

    // Add source to ingester
    const success = liveIngester.addSource(sourceConfig);

    if (success) {
      res.json({
        success: true,
        source: sourceConfig,
        message: `Live source "${sourceConfig.name}" added successfully`
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to add live source'
      });
    }

  } catch (error) {
    console.error('❌ Failed to add live source:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add live source',
      error: error.message
    });
  }
});

/**
 * GET /api/live-sources
 * Get all configured live sources
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    console.log(`📋 Fetching live sources for user ${userId}`);

    // Get all sources and filter by user
    const allSources = liveIngester.getSources();
    const userSources = allSources.filter(source => source.id.startsWith(userId));

    res.json({
      success: true,
      sources: userSources,
      total: userSources.length,
      message: `${userSources.length} live sources configured`
    });

  } catch (error) {
    console.error('❌ Failed to get live sources:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get live sources',
      error: error.message
    });
  }
});

/**
 * POST /api/live-sources/:sourceId/toggle
 * Enable/disable a live source
 */
router.post('/:sourceId/toggle', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { sourceId } = req.params;
    const { enabled } = req.body;

    console.log(`🔄 Toggling live source ${sourceId} for user ${userId}`);

    // Verify source belongs to user
    if (!sourceId.startsWith(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this source'
      });
    }

    const source = liveIngester.getSource(sourceId);
    if (!source) {
      return res.status(404).json({
        success: false,
        message: 'Live source not found'
      });
    }

    // Update source status
    source.enabled = enabled !== undefined ? enabled : !source.enabled;

    res.json({
      success: true,
      source,
      message: `Live source "${source.name}" ${source.enabled ? 'enabled' : 'disabled'}`
    });

  } catch (error) {
    console.error('❌ Failed to toggle live source:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle live source',
      error: error.message
    });
  }
});

/**
 * DELETE /api/live-sources/:sourceId
 * Remove a live source
 */
router.delete('/:sourceId', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { sourceId } = req.params;

    console.log(`🗑️ Removing live source ${sourceId} for user ${userId}`);

    // Verify source belongs to user
    if (!sourceId.startsWith(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this source'
      });
    }

    const success = liveIngester.removeSource(sourceId);

    if (success) {
      res.json({
        success: true,
        message: 'Live source removed successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Live source not found'
      });
    }

  } catch (error) {
    console.error('❌ Failed to remove live source:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove live source',
      error: error.message
    });
  }
});

/**
 * POST /api/live-sources/:sourceId/ingest
 * Manually trigger ingestion for a specific source
 */
router.post('/:sourceId/ingest', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { sourceId } = req.params;
    const { sessionId } = req.body;

    console.log(`🔄 Manual ingestion for source ${sourceId}, user ${userId}`);

    // Verify source belongs to user
    if (!sourceId.startsWith(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this source'
      });
    }

    // Get or create session if not provided
    let targetSessionId = sessionId;
    if (!targetSessionId) {
      const activeSessions = await ResearchSession.find({ 
        userId, 
        status: 'active' 
      }).sort({ lastAccessed: -1 }).limit(1);

      if (activeSessions.length > 0) {
        targetSessionId = activeSessions[0].sessionId;
      } else {
        // Create new session
        const newSession = new ResearchSession({
          sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          userId,
          title: 'Live Source Ingestion',
          status: 'active'
        });
        await newSession.save();
        targetSessionId = newSession.sessionId;
      }
    }

    // Process the source
    const result = await liveIngester.processSource(sourceId, userId, targetSessionId);

    res.json({
      success: true,
      result,
      sessionId: targetSessionId,
      message: `Ingested ${result.ingested} new items from "${result.sourceName}"`
    });

  } catch (error) {
    console.error('❌ Failed to ingest from live source:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to ingest from live source',
      error: error.message
    });
  }
});

/**
 * POST /api/live-sources/ingest-all
 * Trigger ingestion for all enabled sources
 */
router.post('/ingest-all', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { sessionId } = req.body;

    console.log(`🔄 Ingesting all live sources for user ${userId}`);

    // Get or create session if not provided
    let targetSessionId = sessionId;
    if (!targetSessionId) {
      const activeSessions = await ResearchSession.find({ 
        userId, 
        status: 'active' 
      }).sort({ lastAccessed: -1 }).limit(1);

      if (activeSessions.length > 0) {
        targetSessionId = activeSessions[0].sessionId;
      } else {
        // Create new session
        const newSession = new ResearchSession({
          sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          userId,
          title: 'Live Source Ingestion',
          status: 'active'
        });
        await newSession.save();
        targetSessionId = newSession.sessionId;
      }
    }

    // Get user's sources
    const allSources = liveIngester.getSources();
    const userSources = allSources.filter(source => 
      source.id.startsWith(userId) && source.enabled
    );

    if (userSources.length === 0) {
      return res.json({
        success: true,
        results: [],
        message: 'No enabled live sources found'
      });
    }

    // Process each source
    const results = [];
    for (const source of userSources) {
      try {
        const result = await liveIngester.processSource(source.id, userId, targetSessionId);
        results.push(result);
      } catch (error) {
        console.error(`❌ Failed to process source ${source.id}:`, error.message);
        results.push({
          sourceId: source.id,
          sourceName: source.name,
          error: error.message,
          ingested: 0,
          skipped: 0,
          errors: 1
        });
      }
    }

    // Calculate summary
    const summary = results.reduce((acc, r) => ({
      totalIngested: acc.totalIngested + (r.ingested || 0),
      totalSkipped: acc.totalSkipped + (r.skipped || 0),
      totalErrors: acc.totalErrors + (r.errors || 0),
      totalSources: acc.totalSources + 1
    }), { totalIngested: 0, totalSkipped: 0, totalErrors: 0, totalSources: 0 });

    res.json({
      success: true,
      results,
      summary,
      sessionId: targetSessionId,
      message: `Processed ${summary.totalSources} sources: ${summary.totalIngested} items ingested`
    });

  } catch (error) {
    console.error('❌ Failed to ingest all live sources:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to ingest all live sources',
      error: error.message
    });
  }
});

/**
 * GET /api/live-sources/status
 * Get status of all live sources
 */
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    console.log(`📊 Getting live source status for user ${userId}`);

    // Get user's sources
    const allSources = liveIngester.getSources();
    const userSources = allSources.filter(source => source.id.startsWith(userId));

    // Add ingestion history
    const sourcesWithHistory = userSources.map(source => {
      const history = liveIngester.ingestionHistory.get(source.id) || [];
      return {
        ...source,
        historyCount: history.length,
        lastIngestionItems: history.slice(-5).reverse() // Last 5 items
      };
    });

    const summary = {
      totalSources: userSources.length,
      enabledSources: userSources.filter(s => s.enabled).length,
      activeSources: userSources.filter(s => s.status === 'active').length,
      errorSources: userSources.filter(s => s.status === 'error').length,
      totalItems: userSources.reduce((sum, s) => sum + s.itemCount, 0)
    };

    res.json({
      success: true,
      sources: sourcesWithHistory,
      summary,
      message: `${userSources.length} live sources configured`
    });

  } catch (error) {
    console.error('❌ Failed to get live source status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get live source status',
      error: error.message
    });
  }
});

// Export both router and ingester instance
module.exports = { router, liveIngester };