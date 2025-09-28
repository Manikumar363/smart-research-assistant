const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const filesRoutes = require('./routes/files'); // Now using full Pinecone version
const simpleSourcesRouter = require('./routes/simple-sources'); // Simple API sources
const pathwayRouter = require('./routes/pathway'); // Pathway integration
const { connectDB, getClientURL } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: (process.env.RATE_LIMIT_WINDOW || 15) * 60 * 1000, // 15 minutes default
  max: process.env.RATE_LIMIT_MAX_REQUESTS || 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// CORS configuration - Allow all origins for easier development
const corsOptions = {
  origin: true, // Allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: process.env.MAX_FILE_SIZE || '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Initialize database
connectDB();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/files', filesRoutes); // Now using simple version
app.use('/api/simple-sources', simpleSourcesRouter); // Simple API sources
app.use('/api/pathway', pathwayRouter); // Pathway integration

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Research Assistant API is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 Research Assistant API server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Client URL: ${getClientURL()}`);
  
  // Start periodic thread cleanup (runs every 6 hours)
  if (process.env.NODE_ENV !== 'test') {
    const QueryRefiner = require('./services/QueryRefiner');
    const queryRefiner = new QueryRefiner();
    
    const cleanupInterval = 6 * 60 * 60 * 1000; // 6 hours
    setInterval(async () => {
      try {
        console.log('🧹 Running periodic thread cleanup...');
        const cleanedCount = await queryRefiner.cleanupOldThreads();
        console.log(`✅ Cleaned up ${cleanedCount} old threads`);
      } catch (error) {
        console.error('❌ Periodic thread cleanup failed:', error.message);
      }
    }, cleanupInterval);
    
    console.log(`🧹 Periodic thread cleanup scheduled every ${cleanupInterval / (60 * 60 * 1000)} hours`);
  }
});