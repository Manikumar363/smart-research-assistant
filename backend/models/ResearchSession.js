const mongoose = require('mongoose');

const researchSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    trim: true,
    maxlength: 200
  },
  question: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'in-progress'],
    default: 'pending'
  },
  result: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  // Enhanced chat history storage
  chatHistory: [{
    id: {
      type: Number,
      required: true
    },
    type: {
      type: String,
      enum: ['user', 'bot', 'system'],
      required: true
    },
    content: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      required: true
    },
    hasReportOption: {
      type: Boolean,
      default: false
    }
  }],
  // Enhanced file storage with detailed metadata
  uploadedFiles: [{
    id: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      required: true
    },
    type: {
      type: String,
      required: true
    },
    lastModified: {
      type: Date
    },
    uploadDate: {
      type: Date,
      default: Date.now
    },
    // Additional file metadata
    originalName: String,
    mimeType: String,
    fileSize: Number
  }],
  // Last message summary for quick display
  lastMessage: {
    type: String,
    maxlength: 500
  },
  reportGenerated: {
    type: Boolean,
    default: false
  },
  reportFormat: {
    type: String,
    enum: ['pdf', 'word', 'markdown'],
    default: 'pdf'
  },
  metadata: {
    sources: [String],
    processingTime: Number,
    tokensUsed: Number,
    creditsUsed: {
      type: Number,
      default: 1
    },
    category: {
      type: String,
      enum: ['research', 'analysis', 'summary', 'comparison', 'other'],
      default: 'research'
    },
    // Track conversation metrics
    messageCount: {
      type: Number,
      default: 0
    },
    fileCount: {
      type: Number,
      default: 0
    }
  },
  // Legacy files field for backward compatibility
  files: [{
    originalName: String,
    fileName: String,
    fileSize: Number,
    mimeType: String,
    uploadDate: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

const ResearchSession = mongoose.model('ResearchSession', researchSessionSchema);

module.exports = ResearchSession;