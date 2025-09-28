const express = require('express');
const router = express.Router();
const pineconeService = require('../services/PineconeService');
const LiveSource = require('../models/LiveSource');
const { authenticateToken: auth } = require('../middleware/auth');

// Store Pathway configuration
let pathwayConfig = {
  isConfigured: false,
  apiKey: null,
  interval: 30,
  cities: ['New York', 'London'],
  sources: new Map() // Track active sources
};

/**
 * Configure Pathway service settings
 */
router.post('/configure', auth, async (req, res) => {
  try {
    const { apiKey, interval, cities, sources } = req.body;
    
    pathwayConfig = {
      ...pathwayConfig,
      isConfigured: true,
      apiKey: apiKey || pathwayConfig.apiKey,
      interval: interval || pathwayConfig.interval,
      cities: cities || pathwayConfig.cities
    };

    console.log('🔧 Pathway service configured:', {
      hasApiKey: !!pathwayConfig.apiKey,
      interval: pathwayConfig.interval,
      cities: pathwayConfig.cities.length
    });

    res.json({
      success: true,
      message: 'Pathway service configured successfully',
      config: {
        hasApiKey: !!pathwayConfig.apiKey,
        interval: pathwayConfig.interval,
        citiesCount: pathwayConfig.cities.length,
        isConfigured: pathwayConfig.isConfigured
      }
    });

  } catch (error) {
    console.error('❌ Error configuring Pathway service:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to configure Pathway service',
      error: error.message
    });
  }
});

/**
 * Register a new live source for data ingestion (TEST MODE - NO AUTH)
 */
router.post('/register-source-test', async (req, res) => {
  try {
    const {
      sourceName,
      sourceType,
      sourceUrl,
      maxEntries = 500,
      ingestionInterval = 300,
      config = {}
    } = req.body;

    // Use test user for demo
    const userId = 'test-user';
    const sessionId = 'test-session';

    // Generate unique source ID
    const sourceId = `${sourceType}_${userId}_${Date.now()}`;

    // Create live source record
    const liveSource = new LiveSource({
      sourceId,
      userId,
      sessionId,
      sourceName,
      sourceType,
      sourceUrl,
      maxEntries,
      ingestionInterval,
      config,
      status: 'active',
      isActive: true
    });

    await liveSource.save();

    // Add to pathway config
    pathwayConfig.sources.set(sourceId, {
      sourceId,
      sourceName,
      sourceType,
      sourceUrl,
      maxEntries,
      ingestionInterval,
      config,
      userId,
      sessionId,
      registeredAt: new Date()
    });

    console.log(`📡 Registered new live source (TEST MODE): ${sourceName} (${sourceType})`);

    res.json({
      success: true,
      message: 'Live source registered successfully (TEST MODE)',
      source: {
        sourceId,
        sourceName,
        sourceType,
        maxEntries,
        ingestionInterval,
        status: 'active'
      }
    });

  } catch (error) {
    console.error('❌ Error registering live source (TEST):', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register live source',
      error: error.message
    });
  }
});

/**
 * Register a new live source for data ingestion
 */
router.post('/register-source', auth, async (req, res) => {
  try {
    const {
      sourceName,
      sourceType,
      sourceUrl,
      maxEntries = 500,
      ingestionInterval = 300,
      config = {}
    } = req.body;

    const userId = req.user.userId;
    const sessionId = req.user.sessionId || 'default';

    // Generate unique source ID
    const sourceId = `${sourceType}_${userId}_${Date.now()}`;

    // Create live source record
    const liveSource = new LiveSource({
      sourceId,
      userId,
      sessionId,
      sourceName,
      sourceType,
      sourceUrl,
      maxEntries,
      ingestionInterval,
      config,
      status: 'active',
      isActive: true
    });

    await liveSource.save();

    // Add to pathway config
    pathwayConfig.sources.set(sourceId, {
      sourceId,
      sourceName,
      sourceType,
      sourceUrl,
      maxEntries,
      ingestionInterval,
      config,
      userId,
      sessionId,
      registeredAt: new Date()
    });

    console.log(`📡 Registered new live source: ${sourceName} (${sourceType})`);

    res.json({
      success: true,
      message: 'Live source registered successfully',
      source: {
        sourceId,
        sourceName,
        sourceType,
        maxEntries,
        ingestionInterval,
        status: 'active'
      }
    });

  } catch (error) {
    console.error('❌ Error registering live source:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register live source',
      error: error.message
    });
  }
});

