/**
 * Test script for AnswerAssistant with session-thread mapping
 */

const AnswerAssistant = require('./services/AnswerAssistant');

async function testAnswerAssistant() {
  console.log('🧪 Testing AnswerAssistant with Session-Thread Mapping...\n');

  const answerAssistant = new AnswerAssistant();
  
  // Test data
  const userId = 'test-user-123';
  const sessionId = 'session-456';
  const originalQuery = 'What are the latest developments in AI technology?';
  
  // Mock retrieved data (simulating data from Pinecone/documents)
  const retrievedData = [
    {
      content: 'Recent advances in artificial intelligence have focused on large language models like GPT-4 and Claude, which demonstrate remarkable capabilities in natural language understanding and generation.',
      source: 'AI Research Paper 2024',
      score: 0.95,
      metadata: { title: 'AI Advances 2024', author: 'Tech Research Inc.' }
    },
    {
      content: 'Machine learning models are becoming more efficient with techniques like parameter pruning and knowledge distillation, making AI more accessible on edge devices.',
      source: 'Tech Magazine',
      score: 0.88,
      metadata: { title: 'Efficient AI Models', date: '2024-01-15' }
    },
    {
      content: 'The integration of AI in healthcare has shown promising results, with diagnostic accuracy improvements and drug discovery acceleration.',
      source: 'Medical AI Journal',
      score: 0.82,
      metadata: { title: 'AI in Healthcare', journal: 'Med AI Quarterly' }
    }
  ];

  try {
    console.log('🔹 Test 1: First answer generation (auto-creates thread)');
    const result1 = await answerAssistant.generateAnswer(
      originalQuery,
      retrievedData,
      userId,
      sessionId
      // No threadId provided - should auto-generate
    );

    console.log(`✅ Answer generated successfully!`);
    console.log(`🆔 Thread ID: ${result1.threadId}`);
    console.log(`🔗 Session mapping: ${result1.metadata.sessionThreadMapping}`);
    console.log(`📝 Answer snippet: ${result1.answer.substring(0, 100)}...`);
    console.log(`📚 Sources found: ${result1.sources.length}`);
    console.log(`🎯 Confidence: ${result1.confidence}\n`);

    console.log('🔹 Test 2: Follow-up question (uses existing thread)');
    const followUpQuery = 'Can you tell me more about the healthcare applications mentioned?';
    const result2 = await answerAssistant.generateAnswer(
      followUpQuery,
      retrievedData.filter(d => d.content.includes('healthcare')), // More focused data
      userId,
      sessionId
      // No threadId - should use existing thread from session mapping
    );

    console.log(`✅ Follow-up answer generated!`);
    console.log(`🆔 Thread ID: ${result2.threadId} (should match previous)`);
    console.log(`📝 Answer snippet: ${result2.answer.substring(0, 100)}...`);
    console.log(`🔗 Conversation length: ${result2.metadata.conversationLength}\n`);

    console.log('🔹 Test 3: Session-Thread Mapping Functions');
    
    // Test reverse lookup
    const sessionFromThread = answerAssistant.getSessionFromThreadId(userId, result1.threadId);
    console.log(`🔄 Reverse lookup - Thread ${result1.threadId} belongs to session: ${sessionFromThread}`);
    
    // Test getting all session threads
    const sessionThreads = answerAssistant.getSessionThreads(userId, sessionId);
    console.log(`📋 Session ${sessionId} has threads: ${sessionThreads.join(', ')}`);

    console.log('\n🔹 Test 4: Thread History');
    const history = answerAssistant.getThreadHistory(userId, sessionId, result1.threadId);
    console.log(`📚 Thread history length: ${history.length} messages`);
    history.forEach((msg, idx) => {
      console.log(`  ${idx + 1}. ${msg.role}: ${msg.content.substring(0, 50)}...`);
    });

    console.log('\n🔹 Test 5: Thread Cleanup');
    const cleared = answerAssistant.clearSessionThread(userId, sessionId);
    console.log(`🧹 Thread cleared: ${cleared}`);
    
    const historyAfterClear = answerAssistant.getThreadHistory(userId, sessionId, result1.threadId);
    console.log(`📚 Thread history after clear: ${historyAfterClear.length} messages`);

    console.log('\n✅ All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
if (require.main === module) {
  testAnswerAssistant();
}

module.exports = testAnswerAssistant;