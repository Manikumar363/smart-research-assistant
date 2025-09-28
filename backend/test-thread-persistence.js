#!/usr/bin/env node

/**
 * Test script for thread persistence functionality
 * Tests the complete workflow of thread creation, persistence, and retrieval
 */

require('dotenv').config();
const mongoose = require('mongoose');
const LLMManager = require('./services/LLMManager');
const QueryRefiner = require('./services/QueryRefiner');

// Test configuration
const TEST_USER_ID = '507f1f77bcf86cd799439011'; // Example MongoDB ObjectId
const TEST_SESSION_ID_1 = '507f1f77bcf86cd799439012';
const TEST_SESSION_ID_2 = '507f1f77bcf86cd799439013';

async function connectDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/research_assistant');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
}

async function testThreadPersistence() {
  console.log('\n🧪 Testing Thread Persistence Functionality\n');
  
  const llmManager = new LLMManager();
  const queryRefiner = new QueryRefiner();

  try {
    // Test 1: Create threads for different sessions
    console.log('📝 Test 1: Creating threads for multiple sessions');
    
    const thread1Info = await llmManager.getOrCreateThread(TEST_SESSION_ID_1, TEST_USER_ID);
    console.log(`   Session 1 Thread: ${thread1Info.threadId}`);
    
    const thread2Info = await llmManager.getOrCreateThread(TEST_SESSION_ID_2, TEST_USER_ID);
    console.log(`   Session 2 Thread: ${thread2Info.threadId}`);

    // Test 2: Send messages to create conversation history
    console.log('\n📝 Test 2: Creating conversation history');
    
    await llmManager.sendMessage(TEST_SESSION_ID_1, 'Hello, this is my first message in session 1', 'You are a helpful assistant.', TEST_USER_ID);
    console.log('   ✅ Message sent to session 1');
    
    await llmManager.sendMessage(TEST_SESSION_ID_2, 'Hello, this is my first message in session 2', 'You are a helpful assistant.', TEST_USER_ID);
    console.log('   ✅ Message sent to session 2');

    // Test 3: Retrieve user threads
    console.log('\n📝 Test 3: Retrieving user threads');
    
    const userThreads = await llmManager.getUserThreads(TEST_USER_ID);
    console.log(`   Found ${userThreads.length} threads for user:`);
    userThreads.forEach(thread => {
      console.log(`   - Session: ${thread.sessionId}, Thread: ${thread.threadId}, Status: ${thread.status}`);
    });

    // Test 4: Test thread info retrieval
    console.log('\n📝 Test 4: Testing thread info retrieval');
    
    const session1Info = llmManager.getThreadInfo(TEST_SESSION_ID_1);
    console.log(`   Session 1 Info:`, session1Info);
    
    const session2Info = llmManager.getThreadInfo(TEST_SESSION_ID_2);
    console.log(`   Session 2 Info:`, session2Info);

    // Test 5: Test QueryRefiner integration
    console.log('\n📝 Test 5: Testing QueryRefiner integration');
    
    const refinementResult = await queryRefiner.refineQuery(
      'What are the main topics we discussed?',
      [],
      TEST_SESSION_ID_1,
      TEST_USER_ID
    );
    console.log(`   Refined query: "${refinementResult.refined}"`);
    console.log(`   Thread ID: ${refinementResult.threadId}`);
    console.log(`   Conversation turn: ${refinementResult.conversationTurn}`);

    // Test 6: Test user thread loading (simulating login)
    console.log('\n📝 Test 6: Testing user thread loading on login');
    
    // Clear cache first to simulate fresh login
    llmManager.threadCache.clear();
    console.log('   🧹 Cleared thread cache (simulating fresh login)');
    
    const loadedThreads = await queryRefiner.loadUserThreadsOnLogin(TEST_USER_ID);
    console.log(`   Loaded ${loadedThreads.length} threads into cache:`);
    loadedThreads.forEach(thread => {
      console.log(`   - Session: ${thread.sessionId}, Thread: ${thread.threadId}`);
    });

    // Test 7: Verify cache is populated
    console.log('\n📝 Test 7: Verifying cache population');
    
    const cachedInfo1 = llmManager.getThreadInfo(TEST_SESSION_ID_1);
    const cachedInfo2 = llmManager.getThreadInfo(TEST_SESSION_ID_2);
    
    console.log(`   Session 1 cached: ${cachedInfo1.hasThread ? '✅' : '❌'}`);
    console.log(`   Session 2 cached: ${cachedInfo2.hasThread ? '✅' : '❌'}`);

    // Test 8: Test session cleanup
    console.log('\n📝 Test 8: Testing session cleanup');
    
    const cleanupSuccess = await queryRefiner.cleanupSessionThread(TEST_SESSION_ID_1, TEST_USER_ID);
    console.log(`   Session 1 cleanup: ${cleanupSuccess ? '✅' : '❌'}`);
    
    const remainingThreads = await queryRefiner.getUserThreads(TEST_USER_ID);
    console.log(`   Remaining threads: ${remainingThreads.length} (should be 1)`);

    console.log('\n🎉 All thread persistence tests completed successfully!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

async function cleanup() {
  try {
    // Clean up test data
    const ConversationThread = require('./models/ConversationThread');
    await ConversationThread.deleteMany({
      userId: TEST_USER_ID,
      sessionId: { $in: [TEST_SESSION_ID_1, TEST_SESSION_ID_2] }
    });
    console.log('\n🧹 Cleaned up test data');
  } catch (error) {
    console.warn('⚠️ Cleanup warning:', error.message);
  }
}

async function main() {
  try {
    await connectDatabase();
    await testThreadPersistence();
    await cleanup();
  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('👋 Disconnected from database');
    process.exit(0);
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n🛑 Test interrupted');
  await cleanup();
  await mongoose.connection.close();
  process.exit(0);
});

if (require.main === module) {
  main();
}

module.exports = { testThreadPersistence };