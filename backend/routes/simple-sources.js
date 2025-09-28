const express = require('express');
const { authenticateToken: authMiddleware } = require('../middleware/auth');
const User = require('../models/User');
const ResearchSession = require('../models/ResearchSession');

const router = express.Router();

// Simple source templates for weather and other APIs
const SIMPLE_TEMPLATES = {
  'weather-global': {
    name: 'Global Weather Data',
    type: 'weather_api',
    category: 'weather',
    description: 'Current weather conditions for major global cities'
  },
  'time-zones': {
    name: 'World Time Zones',
    type: 'time_api',
    category: 'time',
    description: 'Current time and timezone information for global cities'
  },
  'crypto-prices': {
    name: 'Cryptocurrency Prices',
    type: 'crypto_api',
    category: 'finance',
    description: 'Real-time cryptocurrency price data'
  },
  'quote-of-day': {
    name: 'Daily Inspirational Quotes',
    type: 'quote_api',
    category: 'inspiration',
    description: 'Daily motivational and inspirational quotes'
  }
};

/**
 * GET /api/simple-sources/templates
 * Get simple API source templates
 */
router.get('/templates', authMiddleware, async (req, res) => {
  try {
    console.log('📋 Fetching simple source templates');
    
    const templates = Object.entries(SIMPLE_TEMPLATES).map(([id, template]) => ({
      id,
      ...template
    }));

    res.json({
      success: true,
      templates,
      message: `${templates.length} simple source templates available`
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
 * GET /api/simple-sources/weather/cities
 * Get available weather cities
 */
router.get('/weather/cities', authMiddleware, async (req, res) => {
  try {
    console.log('🌍 Fetching weather cities');
    
    // Return static list of major cities for now
    const cities = [
      { id: 'london', name: 'London', country: 'UK', lat: 51.5074, lon: -0.1278 },
      { id: 'new_york', name: 'New York', country: 'USA', lat: 40.7128, lon: -74.0060 },
      { id: 'tokyo', name: 'Tokyo', country: 'Japan', lat: 35.6762, lon: 139.6503 },
      { id: 'sydney', name: 'Sydney', country: 'Australia', lat: -33.8688, lon: 151.2093 },
      { id: 'paris', name: 'Paris', country: 'France', lat: 48.8566, lon: 2.3522 }
    ];

    res.json({
      success: true,
      cities,
      total: cities.length,
      message: `${cities.length} weather cities available`
    });

  } catch (error) {
    console.error('❌ Failed to get weather cities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get weather cities',
      error: error.message
    });
  }
});

/**
 * POST /api/simple-sources/weather/ingest
 * Trigger weather data ingestion - redirects to Pathway
 */
router.post('/weather/ingest', authMiddleware, async (req, res) => {
  try {
    console.log('🌤️ Weather ingestion request - redirecting to Pathway service');

    res.json({
      success: true,
      message: 'Weather ingestion is now handled by Pathway service. Please use the Pathway configuration in the Live Sources interface.',
      redirectTo: 'pathway',
      sessionId: req.body.sessionId
    });

  } catch (error) {
    console.error('❌ Failed to handle weather ingestion request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to handle weather ingestion request',
      error: error.message
    });
  }
});

/**
 * POST /api/simple-sources/demo/ingest
 * Trigger demo data ingestion (mock data for testing)
 */
router.post('/demo/ingest', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { sessionId, sourceType = 'demo' } = req.body;

    console.log(`🎭 Demo ingestion triggered for user ${userId}, type: ${sourceType}`);

    // Get or create session
    let targetSessionId = sessionId;
    if (!targetSessionId) {
      const activeSessions = await ResearchSession.find({ 
        userId, 
        status: 'active' 
      }).sort({ lastAccessed: -1 }).limit(1);

      if (activeSessions.length > 0) {
        targetSessionId = activeSessions[0].sessionId;
      } else {
        const newSession = new ResearchSession({
          sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          userId,
          title: 'Demo Data Ingestion',
          status: 'active'
        });
        await newSession.save();
        targetSessionId = newSession.sessionId;
      }
    }

    // Generate mock data based on source type
    let result;
    switch (sourceType) {
      case 'weather':
        // Weather is now handled by Pathway - return message
        result = {
          sourceType: 'weather_pathway',
          message: 'Weather data is now handled by Pathway service',
          redirectTo: 'pathway',
          ingested: 0
        };
        break;
      case 'demo':
      default:
        result = await generateDemoData(userId, targetSessionId);
        break;
    }

    res.json({
      success: true,
      result,
      sessionId: targetSessionId,
      message: `Successfully ingested ${sourceType} data: ${result.ingested} items processed`
    });

  } catch (error) {
    console.error('❌ Failed to ingest demo data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to ingest demo data',
      error: error.message
    });
  }
});

/**
 * GET /api/simple-sources/status
 * Get simple ingestion status
 */
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    console.log(`📊 Getting simple sources status for user ${userId}`);

    // Get document count by source type
    const Document = require('../models/Document');
    const weatherDocs = await Document.countDocuments({
      userId,
      'metadata.sourceType': 'weather_api'
    });

    const demoDocs = await Document.countDocuments({
      userId,
      'metadata.sourceType': 'demo_data'
    });

    const status = {
      weatherSources: {
        available: 5, // Static list of major cities
        message: 'Weather data is now handled by Pathway service',
        redirectTo: 'pathway',
        lastUpdate: new Date().toISOString()
      },
      demoSources: {
        ingested: demoDocs,
        lastUpdate: new Date().toISOString()
      },
      totalDocuments: demoDocs
    };

    res.json({
      success: true,
      status,
      message: 'Simple sources status retrieved'
    });

  } catch (error) {
    console.error('❌ Failed to get simple sources status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get simple sources status',
      error: error.message
    });
  }
});

