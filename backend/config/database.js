const mongoose = require('mongoose');

// Get MongoDB URI - same for both development and production
const getMongoURI = () => {
  const uri = process.env.MONGODB_URI;
  
  if (!uri) {
    throw new Error('MongoDB URI not found. Please set MONGODB_URI in your environment variables.');
  }
  
  return uri;
};

// Get client URL based on environment
const getClientURL = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  return isProduction ? process.env.CLIENT_URL_PROD : process.env.CLIENT_URL_DEV;
};

// MongoDB connection options
const mongooseOptions = {
  maxPoolSize: 10, // Maintain up to 10 socket connections
  serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
  socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
};

let isConnected = false;

const connectDB = async () => {
  if (isConnected) {
    console.log('📁 Already connected to MongoDB');
    return;
  }

  try {
    const mongoURI = getMongoURI();
    console.log(`🔗 Connecting to MongoDB (${process.env.NODE_ENV || 'development'})...`);
    
    await mongoose.connect(mongoURI, mongooseOptions);
    
    isConnected = true;
    console.log('📁 Successfully connected to MongoDB Atlas');
    console.log(`📊 Database: ${mongoose.connection.name}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🖥️ Client URL: ${getClientURL()}`);
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
      isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ MongoDB disconnected');
      isConnected = false;
    });

    mongoose.connection.on('reconnected', () => {
      console.log('🔄 MongoDB reconnected');
      isConnected = true;
    });

    // Handle process termination
    process.on('SIGINT', async () => {
      try {
        await mongoose.connection.close();
        console.log('📁 MongoDB connection closed through app termination');
        process.exit(0);
      } catch (err) {
        console.error('❌ Error closing MongoDB connection:', err);
        process.exit(1);
      }
    });

  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error.message);
    console.log('💡 Please check your MongoDB connection string in the environment variables');
    
    // In development, provide helpful error messages
    if (process.env.NODE_ENV !== 'production') {
      console.log('\n🛠️ Development Help:');
      console.log('- Check your MONGODB_URI in .env file');
      console.log('- Ensure your MongoDB Atlas cluster is running');
      console.log('- Verify your network access settings in MongoDB Atlas');
    }
    
    process.exit(1);
  }
};

const disconnectDB = async () => {
  try {
    await mongoose.connection.close();
    isConnected = false;
    console.log('📁 MongoDB connection closed');
  } catch (error) {
    console.error('❌ Error closing MongoDB connection:', error);
  }
};

// Get connection status
const getConnectionStatus = () => {
  return {
    isConnected,
    readyState: mongoose.connection.readyState,
    host: mongoose.connection.host,
    port: mongoose.connection.port,
    name: mongoose.connection.name
  };
};

module.exports = {
  connectDB,
  disconnectDB,
  getConnectionStatus,
  getClientURL,
  mongoose
};