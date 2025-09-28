const axios = require('axios');

// Determine the correct port - try both 5000 and 5001
const POSSIBLE_PORTS = [5000, 5001];

async function findServerPort() {
  for (const port of POSSIBLE_PORTS) {
    try {
      await axios.get(`http://localhost:${port}/api/health`, { timeout: 2000 });
      console.log(`✅ Server found on port ${port}`);
      return port;
    } catch (error) {
      // Try next port
    }
  }
  throw new Error('❌ Server not found on any expected port (5000, 5001)');
}

async function testPathwayIntegration() {
  console.log('🧪 Testing Pathway Integration...');
  
  try {
    // Find the server port
    const serverPort = await findServerPort();
    const baseUrl = `http://localhost:${serverPort}`;
    
    // Test 1: Check if Pathway status endpoint works
    console.log('\n1️⃣ Testing Pathway status endpoint...');
    
    const statusResponse = await axios.get(`${baseUrl}/api/pathway/status`);
    console.log('✅ Status endpoint working!');
    console.log('📊 Status:', JSON.stringify(statusResponse.data, null, 2));
    
    // Test 2: Send mock weather data to Pathway ingestion endpoint
    console.log('\n2️⃣ Testing Pathway ingestion endpoint...');
    
    const mockWeatherData = [{
      id: `test_${Date.now()}`,
      city: 'Test City',
      country: 'TEST',
      coordinates: { lat: 40.7128, lon: -74.0060 },
      weather: {
        main: 'Clear',
        description: 'clear sky',
        icon: '01d'
      },
      temperature: {
        current: 22.5,
        feels_like: 24.0,
        min: 18.0,
        max: 26.0
      },
      pressure: 1013,
      humidity: 65,
      visibility: 10000,
      wind: {
        speed: 3.5,
        deg: 180
      },
      timestamp: new Date().toISOString(),
      source: 'pathway_test'
    }];
    
    const ingestPayload = {
      source_type: 'pathway_weather',
      timestamp: new Date().toISOString(),
      data_count: mockWeatherData.length,
      weather_data: mockWeatherData,
      user_id: 'test_user'
    };
    
    const ingestResponse = await axios.post(
      `${baseUrl}/api/pathway/ingest`,
      ingestPayload,
      { 
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    
    console.log('✅ Ingestion endpoint working!');
    console.log('📊 Ingestion result:', JSON.stringify(ingestResponse.data, null, 2));
    
    // Test 3: Check status again to see if data was processed
    console.log('\n3️⃣ Checking status after ingestion...');
    
    const statusAfter = await axios.get(`${baseUrl}/api/pathway/status`);
    console.log('📊 Updated status:', JSON.stringify(statusAfter.data, null, 2));
    
    console.log('\n✅ All Pathway integration tests passed!');
    console.log('🎉 Pathway integration is working correctly!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('❌ Response status:', error.response.status);
      console.error('❌ Response data:', error.response.data);
    }
    if (error.code === 'ECONNREFUSED') {
      console.error('💡 Make sure the backend server is running: npm start');
    }
  }
}

// Run the test
testPathwayIntegration();