/**
 * Get all registered sources for Pathway service (no auth required)
 */
router.get('/sources/active', async (req, res) => {
  try {
    // Find all sources regardless of status for now (quick fix)
    const sources = await LiveSource.find({});

    // Format sources for Pathway service
    const formattedSources = sources.map(source => ({
      sourceId: source.sourceId,
      sourceName: source.sourceName,
      sourceType: source.sourceType,
      sourceUrl: source.sourceUrl,
      maxEntries: source.maxEntries || 500,
      ingestionInterval: source.ingestionInterval || 300,
      config: source.config || {},
      userId: source.userId,
      sessionId: source.sessionId,
      status: 'active',        // Force active for demo
      isActive: true           // Force active for demo
    }));

    res.json({
      success: true,
      sources: formattedSources,
      count: formattedSources.length
    });

  } catch (error) {
    console.error('❌ Error fetching active sources for Pathway:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active sources',
      error: error.message
    });
  }
});

/**
 * Get all registered sources for user
 */
router.get('/sources', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const sessionId = req.user.sessionId || 'default';

    const sources = await LiveSource.findActiveSourcesForUser(userId, sessionId);

    // Get stats for each source
    const sourcesWithStats = await Promise.all(
      sources.map(async (source) => {
        const stats = await pineconeService.getLiveSourceStats(
          source.sourceId,
          sessionId
        );
        
        return {
          sourceId: source.sourceId,
          sourceName: source.sourceName,
          sourceType: source.sourceType,
          sourceUrl: source.sourceUrl,
          maxEntries: source.maxEntries,
          ingestionInterval: source.ingestionInterval,
          status: source.status,
          isActive: source.isActive,
          stats: {
            ...source.stats.toObject(),
            currentEntries: stats.entryCount,
            oldestEntry: stats.oldestEntry,
            newestEntry: stats.newestEntry
          },
          createdAt: source.createdAt,
          lastIngestedAt: source.lastIngestedAt
        };
      })
    );

    res.json({
      success: true,
      sources: sourcesWithStats,
      totalSources: sourcesWithStats.length
    });

  } catch (error) {
    console.error('❌ Error fetching sources:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sources',
      error: error.message
    });
  }
});

/**
 * Receive data from Pathway service with rolling window management
 */
router.post('/ingest', async (req, res) => {
  try {
    const { data, type, sourceId, timestamp } = req.body;
    
    if (!data) {
      return res.status(400).json({
        success: false,
        message: 'No data provided for ingestion'
      });
    }

    // Find the source configuration
    let source = null;
    if (sourceId) {
      source = await LiveSource.findOne({ sourceId: sourceId });
    }

    // If no source found, create a default entry (for backward compatibility)
    if (!source && sourceId) {
      console.log(`⚠️ Source ${sourceId} not found, creating default entry`);
      source = new LiveSource({
        sourceId: sourceId,
        userId: 'system',
        sessionId: 'default',
        sourceName: `Auto-created source (${type})`,
        sourceType: type || 'general',
        sourceUrl: 'auto-generated',
        maxEntries: 500,
        ingestionInterval: 300
      });
      await source.save();
    }

    const maxEntries = source ? source.maxEntries : 500;
    const sessionId = source ? source.sessionId : 'live-sources';

    // Store data with rolling window management
    const result = await pineconeService.storeLiveSourceData(
      sourceId || `default_${type}`,
      data,
      {
        sourceType: type,
        sourceUrl: source?.sourceUrl,
        sourceName: source?.sourceName,
        dataType: type,
        userId: source?.userId,
        sessionId: sessionId,
        timestamp: timestamp || new Date().toISOString()
      },
      maxEntries
    );

    // Update source statistics
    if (source) {
      await source.updateLastIngestion(true);
      await source.incrementEntryCount();
    }

    console.log(`✅ Ingested data for source ${sourceId || 'default'} with rolling window (max: ${maxEntries})`);

    res.json({
      success: true,
      message: 'Data ingested successfully with rolling window management',
      entryId: result.entryId,
      sourceId: result.sourceId,
      maxEntries: maxEntries,
      timestamp: result.timestamp
    });

  } catch (error) {
    console.error('❌ Error ingesting Pathway data:', error);
    
    // Update source error statistics
    if (req.body.sourceId) {
      try {
        const source = await LiveSource.findOne({ sourceId: req.body.sourceId });
        if (source) {
          await source.updateLastIngestion(false, error.message);
        }
      } catch (updateError) {
        console.error('❌ Error updating source stats:', updateError);
      }
    }

    res.status(500).json({
      success: false,
      message: 'Failed to ingest data',
      error: error.message
    });
  }
});

