const mongoose = require('mongoose');

const DocumentSchema = new mongoose.Schema({
  // Primary document identification - same as Pinecone metadata
  docId: {
    type: String,
    required: true,
    unique: true,
    // Format: `${sessionId}_${fileName}_${timestamp}`
  },
  
  // Basic document information
  fileName: {
    type: String,
    required: true
  },
  originalName: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  uploadDate: {
    type: Date,
    default: Date.now
  },
  
  // User and session context
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ResearchSession',
    required: true
  },
  
  // Pinecone integration metadata
  pineconeNamespace: {
    type: String,
    default: 'default'
  },
  pineconeIds: [{
    type: String
  }], // Array of all chunk IDs stored in Pinecone
  embeddingModel: {
    type: String,
    default: 'text-embedding-ada-002'
  },
  
  // Document processing data
  extractedText: {
    type: String,
    default: ''
  },
  totalChunks: {
    type: Number,
    default: 0
  },
  chunkSize: {
    type: Number,
    default: 1000
  },
  processingStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  processingError: {
    type: String,
    default: null
  },
  
  // AI-generated metadata for search optimization
  summary: {
    type: String,
    default: ''
  },
  keywords: [{
    type: String
  }],
  topics: [{
    type: String
  }],
  
  // Usage analytics
  queryCount: {
    type: Number,
    default: 0
  },
  lastAccessed: {
    type: Date,
    default: Date.now
  },
  averageRelevanceScore: {
    type: Number,
    default: 0
  },
  
  // Content metadata
  pageCount: {
    type: Number,
    default: 0
  },
  wordCount: {
    type: Number,
    default: 0
  },
  language: {
    type: String,
    default: 'en'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
DocumentSchema.index({ docId: 1 });
DocumentSchema.index({ userId: 1, sessionId: 1 });
DocumentSchema.index({ processingStatus: 1 });
DocumentSchema.index({ uploadDate: -1 });
DocumentSchema.index({ queryCount: -1 });

// Virtual for file size in human readable format
DocumentSchema.virtual('fileSizeFormatted').get(function() {
  const bytes = this.fileSize;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
});

// Virtual for processing duration
DocumentSchema.virtual('processingDuration').get(function() {
  if (this.processingStatus !== 'completed') return null;
  return this.updatedAt - this.createdAt;
});

// Static method to generate consistent document ID
DocumentSchema.statics.generateDocId = function(sessionId, fileName, timestamp = Date.now()) {
  const cleanFileName = fileName.replace(/[^a-zA-Z0-9]/g, '_');
  return `${sessionId}_${cleanFileName}_${timestamp}`;
};

// Static method to generate chunk ID
DocumentSchema.statics.generateChunkId = function(docId, chunkIndex) {
  return `${docId}_chunk_${chunkIndex}`;
};

// Instance method to update usage statistics
DocumentSchema.methods.updateUsage = function(relevanceScore = null) {
  this.queryCount += 1;
  this.lastAccessed = new Date();
  
  if (relevanceScore !== null) {
    // Update average relevance score
    const totalScore = this.averageRelevanceScore * (this.queryCount - 1) + relevanceScore;
    this.averageRelevanceScore = totalScore / this.queryCount;
  }
  
  return this.save();
};

// Instance method to mark processing as completed
DocumentSchema.methods.markProcessingComplete = function(metadata = {}) {
  this.processingStatus = 'completed';
  this.totalChunks = metadata.totalChunks || this.totalChunks;
  this.pineconeIds = metadata.pineconeIds || this.pineconeIds;
  this.extractedText = metadata.extractedText || this.extractedText;
  this.wordCount = metadata.wordCount || this.wordCount;
  this.pageCount = metadata.pageCount || this.pageCount;
  
  return this.save();
};

// Instance method to mark processing as failed
DocumentSchema.methods.markProcessingFailed = function(error) {
  this.processingStatus = 'failed';
  this.processingError = error.message || error;
  
  return this.save();
};

// Pre-save middleware to update modification timestamp and set namespace
DocumentSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.updatedAt = new Date();
  }
  
  // Automatically set pineconeNamespace to sessionId for session isolation
  if (this.sessionId && (!this.pineconeNamespace || this.pineconeNamespace === 'default')) {
    this.pineconeNamespace = this.sessionId.toString();
  }
  
  next();
});

module.exports = mongoose.model('Document', DocumentSchema);