/**
 * Generate demo data for testing
 */
async function generateDemoData(userId, sessionId) {
  try {
    const Document = require('../models/Document');
    const FileProcessor = require('../utils/FileProcessor');
    const PineconeService = require('../services/PineconeService');
    const crypto = require('crypto');

    const demoItems = [
      {
        title: 'Introduction to Artificial Intelligence',
        content: `Artificial Intelligence (AI) represents one of the most significant technological advances of our time. AI systems can perform tasks that typically require human intelligence, such as learning, reasoning, problem-solving, and decision-making.

Key areas of AI include:
- Machine Learning: Algorithms that improve through experience
- Natural Language Processing: Understanding and generating human language
- Computer Vision: Interpreting and analyzing visual information
- Robotics: Creating intelligent machines that can interact with the physical world

AI applications are transforming industries including healthcare, finance, transportation, and entertainment. As AI technology continues to evolve, it promises to revolutionize how we work, communicate, and solve complex global challenges.

The future of AI holds tremendous potential for improving human life while also raising important questions about ethics, employment, and the role of technology in society.`,
        category: 'technology'
      },
      {
        title: 'Climate Change and Renewable Energy',
        content: `Climate change represents one of the most pressing challenges of our time, requiring urgent action and innovative solutions. The transition to renewable energy sources is a critical component of global efforts to reduce greenhouse gas emissions.

Renewable energy technologies include:
- Solar Power: Converting sunlight into electricity using photovoltaic cells
- Wind Energy: Harnessing wind power through turbines
- Hydroelectric Power: Generating electricity from flowing water
- Geothermal Energy: Utilizing heat from the Earth's core
- Biomass: Converting organic materials into energy

The benefits of renewable energy extend beyond environmental protection to include economic opportunities, energy independence, and improved public health. Countries around the world are investing heavily in clean energy infrastructure and developing policies to accelerate the transition away from fossil fuels.

Success in addressing climate change will require collaboration between governments, businesses, and individuals to implement sustainable solutions at scale.`,
        category: 'environment'
      },
      {
        title: 'The Future of Work and Remote Collaboration',
        content: `The COVID-19 pandemic fundamentally changed how we think about work, accelerating the adoption of remote and hybrid work models. This transformation has reshaped organizational culture, productivity metrics, and the tools we use to collaborate.

Key trends in the future of work include:
- Flexible Work Arrangements: Balancing remote and in-office work
- Digital Collaboration Tools: Platforms for communication and project management
- Asynchronous Work: Reducing dependence on real-time interaction
- Results-Oriented Performance: Focusing on outcomes rather than hours worked
- Employee Well-being: Prioritizing mental health and work-life balance

Organizations are discovering that remote work can increase productivity, reduce costs, and improve employee satisfaction when implemented effectively. However, challenges remain in maintaining company culture, fostering innovation, and ensuring equitable opportunities for all team members.

The future workplace will likely be more flexible, technology-enabled, and focused on human-centered design principles that prioritize both performance and well-being.`,
        category: 'business'
      }
    ];

    let ingested = 0;
    let errors = 0;

    for (const item of demoItems) {
      try {
        const docId = crypto.createHash('md5').update(`demo_${item.title}_${Date.now()}`).digest('hex');
        const contentHash = crypto.createHash('sha256').update(item.content).digest('hex');

        // Check if document already exists
        const existingDoc = await Document.findOne({
          userId,
          contentHash,
          'metadata.sourceType': 'demo_data'
        });

        if (existingDoc) {
          continue;
        }

        // Create document record
        const document = new Document({
          userId,
          sessionId,
          fileName: `demo_${item.title.toLowerCase().replace(/\s+/g, '_')}.txt`,
          originalName: item.title,
          fileSize: Buffer.byteLength(item.content, 'utf8'),
          contentType: 'text/plain',
          docId,
          processingStatus: 'processing',
          extractedText: item.content,
          contentHash,
          metadata: {
            sourceType: 'demo_data',
            demoData: {
              category: item.category,
              publishedAt: new Date().toISOString(),
              author: 'Demo System',
              description: 'Generated demo content for testing'
            }
          }
        });

        await document.save();

        // Process and vectorize content
        const chunks = FileProcessor.chunkText(item.content, 1000, 200);

        // Store in Pinecone
        await PineconeService.storeDocument(
          document.docId,
          chunks,
          {
            userId,
            sessionId,
            fileName: document.fileName,
            sourceType: 'demo_data',
            category: item.category,
            author: 'Demo System',
            publishedAt: new Date().toISOString()
          }
        );

        // Update document status
        document.processingStatus = 'completed';
        document.chunkCount = chunks.length;
        await document.save();

        ingested++;
        console.log(`✅ Ingested demo item: ${item.title}`);

      } catch (itemError) {
        console.error(`❌ Failed to ingest demo item "${item.title}":`, itemError.message);
        errors++;
      }
    }

    return {
      sourceType: 'demo_data',
      totalFetched: demoItems.length,
      newItems: demoItems.length,
      ingested,
      skipped: 0,
      errors
    };

  } catch (error) {
    console.error('❌ Failed to generate demo data:', error.message);
    throw error;
  }
}

module.exports = router;