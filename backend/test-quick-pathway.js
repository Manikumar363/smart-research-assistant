// Quick test of Pathway endpoints
const axios = require('axios');

const BASE_URL = 'http://localhost:5001';

async function testPathwayEndpoints() {
    console.log('🧪 Testing Pathway Integration Endpoints...\n');

    try {
        // Test 1: Status endpoint
        console.log('1️⃣ Testing Pathway Status endpoint...');
        const statusResponse = await axios.get(`${BASE_URL}/api/pathway/status`);
        console.log('✅ Status endpoint working:', statusResponse.data);
        console.log('');

        // Test 2: Configuration endpoint
        console.log('2️⃣ Testing Pathway Configuration endpoint...');
        const configData = {
            apiKey: 'test-api-key',
            interval: 30,
            cities: ['New York', 'London']
        };
        const configResponse = await axios.post(`${BASE_URL}/api/pathway/configure`, configData);
        console.log('✅ Configuration endpoint working:', configResponse.data);
        console.log('');

        // Test 3: Sample weather data ingestion
        console.log('3️⃣ Testing Pathway Ingestion endpoint...');
        const sampleWeatherData = {
            city: 'Test City',
            temperature: 25,
            description: 'Clear sky',
            humidity: 60,
            windSpeed: 5.2,
            timestamp: new Date().toISOString(),
            source: 'pathway-test'
        };
        
        const ingestResponse = await axios.post(`${BASE_URL}/api/pathway/ingest`, {
            data: sampleWeatherData,
            type: 'weather'
        });
        console.log('✅ Ingestion endpoint working:', ingestResponse.data);
        console.log('');

        console.log('🎉 All Pathway endpoints are working correctly!');

    } catch (error) {
        console.error('❌ Error testing endpoints:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
    }
}

// Run the test
testPathwayEndpoints();