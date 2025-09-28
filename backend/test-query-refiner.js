const QueryRefiner = require('./services/QueryRefiner');

async function testQueryRefiner() {
  console.log('🧪 Testing QueryRefiner...');
  
  try {
    const queryRefiner = new QueryRefiner();
    
    // Test data
    const testUserId = 'test-user-123';
    const testSessionId = 'test-session-456';
    const testQuery = 'What are the benefits of renewable energy?';
    
    console.log('\n🔍 Testing query refinement...');
    console.log(`📝 Original query: "${testQuery}"`);
    
    // Get or create thread ID for this session
    const threadId = queryRefiner.getQueryRefinerThreadIdForSession(testUserId, testSessionId);
    console.log(`🧵 Using thread ID: ${threadId}`);
    
    // Test query refinement
    const refinementResult = await queryRefiner.refineQuery(
      testQuery,
      testUserId,
      testSessionId,
      threadId
    );
    
    console.log('\n✅ Query refinement result:');
    console.log('📊 Refined query:', refinementResult.refined);
    console.log('🔍 Search terms:', refinementResult.searchTerms);
    console.log('🎯 Intent:', refinementResult.intent);
    console.log('🔧 Confidence:', refinementResult.confidence);
    
    // Test another query to see conversation context
    console.log('\n🔄 Testing follow-up query...');
    const followUpQuery = 'How do solar panels work?';
    console.log(`📝 Follow-up query: "${followUpQuery}"`);
    
    const followUpResult = await queryRefiner.refineQuery(
      followUpQuery,
      testUserId,
      testSessionId,
      threadId
    );
    
    console.log('\n✅ Follow-up refinement result:');
    console.log('📊 Refined query:', followUpResult.refined);
    console.log('🔍 Search terms:', followUpResult.searchTerms);
    console.log('🎯 Intent:', followUpResult.intent);
    console.log('🔧 Confidence:', followUpResult.confidence);
    
    console.log('\n🎉 QueryRefiner test completed successfully!');
    
  } catch (error) {
    console.error('❌ QueryRefiner test failed:', error.message);
    console.error('📋 Full error:', error);
    
    // Check for specific Azure OpenAI errors
    if (error.message.includes('404') || error.message.includes('Resource not found')) {
      console.error('\n💡 Azure OpenAI Configuration Issues:');
      console.error('   - Check AZURE_OPENAI_DEPLOYMENT_NAME is correct for chat completions');
      console.error('   - Verify AZURE_OPENAI_BASE_URL format');
      console.error('   - Ensure API version is supported by your deployment');
      console.error(`   - Current deployment: ${process.env.AZURE_OPENAI_DEPLOYMENT_NAME}`);
      console.error(`   - Current base URL: ${process.env.AZURE_OPENAI_BASE_URL}`);
    }
  }
}

// Run the test
testQueryRefiner();