/**
 * Get Pathway service status
 */
router.get('/status', async (req, res) => {
  try {
    // Get index statistics
    const indexStats = await pineconeService.getIndexStats();
    
    // Get sources ready for ingestion
    const sourcesReady = await LiveSource.findSourcesReadyForIngestion();
    
    res.json({
      success: true,
      pathway: {
        configured: pathwayConfig.isConfigured,
        hasApiKey: !!pathwayConfig.apiKey,
        interval: pathwayConfig.interval,
        activeSources: pathwayConfig.sources.size,
        sourcesReadyForIngestion: sourcesReady.length
      },
      pinecone: {
        totalVectors: indexStats?.totalVectorCount || 0,
        indexFullness: indexStats?.indexFullness || 0,
        namespaces: indexStats?.namespaces || {}
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error getting Pathway status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get status',
      error: error.message
    });
  }
});

/**
 * Update source configuration
 */
router.put('/sources/:sourceId', auth, async (req, res) => {
  try {
    const { sourceId } = req.params;
    const updates = req.body;
    const userId = req.user.userId;

    const source = await LiveSource.findOne({ 
      sourceId: sourceId,
      userId: userId 
    });

    if (!source) {
      return res.status(404).json({
        success: false,
        message: 'Source not found'
      });
    }

    // Update allowed fields
    const allowedUpdates = ['sourceName', 'maxEntries', 'ingestionInterval', 'config', 'status'];
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        source[field] = updates[field];
      }
    });

    await source.save();

    // Update pathway config if needed
    if (pathwayConfig.sources.has(sourceId)) {
      const pathwaySource = pathwayConfig.sources.get(sourceId);
      pathwayConfig.sources.set(sourceId, {
        ...pathwaySource,
        ...updates,
        updatedAt: new Date()
      });
    }

    res.json({
      success: true,
      message: 'Source updated successfully',
      source: source
    });

  } catch (error) {
    console.error('❌ Error updating source:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update source',
      error: error.message
    });
  }
});

/**
 * Delete/deactivate a source
 */
router.delete('/sources/:sourceId', auth, async (req, res) => {
  try {
    const { sourceId } = req.params;
    const userId = req.user.userId;

    const source = await LiveSource.findOne({ 
      sourceId: sourceId,
      userId: userId 
    });

    if (!source) {
      return res.status(404).json({
        success: false,
        message: 'Source not found'
      });
    }

    // Deactivate the source
    await source.deactivate();

    // Remove from pathway config
    pathwayConfig.sources.delete(sourceId);

    res.json({
      success: true,
      message: 'Source deactivated successfully'
    });

  } catch (error) {
    console.error('❌ Error deactivating source:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to deactivate source',
      error: error.message
    });
  }
});

/**
 * Search live source data
 */
router.post('/search', auth, async (req, res) => {
  try {
    const { query, sourceId, sourceType, limit = 10 } = req.body;
    const userId = req.user.userId;
    const sessionId = req.user.sessionId || 'default';

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Query is required'
      });
    }

    const filters = {
      sessionId: sessionId,
      userId: userId
    };

    if (sourceId) filters.sourceId = sourceId;
    if (sourceType) filters.sourceType = sourceType;

    const searchResults = await pineconeService.searchLiveSourceData(
      query,
      filters,
      limit
    );

    res.json({
      success: true,
      ...searchResults
    });

  } catch (error) {
    console.error('❌ Error searching live source data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search live source data',
      error: error.message
    });
  }
});

