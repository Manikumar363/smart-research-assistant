/**
 * Simple test for LiveSourceIngester without Express routes
 */

const LiveSourceIngester = require('./services/LiveSourceIngester');

async function testLiveSourceIngestion() {
  console.log('🧪 Testing Live Source Ingestion Module\n');

  // Initialize the ingester
  const liveIngester = new LiveSourceIngester();

  // 1. Add some test sources
  console.log('📡 Adding test sources...');
  
  // Add BBC Technology RSS feed
  const bbcSuccess = liveIngester.addSource({
    id: 'test_bbc_tech',
    name: 'BBC Technology News',
    url: 'http://feeds.bbci.co.uk/news/technology/rss.xml',
    type: 'rss',
    category: 'technology',
    enabled: true
  });

  // Add TechCrunch RSS feed
  const tcSuccess = liveIngester.addSource({
    id: 'test_techcrunch',
    name: 'TechCrunch',
    url: 'https://techcrunch.com/feed/',
    type: 'rss',
    category: 'technology',
    enabled: true
  });

  // Add Hacker News RSS feed
  const hnSuccess = liveIngester.addSource({
    id: 'test_hackernews',
    name: 'Hacker News Top Stories',
    url: 'https://hnrss.org/frontpage',
    type: 'rss',
    category: 'technology',
    enabled: true
  });

  console.log(`✅ Added sources: BBC(${bbcSuccess}), TC(${tcSuccess}), HN(${hnSuccess})\n`);

  // 2. List configured sources
  console.log('📋 Configured sources:');
  const sources = liveIngester.getSources();
  sources.forEach(source => {
    console.log(`  - ${source.name} (${source.type}) - ${source.enabled ? 'enabled' : 'disabled'}`);
    console.log(`    URL: ${source.url}`);
    console.log(`    Category: ${source.category}`);
    console.log('');
  });

  // 3. Test fetching from one source (BBC Tech)
  console.log('🔍 Testing RSS feed fetching...');
  try {
    const bbcSource = liveIngester.getSource('test_bbc_tech');
    if (bbcSource) {
      const items = await liveIngester.fetchRSSFeed(bbcSource);
      console.log(`📰 Fetched ${items.length} items from BBC Technology:`);
      
      items.slice(0, 3).forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.title}`);
        console.log(`     Published: ${item.publishedAt.toLocaleString()}`);
        console.log(`     Author: ${item.author}`);
        console.log(`     URL: ${item.url}`);
        console.log(`     Content preview: ${item.content.substring(0, 100)}...`);
        console.log('');
      });
    }
  } catch (error) {
    console.error('❌ Failed to fetch BBC RSS:', error.message);
  }

  // 4. Test TechCrunch RSS
  console.log('🔍 Testing TechCrunch RSS feed...');
  try {
    const tcSource = liveIngester.getSource('test_techcrunch');
    if (tcSource) {
      const items = await liveIngester.fetchRSSFeed(tcSource);
      console.log(`📰 Fetched ${items.length} items from TechCrunch:`);
      
      items.slice(0, 2).forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.title}`);
        console.log(`     Published: ${item.publishedAt.toLocaleString()}`);
        console.log(`     Author: ${item.author}`);
        console.log(`     Content preview: ${item.content.substring(0, 150)}...`);
        console.log('');
      });
    }
  } catch (error) {
    console.error('❌ Failed to fetch TechCrunch RSS:', error.message);
  }

  // 5. Test HTML content fetching (optional - if needed)
  console.log('🌐 Testing HTML source setup...');
  const htmlSuccess = liveIngester.addSource({
    id: 'test_custom_html',
    name: 'Custom HTML Source',
    url: 'https://example.com/news',
    type: 'html',
    category: 'general',
    enabled: false, // Disabled for testing
    selectors: {
      articleSelector: 'article',
      titleSelector: 'h1',
      contentSelector: '.content',
      linkSelector: 'a',
      dateSelector: '.date',
      authorSelector: '.author'
    }
  });
  console.log(`✅ Added HTML source: ${htmlSuccess}`);

  // 6. Show final source count
  console.log('\n📊 Summary:');
  const finalSources = liveIngester.getSources();
  const enabledCount = finalSources.filter(s => s.enabled).length;
  console.log(`  Total sources: ${finalSources.length}`);
  console.log(`  Enabled sources: ${enabledCount}`);
  console.log(`  Disabled sources: ${finalSources.length - enabledCount}`);

  console.log('\n🎉 Live Source Ingestion test completed!');
  console.log('\n💡 Next steps:');
  console.log('  1. Start the server: npm start');
  console.log('  2. Use the API endpoints to manage sources');
  console.log('  3. Test ingestion with: POST /api/live-sources/ingest-all');
  console.log('  4. Monitor with: GET /api/live-sources/status');
}

// Run the test
testLiveSourceIngestion().catch(console.error);