const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

const seedDemoUser = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check if demo user already exists
    const existingUser = await User.findByEmail('demo@research.ai');
    
    if (existingUser) {
      console.log('Demo user already exists');
      return;
    }

    // Create demo user
    const demoUser = new User({
      username: 'demo_user',
      name: 'Demo User',
      email: 'demo@research.ai',
      password: 'demo123', // This will be hashed automatically by the pre-save hook
      firstName: 'Demo',
      lastName: 'User',
      plan: 'premium', // Give demo user premium access
      credits: 1000, // Extra credits for demo
      isActive: true,
      statistics: {
        totalQuestions: 25,
        totalReports: 8,
        totalSessions: 25,
        creditsUsed: 45,
        lastActivityDate: new Date()
      },
      preferences: {
        language: 'en',
        theme: 'auto',
        emailNotifications: true,
        reportFormat: 'pdf'
      }
    });

    await demoUser.save();
    console.log('✅ Demo user created successfully');
    console.log('📧 Email: demo@research.ai');
    console.log('🔑 Password: demo123');
    
  } catch (error) {
    console.error('❌ Error creating demo user:', error);
  } finally {
    await mongoose.connection.close();
    console.log('📁 Database connection closed');
  }
};

// Run the seeder
seedDemoUser();