const mongoose = require('mongoose');

const conversationThreadSchema = new mongoose.Schema({
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
    ref: 'ResearchSession'
  },
  threadId: {
    type: String,
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
    ref: 'User'
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'reset'],
    default: 'active',
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  lastUsedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  messageCount: {
    type: Number,
    default: 0
  },
  metadata: {
    purpose: {
      type: String,
      default: 'query_refinement'
    },
    azureThreadId: String, // Original Azure thread ID if different
    fallbackMode: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true,
  collection: 'conversation_threads'
});

// Compound indexes for efficient queries
conversationThreadSchema.index({ userId: 1, sessionId: 1 }, { unique: true });
conversationThreadSchema.index({ threadId: 1 }, { unique: true });
conversationThreadSchema.index({ status: 1, lastUsedAt: 1 });

// Instance methods
conversationThreadSchema.methods.updateLastUsed = function() {
  this.lastUsedAt = new Date();
  this.messageCount += 1;
  return this.save();
};

conversationThreadSchema.methods.markAsReset = function() {
  this.status = 'reset';
  return this.save();
};

conversationThreadSchema.methods.markAsExpired = function() {
  this.status = 'expired';
  return this.save();
};

// Static methods
conversationThreadSchema.statics.findBySession = function(sessionId) {
  return this.findOne({ sessionId, status: 'active' });
};

conversationThreadSchema.statics.findByUser = function(userId) {
  return this.find({ userId, status: 'active' }).sort({ lastUsedAt: -1 });
};

conversationThreadSchema.statics.findByThread = function(threadId) {
  return this.findOne({ threadId, status: 'active' });
};

conversationThreadSchema.statics.cleanupExpired = function(maxAge = 24 * 60 * 60 * 1000) {
  const cutoffDate = new Date(Date.now() - maxAge);
  return this.updateMany(
    { 
      lastUsedAt: { $lt: cutoffDate },
      status: 'active'
    },
    { 
      status: 'expired' 
    }
  );
};

// Pre-save hooks
conversationThreadSchema.pre('save', function(next) {
  if (this.isNew) {
    this.lastUsedAt = new Date();
  }
  next();
});

const ConversationThread = mongoose.model('ConversationThread', conversationThreadSchema);

module.exports = ConversationThread;