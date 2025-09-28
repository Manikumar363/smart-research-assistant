const mongoose = require('mongoose');

/**
 * Live Source Schema - Tracks configured live data sources
 */
const liveSourceSchema = new mongoose.Schema({
  // Source identification
  sourceId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // User context
  userId: {
    type: String,
    required: true,
    index: true
  },
  
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  
  // Source configuration
  sourceName: {
    type: String,
    required: true
  },
  
  sourceType: {
    type: String,
    required: true,
    enum: ['weather', 'news', 'rss', 'api', 'social', 'custom'],
    index: true
  },
  
  sourceUrl: {
    type: String,
    required: true
  },
  
  // Data management settings
  maxEntries: {
    type: Number,
    default: 500,
    min: 1,
    max: 10000
  },
  
  ingestionInterval: {
    type: Number, // in seconds
    default: 300, // 5 minutes
    min: 60,     // 1 minute minimum
    max: 86400   // 24 hours maximum
  },
  
  // Source-specific configuration
  config: {
    // Weather API specific
    apiKey: String,
    cities: [String],
    
    // RSS/News specific
    feedUrl: String,
    categories: [String],
    
    // General API specific
    headers: mongoose.Schema.Types.Mixed,
    queryParams: mongoose.Schema.Types.Mixed,
    
    // Data extraction settings
    dataPath: String, // JSON path to extract data
    textFields: [String], // Fields to use for text content
  },
  
  // Status tracking
  status: {
    type: String,
    enum: ['active', 'paused', 'error', 'stopped'],
    default: 'active',
    index: true
  },
  
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  
  // Statistics
  stats: {
    totalEntries: {
      type: Number,
      default: 0
    },
    lastIngestion: Date,
    lastError: String,
    successfulIngestions: {
      type: Number,
      default: 0
    },
    failedIngestions: {
      type: Number,
      default: 0
    }
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  },
  
  lastIngestedAt: {
    type: Date,
    index: true
  }
}, {
  timestamps: true,
  collection: 'live_sources'
});

// Indexes for efficient queries
liveSourceSchema.index({ userId: 1, sessionId: 1 });
liveSourceSchema.index({ sourceType: 1, status: 1 });
liveSourceSchema.index({ isActive: 1, status: 1 });
liveSourceSchema.index({ 'stats.lastIngestion': 1 });

// Update the updatedAt field before saving
liveSourceSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Static methods for source management
liveSourceSchema.statics.findActiveSourcesForUser = function(userId, sessionId) {
  return this.find({
    userId: userId,
    sessionId: sessionId,
    isActive: true,
    status: { $in: ['active', 'paused'] }
  }).sort({ createdAt: -1 });
};

liveSourceSchema.statics.findSourcesReadyForIngestion = function() {
  const now = new Date();
  
  return this.find({
    isActive: true,
    status: 'active',
    $or: [
      { lastIngestedAt: { $exists: false } }, // Never ingested
      {
        $expr: {
          $gte: [
            { $subtract: [now, '$lastIngestedAt'] },
            { $multiply: ['$ingestionInterval', 1000] } // Convert seconds to milliseconds
          ]
        }
      }
    ]
  });
};

liveSourceSchema.statics.updateSourceStats = function(sourceId, stats) {
  return this.findOneAndUpdate(
    { sourceId: sourceId },
    {
      $set: {
        'stats.lastIngestion': new Date(),
        'stats.totalEntries': stats.totalEntries || 0,
        lastIngestedAt: new Date()
      },
      $inc: {
        'stats.successfulIngestions': stats.success ? 1 : 0,
        'stats.failedIngestions': stats.success ? 0 : 1
      }
    },
    { new: true }
  );
};

// Instance methods
liveSourceSchema.methods.updateLastIngestion = function(success = true, error = null) {
  this.stats.lastIngestion = new Date();
  this.lastIngestedAt = new Date();
  
  if (success) {
    this.stats.successfulIngestions += 1;
    this.status = 'active';
  } else {
    this.stats.failedIngestions += 1;
    this.stats.lastError = error;
    // Don't change status to error immediately - allow retries
  }
  
  return this.save();
};

liveSourceSchema.methods.incrementEntryCount = function() {
  this.stats.totalEntries += 1;
  return this.save();
};

liveSourceSchema.methods.activate = function() {
  this.isActive = true;
  this.status = 'active';
  return this.save();
};

liveSourceSchema.methods.deactivate = function() {
  this.isActive = false;
  this.status = 'stopped';
  return this.save();
};

liveSourceSchema.methods.pause = function() {
  this.status = 'paused';
  return this.save();
};

liveSourceSchema.methods.resume = function() {
  this.status = 'active';
  return this.save();
};

const LiveSource = mongoose.model('LiveSource', liveSourceSchema);

module.exports = LiveSource;