module.exports = router;

/**
 * POST /api/pathway/ingest
 * Receive processed data from Pathway service
 */
router.post('/ingest', async (req, res) => {
  try {
    const {
      source_type,
      timestamp,
      data_count,
      weather_data,
      user_id,
      session_id
    } = req.body;

    console.log(`📡 Received Pathway data: ${source_type}, ${data_count} items`);

    // Use default user/session if not provided (for system ingestion)
    const targetUserId = user_id || 'system_pathway';
    let targetSessionId = session_id;

    // Create session if not provided
    if (!targetSessionId) {
      const newSession = new ResearchSession({
        sessionId: `pathway_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: targetUserId,
        title: `Pathway ${source_type} Ingestion`,
        status: 'active'
      });
      await newSession.save();
      targetSessionId = newSession.sessionId;
    }

    let ingested = 0;
    let skipped = 0;
    let errors = 0;

    // Process weather data
    if (source_type === 'pathway_weather' && weather_data) {
      for (const weatherItem of weather_data) {
        try {
          // Generate content from weather data
          const content = formatWeatherContent(weatherItem);
          const contentHash = crypto.createHash('sha256').update(content).digest('hex');

          // Check if document already exists
          const existingDoc = await Document.findOne({
            userId: targetUserId,
            contentHash,
            'metadata.sourceType': 'pathway_weather'
          });

          if (existingDoc) {
            skipped++;
            continue;
          }

          // Create document record
          const document = new Document({
            userId: targetUserId,
            sessionId: targetSessionId,
            fileName: `weather_${weatherItem.city}_${Date.now()}.txt`,
            originalName: `Weather Report: ${weatherItem.city}`,
            fileSize: Buffer.byteLength(content, 'utf8'),
            contentType: 'text/plain',
            docId: weatherItem.id,
            processingStatus: 'processing',
            extractedText: content,
            contentHash,
            metadata: {
              sourceType: 'pathway_weather',
              pathwayData: {
                city: weatherItem.city,
                country: weatherItem.country,
                coordinates: weatherItem.coordinates,
                temperature: weatherItem.temperature.current,
                condition: weatherItem.weather.main,
                description: weatherItem.weather.description,
                humidity: weatherItem.humidity,
                pressure: weatherItem.pressure,
                windSpeed: weatherItem.wind.speed,
                timestamp: weatherItem.timestamp,
                source: weatherItem.source
              }
            }
          });

          await document.save();

          // Process and vectorize content
          const chunks = FileProcessor.chunkText(content, 1000, 200);

          // Store in Pinecone
          await PineconeService.storeDocument(
            document.docId,
            chunks,
            {
              userId: targetUserId,
              sessionId: targetSessionId,
              fileName: document.fileName,
              sourceType: 'pathway_weather',
              city: weatherItem.city,
              country: weatherItem.country,
              temperature: weatherItem.temperature.current,
              condition: weatherItem.weather.main,
              timestamp: weatherItem.timestamp,
              source: weatherItem.source
            }
          );

          // Update document status
          document.processingStatus = 'completed';
          document.chunkCount = chunks.length;
          await document.save();

          ingested++;
          console.log(`✅ Ingested Pathway weather data: ${weatherItem.city}`);

        } catch (itemError) {
          console.error(`❌ Failed to ingest weather item for ${weatherItem.city}:`, itemError.message);
          errors++;
        }
      }
    }

    const result = {
      sourceType: source_type,
      timestamp,
      totalReceived: data_count,
      ingested,
      skipped,
      errors,
      sessionId: targetSessionId
    };

    console.log(`📊 Pathway ingestion complete:`, result);

    res.json({
      success: true,
      result,
      message: `Pathway ingestion completed: ${ingested} items processed`
    });

  } catch (error) {
    console.error('❌ Failed to process Pathway data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process Pathway data',
      error: error.message
    });
  }
});

/**
 * GET /api/pathway/status
 * Get Pathway service status
 */
router.get('/status', async (req, res) => {
  try {
    console.log('📊 Getting Pathway status');

    // Count Pathway-ingested documents
    const pathwayDocs = await Document.countDocuments({
      'metadata.sourceType': 'pathway_weather'
    });

    // Get recent Pathway documents
    const recentDocs = await Document.find({
      'metadata.sourceType': 'pathway_weather'
    })
    .sort({ createdAt: -1 })
    .limit(10)
    .select('originalName createdAt metadata.pathwayData.city metadata.pathwayData.temperature');

    const status = {
      pathwayIntegration: {
        enabled: true,
        totalDocuments: pathwayDocs,
        lastUpdate: recentDocs.length > 0 ? recentDocs[0].createdAt : null,
        recentCities: recentDocs.map(doc => ({
          city: doc.metadata.pathwayData?.city,
          temperature: doc.metadata.pathwayData?.temperature,
          timestamp: doc.createdAt
        }))
      },
      serviceStatus: 'running', // This could be enhanced to actually check Pathway service
      integrationHealth: pathwayDocs > 0 ? 'healthy' : 'no_data'
    };

    res.json({
      success: true,
      status,
      message: 'Pathway status retrieved'
    });

  } catch (error) {
    console.error('❌ Failed to get Pathway status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get Pathway status',
      error: error.message
    });
  }
});

/**
 * POST /api/pathway/configure
 * Configure Pathway service settings
 */
router.post('/configure', auth, async (req, res) => {
  try {
    const {
      weatherApiKey,
      ingestionInterval,
      enabledCities,
      userId
    } = req.body;

    console.log(`⚙️ Configuring Pathway service for user ${userId || req.user.userId}`);

    // Here you would typically send configuration to the Pathway service
    // For now, we'll store it in a configuration object or database

    const configuration = {
      userId: userId || req.user.userId,
      weatherApiKey,
      ingestionInterval: ingestionInterval || 300,
      enabledCities: enabledCities || ['New York', 'London', 'Tokyo'],
      updatedAt: new Date().toISOString()
    };

    // In a real implementation, you would:
    // 1. Store this configuration in a database
    // 2. Send it to the Pathway service via API/message queue
    // 3. Restart or reconfigure the Pathway service

    res.json({
      success: true,
      configuration,
      message: 'Pathway service configured successfully'
    });

  } catch (error) {
    console.error('❌ Failed to configure Pathway service:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to configure Pathway service',
      error: error.message
    });
  }
});

/**
 * Format weather data into readable content
 */
function formatWeatherContent(weatherData) {
  const {
    city,
    country,
    weather,
    temperature,
    pressure,
    humidity,
    wind,
    timestamp
  } = weatherData;

  return `Weather Report for ${city}, ${country}

Generated by Pathway Real-time Weather Service
Report Time: ${new Date(timestamp).toLocaleString()}

Current Conditions:
- Weather: ${weather.main} (${weather.description})
- Temperature: ${temperature.current}°C (feels like ${temperature.feels_like}°C)
- Temperature Range: ${temperature.min}°C to ${temperature.max}°C
- Humidity: ${humidity}%
- Atmospheric Pressure: ${pressure} hPa
- Wind: ${wind.speed} m/s from ${wind.deg}°

Weather Summary:
${city} is currently experiencing ${weather.description} with a temperature of ${temperature.current}°C. The atmospheric conditions show ${humidity}% humidity and ${pressure} hPa pressure. Wind conditions are ${wind.speed < 5 ? 'calm' : wind.speed < 10 ? 'moderate' : 'strong'} with speeds of ${wind.speed} meters per second.

This real-time weather data is provided through Pathway's live data ingestion pipeline, ensuring up-to-date meteorological information for research and analysis purposes. The data includes comprehensive atmospheric measurements useful for weather pattern analysis, climate research, and environmental monitoring.

Data Source: ${weatherData.source}
Location Coordinates: ${weatherData.coordinates.lat}, ${weatherData.coordinates.lon}
Report ID: ${weatherData.id}

---
This report was automatically generated and ingested through the Pathway real-time data processing pipeline.`;
}

module.exports = router;