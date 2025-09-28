const SimpleWeatherIngester = require('./services/SimpleWeatherIngester');

async function testSimpleWeatherIngester() {
  console.log('🧪 Testing Simple Weather Ingester...');
  
  try {
    const ingester = new SimpleWeatherIngester();
    
    // Test 1: Get weather sources
    console.log('\n1️⃣ Testing getWeatherSources...');
    const sources = ingester.getWeatherSources();
    console.log(`✅ Found ${sources.length} weather sources:`, sources.map(s => s.name));
    
    // Test 2: Fetch weather data for all cities
    console.log('\n2️⃣ Testing fetchAllWeatherData...');
    const weatherData = await ingester.fetchAllWeatherData();
    console.log(`✅ Fetched weather data for ${weatherData.length} cities`);
    
    // Display sample data
    if (weatherData.length > 0) {
      const sample = weatherData[0];
      console.log('\n📄 Sample weather data:');
      console.log(`- Title: ${sample.title}`);
      console.log(`- Temperature: ${sample.metadata.temperature}°C`);
      console.log(`- Condition: ${sample.metadata.condition}`);
      console.log(`- Content length: ${sample.content.length} characters`);
    }
    
    console.log('\n✅ Simple Weather Ingester test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testSimpleWeatherIngester();