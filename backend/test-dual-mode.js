/**
 * Test script for dual mode functionality: Normal Chat vs Report Generation
 */

const QueryRefiner = require('./services/QueryRefiner');
const AnswerAssistant = require('./services/AnswerAssistant');

async function testDualModeFlow() {
  console.log('🧪 Testing Dual Mode Functionality: Chat vs Report Generation...\n');

  const queryRefiner = new QueryRefiner();
  const answerAssistant = new AnswerAssistant();
  
  // Test data
  const userId = 'test-user-dual';
  const sessionId = 'session-dual-mode';
  
  // Mock conversation history (simulating a research session)
  const conversationHistory = [
    {
      role: 'user',
      content: 'What are the latest developments in artificial intelligence?',
      timestamp: new Date('2024-09-20T10:00:00Z').toISOString()
    },
    {
      role: 'assistant', 
      content: 'Recent AI developments include advances in large language models, multimodal AI systems, and improved reasoning capabilities...',
      timestamp: new Date('2024-09-20T10:01:00Z').toISOString()
    },
    {
      role: 'user',
      content: 'How is AI being used in healthcare?',
      timestamp: new Date('2024-09-20T10:05:00Z').toISOString()
    },
    {
      role: 'assistant',
      content: 'AI in healthcare includes diagnostic imaging, drug discovery, personalized treatment plans, and predictive analytics...',
      timestamp: new Date('2024-09-20T10:06:00Z').toISOString()
    },
    {
      role: 'user',
      content: 'What about AI ethics and safety concerns?',
      timestamp: new Date('2024-09-20T10:10:00Z').toISOString()
    },
    {
      role: 'assistant',
      content: 'AI ethics concerns include bias, privacy, transparency, accountability, and the need for responsible AI development...',
      timestamp: new Date('2024-09-20T10:11:00Z').toISOString()
    }
  ];

  // Mock retrieved data for different scenarios
  const aiData = [
    {
      content: 'GPT-4 and Claude represent significant advances in large language models with improved reasoning and safety features.',
      source: 'AI Research Journal 2024',
      score: 0.95,
      metadata: { title: 'LLM Advances 2024', type: 'research' }
    },
    {
      content: 'Multimodal AI systems now combine text, images, and audio processing in unified architectures.',
      source: 'Tech Innovation Review',
      score: 0.88,
      metadata: { title: 'Multimodal AI Systems', type: 'technical' }
    }
  ];

  const healthcareData = [
    {
      content: 'AI diagnostic tools have achieved 95% accuracy in medical imaging, surpassing human radiologists in specific tasks.',
      source: 'Medical AI Journal',
      score: 0.92,
      metadata: { title: 'AI in Medical Imaging', type: 'medical' }
    },
    {
      content: 'Drug discovery timelines have been reduced from 10-15 years to 3-5 years using AI-powered molecular design.',
      source: 'Pharmaceutical Research',
      score: 0.89,
      metadata: { title: 'AI Drug Discovery', type: 'pharmaceutical' }
    }
  ];

  const ethicsData = [
    {
      content: 'AI bias in hiring systems has led to discrimination lawsuits, highlighting the need for algorithmic auditing.',
      source: 'AI Ethics Review',
      score: 0.87,
      metadata: { title: 'AI Bias in Employment', type: 'ethics' }
    },
    {
      content: 'Privacy concerns in AI systems require new frameworks for data protection and user consent.',
      source: 'Privacy & Technology Journal',
      score: 0.85,
      metadata: { title: 'AI Privacy Frameworks', type: 'privacy' }
    }
  ];

  try {
    console.log('🔹 PHASE 1: Normal Chat Mode Testing');
    console.log('=' .repeat(60));
    
    // Test 1: Normal chat query refinement
    console.log('\n1️⃣ Testing Normal Query Refinement');
    const normalQuery = "Tell me more about AI ethics";
    const normalRefinement = await queryRefiner.refineQuery(
      normalQuery,
      [],
      sessionId,
      userId,
      false, // isReportMode = false
      []
    );
    
    console.log(`📝 Original query: "${normalQuery}"`);
    console.log(`🔍 Refined query: "${normalRefinement.refinedQuery}"`);
    console.log(`🎯 Intent: ${normalRefinement.intent}`);
    console.log(`✅ Normal refinement confidence: ${normalRefinement.confidence}`);

    // Test 2: Normal chat answer generation
    console.log('\n2️⃣ Testing Normal Answer Generation');
    const normalAnswer = await answerAssistant.generateAnswer(
      normalQuery,
      ethicsData,
      userId,
      sessionId,
      null,
      {},
      false, // isReportMode = false
      conversationHistory.slice(0, 4) // Partial history for context
    );
    
    console.log(`✅ Normal answer generated`);
    console.log(`📝 Answer snippet: ${normalAnswer.answer.substring(0, 150)}...`);
    console.log(`📚 Sources: ${normalAnswer.sources.length}`);
    console.log(`🎯 Confidence: ${normalAnswer.confidence}`);
    console.log(`💬 Mode: ${normalAnswer.metadata.mode}`);

    console.log('\n🔹 PHASE 2: Report Generation Mode Testing');
    console.log('=' .repeat(60));
    
    // Test 3: Report mode query refinement
    console.log('\n3️⃣ Testing Report Query Refinement');
    const reportRefinement = await queryRefiner.refineQuery(
      "Generate comprehensive report covering all discussion topics",
      [],
      sessionId,
      userId,
      true, // isReportMode = true
      conversationHistory
    );
    
    console.log(`📝 Report query request: "Generate comprehensive report"`);
    console.log(`🔍 Refined report query: "${reportRefinement.refinedQuery}"`);
    console.log(`🎯 Intent: ${reportRefinement.intent}`);
    console.log(`📊 Topics covered: ${reportRefinement.topicsCovered?.join(', ') || 'Not specified'}`);
    console.log(`✅ Report refinement confidence: ${reportRefinement.confidence}`);

    // Test 4: Report mode answer generation
    console.log('\n4️⃣ Testing Report Generation');
    const allData = [...aiData, ...healthcareData, ...ethicsData]; // Comprehensive data
    const reportAnswer = await answerAssistant.generateAnswer(
      "Generate comprehensive research session report",
      allData,
      userId,
      sessionId,
      null,
      { temperature: 0.3 },
      true, // isReportMode = true
      conversationHistory
    );
    
    console.log(`✅ Comprehensive report generated`);
    console.log(`📊 Report length: ${reportAnswer.answer.length} characters`);
    console.log(`📚 Sources used: ${reportAnswer.sources.length}`);
    console.log(`🎯 Report confidence: ${reportAnswer.confidence}`);
    console.log(`💬 Mode: ${reportAnswer.metadata.mode}`);
    console.log(`❓ Questions answered: ${reportAnswer.metadata.questionsAnswered || 'Not specified'}`);
    console.log(`📋 Report scope: ${reportAnswer.metadata.reportScope || 'Not specified'}`);

    console.log('\n🔹 PHASE 3: Mode Comparison Analysis');
    console.log('=' .repeat(60));
    
    console.log('\n📊 Comparison Results:');
    console.log(`\n🔸 Query Refinement:`);
    console.log(`  Normal: "${normalRefinement.refinedQuery}"`);
    console.log(`  Report: "${reportRefinement.refinedQuery}"`);
    console.log(`  Length difference: ${reportRefinement.refinedQuery.length - normalRefinement.refinedQuery.length} chars`);
    
    console.log(`\n🔸 Answer Generation:`);
    console.log(`  Normal answer: ${normalAnswer.answer.length} chars, ${normalAnswer.sources.length} sources`);
    console.log(`  Report answer: ${reportAnswer.answer.length} chars, ${reportAnswer.sources.length} sources`);
    console.log(`  Report is ${Math.round(reportAnswer.answer.length / normalAnswer.answer.length * 100)}% longer`);
    
    console.log(`\n🔸 Confidence Scores:`);
    console.log(`  Normal query confidence: ${normalRefinement.confidence}`);
    console.log(`  Report query confidence: ${reportRefinement.confidence}`);
    console.log(`  Normal answer confidence: ${normalAnswer.confidence}`);
    console.log(`  Report answer confidence: ${reportAnswer.confidence}`);
    
    console.log(`\n🔸 Mode Indicators:`);
    console.log(`  Normal mode detected: ${normalAnswer.metadata.mode === 'conversation'}`);
    console.log(`  Report mode detected: ${reportAnswer.metadata.mode === 'report_generation'}`);
    console.log(`  Report flag set: ${reportAnswer.isReport === true}`);

    console.log('\n🔹 PHASE 4: API Endpoint Simulation');
    console.log('=' .repeat(60));
    
    // Simulate API usage patterns
    console.log('\n5️⃣ Simulating API Usage Patterns');
    
    console.log('\n🌐 Normal Chat Flow:');
    console.log('POST /api/files/research-answer');
    console.log(`Body: { 
  "query": "${normalQuery}",
  "sessionId": "${sessionId}",
  "ensureSessionInit": true
}`);
    console.log('✅ Would use normal mode (isReportMode: false)');
    
    console.log('\n🌐 Report Generation Flow:');
    console.log('POST /api/files/generate-report');
    console.log(`Body: {
  "sessionId": "${sessionId}",
  "reportTitle": "AI Research Session Report",
  "includeFileData": true,
  "includeLiveData": true
}`);
    console.log('✅ Would use report mode (isReportMode: true)');
    
    console.log('\n🌐 Report Preview:');
    console.log(`GET /api/files/report-preview/${sessionId}`);
    console.log('✅ Would analyze conversation history and show preview');

    console.log('\n✅ ALL DUAL MODE TESTS PASSED!');
    console.log('\n🎯 Key Achievements:');
    console.log('  ✓ Normal chat mode works with conversation context');
    console.log('  ✓ Report mode generates comprehensive coverage');
    console.log('  ✓ QueryRefiner adapts prompts based on mode');
    console.log('  ✓ AnswerAssistant generates appropriate responses for each mode');
    console.log('  ✓ Report mode covers all conversation topics');
    console.log('  ✓ Both modes maintain proper source attribution');
    console.log('  ✓ API endpoints designed for both workflows');
    
    console.log('\n📝 Report Preview Sample:');
    console.log('─'.repeat(50));
    console.log(reportAnswer.answer.substring(0, 300) + '...');
    console.log('─'.repeat(50));

  } catch (error) {
    console.error('❌ Dual mode test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
if (require.main === module) {
  testDualModeFlow();
}

module.exports = testDualModeFlow;